from fastapi import FastAPI, HTTPException, Query, Body, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from database import get_supabase
from models import EmployeeDetailed, RosterRequest, RosteringResult
from rostering_engine import RosteringEngine
from auth import authenticate_user, create_access_token, AuthenticationError, get_user_by_id
from auth_middleware import get_current_user, get_current_super_admin, apply_department_filter
from cache_manager import cached, invalidate_cache
import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ======================================================================
# PYDANTIC MODELS FOR AUTH
# ======================================================================

class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    department_id: Optional[str]
    department_name: Optional[str]

# Optimizer API configuration
OPTIMIZER_API_URL = "http://localhost:9001"

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


# ======================================================================
# AUTHENTICATION ENDPOINTS
# ======================================================================

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user and return JWT token.

    Credentials:
    - Super Admin: admin@staffadmin.com / password123
    - Department Admins: {dept}.admin@staffadmin.com / password123
    """
    try:
        # Authenticate user
        user = authenticate_user(request.email, request.password)

        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )

        # Create access token
        token_data = {
            "user_id": user["id"],
            "email": user["email"],
            "role": user["role"]
        }
        access_token = create_access_token(token_data)

        logger.info(f"User {user['email']} logged in successfully")

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": user
        }

    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        raise HTTPException(status_code=500, detail="Login failed")


@app.get("/api/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.
    Requires: Bearer token in Authorization header
    """
    return current_user


@app.post("/api/auth/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint (client-side token removal).
    Backend doesn't need to do anything as JWTs are stateless.
    """
    logger.info(f"User {current_user['email']} logged out")
    return {"message": "Logged out successfully"}


# ======================================================================
# EMPLOYEE ENDPOINTS (Now with Auth)
# ======================================================================

@app.get("/api/employees", response_model=List[dict])
@cached(ttl=300, prefix="employees")  # Cache for 5 minutes
async def get_employees(
    opco_id: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None),
    active_for_rostering: Optional[bool] = Query(None)
):
    """
    Get all employees with their core details, active qualifications, and anomalies (5-minute cache).

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


@app.get("/api/employee-hours")
async def get_employee_hours(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format")
):
    """
    Get employee hours summary for a date range with daily breakdown.
    Returns data for the Employee Hours Tracking page.
    """
    try:
        supabase = get_supabase()

        # Fetch employees with contracts
        employees_response = supabase.table('employees').select('''
            id,
            first_name,
            last_name,
            department_id,
            departments(name),
            contracts(weekly_hours_limit)
        ''').eq('active_for_rostering', True).execute()

        if not employees_response.data:
            return []

        # Fetch roster assignments for date range
        assignments_response = supabase.table('roster_assignments').select('''
            employee_id,
            shift_date,
            shift_start_time,
            shift_end_time
        ''').gte('shift_date', start_date).lte('shift_date', end_date).execute()

        # Group assignments by employee
        from collections import defaultdict
        from datetime import datetime as dt, timedelta

        employee_assignments = defaultdict(list)
        for assignment in assignments_response.data:
            employee_assignments[assignment['employee_id']].append(assignment)

        # Calculate hours for each employee
        employee_hours_data = []

        for emp in employees_response.data:
            emp_id = emp['id']
            emp_name = f"{emp['first_name']} {emp['last_name']}"
            dept_name = emp['departments']['name'] if emp.get('departments') else 'Unknown'

            # Get contracted weekly hours
            contracted_hours = 40  # default
            if emp.get('contracts') and len(emp['contracts']) > 0:
                contracted_hours = emp['contracts'][0].get('weekly_hours_limit', 40)

            # Calculate daily hours
            daily_hours_map = defaultdict(float)
            daily_shift_count = defaultdict(int)

            for assignment in employee_assignments.get(emp_id, []):
                date = assignment['shift_date']
                start = dt.fromisoformat(assignment['shift_start_time'].replace('+00:00', ''))
                end = dt.fromisoformat(assignment['shift_end_time'].replace('+00:00', ''))
                hours = (end - start).total_seconds() / 3600

                daily_hours_map[date] += hours
                daily_shift_count[date] += 1

            # Build daily hours list
            daily_hours = [
                {
                    'date': date,
                    'hours': hours,
                    'shiftCount': daily_shift_count[date]
                }
                for date, hours in sorted(daily_hours_map.items())
            ]

            # Calculate weekly total (using ISO week)
            weekly_hours = defaultdict(float)
            for assignment in employee_assignments.get(emp_id, []):
                date_obj = dt.fromisoformat(assignment['shift_date'])
                week_key = date_obj.isocalendar()[1]  # ISO week number

                start = dt.fromisoformat(assignment['shift_start_time'].replace('+00:00', ''))
                end = dt.fromisoformat(assignment['shift_end_time'].replace('+00:00', ''))
                hours = (end - start).total_seconds() / 3600

                weekly_hours[week_key] += hours

            # Get max weekly hours for the period
            max_weekly = max(weekly_hours.values()) if weekly_hours else 0

            # Calculate monthly total
            monthly_total = sum(daily_hours_map.values())

            employee_hours_data.append({
                'employeeId': emp_id,
                'employeeName': emp_name,
                'department': dept_name,
                'dailyHours': daily_hours,
                'weeklyTotal': round(max_weekly, 1),
                'monthlyTotal': round(monthly_total, 1),
                'contractedWeeklyHours': contracted_hours
            })

        # Sort by weekly hours descending
        employee_hours_data.sort(key=lambda x: x['weeklyTotal'], reverse=True)

        return employee_hours_data

    except Exception as e:
        logger.error(f"Error fetching employee hours: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee hours: {str(e)}")


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
@cached(ttl=180, prefix="shifts")  # Cache for 3 minutes
async def get_shifts(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    department_id: Optional[str] = Query(None)
):
    """Get shift requirements (3-minute cache)."""
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
@cached(ttl=600, prefix="departments")  # Cache for 10 minutes
async def get_departments(
    current_user: dict = Depends(get_current_user),
    opco_id: Optional[str] = Query(None)
):
    """
    Get departments (with 10-minute cache).
    - Super Admin: See all departments
    - Dept Admin: See only their department
    """
    try:
        supabase = get_supabase()

        query = supabase.table("departments").select("id, name, code")

        # Department admins can only see their own department
        if current_user['role'] == 'dept_admin' and current_user.get('department_id'):
            query = query.eq("id", current_user['department_id'])

        # Filter by opco if provided
        if opco_id:
            query = query.eq("opco_id", opco_id)

        query = query.order("name")

        response = query.execute()
        return response.data or []

    except Exception as e:
        logger.error(f"Error fetching departments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ======================================================================
# OPTIMIZER API PROXY ENDPOINTS
# ======================================================================

@app.post("/api/optimize")
async def run_optimization(
    request: dict = Body(...),
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger roster optimization with authentication and department filtering.

    For super admins: Can optimize for any department or globally.
    For dept admins: Automatically filters to their department and validates
                     cross-department hours to prevent exceeding global limits.

    Triggers roster optimization for the given date range.
    Returns job_id for async tracking or immediate results for small datasets.
    """
    try:
        # Extract department_id from authenticated user
        department_id = current_user.get('department_id')
        is_dept_admin = current_user.get('role') == 'dept_admin'

        # For department admins, automatically add department filtering
        if is_dept_admin and department_id:
            # Add department_id to shift filters
            if 'shift_filters' not in request:
                request['shift_filters'] = {}
            request['shift_filters']['department_id'] = department_id

            # Enable cross-department hours validation
            request['fetch_existing_hours'] = True
            request['department_id'] = department_id

        # Add admin user ID for audit trail
        request['admin_user_id'] = current_user['id']

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{OPTIMIZER_API_URL}/optimize",
                json=request,
                timeout=300.0  # 5 minutes for optimization
            )
            response.raise_for_status()
            return response.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Optimization request timed out")
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Optimizer API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to communicate with optimizer: {str(e)}")


@app.get("/api/optimizer/jobs/{job_id}")
async def get_optimization_status(job_id: str):
    """
    Get optimization job status.

    Poll this endpoint to check the status of a running optimization job.
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{OPTIMIZER_API_URL}/jobs/{job_id}",
                timeout=30.0
            )
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Job not found")
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/optimizer/configs")
async def get_optimizer_configs():
    """Get all optimizer configurations from database."""
    try:
        supabase = get_supabase()
        response = supabase.table("optimizer_configs").select("*").order("is_active", desc=True).execute()
        return response.data or []
    except Exception as e:
        logger.error(f"Error fetching optimizer configs: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/optimizer/configs")
async def create_optimizer_config(config: dict = Body(...)):
    """Create new optimizer configuration."""
    try:
        supabase = get_supabase()
        response = supabase.table("optimizer_configs").insert(config).execute()
        return response.data[0] if response.data else None
    except Exception as e:
        logger.error(f"Error creating optimizer config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/api/optimizer/configs/{config_id}")
async def update_optimizer_config(config_id: str, config: dict = Body(...)):
    """Update optimizer configuration."""
    try:
        supabase = get_supabase()
        response = supabase.table("optimizer_configs").update(config).eq("id", config_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Configuration not found")
        return response.data[0]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating optimizer config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/optimizer/configs/{config_id}")
async def delete_optimizer_config(config_id: str):
    """Delete optimizer configuration."""
    try:
        supabase = get_supabase()
        response = supabase.table("optimizer_configs").delete().eq("id", config_id).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Configuration not found")
        return {"message": "Configuration deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting optimizer config: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/roster/view")
async def get_roster_view(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format"),
    department_id: Optional[str] = Query(None, description="Filter by department")
):
    """
    Get roster view data showing shifts and assignments for a date range.

    This endpoint fetches shift requirements and their assignments from the database,
    formatted for the RosterView component.
    """
    try:
        from datetime import datetime, timedelta
        supabase = get_supabase()

        # Add time component to make it inclusive
        start_datetime = f"{start_date}T00:00:00"
        end_datetime = f"{end_date}T23:59:59"

        # Fetch shift requirements for the date range using start_time
        shift_query = supabase.table("shift_requirements").select("""
            id,
            start_time,
            end_time,
            headcount_needed,
            location,
            required_role_id,
            department_id
        """).gte("start_time", start_datetime).lte("start_time", end_datetime)

        if department_id:
            shift_query = shift_query.eq("department_id", department_id)

        shifts_response = shift_query.order("start_time").execute()

        if not shifts_response.data:
            # Return empty schedule for the date range
            from datetime import datetime, timedelta
            start = datetime.fromisoformat(start_date)
            end = datetime.fromisoformat(end_date)
            result = []
            current = start
            while current <= end:
                result.append({
                    "date": current.strftime("%Y-%m-%d"),
                    "shifts": []
                })
                current += timedelta(days=1)
            return result

        # Fetch roles and departments separately (manual join)
        role_ids = list(set([s["required_role_id"] for s in shifts_response.data if s.get("required_role_id")]))
        dept_ids = list(set([s["department_id"] for s in shifts_response.data if s.get("department_id")]))

        roles_map = {}
        if role_ids:
            roles_response = supabase.table("roles").select("id, name").in_("id", role_ids).execute()
            roles_map = {r["id"]: r for r in roles_response.data or []}

        depts_map = {}
        if dept_ids:
            depts_response = supabase.table("departments").select("id, name, code").in_("id", dept_ids).execute()
            depts_map = {d["id"]: d for d in depts_response.data or []}

        shift_ids = [s["id"] for s in shifts_response.data]

        # Fetch roster assignments for these shifts (without join)
        assignments_response = supabase.table("roster_assignments").select("""
            id,
            shift_id,
            employee_id,
            employee_weekly_hours,
            employee_overtime_hours,
            is_cross_department
        """).in_("shift_id", shift_ids).execute()

        # Fetch employees manually for assignments
        employee_ids = list(set([a["employee_id"] for a in assignments_response.data or [] if a.get("employee_id")]))
        employees_map = {}
        if employee_ids:
            employees_response = supabase.table("employees").select("id, first_name, last_name").in_("id", employee_ids).execute()
            employees_map = {e["id"]: e for e in employees_response.data or []}

        # Group assignments by shift_id
        assignments_by_shift = {}
        for assignment in assignments_response.data or []:
            shift_id = assignment["shift_id"]
            if shift_id not in assignments_by_shift:
                assignments_by_shift[shift_id] = []

            # Get employee from manual join
            employee_id = assignment.get("employee_id")
            emp = employees_map.get(employee_id, {})
            weekly_hours = assignment.get("employee_weekly_hours", 0) or 0

            # Determine status based on hours
            status = "optimal"
            warnings = []
            if weekly_hours > 48:
                status = "overtime"
                warnings.append(f"{weekly_hours}h this week (48h limit)")
            elif weekly_hours > 40:
                status = "warning"
                warnings.append(f"{weekly_hours}h this week")

            if assignment.get("is_cross_department"):
                warnings.append("Cross-department assignment")

            assignments_by_shift[shift_id].append({
                "id": assignment["id"],
                "employeeId": emp.get("id"),
                "employeeName": f"{emp.get('first_name', '')} {emp.get('last_name', '')}".strip(),
                "employeeCode": f"EMP-{emp.get('id', '')[:8]}" if emp.get("id") else None,
                "weeklyHours": weekly_hours,
                "status": status,
                "warnings": warnings if warnings else None
            })

        # Group shifts by date (extract date from start_time)
        roster_by_date = {}
        for shift in shifts_response.data:
            # Extract date from start_time timestamp
            start_time_str = shift["start_time"]
            shift_date = start_time_str.split("T")[0]  # Get YYYY-MM-DD part

            if shift_date not in roster_by_date:
                roster_by_date[shift_date] = []

            # Get role name from manual join map
            role_id = shift.get("required_role_id")
            if role_id and role_id in roles_map:
                role_name = roles_map[role_id].get("name", "Unknown Role")
            else:
                role_name = "Unknown Role"

            location = shift.get("location", "")

            # Extract time from timestamp
            start_time = start_time_str.split("T")[1][:5] if "T" in start_time_str else "00:00"
            end_time_str = shift["end_time"]
            end_time = end_time_str.split("T")[1][:5] if "T" in end_time_str else "00:00"

            # Get all assignments for this shift
            all_assignments = assignments_by_shift.get(shift["id"], [])

            # Only show up to headcount_needed assignments (best ones with lowest weekly hours)
            headcount = shift.get("headcount_needed", 1)
            best_assignments = sorted(all_assignments, key=lambda a: a["weeklyHours"])[:headcount]

            roster_by_date[shift_date].append({
                "id": shift["id"],
                "name": f"{role_name} Shift",
                "startTime": start_time,
                "endTime": end_time,
                "requiredCount": headcount,
                "location": location,
                "role": role_name,
                "assignments": best_assignments
            })

        # Convert to array format expected by frontend, filling in missing dates
        from datetime import datetime, timedelta
        start = datetime.fromisoformat(start_date)
        end = datetime.fromisoformat(end_date)
        result = []
        current = start
        while current <= end:
            date_str = current.strftime("%Y-%m-%d")
            result.append({
                "date": date_str,
                "shifts": roster_by_date.get(date_str, [])
            })
            current += timedelta(days=1)

        return result

    except Exception as e:
        logger.error(f"Error fetching roster view: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ======================================================================
# ADMIN PANEL ENDPOINTS
# ======================================================================

@app.get("/api/admin/employees")
async def get_all_employees():
    """Get all employees for admin panel"""
    try:
        supabase = get_supabase()
        response = supabase.table("employees").select(
            "id, first_name, last_name, department_id, active_for_rostering, joining_date, opco_id, email"
        ).order("created_at", desc=True).execute()

        # Generate employee_code from id for display
        for emp in response.data:
            emp["employee_code"] = f"EMP-{emp['id'][:8]}"

        return response.data
    except Exception as e:
        logger.error(f"Error fetching employees: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/employees")
async def create_employee(employee: dict = Body(...)):
    """Create a new employee"""
    try:
        supabase = get_supabase()

        # Get opco_id from first employee if not provided
        if "opco_id" not in employee:
            opco_response = supabase.table("employees").select("opco_id").limit(1).execute()
            if opco_response.data:
                employee["opco_id"] = opco_response.data[0]["opco_id"]

        # Extract role_ids before inserting employee
        role_ids = employee.pop("role_ids", [])

        # Insert employee (no employee_code field exists)
        emp_response = supabase.table("employees").insert(employee).execute()

        if not emp_response.data:
            raise HTTPException(status_code=400, detail="Failed to create employee")

        emp_id = emp_response.data[0]["id"]

        # Create employee-role mappings
        if role_ids:
            mappings = [
                {
                    "employee_id": emp_id,
                    "role_id": role_id,
                    "valid_from": employee.get("joining_date", datetime.now().strftime("%Y-%m-%d"))
                }
                for role_id in role_ids
            ]
            supabase.table("employee_roles").insert(mappings).execute()

        # Add employee_code for response
        emp_response.data[0]["employee_code"] = f"EMP-{emp_id[:8]}"

        # Invalidate employee cache
        invalidate_cache("employees")

        return emp_response.data[0]
    except Exception as e:
        logger.error(f"Error creating employee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/employees/{employee_id}")
async def delete_employee(employee_id: str):
    """Delete an employee"""
    try:
        supabase = get_supabase()
        # Delete employee-role mappings first
        supabase.table("employee_roles").delete().eq("employee_id", employee_id).execute()
        # Delete employee
        response = supabase.table("employees").delete().eq("id", employee_id).execute()
        # Invalidate employee cache
        invalidate_cache("employees")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting employee: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/shifts")
async def get_all_shifts():
    """Get all shift requirements for admin panel"""
    try:
        supabase = get_supabase()
        response = supabase.table("shift_requirements").select(
            "id, start_time, end_time, headcount_needed, required_role_id, department_id, location"
        ).order("start_time", desc=True).limit(100).execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching shifts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/shifts")
async def create_shift(shift: dict = Body(...)):
    """Create a new shift requirement"""
    try:
        supabase = get_supabase()
        
        # Convert datetime-local format to ISO with timezone
        if "T" in shift["start_time"] and "+" not in shift["start_time"]:
            shift["start_time"] += "+00:00"
        if "T" in shift["end_time"] and "+" not in shift["end_time"]:
            shift["end_time"] += "+00:00"

        response = supabase.table("shift_requirements").insert(shift).execute()
        # Invalidate shift cache
        invalidate_cache("shifts")
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating shift: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/admin/shifts/{shift_id}")
async def delete_shift(shift_id: str):
    """Delete a shift requirement"""
    try:
        supabase = get_supabase()
        response = supabase.table("shift_requirements").delete().eq("id", shift_id).execute()
        # Invalidate shift cache
        invalidate_cache("shifts")
        return {"success": True}
    except Exception as e:
        logger.error(f"Error deleting shift: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/roles")
async def get_all_roles():
    """Get all roles for admin panel"""
    try:
        supabase = get_supabase()
        response = supabase.table("roles").select("id, name, description").order("name").execute()

        # Extract level from name if it contains L1, L2, L3, etc.
        for role in response.data:
            name = role.get("name", "")
            if "L1" in name:
                role["level"] = "L1"
            elif "L2" in name:
                role["level"] = "L2"
            elif "L3" in name:
                role["level"] = "L3"
            elif "Supervisor" in name:
                role["level"] = "SUP"
            elif "Manager" in name:
                role["level"] = "MGR"
            else:
                role["level"] = None

        return response.data
    except Exception as e:
        logger.error(f"Error fetching roles: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/roles")
async def create_role(role: dict = Body(...)):
    """Create a new role"""
    try:
        supabase = get_supabase()

        # Get opco_id
        if "opco_id" not in role:
            opco_response = supabase.table("roles").select("opco_id").limit(1).execute()
            if opco_response.data:
                role["opco_id"] = opco_response.data[0]["opco_id"]

        # Remove level field as it doesn't exist in DB
        role.pop("level", None)

        response = supabase.table("roles").insert(role).execute()
        return response.data[0]
    except Exception as e:
        logger.error(f"Error creating role: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/departments")
async def get_all_departments():
    """Get all departments"""
    try:
        supabase = get_supabase()
        response = supabase.table("departments").select("id, name").order("name").execute()
        return response.data
    except Exception as e:
        logger.error(f"Error fetching departments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/admin/generate-bulk")
async def generate_bulk_data(request: dict = Body(...)):
    """Generate bulk test data - employees and shifts"""
    import random

    try:
        supabase = get_supabase()
        employee_count = request.get("employee_count", 10)
        shift_count = request.get("shift_count", 20)
        
        # Get reference data
        departments = supabase.table("departments").select("id").execute().data
        roles = supabase.table("roles").select("id").execute().data
        opco = supabase.table("employees").select("opco_id").limit(1).execute().data
        
        if not departments or not roles or not opco:
            raise HTTPException(status_code=400, detail="Missing reference data (departments, roles, or opco)")
        
        dept_ids = [d["id"] for d in departments]
        role_ids = [r["id"] for r in roles]
        opco_id = opco[0]["opco_id"]
        
        # Generate employees
        first_names = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "David", "Barbara",
                      "William", "Elizabeth", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
        last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
                     "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"]
        
        employees = []
        for i in range(employee_count):
            first_name = random.choice(first_names)
            last_name = random.choice(last_names)
            emp = {
                "first_name": first_name,
                "last_name": last_name,
                "email": f"{first_name.lower()}.{last_name.lower()}{random.randint(1,999)}@test.com",
                "department_id": random.choice(dept_ids),
                "opco_id": opco_id,
                "active_for_rostering": random.random() > 0.1,  # 90% active
                "joining_date": (datetime.now() - timedelta(days=random.randint(30, 730))).strftime("%Y-%m-%d")
            }
            employees.append(emp)
        
        emp_response = supabase.table("employees").insert(employees).execute()
        created_emp_ids = [e["id"] for e in emp_response.data]
        
        # Assign random roles to employees
        role_mappings = []
        for i, emp_id in enumerate(created_emp_ids):
            # Each employee gets 1-3 roles
            num_roles = random.randint(1, min(3, len(role_ids)))
            emp_roles = random.sample(role_ids, num_roles)
            # Use the joining_date from the employee record
            joining_date = employees[i]["joining_date"]
            for role_id in emp_roles:
                role_mappings.append({
                    "employee_id": emp_id,
                    "role_id": role_id,
                    "valid_from": joining_date
                })

        if role_mappings:
            supabase.table("employee_roles").insert(role_mappings).execute()
        
        # Generate shifts
        locations = ["Terminal 1", "Terminal 2", "Terminal 3", "Terminal 4", "Terminal 5"]
        shift_times = [
            ("06:00", "14:00"),
            ("08:00", "16:00"),
            ("14:00", "22:00"),
            ("16:00", "00:00"),
            ("22:00", "06:00")
        ]
        
        shifts = []
        start_date = datetime.now() + timedelta(days=1)  # Start from tomorrow
        
        for i in range(shift_count):
            shift_date = start_date + timedelta(days=random.randint(0, 30))
            start_h, end_h = random.choice(shift_times)
            
            # Parse times
            start_hour = int(start_h.split(":")[0])
            end_hour = int(end_h.split(":")[0])
            
            start_time = shift_date.replace(hour=start_hour, minute=0, second=0)
            
            # Handle overnight shifts
            if end_hour < start_hour or end_hour == 0:
                end_time = (shift_date + timedelta(days=1)).replace(hour=end_hour if end_hour > 0 else 0, minute=0, second=0)
            else:
                end_time = shift_date.replace(hour=end_hour, minute=0, second=0)
            
            shift = {
                "start_time": start_time.isoformat() + "+00:00",
                "end_time": end_time.isoformat() + "+00:00",
                "headcount_needed": random.randint(1, 5),
                "required_role_id": random.choice(role_ids),
                "department_id": random.choice(dept_ids),
                "location": random.choice(locations)
            }
            shifts.append(shift)
        
        shift_response = supabase.table("shift_requirements").insert(shifts).execute()
        
        return {
            "success": True,
            "employees_created": len(emp_response.data),
            "shifts_created": len(shift_response.data)
        }
    
    except Exception as e:
        logger.error(f"Error generating bulk data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/employees/{employee_id}/roles-qualifications")
async def get_employee_roles_qualifications(employee_id: str):
    """Get all roles and qualifications for a specific employee"""
    try:
        supabase = get_supabase()

        # Fetch employee roles with role details
        employee_roles_response = supabase.table("employee_roles").select(
            "id, role_id, valid_from, valid_until, is_primary"
        ).eq("employee_id", employee_id).execute()

        # Get role IDs
        role_ids = [er["role_id"] for er in employee_roles_response.data if er.get("role_id")]

        # Fetch role details
        roles_map = {}
        if role_ids:
            roles_response = supabase.table("roles").select("id, name, description").in_("id", role_ids).execute()
            roles_map = {r["id"]: r for r in roles_response.data}

        # Enrich employee roles with role names
        roles = []
        for er in employee_roles_response.data:
            role_id = er.get("role_id")
            if role_id and role_id in roles_map:
                role = roles_map[role_id]
                # Check if role is currently valid
                is_valid = True
                if er.get("valid_until"):
                    valid_until = datetime.fromisoformat(er["valid_until"].replace("Z", "+00:00"))
                    is_valid = valid_until >= datetime.now()

                roles.append({
                    "id": role["id"],
                    "name": role["name"],
                    "description": role.get("description"),
                    "is_primary": er.get("is_primary", False),
                    "valid_from": er.get("valid_from"),
                    "valid_until": er.get("valid_until"),
                    "is_valid": is_valid
                })

        # Fetch employee qualifications with qualification type details
        qualifications_response = supabase.table("employee_qualifications").select(
            "id, qualification_type_id, achieved_date, expiry_date, certificate_ref"
        ).eq("employee_id", employee_id).execute()

        # Get qualification type IDs
        qual_type_ids = [q["qualification_type_id"] for q in qualifications_response.data if q.get("qualification_type_id")]

        # Fetch qualification type details
        qual_types_map = {}
        if qual_type_ids:
            qual_types_response = supabase.table("qualification_types").select(
                "id, name, details, validity_period_months, is_mandatory"
            ).in_("id", qual_type_ids).execute()
            qual_types_map = {qt["id"]: qt for qt in qual_types_response.data}

        # Enrich qualifications with type names
        qualifications = []
        for qual in qualifications_response.data:
            qual_type_id = qual.get("qualification_type_id")
            if qual_type_id and qual_type_id in qual_types_map:
                qual_type = qual_types_map[qual_type_id]

                # Check if qualification is expired
                expiry_date = datetime.fromisoformat(qual["expiry_date"].replace("Z", "+00:00"))
                is_expired = expiry_date < datetime.now()
                days_until_expiry = (expiry_date - datetime.now()).days

                qualifications.append({
                    "id": qual_type["id"],
                    "name": qual_type["name"],
                    "details": qual_type.get("details"),
                    "is_mandatory": qual_type.get("is_mandatory", False),
                    "achieved_date": qual.get("achieved_date"),
                    "expiry_date": qual.get("expiry_date"),
                    "certificate_ref": qual.get("certificate_ref"),
                    "is_expired": is_expired,
                    "days_until_expiry": days_until_expiry if not is_expired else 0
                })

        return {
            "roles": roles,
            "qualifications": qualifications
        }

    except Exception as e:
        logger.error(f"Error fetching employee roles/qualifications: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/gaps")
async def get_staffing_gaps(
    start_date: str,
    end_date: str,
    absence_rate: float = 0.0  # Percentage of employees to simulate as absent (0-1)
):
    """
    Analyze staffing gaps and identify uncovered shifts with required skills.
    Supports absence scenario simulation.
    """
    try:
        supabase = get_supabase()

        # Fetch all shifts in date range
        shifts_response = supabase.table("shift_requirements").select(
            "id, start_time, end_time, headcount_needed, location, required_role_id, department_id"
        ).gte("start_time", f"{start_date}T00:00:00").lte(
            "start_time", f"{end_date}T23:59:59"
        ).order("start_time").execute()

        shifts = shifts_response.data

        if not shifts:
            return {
                "gaps": [],
                "skill_demand": {},
                "total_uncovered_shifts": 0,
                "total_headcount_shortage": 0,
                "absence_rate": absence_rate
            }

        # Get shift IDs for assignment lookup
        shift_ids = [s["id"] for s in shifts]

        # Fetch current assignments
        assignments_response = supabase.table("roster_assignments").select(
            "id, shift_id, employee_id"
        ).in_("shift_id", shift_ids).execute()

        assignments_by_shift = {}
        for assignment in assignments_response.data:
            shift_id = assignment["shift_id"]
            if shift_id not in assignments_by_shift:
                assignments_by_shift[shift_id] = []
            assignments_by_shift[shift_id].append(assignment)

        # Get role names
        role_ids = list(set([s["required_role_id"] for s in shifts if s.get("required_role_id")]))
        roles_map = {}
        if role_ids:
            roles_response = supabase.table("roles").select("id, name").in_("id", role_ids).execute()
            roles_map = {r["id"]: r["name"] for r in roles_response.data}

        # Get department names
        dept_ids = list(set([s["department_id"] for s in shifts if s.get("department_id")]))
        depts_map = {}
        if dept_ids:
            depts_response = supabase.table("departments").select("id, name").in_("id", dept_ids).execute()
            depts_map = {d["id"]: d["name"] for d in depts_response.data}

        # Analyze gaps
        gaps = []
        skill_demand = {}  # role_name -> total headcount needed
        total_uncovered_shifts = 0
        total_headcount_shortage = 0

        for shift in shifts:
            headcount_needed = shift.get("headcount_needed", 1)
            original_assignments = len(assignments_by_shift.get(shift["id"], []))

            # Apply absence simulation - calculate staff after absences
            current_assignments = original_assignments
            if absence_rate > 0 and original_assignments > 0:
                # Simulate X% of staff being absent - round up to be conservative
                absent_count = max(1, int(original_assignments * absence_rate + 0.5))
                current_assignments = max(0, original_assignments - absent_count)

            shortage = headcount_needed - current_assignments

            if shortage > 0:
                role_id = shift.get("required_role_id")
                role_name = roles_map.get(role_id, "Unknown Role")
                dept_name = depts_map.get(shift.get("department_id"), "Unknown Department")

                # Track skill demand
                if role_name not in skill_demand:
                    skill_demand[role_name] = 0
                skill_demand[role_name] += shortage

                total_uncovered_shifts += 1
                total_headcount_shortage += shortage

                gaps.append({
                    "shift_id": shift["id"],
                    "date": shift["start_time"][:10],
                    "start_time": shift["start_time"],
                    "end_time": shift["end_time"],
                    "location": shift.get("location", "Unknown"),
                    "department": dept_name,
                    "required_role": role_name,
                    "headcount_needed": headcount_needed,
                    "current_assigned": current_assignments,
                    "shortage": shortage
                })

        # Sort gaps by date and shortage severity
        gaps.sort(key=lambda g: (g["date"], -g["shortage"]))

        return {
            "gaps": gaps,
            "skill_demand": skill_demand,
            "total_uncovered_shifts": total_uncovered_shifts,
            "total_headcount_shortage": total_headcount_shortage,
            "absence_rate": absence_rate,
            "total_shifts_analyzed": len(shifts)
        }

    except Exception as e:
        logger.error(f"Error analyzing staffing gaps: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/forecast/workforce-trends")
async def get_workforce_trends(
    start_date: str,
    end_date: str
):
    """
    Get workforce utilization trends and forecasting data.
    """
    try:
        supabase = get_supabase()

        # Fetch shifts and assignments
        shifts_response = supabase.table("shift_requirements").select(
            "id, start_time, end_time, headcount_needed, required_role_id"
        ).gte("start_time", f"{start_date}T00:00:00").lte(
            "start_time", f"{end_date}T23:59:59"
        ).order("start_time").execute()

        shifts = shifts_response.data

        if not shifts:
            return {
                "daily_demand": [],
                "weekly_demand": [],
                "role_distribution": {},
                "coverage_rate": 0
            }

        shift_ids = [s["id"] for s in shifts]

        assignments_response = supabase.table("roster_assignments").select(
            "id, shift_id, shift_date"
        ).in_("shift_id", shift_ids).execute()

        assignments_by_shift = {}
        for assignment in assignments_response.data:
            shift_id = assignment["shift_id"]
            if shift_id not in assignments_by_shift:
                assignments_by_shift[shift_id] = []
            assignments_by_shift[shift_id].append(assignment)

        # Get role names
        role_ids = list(set([s["required_role_id"] for s in shifts if s.get("required_role_id")]))
        roles_map = {}
        if role_ids:
            roles_response = supabase.table("roles").select("id, name").in_("id", role_ids).execute()
            roles_map = {r["id"]: r["name"] for r in roles_response.data}

        # Calculate daily demand
        daily_demand = {}
        role_distribution = {}

        for shift in shifts:
            shift_date = shift["start_time"][:10]
            headcount = shift.get("headcount_needed", 1)
            assigned = len(assignments_by_shift.get(shift["id"], []))

            if shift_date not in daily_demand:
                daily_demand[shift_date] = {"required": 0, "assigned": 0, "gap": 0}

            daily_demand[shift_date]["required"] += headcount
            daily_demand[shift_date]["assigned"] += assigned
            daily_demand[shift_date]["gap"] += max(0, headcount - assigned)

            # Role distribution
            role_name = roles_map.get(shift.get("required_role_id"), "Unknown")
            if role_name not in role_distribution:
                role_distribution[role_name] = 0
            role_distribution[role_name] += headcount

        # Convert to list format
        daily_list = [
            {"date": date, **values}
            for date, values in sorted(daily_demand.items())
        ]

        # Calculate overall coverage rate
        total_required = sum(d["required"] for d in daily_list)
        total_assigned = sum(d["assigned"] for d in daily_list)
        coverage_rate = round((total_assigned / total_required * 100) if total_required > 0 else 0, 1)

        return {
            "daily_demand": daily_list,
            "role_distribution": role_distribution,
            "coverage_rate": coverage_rate,
            "total_shifts": len(shifts)
        }

    except Exception as e:
        logger.error(f"Error fetching workforce trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ======================================================================
# RUN SERVER
# ======================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
