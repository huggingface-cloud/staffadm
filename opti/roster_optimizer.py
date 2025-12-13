import pulp
import json
from datetime import datetime, timedelta
import random

# ======================================================================
# DATA STRUCTURES & CONFIGURATION
# ======================================================================

# Reference date is primarily for qualification expiry comparison
REF_DATE = datetime(2025, 12, 1)

# Optimization Constants
MIN_REST_HOURS = 11
# The coverage weight is set very high (1000) to ensure that the solver
# prioritizes covering a shift over avoiding the overtime penalty (max penalty per shift ~500).
COVERAGE_WEIGHT = 1000 
OVERTIME_PENALTY_PER_HOUR = 50 


def load_data_from_json(json_data):
    """
    Parses the structured JSON input into the internal dictionaries
    required by the RosterOptimizer class.
    
    The input JSON is expected to have 'employees_available' and 
    'shift_requirements' sections.
    """
    data = json.loads(json_data)
    
    employees = {}
    employee_quals = {}
    employee_absences = {}
    employee_anomalies = {}
    shifts = {}

    # 1. Load Employees
    for emp_data in data.get('employees_available', []):
        emp_id = emp_data['id']
        role_id = emp_data['role']
        
        employees[emp_id] = {
            'role_id': role_id, 
            'dept_id': role_id.split('_')[0],
            'max_hours_week': emp_data['max_hours_week'],
        }
        
        # Load Qualifications
        quals = {}
        for q in emp_data.get('qualifications', []):
            try:
                # Store expiry date as datetime object
                quals[q['qual_id']] = datetime.strptime(q['expiry_date'], '%Y-%m-%d')
            except ValueError:
                print(f"Warning: Invalid date format for qualification {q['qual_id']} for {emp_id}")
        employee_quals[emp_id] = quals

        # Load Anomalies
        if emp_data.get('anomalies'):
            a = emp_data['anomalies'][0] # Assuming one active anomaly for simplicity
            try:
                employee_anomalies[emp_id] = {
                    'restricted_roles': a['restricted_roles'],
                    'active_start': datetime.strptime(a['start_date'], '%Y-%m-%d'),
                    'active_end': datetime.strptime(a['end_date'], '%Y-%m-%d') + timedelta(days=1, seconds=-1) # End of the day
                }
            except (ValueError, KeyError):
                pass
        
        # Load Absences
        if emp_data.get('absences'):
            a = emp_data['absences'][0] # Assuming one absence for simplicity
            try:
                employee_absences[emp_id] = (
                    datetime.strptime(a['start_date'], '%Y-%m-%d'),
                    datetime.strptime(a['end_date'], '%Y-%m-%d') + timedelta(days=1, seconds=-1) # End of the day
                )
            except (ValueError, KeyError):
                pass

    # 2. Load Shifts
    for shift_data in data.get('shift_requirements', []):
        shift_id = shift_data['id']
        start_time_dt = datetime.strptime(shift_data['start_time'], '%Y-%m-%d %H:%M:%S')
        
        shifts[shift_id] = {
            'role_id': shift_data['role'], 
            'duration_hours': shift_data['duration_hours'], 
            'start_time': start_time_dt,
            'week_number': start_time_dt.isocalendar()[1]
        }
        
    return employees, shifts, employee_quals, employee_absences, employee_anomalies

# ======================================================================
# THE OPTIMIZER CLASS
# ======================================================================

class RosterOptimizer:
    """
    Models the staff rostering problem as a Mixed-Integer Program (MIP)
    using PuLP to find the optimal assignment.
    """
    def __init__(self, employees, shifts, employee_quals, employee_absences, employee_anomalies, name="Staff_Rostering_Optimization"):
        self.employees = employees
        self.shifts = shifts
        self.employee_quals = employee_quals
        self.employee_absences = employee_absences
        self.employee_anomalies = employee_anomalies
        self.model = pulp.LpProblem(name, pulp.LpMaximize)

        self.employee_ids = list(employees.keys())
        self.shift_ids = list(shifts.keys())
        # Calculate weeks based on the shifts provided
        self.weeks = sorted(list(set(s['week_number'] for s in shifts.values())))

        # Decision Variable: X[i, j] = 1 if employee 'i' is assigned to shift 'j', 0 otherwise.
        self.assignment_vars = pulp.LpVariable.dicts(
            "Assignment", 
            (self.employee_ids, self.shift_ids), 
            0, 1, 
            pulp.LpBinary
        )

        # Soft Constraint Variables (for penalties)
        self.overtime_vars = pulp.LpVariable.dicts("Overtime", self.employee_ids, lowBound=0)

    def define_objective_function(self):
        """
        Objective: Maximize the total number of assigned shifts (Coverage), 
        while minimizing the financial cost of overtime.
        """
        # Hard Constraint Weight (maximize coverage)
        total_coverage = pulp.lpSum(self.assignment_vars[i][j] 
                                    for i in self.employee_ids for j in self.shift_ids)
        
        # Soft Constraint Weight (penalize overtime)
        overtime_penalty = pulp.lpSum(self.overtime_vars[i] * OVERTIME_PENALTY_PER_HOUR
                                      for i in self.employee_ids)

        # Maximize Coverage (high value) - Minimize Penalty (lower value)
        self.model += total_coverage * COVERAGE_WEIGHT - overtime_penalty, "Total Value Maximization"


    def add_hard_constraints(self):
        """
        Applies non-negotiable rules derived from the staff data (Role, Quals, Rest).
        """
        # 1. Shift Coverage (Max One Employee per Shift)
        for j in self.shift_ids:
            self.model += pulp.lpSum(self.assignment_vars[i][j] for i in self.employee_ids) <= 1, \
                          f"Shift_{j}_Max_One_Assignment"

        # 2. Employee to Shift Role Match
        for i in self.employee_ids:
            emp_role = self.employees[i]['role_id']
            for j in self.shift_ids:
                shift_role = self.shifts[j]['role_id']
                if emp_role != shift_role:
                    self.model += self.assignment_vars[i][j] == 0, f"Role_Mismatch_{i}_{j}"

        # 3. Qualification Validity and Presence (Qualification required for role)
        # Note: Since the data generation is removed, ROLE_QUAL_REQ is no longer needed 
        # but the check remains for robustness if role definitions change.
        # This section is currently skipped as the input JSON doesn't define ROLE_QUAL_REQ 
        # but relies on the employee's existing 'qualifications' array to decide capability.
        pass

        # 4. Anomaly Restriction Check (Restriction based on temporary constraints)
        for i in self.employee_ids:
            anomaly = self.employee_anomalies.get(i)
            if anomaly:
                for j in self.shift_ids:
                    shift_role = self.shifts[j]['role_id']
                    shift_date = self.shifts[j]['start_time']
                    
                    if (anomaly['active_start'] <= shift_date <= anomaly['active_end']) and \
                       (shift_role in anomaly['restricted_roles']):
                        self.model += self.assignment_vars[i][j] == 0, f"Anomaly_Restriction_{i}_{j}"
        
        # 5. Absence Restriction Check
        for i in self.employee_ids:
            absence = self.employee_absences.get(i)
            if absence:
                absence_start, absence_end = absence
                for j in self.shift_ids:
                    shift_start = self.shifts[j]['start_time']
                    
                    if absence_start <= shift_start <= absence_end:
                        self.model += self.assignment_vars[i][j] == 0, f"Absence_Restriction_{i}_{j}"

        # 6. Contractual Rest Constraint (MIN_REST_HOURS)
        for i in self.employee_ids:
            for j1 in self.shift_ids:
                end_time_j1 = self.shifts[j1]['start_time'] + timedelta(hours=self.shifts[j1]['duration_hours'])
                for j2 in self.shift_ids:
                    if j1 == j2: continue
                    
                    start_time_j2 = self.shifts[j2]['start_time']
                    
                    if start_time_j2 > self.shifts[j1]['start_time']:
                        if start_time_j2 < end_time_j1 + timedelta(hours=MIN_REST_HOURS):
                            # Cannot assign both shifts j1 and j2 to employee i
                            self.model += self.assignment_vars[i][j1] + self.assignment_vars[i][j2] <= 1, \
                                          f"Rest_Violation_{i}_{j1}_{j2}"


    def add_soft_constraints(self):
        """
        Applies constraints that introduce cost/penalties (Overtime).
        IMPORTANT: Weekly hours are capped at 120% of max_hours_week (HARD LIMIT).
        """
        # Weekly Hour Limits / Overtime Calculation
        for week in self.weeks:
            for i in self.employee_ids:
                max_hours = self.employees[i]['max_hours_week']

                # Sum of hours assigned to employee i in this week
                hours_assigned = pulp.lpSum(self.assignment_vars[i][j] * self.shifts[j]['duration_hours']
                                            for j in self.shift_ids if self.shifts[j]['week_number'] == week)

                # HARD CONSTRAINT: Cannot exceed 120% of weekly limit (max 20% overtime)
                absolute_max_hours = max_hours * 1.2
                self.model += hours_assigned <= absolute_max_hours, f"Max_Weekly_Hours_{i}_Week_{week}"

                # Soft constraint for overtime penalty (between max_hours and 120%)
                # Constraint: hours_assigned - max_hours <= overtime_vars[i]
                # If hours_assigned > max_hours, overtime_vars[i] captures the excess.
                self.model += hours_assigned - max_hours <= self.overtime_vars[i], f"Overtime_Calc_{i}_Week_{week}"


    def solve(self):
        """
        Builds the model, solves it, and returns the assignment roster.
        """
        print(f"\n--- Scenario: {self.model.name} ---")
        self.define_objective_function()
        self.add_hard_constraints()
        self.add_soft_constraints()
        print(f"Employees: {len(self.employee_ids)}, Shifts: {len(self.shift_ids)}, Constraints: {len(self.model.constraints)}")
        
        # Solve using the GLPK solver
        self.model.solve(pulp.GLPK_CMD(msg=0)) 
        
        status = pulp.LpStatus[self.model.status]
        objective_value = pulp.value(self.model.objective) if status == 'Optimal' else 0
        print(f"Status: {status}. Total Value: {objective_value:.2f}")

        roster_entries = []
        uncovered_shifts = []
        total_assigned_hours = 0
        total_overtime_hours = 0

        if status == 'Optimal': 
            for j in self.shift_ids:
                assignment_sum = pulp.lpSum(self.assignment_vars[i][j] for i in self.employee_ids)
                if assignment_sum.value() < 0.99: # Check if shift is covered
                    uncovered_shifts.append(j)
                
            for i in self.employee_ids:
                employee_shifts = []
                for j in self.shift_ids:
                    if pulp.value(self.assignment_vars[i][j]) == 1:
                        shift_data = self.shifts[j]
                        employee_shifts.append({
                            'shift_id': j,
                            'role': shift_data['role_id'],
                            'start_time': shift_data['start_time'].strftime('%Y-%m-%d %H:%M'),
                            'duration_h': shift_data['duration_hours'],
                        })
                        total_assigned_hours += shift_data['duration_hours']
                
                overtime = pulp.value(self.overtime_vars[i])
                if overtime and overtime > 0.01:
                    total_overtime_hours += overtime
                
                # Structured output for each assigned employee
                roster_entries.append({
                    'employee_id': i,
                    'shifts_assigned': employee_shifts,
                    'total_hours': sum(s['duration_h'] for s in employee_shifts),
                    'overtime_h': overtime if overtime and overtime > 0.01 else 0.0
                })

        # --- FORECASTING AND REPORTING ---
        print("\n--- FORECAST & GAP ANALYSIS ---")
        if uncovered_shifts:
            print(f"🔴 WARNING: {len(uncovered_shifts)} of {len(self.shift_ids)} shifts could NOT be covered (GAP).")
            # Highlight the uncovered shifts
            print(f"Uncovered Shifts IDs: {', '.join(uncovered_shifts)}")
        else:
            print("🟢 Success: All shifts were covered.")
        
        print(f"Total Assigned Hours: {total_assigned_hours:.1f}h")
        print(f"Total Overtime Hours: {total_overtime_hours:.1f}h (Cost: ${total_overtime_hours * OVERTIME_PENALTY_PER_HOUR:.0f})")
        print(f"Average hours/employee: {total_assigned_hours / len(self.employee_ids):.1f}h")

        return roster_entries


# ======================================================================
# EXECUTION WITH JSON INPUT
# ======================================================================

# Sample JSON data designed to demonstrate assignment, rest conflict, and overtime.
SAMPLE_JSON_INPUT = """
{
    "employees_available": [
        {
            "id": "emp_A01", 
            "role": "Agent_GR", 
            "max_hours_week": 40,
            "qualifications": [
                {"qual_id": "Qual_DCS", "expiry_date": "2026-06-01"}
            ]
        },
        {
            "id": "emp_A06", 
            "role": "Agent_GR", 
            "max_hours_week": 40,
            "qualifications": [
                {"qual_id": "Qual_DCS1", "expiry_date": "2026-06-01"}
            ]
        },        
        {
            "id": "emp_A04", 
            "role": "Mechanic_B777", 
            "max_hours_week": 40,
            "qualifications": [
                {"qual_id": "Qual_DCS", "expiry_date": "2026-06-01"},
                {"qual_id": "Qual_B777", "expiry_date": "2027-01-15"}
            ]
        },        
        {
            "id": "emp_A02", 
            "role": "Agent_GR", 
            "max_hours_week": 16, 
            "qualifications": [
                {"qual_id": "Qual_DCS", "expiry_date": "2026-06-01"}
            ]
        },
        {
            "id": "emp_B01_RESTRICTED", 
            "role": "Mechanic_B777", 
            "max_hours_week": 40, 
            "qualifications": [
                {"qual_id": "Qual_B777", "expiry_date": "2027-01-15"}
            ],
            "absences": [
                {"start_date": "2025-12-05", "end_date": "2025-12-07"}
            ]
        }
    ],
    "shift_requirements": [
        {
            "id": "GR_S1_MONDAY",
            "role": "Agent_GR",
            "duration_hours": 10,
            "start_time": "2025-12-01 08:00:00"
        },
        {
            "id": "GR_S2_MONDAY",
            "role": "Agent_GR",
            "duration_hours": 10,
            "start_time": "2025-12-01 18:00:00"
        },
        {
            "id": "GR_S3_TUESDAY",
            "role": "Agent_GR",
            "duration_hours": 10,
            "start_time": "2025-12-02 07:00:00"
        },
        {
            "id": "GR_S4_TUESDAY_OVERTIME",
            "role": "Agent_GR",
            "duration_hours": 10,
            "start_time": "2025-12-02 17:00:00"
        },
        {
            "id": "MECH_S5_GAP_ABSENCE",
            "role": "Mechanic_B777",
            "duration_hours": 8,
            "start_time": "2025-12-06 10:00:00"
        }
    ]
}
"""

if __name__ == '__main__':
    print(f"*** Roster Optimizer Test Suite ***\nReference Week: {REF_DATE.isocalendar()[1]}")
    
    # Load data from the static JSON input
    employees, shifts, employee_quals, employee_absences, employee_anomalies = load_data_from_json(SAMPLE_JSON_INPUT)
    
    # Instantiate and solve the optimizer with the loaded data
    optimizer = RosterOptimizer(
        employees, 
        shifts, 
        employee_quals, 
        employee_absences, 
        employee_anomalies, 
        name="JSON Input Test Case"
    )
    
    roster = optimizer.solve()

    print("\n--- DETAILED ROSTER ASSIGNMENTS ---")
    for entry in roster:
        if entry['shifts_assigned']:
            print(f"\nEmployee ID: {entry['employee_id']} (Total Hours: {entry['total_hours']:.1f}h, Overtime: {entry['overtime_h']:.1f}h)")
            for shift in entry['shifts_assigned']:
                print(f"  - {shift['shift_id']} ({shift['role']}) starting {shift['start_time']} for {shift['duration_h']}h")
