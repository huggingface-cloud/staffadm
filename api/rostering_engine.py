from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from database import get_supabase
import logging

logger = logging.getLogger(__name__)


class RosteringEngine:
    """
    Intelligent rostering engine that assigns employees to shifts based on:
    - Qualifications and role requirements
    - Availability (absences, anomalies)
    - Contract compliance (hours, rest periods)
    - Workload distribution
    """

    def __init__(self):
        self.supabase = get_supabase()
        self.employees = []
        self.shifts = []
        self.absences = []
        self.role_qualifications = {}
        self.existing_rosters = {}

    async def initialize(self, start_date: str, end_date: str, dept_id: Optional[str] = None):
        """Load all necessary data for rostering."""

        # Fetch employees
        emp_query = self.supabase.table("employees").select("""
            *,
            employee_roles(role_id),
            employee_qualifications(qualification_type_id, is_valid),
            employee_anomalies(anomaly_type, start_date, end_date, restriction_comment),
            contracts(weekly_hours_limit, min_rest_hours, is_active)
        """).eq("active_for_rostering", True)

        if dept_id:
            emp_query = emp_query.eq("department_id", dept_id)

        emp_response = emp_query.execute()
        self.employees = emp_response.data or []

        # Fetch shift requirements
        shift_query = self.supabase.table("shift_requirements").select("""
            *,
            roles(id, name)
        """).gte("start_time", start_date).lte("end_time", end_date).neq("status", "cancelled")

        if dept_id:
            shift_query = shift_query.eq("department_id", dept_id)

        shift_response = shift_query.execute()
        self.shifts = shift_response.data or []

        # Fetch absences
        absence_response = self.supabase.table("absences").select(
            "employee_id, start_date, end_date, status"
        ).in_("status", ["approved", "pending"]).execute()

        self.absences = absence_response.data or []

        # Fetch role qualifications mapping
        role_qual_response = self.supabase.table("role_qualifications").select(
            "role_id, qualification_type_id, skill_level"
        ).execute()

        for rq in role_qual_response.data or []:
            if rq["role_id"] not in self.role_qualifications:
                self.role_qualifications[rq["role_id"]] = []
            self.role_qualifications[rq["role_id"]].append(rq["qualification_type_id"])

        # Fetch existing rosters
        if self.shifts:
            shift_ids = [s["id"] for s in self.shifts]
            roster_response = self.supabase.table("rosters").select(
                "employee_id, shift_id"
            ).in_("shift_id", shift_ids).execute()

            for roster in roster_response.data or []:
                emp_id = roster["employee_id"]
                if emp_id not in self.existing_rosters:
                    self.existing_rosters[emp_id] = []
                self.existing_rosters[emp_id].append(roster["shift_id"])

        logger.info(f"Initialized: {len(self.employees)} employees, {len(self.shifts)} shifts")

    def assign_shifts(self) -> Dict:
        """Main method to assign employees to all shifts."""
        assignments = []
        gaps = []

        for shift in self.shifts:
            shift_assignments = self._assign_shift(shift)

            total_required = sum(req["required_count"] for req in shift.get("shift_requirements", []))

            if len(shift_assignments) < total_required:
                gap_reasons = self._analyze_gap(shift, shift_assignments)
                gaps.append({
                    "shift_id": shift["id"],
                    "shift_date": shift["shift_date"],
                    "shift_time": f"{shift['start_time']} - {shift['end_time']}",
                    "location": shift.get("location"),
                    "required_count": total_required,
                    "assigned_count": len(shift_assignments),
                    "gap": total_required - len(shift_assignments),
                    "reasons": gap_reasons
                })

            assignments.extend(shift_assignments)

        summary = self._calculate_summary(assignments, gaps)

        return {
            "assignments": assignments,
            "gaps": gaps,
            "summary": summary
        }

    def _assign_shift(self, shift: Dict) -> List[Dict]:
        """Assign employees to a single shift."""
        assignments = []
        assigned_emp_ids = set()

        for requirement in shift.get("shift_requirements", []):
            eligible = self._find_eligible_employees(
                shift,
                requirement["role_id"],
                requirement["skill_level"]
            )

            # Score and rank
            ranked = sorted(
                eligible,
                key=lambda e: self._calculate_suitability_score(e, shift),
                reverse=True
            )

            for emp in ranked:
                if len([a for a in assignments if a["employee_id"] == emp["id"]]) >= requirement["required_count"]:
                    break
                if emp["id"] in assigned_emp_ids:
                    continue

                warnings = self._get_warnings(emp, shift)
                confidence = "perfect"
                if warnings:
                    confidence = "suboptimal" if any("CRITICAL" in w for w in warnings) else "good"

                assignments.append({
                    "shift_id": shift["id"],
                    "employee_id": emp["id"],
                    "employee_code": emp["employee_code"],
                    "employee_name": f"{emp['first_name']} {emp['last_name']}",
                    "confidence": confidence,
                    "warnings": warnings
                })
                assigned_emp_ids.add(emp["id"])

        return assignments

    def _find_eligible_employees(self, shift: Dict, role_id: str, skill_level: str) -> List[Dict]:
        """Find employees eligible for a shift/role."""
        eligible = []

        for emp in self.employees:
            # Check department
            if emp.get("dept_id") != shift.get("dept_id"):
                continue

            # Check role assignment
            role_assignments = emp.get("employee_roles", [])
            if not any(ra["role_id"] == role_id for ra in role_assignments):
                continue

            # Check absence
            if self._is_on_absence(emp["id"], shift["shift_date"]):
                continue

            # Check active contract
            contracts = emp.get("contracts", [])
            if not any(c.get("is_active") for c in contracts):
                continue

            # Check qualifications
            required_quals = self.role_qualifications.get(role_id, [])
            emp_quals = emp.get("employee_qualifications", [])

            if skill_level == "Recommended":
                # Need all qualifications
                has_all = all(
                    any(eq["qualification_type_id"] == qual_id and eq.get("is_valid")
                        for eq in emp_quals)
                    for qual_id in required_quals
                )
                if not has_all:
                    continue

            eligible.append(emp)

        return eligible

    def _calculate_suitability_score(self, emp: Dict, shift: Dict) -> float:
        """Calculate suitability score for employee-shift pairing."""
        score = 0.0

        # Has qualifications
        emp_quals = emp.get("employee_qualifications", [])
        valid_quals = [q for q in emp_quals if q.get("is_valid")]
        score += len(valid_quals) * 10

        # No anomalies (check if active based on dates)
        anomalies = emp.get("employee_anomalies", [])
        from datetime import datetime
        today = datetime.now().date()
        active_anomalies = [
            a for a in anomalies
            if (
                datetime.fromisoformat(a["start_date"]).date() <= today and
                (a.get("end_date") is None or datetime.fromisoformat(a["end_date"]).date() >= today)
            )
        ]
        if not active_anomalies:
            score += 20
        else:
            score -= len(active_anomalies) * 5

        # Workload distribution
        current_shifts = len(self.existing_rosters.get(emp["id"], []))
        if current_shifts < 5:
            score += 15
        elif current_shifts > 10:
            score -= 10

        # Rest period check
        if not self._has_rest_period_issue(emp, shift):
            score += 10

        return score

    def _get_warnings(self, emp: Dict, shift: Dict) -> List[str]:
        """Get assignment warnings for an employee."""
        warnings = []

        # Check anomalies (check if active based on dates)
        anomalies = emp.get("employee_anomalies", [])
        from datetime import datetime
        today = datetime.now().date()
        for anomaly in anomalies:
            if (
                datetime.fromisoformat(anomaly["start_date"]).date() <= today and
                (anomaly.get("end_date") is None or datetime.fromisoformat(anomaly["end_date"]).date() >= today)
            ):
                warning = anomaly["anomaly_type"]
                if anomaly.get("restriction_comment"):
                    warning += f": {anomaly['restriction_comment']}"
                warnings.append(warning)

        # Check rest period
        if self._has_rest_period_issue(emp, shift):
            warnings.append("CRITICAL: Rest period violation")

        # Check weekly hours
        contracts = emp.get("contracts", [])
        active_contract = next((c for c in contracts if c.get("is_active")), None)
        if active_contract:
            # Simplified check - in production, calculate actual hours
            current_shifts = len(self.existing_rosters.get(emp["id"], []))
            if current_shifts > 5:  # Rough proxy
                warnings.append(f"High workload: {current_shifts} shifts assigned")

        return warnings

    def _is_on_absence(self, emp_id: str, shift_date: str) -> bool:
        """Check if employee is on absence for the shift date."""
        shift_dt = datetime.fromisoformat(shift_date)

        for absence in self.absences:
            if absence["employee_id"] != emp_id:
                continue
            start = datetime.fromisoformat(absence["start_date"])
            end = datetime.fromisoformat(absence["end_date"])
            if start <= shift_dt <= end:
                return True
        return False

    def _has_rest_period_issue(self, emp: Dict, shift: Dict) -> bool:
        """Check if assigning this shift would violate rest period."""
        contracts = emp.get("contracts", [])
        active_contract = next((c for c in contracts if c.get("is_active")), None)

        if not active_contract or not active_contract.get("min_rest_hours"):
            return False

        # Simplified - would need full shift timing logic in production
        return False

    def _analyze_gap(self, shift: Dict, assignments: List[Dict]) -> List[Dict]:
        """Analyze why a shift has a staffing gap."""
        reasons = []

        for requirement in shift.get("shift_requirements", []):
            role_id = requirement["role_id"]
            required_count = requirement["required_count"]
            assigned_count = len([a for a in assignments])

            if assigned_count >= required_count:
                continue

            # Count employees with role
            employees_with_role = [
                e for e in self.employees
                if any(ra["role_id"] == role_id for ra in e.get("employee_role_assignments", []))
            ]

            if not employees_with_role:
                reasons.append({
                    "type": "no_qualified_staff",
                    "count": required_count,
                    "details": f"No employees have the required role"
                })
                continue

            # Check absences
            on_absence = [
                e for e in employees_with_role
                if self._is_on_absence(e["id"], shift["shift_date"])
            ]

            if on_absence:
                reasons.append({
                    "type": "absences",
                    "count": len(on_absence),
                    "details": f"{len(on_absence)} qualified employee(s) on absence",
                    "affected": [f"{e['first_name']} {e['last_name']}" for e in on_absence[:3]]
                })

            # Check anomalies (check if active based on dates)
            from datetime import datetime
            today = datetime.now().date()
            with_anomalies = [
                e for e in employees_with_role
                if any(
                    datetime.fromisoformat(a["start_date"]).date() <= today and
                    (a.get("end_date") is None or datetime.fromisoformat(a["end_date"]).date() >= today)
                    for a in e.get("employee_anomalies", [])
                )
            ]

            if with_anomalies:
                reasons.append({
                    "type": "anomalies",
                    "count": len(with_anomalies),
                    "details": f"{len(with_anomalies)} employee(s) have active restrictions"
                })

        if not reasons:
            gap = sum(req["required_count"] for req in shift.get("shift_requirements", [])) - len(assignments)
            if gap > 0:
                reasons.append({
                    "type": "insufficient_staff",
                    "count": gap,
                    "details": f"Need {gap} more employee(s)"
                })

        return reasons

    def _calculate_summary(self, assignments: List[Dict], gaps: List[Dict]) -> Dict:
        """Calculate summary statistics."""
        total_shifts = len(self.shifts)
        total_required = sum(
            sum(req["required_count"] for req in shift.get("shift_requirements", []))
            for shift in self.shifts
        )
        total_assigned = len(assignments)

        fully_assigned = len([
            s for s in self.shifts
            if sum(req["required_count"] for req in s.get("shift_requirements", [])) <= len([
                a for a in assignments if a["shift_id"] == s["id"]
            ])
        ])

        partially_assigned = len([g for g in gaps if g["assigned_count"] > 0])
        unassigned = len([g for g in gaps if g["assigned_count"] == 0])

        coverage = (total_assigned / total_required * 100) if total_required > 0 else 0

        return {
            "total_shifts": total_shifts,
            "fully_assigned": fully_assigned,
            "partially_assigned": partially_assigned,
            "unassigned": unassigned,
            "total_required": total_required,
            "total_assigned": total_assigned,
            "coverage_percentage": round(coverage, 2)
        }
