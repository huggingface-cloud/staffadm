from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from database import get_supabase
from models import EmployeeDetailed, RosterRequest, RosteringResult
from rostering_engine import RosteringEngine
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Staff Admin & Rostering API",
    description="Intelligent staff management and rostering system",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "message": "Staff Admin & Rostering API",
        "version": "1.0.0",
        "endpoints": {
            "employees": "/api/employees",
            "shifts": "/api/shifts",
            "rosters": "/api/rosters",
            "roster_assign": "/api/roster/assign"
        }
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


@app.get("/api/employees", response_model=List[dict])
async def get_employees(
    opco_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    active_for_rostering: Optional[bool] = Query(None)
):
    """
    Get all employees with their core details, active qualifications, and anomalies.

    - **opco_id**: Filter by operating company
    - **department_id**: Filter by department
    - **active_for_rostering**: Filter by active status
    """
    try:
        supabase = get_supabase()

        # Build query with all joins
        query = supabase.table("employees").select("""
            *,
            operating_companies!inner(id, name, code),
            departments!inner(id, name, code),
            employee_roles(
                roles(id, name, description)
            ),
            employee_qualifications(
                id,
                acquired_date,
                expiry_date,
                is_valid,
                qualification_types(id, name, details, validity_period_months, is_mandatory)
            ),
            employee_anomalies(
                id,
                anomaly_type,
                start_date,
                end_date,
                restriction_comment
            ),
            contracts(
                id,
                contract_type,
                valid_from,
                valid_until,
                weekly_hours_limit,
                min_rest_hours,
                is_active
            )
        """)

        # Apply filters
        if opco_id:
            query = query.eq("opco_id", opco_id)
        if department_id:
            query = query.eq("department_id", department_id)
        if active_for_rostering is not None:
            query = query.eq("active_for_rostering", active_for_rostering)

        query = query.order("email", desc=False)

        response = query.execute()

        if not response.data:
            return []

        # Transform the data for better structure
        employees = []
        for emp in response.data:
            # Get active qualifications only
            active_qualifications = [
                q for q in emp.get("employee_qualifications", [])
                if q.get("is_valid", False)
            ]

            # Get active anomalies only (based on date range)
            from datetime import datetime
            today = datetime.now().date()
            active_anomalies = [
                a for a in emp.get("employee_anomalies", [])
                if (
                    datetime.fromisoformat(a["start_date"]).date() <= today and
                    (a.get("end_date") is None or datetime.fromisoformat(a["end_date"]).date() >= today)
                )
            ]

            # Get active contract
            active_contract = next(
                (c for c in emp.get("contracts", []) if c.get("is_active", False)),
                None
            )

            # Extract roles
            roles = [
                er["roles"]
                for er in emp.get("employee_roles", [])
                if er.get("roles")
            ]

            # Generate employee code from email
            email_user = emp["email"].split("@")[0]
            employee_code = f"EMP-{email_user.upper()[:6]}-{emp['id'][:4].upper()}"

            employee_data = {
                "id": emp["id"],
                "employee_code": employee_code,
                "first_name": emp["first_name"],
                "last_name": emp["last_name"],
                "full_name": f"{emp['first_name']} {emp['last_name']}",
                "email": emp["email"],
                "phone": emp.get("phone"),
                "joining_date": emp["joining_date"],
                "active_for_rostering": emp.get("active_for_rostering", True),
                "is_active": emp.get("active_for_rostering", True),
                "operating_company": emp.get("operating_companies"),
                "department": emp.get("departments"),
                "roles": roles,
                "active_qualifications": active_qualifications,
                "active_anomalies": active_anomalies,
                "active_contract": active_contract,
                "total_qualifications": len(active_qualifications),
                "has_anomalies": len(active_anomalies) > 0,
                "has_active_contract": active_contract is not None
            }

            employees.append(employee_data)

        logger.info(f"Retrieved {len(employees)} employees")
        return employees

    except Exception as e:
        logger.error(f"Error fetching employees: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch employees: {str(e)}")


@app.get("/api/employees/{employee_id}", response_model=dict)
async def get_employee_by_id(employee_id: str):
    """
    Get a single employee by ID with all details.
    """
    try:
        supabase = get_supabase()

        response = supabase.table("employees").select("""
            *,
            operating_companies(id, name, code),
            departments(id, name, code),
            employee_roles(
                roles(id, name, description)
            ),
            employee_qualifications(
                id,
                acquired_date,
                expiry_date,
                is_valid,
                qualification_types(id, name, details, validity_period_months, is_mandatory)
            ),
            employee_anomalies(
                id,
                anomaly_type,
                start_date,
                end_date,
                restriction_comment
            ),
            contracts(
                id,
                contract_type,
                valid_from,
                valid_until,
                weekly_hours_limit,
                min_rest_hours,
                is_active
            )
        """).eq("id", employee_id).execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Employee not found")

        emp = response.data[0]

        # Get active qualifications
        active_qualifications = [
            q for q in emp.get("employee_qualifications", [])
            if q.get("is_valid", False)
        ]

        # Get active anomalies
        active_anomalies = [
            a for a in emp.get("employee_anomalies", [])
            if a.get("is_active", False)
        ]

        # Get active contract
        active_contract = next(
            (c for c in emp.get("contracts", []) if c.get("is_active", False)),
            None
        )

        # Extract roles
        roles = [
            ra["employee_roles"]
            for ra in emp.get("employee_role_assignments", [])
            if ra.get("employee_roles")
        ]

        return {
            "id": emp["id"],
            "employee_code": emp["employee_code"],
            "first_name": emp["first_name"],
            "last_name": emp["last_name"],
            "full_name": f"{emp['first_name']} {emp['last_name']}",
            "email": emp["email"],
            "phone": emp.get("phone"),
            "joining_date": emp["joining_date"],
            "is_active": emp["is_active"],
            "operating_company": emp.get("operating_companies"),
            "department": emp.get("departments"),
            "roles": roles,
            "active_qualifications": active_qualifications,
            "all_qualifications": emp.get("employee_qualifications", []),
            "active_anomalies": active_anomalies,
            "all_anomalies": emp.get("employee_anomalies", []),
            "active_contract": active_contract,
            "all_contracts": emp.get("contracts", [])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching employee {employee_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee: {str(e)}")


@app.post("/api/roster/assign")
async def assign_roster(request: RosterRequest = Body(...)):
    """
    Intelligently assign employees to shifts within a date range.

    This endpoint runs the rostering engine to automatically match employees to shifts
    based on qualifications, availability, contract compliance, and workload.

    Returns assignments, resource gaps, and summary statistics.
    """
    try:
        engine = RosteringEngine()
        await engine.initialize(
            start_date=str(request.start_date),
            end_date=str(request.end_date),
            dept_id=request.dept_id
        )

        result = engine.assign_shifts()

        logger.info(f"Rostering complete: {result['summary']['coverage_percentage']}% coverage")
        return result

    except Exception as e:
        logger.error(f"Rostering error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Rostering failed: {str(e)}")


@app.get("/api/shifts")
async def get_shifts(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None)
):
    """Get shift requirements."""
    try:
        supabase = get_supabase()

        query = supabase.table("shift_requirements").select("""
            *,
            departments(name, code),
            roles(name, description)
        """)

        if start_date:
            query = query.gte("start_time", start_date)
        if end_date:
            query = query.lte("end_time", end_date)
        if department_id:
            query = query.eq("department_id", department_id)

        query = query.order("start_time", desc=False)

        response = query.execute()
        return response.data or []

    except Exception as e:
        logger.error(f"Error fetching shifts: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/absences")
async def get_absences(
    employee_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None)
):
    """Get employee absences."""
    try:
        supabase = get_supabase()

        query = supabase.table("absences").select("""
            *,
            employees(id, first_name, last_name, email)
        """)

        if employee_id:
            query = query.eq("employee_id", employee_id)
        if status:
            query = query.eq("status", status)

        query = query.order("start_date", desc=True)

        response = query.execute()
        return response.data or []

    except Exception as e:
        logger.error(f"Error fetching absences: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/qualifications")
async def get_qualification_types():
    """Get all qualification types."""
    try:
        supabase = get_supabase()

        response = supabase.table("qualification_types").select("*").execute()
        return response.data or []

    except Exception as e:
        logger.error(f"Error fetching qualifications: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/departments")
async def get_departments(opco_id: Optional[str] = Query(None)):
    """Get departments with roles."""
    try:
        supabase = get_supabase()

        query = supabase.table("departments").select("""
            *,
            operating_companies(name, code),
            employee_roles(id, role_name, description)
        """)

        if opco_id:
            query = query.eq("opco_id", opco_id)

        response = query.execute()
        return response.data or []

    except Exception as e:
        logger.error(f"Error fetching departments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
