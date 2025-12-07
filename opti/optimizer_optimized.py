"""
Optimized Roster Optimizer for Supabase Integration
Implements all optimizations from req.md:
- Sparse variables (only eligible employee-shift pairs)
- Precomputed conflict pairs
- Per (employee, week) variables
- Centralized CONFIG
- Modular structure
"""

import pulp
import json
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

# ======================================================================
# CONFIGURATION - All tunable parameters in one place
# ======================================================================

CONFIG = {
    "HARD_CONSTRAINTS": {
        "MIN_REST_HOURS": 11,
        "MAX_SHIFT_DURATION_HOURS": 14,
        "MAX_CONSECUTIVE_SHIFTS": 5,
        "MAX_WORK_DAYS_PER_WEEK": 6,
        "QUAL_EXPIRY_THRESHOLD_DAYS": 90
    },
    "SOFT_PENALTIES": {
        "COVERAGE_WEIGHT": 1000,
        "CROSS_DEPT_PENALTY": 100,
        "FAIRNESS_PENALTY_PER_HOUR": 10,
        "OVERTIME_PENALTY_PER_HOUR": 50
    },
    "TARGETS": {
        "TARGET_HOURS_WEEK": 35
    },
    "SOLVER": {
        "USE_GUROBI": False,
        "TIME_LIMIT_SEC": 120,
        "MIP_GAP": 0.01,
        "GLPK_MSG": 0
    }
}

# Role -> Required Qualifications mapping
ROLE_QUAL_REQ = {
    "Agent_GR": ["Qual_DCS", "Qual_Ramp_Access"],
    "Security": ["Qual_Security_Clearance"],
    "Mechanic_B777": ["Qual_B777_Cert"],
}

# ======================================================================
# DATA LOADING FROM SUPABASE FORMAT
# ======================================================================

def load_data_from_supabase(employees_data: List[dict], shifts_data: List[dict]) -> Tuple:
    """
    Load data from Supabase query results.
    Expected format matches the current JSON structure.
    """
    employees = {}
    employee_quals = {}
    employee_absences = {}
    employee_anomalies = {}
    shifts = {}

    # Process employees
    for emp_data in employees_data:
        emp_id = emp_data['id']
        dept_id = emp_data.get('department_id', 'UNKNOWN')

        employees[emp_id] = {
            'role_id': dept_id,  # Using department as role for now
            'dept_id': dept_id,
            'max_hours_week': 40  # Default to 40 hours
        }

        # Qualifications - skipped for now as we don't have this data
        employee_quals[emp_id] = {}

        # Anomalies - skipped for now as we don't have this data
        # (This would come from employee_anomalies table)

        # Absences - skipped for now as we don't have this data
        # (This would come from absences table)

    # Process shifts
    for shift_data in shifts_data:
        shift_id = shift_data['id']
        try:
            # Handle timestamp format: 2025-12-01T09:00:00+00:00 or 2025-12-01 09:00:00
            start_str = shift_data['start_time']
            end_str = shift_data['end_time']

            # Try parsing with timezone first, then without
            try:
                start_time = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
                end_time = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            except:
                start_time = datetime.strptime(start_str, '%Y-%m-%d %H:%M:%S')
                end_time = datetime.strptime(end_str, '%Y-%m-%d %H:%M:%S')

            # Calculate duration in hours
            duration_hours = (end_time - start_time).total_seconds() / 3600
        except Exception as e:
            print(f"Error parsing shift {shift_id}: {e}")
            continue

        shifts[shift_id] = {
            'role_id': shift_data.get('required_role_id', 'UNKNOWN'),
            'duration_hours': duration_hours,
            'start_time': start_time,
            'end_time': end_time,
            'week_number': start_time.isocalendar()[1],
            'day_of_week': start_time.weekday(),
            'date_str': start_time.strftime('%Y-%m-%d')
        }

    return employees, shifts, employee_quals, employee_absences, employee_anomalies


# ======================================================================
# OPTIMIZED ROSTER OPTIMIZER CLASS
# ======================================================================

class RosterOptimizer:
    """
    Optimized MIP-based staff rostering with sparse variables and precomputation.
    """

    def __init__(self, employees, shifts, employee_quals, employee_absences,
                 employee_anomalies, name="RosterOptimizer"):
        self.employees = employees
        self.shifts = shifts
        self.employee_quals = employee_quals
        self.employee_absences = employee_absences
        self.employee_anomalies = employee_anomalies

        self.employee_ids = list(employees.keys())
        self.shift_ids = list(shifts.keys())

        # Weeks and dates
        self.weeks = sorted(list({s['week_number'] for s in shifts.values()}))
        self.unique_dates = sorted(list({s['date_str'] for s in shifts.values()}))

        # Precomputed structures (populated by _precompute)
        self.shifts_by_date = defaultdict(list)
        self.shifts_by_week = defaultdict(list)
        self.date_to_dt = {}
        self.overlap_pairs = []  # (j1, j2) pairs with rest conflicts
        self.employee_allowed_shifts = defaultdict(list)  # emp -> eligible shifts

        # Model
        self.model = pulp.LpProblem(name, pulp.LpMaximize)

        # Variables (created sparsely)
        self.assignment_vars = {}  # (emp, shift) -> binary var
        self.work_day_vars = {}    # (emp, date) -> binary var
        self.overtime_vars = {}    # (emp, week) -> continuous var
        self.dev_low_vars = {}     # (emp, week) -> continuous var (fairness)
        self.dev_high_vars = {}    # (emp, week) -> continuous var (fairness)

        # Run precomputation
        self._precompute()

        # Create sparse variables
        self._create_variables()

    # ======================================================================
    # PRECOMPUTATION - Massive performance improvement
    # ======================================================================

    def _precompute(self):
        """Precompute all heavy data structures to reduce solve time."""

        # Date string to datetime (parse once)
        self.date_to_dt = {d: datetime.strptime(d, "%Y-%m-%d") for d in self.unique_dates}

        # Group shifts by date and week
        for j, s in self.shifts.items():
            self.shifts_by_date[s['date_str']].append(j)
            self.shifts_by_week[s['week_number']].append(j)

        # Precompute overlapping shift pairs (rest conflicts)
        # This is O(S²) but only done ONCE, not O(E × S²)
        min_rest_td = timedelta(hours=CONFIG["HARD_CONSTRAINTS"]["MIN_REST_HOURS"])
        for j1, s1 in self.shifts.items():
            end1 = s1['end_time']
            for j2, s2 in self.shifts.items():
                if j1 == j2:
                    continue
                # Only store ordered pairs (j2 starts after j1)
                if s2['start_time'] > s1['start_time'] and s2['start_time'] < end1 + min_rest_td:
                    self.overlap_pairs.append((j1, j2))

        # Precompute eligible shifts for each employee
        for i in self.employee_ids:
            for j in self.shift_ids:
                if self._can_employee_take_shift(i, j):
                    self.employee_allowed_shifts[i].append(j)

    def _can_employee_take_shift(self, emp_id: str, shift_id: str) -> bool:
        """
        Check if employee is eligible for shift.
        Consolidates all eligibility logic in one place.

        SIMPLIFIED VERSION: For now, we allow any employee to take any shift
        until we have proper role and qualification data in the database.
        """
        shift = self.shifts[shift_id]
        emp = self.employees[emp_id]

        # Temporarily relaxed constraints:
        # - Skip role matching (would need employee_roles table)
        # - Skip qualification checks (would need employee_qualifications table)
        # - Skip absence checks (would need absences table properly linked)
        # - Skip anomaly checks (would need employee_anomalies table)

        # Only enforce basic shift duration constraint
        if shift['duration_hours'] > CONFIG["HARD_CONSTRAINTS"]["MAX_SHIFT_DURATION_HOURS"]:
            return False

        return True

    # ======================================================================
    # SPARSE VARIABLE CREATION - Only create what's needed
    # ======================================================================

    def _create_variables(self):
        """Create variables only for eligible (employee, shift) pairs."""

        # Assignment variables (sparse)
        for i in self.employee_ids:
            for j in self.employee_allowed_shifts[i]:
                self.assignment_vars[(i, j)] = pulp.LpVariable(
                    f"A_{i}_{j}", cat=pulp.LpBinary
                )

        # Work-day variables (only for dates with eligible shifts)
        for i in self.employee_ids:
            for date_str, jlist in self.shifts_by_date.items():
                eligible_j = [j for j in jlist if (i, j) in self.assignment_vars]
                if eligible_j:
                    self.work_day_vars[(i, date_str)] = pulp.LpVariable(
                        f"W_{i}_{date_str}", cat=pulp.LpBinary
                    )

        # Per (employee, week) variables for overtime and fairness
        for i in self.employee_ids:
            for week in self.weeks:
                self.overtime_vars[(i, week)] = pulp.LpVariable(
                    f"OT_{i}_W{week}", lowBound=0
                )
                self.dev_low_vars[(i, week)] = pulp.LpVariable(
                    f"DEVL_{i}_W{week}", lowBound=0
                )
                self.dev_high_vars[(i, week)] = pulp.LpVariable(
                    f"DEVH_{i}_W{week}", lowBound=0
                )

    # ======================================================================
    # OBJECTIVE FUNCTION
    # ======================================================================

    def define_objective_function(self):
        """Maximize coverage while minimizing penalties."""
        S = CONFIG["SOFT_PENALTIES"]

        # Coverage (sum of assignments)
        coverage = pulp.lpSum(self.assignment_vars[(i, j)] for (i, j) in self.assignment_vars)

        # Cross-department penalty
        cross_dept = pulp.lpSum(
            self.assignment_vars[(i, j)] * S["CROSS_DEPT_PENALTY"]
            for (i, j) in self.assignment_vars
            if self.employees[i]['role_id'] != self.shifts[j]['role_id']
        )

        # Fairness penalty (deviation from target hours)
        fairness = pulp.lpSum(
            (self.dev_low_vars[(i, w)] + self.dev_high_vars[(i, w)]) * S["FAIRNESS_PENALTY_PER_HOUR"]
            for i in self.employee_ids for w in self.weeks
        )

        # Overtime penalty
        overtime = pulp.lpSum(
            self.overtime_vars[(i, w)] * S["OVERTIME_PENALTY_PER_HOUR"]
            for i in self.employee_ids for w in self.weeks
        )

        self.model += (coverage * S["COVERAGE_WEIGHT"]) - cross_dept - fairness - overtime, "Objective"

    # ======================================================================
    # HARD CONSTRAINTS - Vectorized with precomputed data
    # ======================================================================

    def add_hard_constraints(self):
        """Add hard constraints using precomputed structures."""
        hc = CONFIG["HARD_CONSTRAINTS"]

        # 1. At most one employee per shift
        for j in self.shift_ids:
            vars_for_shift = [self.assignment_vars[(i, j)] for i in self.employee_ids
                            if (i, j) in self.assignment_vars]
            if vars_for_shift:
                self.model += pulp.lpSum(vars_for_shift) <= 1, f"Shift_{j}_MaxOne"

        # 2. Rest constraints (vectorized with precomputed pairs)
        for i in self.employee_ids:
            for (j1, j2) in self.overlap_pairs:
                if (i, j1) in self.assignment_vars and (i, j2) in self.assignment_vars:
                    self.model += (
                        self.assignment_vars[(i, j1)] + self.assignment_vars[(i, j2)] <= 1,
                        f"Rest_{i}_{j1}_{j2}"
                    )

        # 3. Link assignments to work-day variables
        for (i, date_str), wvar in self.work_day_vars.items():
            j_list = [j for j in self.shifts_by_date[date_str] if (i, j) in self.assignment_vars]
            if not j_list:
                continue

            assignments_sum = pulp.lpSum(self.assignment_vars[(i, j)] for j in j_list)
            M = len(j_list)  # Tight Big-M

            self.model += assignments_sum <= M * wvar, f"LinkUp_{i}_{date_str}"
            self.model += assignments_sum >= wvar, f"LinkDown_{i}_{date_str}"

        # 4. Max work days per week
        max_days = hc["MAX_WORK_DAYS_PER_WEEK"]
        for i in self.employee_ids:
            for w in self.weeks:
                dates_in_week = [d for d in self.unique_dates
                               if self.date_to_dt[d].isocalendar()[1] == w]
                workday_vars = [self.work_day_vars[(i, d)] for d in dates_in_week
                              if (i, d) in self.work_day_vars]
                if workday_vars:
                    self.model += pulp.lpSum(workday_vars) <= max_days, f"MaxDays_{i}_W{w}"

        # 5. Max consecutive shifts (sliding window)
        max_consec = hc["MAX_CONSECUTIVE_SHIFTS"]
        if len(self.unique_dates) >= max_consec + 1:
            for i in self.employee_ids:
                for start_idx in range(len(self.unique_dates) - max_consec):
                    window = self.unique_dates[start_idx:start_idx + max_consec + 1]
                    window_vars = [self.work_day_vars[(i, d)] for d in window
                                 if (i, d) in self.work_day_vars]
                    if window_vars:
                        self.model += pulp.lpSum(window_vars) <= max_consec, \
                                    f"Consec_{i}_{window[0]}"

    # ======================================================================
    # SOFT CONSTRAINTS
    # ======================================================================

    def add_soft_constraints(self):
        """Add overtime and fairness deviation constraints per (employee, week)."""
        target = CONFIG["TARGETS"]["TARGET_HOURS_WEEK"]

        for i in self.employee_ids:
            max_hours = self.employees[i]['max_hours_week']
            for w in self.weeks:
                shift_list = [j for j in self.shifts_by_week.get(w, [])
                            if (i, j) in self.assignment_vars]

                if not shift_list:
                    continue

                hours_assigned = pulp.lpSum(
                    self.assignment_vars[(i, j)] * self.shifts[j]['duration_hours']
                    for j in shift_list
                )

                # Overtime
                self.model += hours_assigned - max_hours <= self.overtime_vars[(i, w)], \
                            f"OT_{i}_W{w}"

                # Fairness deviation
                self.model += hours_assigned - target == \
                            self.dev_high_vars[(i, w)] - self.dev_low_vars[(i, w)], \
                            f"Fair_{i}_W{w}"

    # ======================================================================
    # SOLVE AND EXTRACT RESULTS
    # ======================================================================

    def solve(self) -> dict:
        """Build, solve, and return roster with statistics."""

        # Build model
        self.define_objective_function()
        self.add_hard_constraints()
        self.add_soft_constraints()

        print(f"Model: {len(self.employee_ids)} employees, {len(self.shift_ids)} shifts")
        print(f"Eligible assignments: {len(self.assignment_vars)}")
        print(f"Constraints: {len(self.model.constraints)}")

        # Solve
        solver_cfg = CONFIG["SOLVER"]
        if solver_cfg["USE_GUROBI"]:
            solver = pulp.GUROBI_CMD(msg=1, timeLimit=solver_cfg["TIME_LIMIT_SEC"])
        else:
            solver = pulp.GLPK_CMD(msg=solver_cfg["GLPK_MSG"])

        self.model.solve(solver)

        status = pulp.LpStatus.get(self.model.status, "Unknown")
        objective_value = pulp.value(self.model.objective) if status == 'Optimal' else None

        print(f"Status: {status}, Objective: {objective_value}")

        # Extract results
        roster_entries = []
        uncovered_shifts = []
        stats = {
            'total_hours': 0,
            'total_overtime': 0,
            'total_fairness_dev': 0
        }

        # Find uncovered shifts
        for j in self.shift_ids:
            assigned = any(
                pulp.value(self.assignment_vars[(i, j)]) and pulp.value(self.assignment_vars[(i, j)]) > 0.5
                for i in self.employee_ids if (i, j) in self.assignment_vars
            )
            if not assigned:
                uncovered_shifts.append(j)

        # Per-employee results
        for i in self.employee_ids:
            emp_shifts = []
            emp_hours = 0
            emp_ot = 0
            emp_fairness = 0

            for j in self.shift_ids:
                if (i, j) in self.assignment_vars:
                    val = pulp.value(self.assignment_vars[(i, j)])
                    if val and val > 0.5:
                        s = self.shifts[j]
                        emp_shifts.append({
                            'shift_id': j,
                            'role': s['role_id'],
                            'start_time': s['start_time'].isoformat(),
                            'duration_h': s['duration_hours']
                        })
                        emp_hours += s['duration_hours']

            # Sum overtime and fairness across weeks
            for w in self.weeks:
                ot_val = pulp.value(self.overtime_vars[(i, w)])
                if ot_val and ot_val > 0.01:
                    emp_ot += ot_val

                dl = pulp.value(self.dev_low_vars[(i, w)]) or 0
                dh = pulp.value(self.dev_high_vars[(i, w)]) or 0
                emp_fairness += (dl + dh)

            stats['total_hours'] += emp_hours
            stats['total_overtime'] += emp_ot
            stats['total_fairness_dev'] += emp_fairness

            roster_entries.append({
                'employee_id': i,
                'shifts_assigned': emp_shifts,
                'total_hours': emp_hours,
                'overtime_h': emp_ot,
                'fairness_deviation_h': emp_fairness
            })

        return {
            'status': status,
            'objective_value': objective_value,
            'roster': roster_entries,
            'uncovered_shifts': uncovered_shifts,
            'statistics': stats
        }


# ======================================================================
# SUPABASE INTEGRATION WRAPPER
# ======================================================================

def optimize_roster_from_supabase(employees_data: List[dict], shifts_data: List[dict]) -> dict:
    """
    Main entry point for Supabase integration.

    Args:
        employees_data: List of employee dicts from Supabase query
        shifts_data: List of shift requirement dicts from Supabase query

    Returns:
        dict with roster assignments and statistics
    """

    # Load data
    employees, shifts, employee_quals, employee_absences, employee_anomalies = \
        load_data_from_supabase(employees_data, shifts_data)

    # Optimize
    optimizer = RosterOptimizer(
        employees, shifts, employee_quals,
        employee_absences, employee_anomalies,
        name="SupabaseOptimization"
    )

    results = optimizer.solve()

    return results


# ======================================================================
# TESTING
# ======================================================================

if __name__ == '__main__':
    # Test with sample data
    sample_employees = [
        {
            "id": "emp_A01",
            "role": "Agent_GR",
            "max_hours_week": 40,
            "qualifications": [
                {"qual_id": "Qual_DCS", "expiry_date": "2026-06-01"},
                {"qual_id": "Qual_Ramp_Access", "expiry_date": "2026-06-01"}
            ]
        }
    ]

    sample_shifts = [
        {
            "id": "GR_S1",
            "role": "Agent_GR",
            "duration_hours": 10,
            "start_time": "2025-12-01 08:00:00"
        }
    ]

    result = optimize_roster_from_supabase(sample_employees, sample_shifts)
    print("\nResult:", json.dumps(result, indent=2, default=str))
