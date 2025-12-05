from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class OperatingCompany(BaseModel):
    id: str
    name: str
    code: str


class Department(BaseModel):
    id: str
    name: str
    code: str


class EmployeeRole(BaseModel):
    id: str
    role_name: str
    description: Optional[str] = None


class QualificationType(BaseModel):
    id: str
    name: str
    details: Optional[str] = None
    validity_period_months: Optional[int] = None
    is_mandatory: bool


class EmployeeQualification(BaseModel):
    id: str
    qualification_type_id: str
    qualification_type: Optional[QualificationType] = None
    acquired_date: date
    expiry_date: Optional[date] = None
    is_valid: bool


class EmployeeAnomaly(BaseModel):
    id: str
    anomaly_type: str
    start_date: date
    end_date: Optional[date] = None
    restrictions: Optional[str] = None
    comments: Optional[str] = None
    is_active: bool


class Contract(BaseModel):
    id: str
    contract_type: str
    start_date: date
    end_date: Optional[date] = None
    weekly_hours: float
    max_consecutive_days: Optional[int] = None
    min_rest_hours: Optional[int] = None
    is_active: bool


class EmployeeDetailed(BaseModel):
    id: str
    employee_code: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    joining_date: date
    is_active: bool
    operating_company: Optional[OperatingCompany] = None
    department: Optional[Department] = None
    roles: List[EmployeeRole] = []
    qualifications: List[EmployeeQualification] = []
    anomalies: List[EmployeeAnomaly] = []
    active_contract: Optional[Contract] = None


class Shift(BaseModel):
    id: str
    shift_date: date
    start_time: str
    end_time: str
    location: Optional[str] = None
    required_headcount: int
    status: str
    department: Optional[Department] = None


class ShiftRequirement(BaseModel):
    id: str
    shift_id: str
    role_id: str
    role: Optional[EmployeeRole] = None
    required_count: int
    skill_level: str


class RosterAssignment(BaseModel):
    shift_id: str
    employee_id: str
    employee_code: str
    employee_name: str
    confidence: str
    warnings: List[str]


class ResourceGap(BaseModel):
    shift_id: str
    shift_date: date
    shift_time: str
    location: Optional[str]
    required_count: int
    assigned_count: int
    gap: int
    reasons: List[dict]


class RosteringSummary(BaseModel):
    total_shifts: int
    fully_assigned: int
    partially_assigned: int
    unassigned: int
    total_required: int
    total_assigned: int
    coverage_percentage: float


class RosteringResult(BaseModel):
    assignments: List[RosterAssignment]
    gaps: List[ResourceGap]
    summary: RosteringSummary


class RosterRequest(BaseModel):
    start_date: date
    end_date: date
    dept_id: Optional[str] = None
