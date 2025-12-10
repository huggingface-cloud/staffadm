"""
FastAPI Microservice for Roster Optimization
Exposes HTTP API endpoints for the Python optimizer
Deploy this as a separate microservice or serverless function
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, Dict, List
from datetime import datetime
import os
import logging
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from supabase_integration import SupabaseRosterService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Roster Optimizer API",
    description="HTTP API for staff roster optimization using MIP solver",
    version="1.0.0"
)

# CORS middleware for Next.js integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase service
supabase_service = SupabaseRosterService()

# ======================================================================
# REQUEST/RESPONSE MODELS
# ======================================================================

class OptimizationRequest(BaseModel):
    start_date: str = Field(..., description="Start date in YYYY-MM-DD format")
    end_date: str = Field(..., description="End date in YYYY-MM-DD format")
    department_filter: Optional[str] = Field(None, description="Filter by department")
    user_id: Optional[str] = Field(None, description="User ID for audit trail")
    admin_user_id: Optional[str] = Field(None, description="Admin user ID (takes precedence over user_id)")
    description: Optional[str] = Field(None, description="Description of optimization run")
    save_results: bool = Field(False, description="Whether to save results to database (requires optimization_runs table)")
    employee_filters: Optional[Dict] = Field(None, description="Additional employee filters")
    shift_filters: Optional[Dict] = Field(None, description="Additional shift filters")
    fetch_existing_hours: bool = Field(False, description="Fetch existing hours across all departments for cross-dept validation")
    department_id: Optional[str] = Field(None, description="Department ID for department-specific optimization")

class OptimizationResponse(BaseModel):
    job_id: Optional[str]
    status: str
    objective_value: Optional[float]
    roster: List[Dict]
    uncovered_shifts: List[str]
    statistics: Dict
    message: Optional[str]

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    created_at: str
    completed_at: Optional[str]
    objective_value: Optional[float]
    uncovered_shifts_count: Optional[int]
    statistics: Optional[Dict]

class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str

# ======================================================================
# API ENDPOINTS
# ======================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat()
    }

@app.post("/optimize", response_model=OptimizationResponse)
async def optimize_roster(request: OptimizationRequest, background_tasks: BackgroundTasks):
    """
    Run roster optimization for the specified date range.

    For small datasets, runs immediately and returns results.
    For large datasets, queues the job and returns job_id for polling.
    """
    try:
        logger.info(f"Optimization request: {request.start_date} to {request.end_date}")

        # Build filters - merge provided filters with department_filter (legacy support)
        employee_filters = request.employee_filters or {}
        shift_filters = request.shift_filters or {}

        # Legacy support: map department_filter to filters
        if request.department_filter:
            employee_filters['department'] = request.department_filter
            shift_filters['department'] = request.department_filter

        # Use admin_user_id if provided, otherwise fallback to user_id
        user_id = request.admin_user_id or request.user_id

        # Estimate dataset size
        employees = supabase_service.fetch_employees(employee_filters)
        shifts = supabase_service.fetch_shifts(
            request.start_date,
            request.end_date,
            shift_filters
        )

        logger.info(f"Dataset size: {len(employees)} employees, {len(shifts)} shifts")
        if request.fetch_existing_hours:
            logger.info("Cross-department hours validation enabled")

        # Decide whether to run immediately or queue
        # Threshold: <500 employees and <2000 shifts = run immediately
        should_run_immediately = len(employees) < 500 and len(shifts) < 2000

        if should_run_immediately:
            # Run synchronously
            if request.save_results:
                result = supabase_service.optimize_and_save(
                    request.start_date,
                    request.end_date,
                    user_id=user_id,
                    description=request.description,
                    employee_filters=employee_filters,
                    shift_filters=shift_filters,
                    department_id=request.department_id,
                    fetch_existing_hours=request.fetch_existing_hours
                )
                job_id = result.get('optimization_run_id')
            else:
                result = supabase_service.run_optimization(
                    request.start_date,
                    request.end_date,
                    employee_filters=employee_filters,
                    shift_filters=shift_filters,
                    department_id=request.department_id,
                    fetch_existing_hours=request.fetch_existing_hours
                )
                job_id = None

            return OptimizationResponse(
                job_id=job_id,
                status=result['status'],
                objective_value=result.get('objective_value'),
                roster=result['roster'],
                uncovered_shifts=result['uncovered_shifts'],
                statistics=result['statistics'],
                message="Optimization completed successfully"
            )
        else:
            # Queue for background processing
            # For now, we'll run it in a background task
            # In production, use a proper job queue (Celery, RQ, etc.)

            async def run_background_optimization():
                try:
                    supabase_service.optimize_and_save(
                        request.start_date,
                        request.end_date,
                        user_id=request.user_id,
                        description=request.description,
                        employee_filters=employee_filters,
                        shift_filters=shift_filters
                    )
                except Exception as e:
                    logger.error(f"Background optimization failed: {e}")

            # Create placeholder job
            from supabase_integration import create_client
            supabase = create_client(
                os.getenv('SUPABASE_URL'),
                os.getenv('SUPABASE_SERVICE_KEY')
            )

            job = supabase.table('optimization_runs').insert({
                'user_id': request.user_id,
                'start_date': request.start_date,
                'end_date': request.end_date,
                'status': 'queued',
                'description': request.description,
                'created_at': datetime.now().isoformat()
            }).execute()

            job_id = job.data[0]['id']

            # Add to background tasks
            background_tasks.add_task(run_background_optimization)

            return OptimizationResponse(
                job_id=job_id,
                status='queued',
                objective_value=None,
                roster=[],
                uncovered_shifts=[],
                statistics={},
                message=f"Large dataset detected ({len(employees)} employees, {len(shifts)} shifts). "
                        f"Optimization queued. Check status at /jobs/{job_id}"
            )

    except Exception as e:
        logger.error(f"Optimization failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get status of an optimization job
    """
    try:
        from supabase_integration import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )

        response = supabase.table('optimization_runs').select('*').eq('id', job_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Job not found")

        job = response.data

        return JobStatusResponse(
            job_id=job['id'],
            status=job['status'],
            created_at=job['created_at'],
            completed_at=job.get('completed_at'),
            objective_value=job.get('objective_value'),
            uncovered_shifts_count=job.get('uncovered_shifts_count'),
            statistics=job.get('statistics')
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch job status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/jobs/{job_id}/roster")
async def get_job_roster(job_id: str):
    """
    Get the complete roster for a completed optimization job
    """
    try:
        from supabase_integration import create_client
        supabase = create_client(
            os.getenv('SUPABASE_URL'),
            os.getenv('SUPABASE_SERVICE_KEY')
        )

        # Get job
        job_response = supabase.table('optimization_runs').select('*').eq('id', job_id).single().execute()

        if not job_response.data:
            raise HTTPException(status_code=404, detail="Job not found")

        job = job_response.data

        if job['status'] != 'Optimal':
            return {
                "job_id": job_id,
                "status": job['status'],
                "roster": None,
                "message": f"Job status is '{job['status']}', roster not available"
            }

        # Get roster assignments
        roster_response = supabase.table('roster_assignments').select('*').eq('optimization_run_id', job_id).execute()

        return {
            "job_id": job_id,
            "status": job['status'],
            "roster": roster_response.data,
            "statistics": job.get('statistics'),
            "uncovered_shifts": job.get('uncovered_shifts', [])
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch roster: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-connection")
async def test_supabase_connection():
    """
    Test Supabase connection and data availability
    """
    try:
        employees = supabase_service.fetch_employees()
        return {
            "status": "success",
            "employee_count": len(employees),
            "message": "Successfully connected to Supabase"
        }
    except Exception as e:
        logger.error(f"Supabase connection test failed: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to connect to Supabase: {str(e)}"
        )

# ======================================================================
# STARTUP/SHUTDOWN EVENTS
# ======================================================================

@app.on_event("startup")
async def startup_event():
    logger.info("Roster Optimizer API starting up...")
    logger.info(f"Supabase URL: {os.getenv('SUPABASE_URL')}")
    logger.info("Ready to accept optimization requests")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Roster Optimizer API shutting down...")

# ======================================================================
# RUN SERVER
# ======================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 8000))

    uvicorn.run(
        "optimizer_api:app",
        host="0.0.0.0",
        port=port,
        reload=True,
        log_level="info"
    )
