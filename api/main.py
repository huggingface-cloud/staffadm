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

        # Fetch employees first
        query = supabase.table("employees").select("*")

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

        # Fetch all related data in separate queries for manual joining
        # (Supabase Python client has issues with nested joins)
        employee_ids = [emp["id"] for emp in response.data]

        # Fetch operating companies
        opcos_response = supabase.table("operating_companies").select("*").execute()
        opcos_map = {opco["id"]: opco for opco in opcos_response.data}

        # Fetch departments
        depts_response = supabase.table("departments").select("*").execute()
        depts_map = {dept["id"]: dept for dept in depts_response.data}

        # Fetch employee roles with role details
        emp_roles_response = supabase.table("employee_roles").select("*, roles(*)").in_("employee_id", employee_ids).execute()
        emp_roles_map = {}
        for er in emp_roles_response.data:
            if er["employee_id"] not in emp_roles_map:
                emp_roles_map[er["employee_id"]] = []
            emp_roles_map[er["employee_id"]].append(er)

        # Fetch employee qualifications with qualification types
        emp_quals_response = supabase.table("employee_qualifications").select("*, qualification_types(*)").in_("employee_id", employee_ids).execute()
        emp_quals_map = {}
        for eq in emp_quals_response.data:
            if eq["employee_id"] not in emp_quals_map:
                emp_quals_map[eq["employee_id"]] = []
            emp_quals_map[eq["employee_id"]].append(eq)

        # Fetch employee anomalies
        emp_anomalies_response = supabase.table("employee_anomalies").select("*").in_("employee_id", employee_ids).execute()
        emp_anomalies_map = {}
        for ea in emp_anomalies_response.data:
            if ea["employee_id"] not in emp_anomalies_map:
                emp_anomalies_map[ea["employee_id"]] = []
            emp_anomalies_map[ea["employee_id"]].append(ea)

        # Fetch contracts
        contracts_response = supabase.table("contracts").select("*").in_("employee_id", employee_ids).execute()
        contracts_map = {}
        for contract in contracts_response.data:
            if contract["employee_id"] not in contracts_map:
                contracts_map[contract["employee_id"]] = []
            contracts_map[contract["employee_id"]].append(contract)

        # Transform the data for better structure
        employees = []
        for emp in response.data:
            emp_id = emp["id"]

            # Get related data using the maps
            emp_qualifications = emp_quals_map.get(emp_id, [])
            emp_anomalies = emp_anomalies_map.get(emp_id, [])
            emp_contracts = contracts_map.get(emp_id, [])
            emp_roles_list = emp_roles_map.get(emp_id, [])

            # Get active qualifications only
            active_qualifications = [
                {
                    "qualification_types": q.get("qualification_types"),
                    "acquired_date": q.get("achieved_date"),  # Note: schema has achieved_date, not acquired_date
                    "expiry_date": q.get("expiry_date"),
                    "is_valid": q.get("is_valid", False)
                }
                for q in emp_qualifications
                if q.get("is_valid", False)
            ]

            # Get active anomalies only (based on date range)
            from datetime import datetime
            today = datetime.now().date()
            active_anomalies = []
            for a in emp_anomalies:
                start_date = datetime.fromisoformat(str(a["start_date"])).date()
                end_date = datetime.fromisoformat(str(a["end_date"])).date() if a.get("end_date") else None
                if start_date <= today and (end_date is None or end_date >= today):
                    active_anomalies.append({
                        "anomaly_type": a["anomaly_type"],
                        "restrictions": a.get("restriction_comment"),
                        "start_date": str(a["start_date"]),
                        "end_date": str(a["end_date"]) if a.get("end_date") else None
                    })

            # Get active contract
            active_contract = None
            for c in emp_contracts:
                if c.get("is_active", False):
                    active_contract = {
                        "contract_type": c["contract_type"],
                        "weekly_hours": c.get("weekly_hours_limit", 40),
                        "is_active": c["is_active"]
                    }
                    break

            # Extract roles
            roles = []
            for er in emp_roles_list:
                if er.get("roles"):
                    roles.append({
                        "role_name": er["roles"].get("name"),
                        "description": er["roles"].get("description")
                    })

            # Generate employee code from email
            email_user = emp["email"].split("@")[0]
            employee_code = f"EMP-{email_user.upper()[:6]}-{emp['id'][:4].upper()}"

            # Get operating company and department
            operating_company = None
            if emp.get("opco_id") and emp["opco_id"] in opcos_map:
                opco = opcos_map[emp["opco_id"]]
                operating_company = {
                    "name": opco["name"],
                    "code": opco["code"]
                }

            department = None
            if emp.get("department_id") and emp["department_id"] in depts_map:
                dept = depts_map[emp["department_id"]]
                department = {
                    "name": dept["name"],
                    "code": dept.get("code")
                }

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
                "operating_company": operating_company,
                "department": department,
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
