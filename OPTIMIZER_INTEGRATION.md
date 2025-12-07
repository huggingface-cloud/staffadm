# Roster Optimizer Integration Guide

## Overview

This guide explains how to integrate the roster optimizer (from `/opti` folder) with the Staff Admin & Rostering System.

## Architecture

```
┌─────────────────┐
│   Next.js UI    │ ← User Interface
│  (Port 3000)    │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   FastAPI       │ ← Main Backend
│  (Port 8001)    │ → Supabase
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│ Optimizer API   │ ← Optimization Engine
│  (Port 8002)    │ → Reads from Supabase
└─────────────────┘  → Writes results back
```

## Setup Steps

### 1. Database Schema Setup

Run the optimizer schema addon to add necessary tables:

```bash
# In Supabase SQL Editor, run:
cat optimizer_schema_addon.sql
```

This creates:
- `optimizer_configs` - Configuration profiles
- `optimization_runs` - Job tracking
- `roster_assignments` - Assignment results
- `optimization_queue` - Background job queue

### 2. Install Optimizer Dependencies

```bash
cd opti/
pip install -r requirements.txt
```

Required packages:
- PuLP (MIP solver)
- supabase-py
- fastapi
- uvicorn
- pydantic

### 3. Configure Environment

Copy `.env.example` to `.env` in the `opti/` folder:

```bash
cp opti/.env.example opti/.env
```

Update with your Supabase credentials:
```env
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
```

### 4. Start Optimizer API

```bash
cd opti/
python optimizer_api.py
```

The optimizer API will run on port 8002.

### 5. Update Main API to Call Optimizer

Add proxy endpoint in `api/main.py`:

```python
import httpx

OPTIMIZER_API_URL = "http://localhost:8002"

@app.post("/api/optimize")
async def run_optimization(request: dict):
    """Proxy request to optimizer API"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OPTIMIZER_API_URL}/optimize",
            json=request,
            timeout=300.0  # 5 minutes
        )
        return response.json()

@app.get("/api/optimizer/jobs/{job_id}")
async def get_optimization_status(job_id: str):
    """Get optimization job status"""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{OPTIMIZER_API_URL}/jobs/{job_id}",
            timeout=30.0
        )
        return response.json()

@app.get("/api/optimizer/configs")
async def get_optimizer_configs():
    """Get all optimizer configurations"""
    supabase = get_supabase()
    response = supabase.table("optimizer_configs").select("*").execute()
    return response.data

@app.post("/api/optimizer/configs")
async def create_optimizer_config(config: dict):
    """Create new optimizer configuration"""
    supabase = get_supabase()
    response = supabase.table("optimizer_configs").insert(config).execute()
    return response.data

@app.put("/api/optimizer/configs/{config_id}")
async def update_optimizer_config(config_id: str, config: dict):
    """Update optimizer configuration"""
    supabase = get_supabase()
    response = supabase.table("optimizer_configs").update(config).eq("id", config_id).execute()
    return response.data

@app.delete("/api/optimizer/configs/{config_id}")
async def delete_optimizer_config(config_id: str):
    """Delete optimizer configuration"""
    supabase = get_supabase()
    response = supabase.table("optimizer_configs").delete().eq("id", config_id).execute()
    return response.data
```

## Configuration Management

### Database-Stored Configurations

All optimizer configurations are stored in the `optimizer_configs` table:

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | TEXT | Configuration name |
| `description` | TEXT | Description |
| `is_active` | BOOLEAN | Only one can be active |
| `min_rest_hours` | INT | Hard constraint |
| `max_shift_duration_hours` | INT | Hard constraint |
| `max_consecutive_shifts` | INT | Hard constraint |
| `max_work_days_per_week` | INT | Hard constraint |
| `qual_expiry_threshold_days` | INT | Hard constraint |
| `coverage_weight` | INT | Soft penalty |
| `cross_dept_penalty` | INT | Soft penalty |
| `fairness_penalty_per_hour` | INT | Soft penalty |
| `overtime_penalty_per_hour` | INT | Soft penalty |
| `target_hours_week` | INT | Target setting |
| `use_gurobi` | BOOLEAN | Solver choice |
| `time_limit_sec` | INT | Solver timeout |
| `mip_gap` | DECIMAL | Optimality gap |

### Using Configurations

The optimizer reads the active configuration on each run:

```python
# In optimizer_optimized.py, replace CONFIG dict with:
def load_config_from_db():
    supabase = get_supabase()
    response = supabase.table("optimizer_configs")\
        .select("*")\
        .eq("is_active", True)\
        .execute()

    if response.data:
        config = response.data[0]
        return {
            "HARD_CONSTRAINTS": {
                "MIN_REST_HOURS": config["min_rest_hours"],
                "MAX_SHIFT_DURATION_HOURS": config["max_shift_duration_hours"],
                "MAX_CONSECUTIVE_SHIFTS": config["max_consecutive_shifts"],
                "MAX_WORK_DAYS_PER_WEEK": config["max_work_days_per_week"],
                "QUAL_EXPIRY_THRESHOLD_DAYS": config["qual_expiry_threshold_days"]
            },
            "SOFT_PENALTIES": {
                "COVERAGE_WEIGHT": config["coverage_weight"],
                "CROSS_DEPT_PENALTY": config["cross_dept_penalty"],
                "FAIRNESS_PENALTY_PER_HOUR": config["fairness_penalty_per_hour"],
                "OVERTIME_PENALTY_PER_HOUR": config["overtime_penalty_per_hour"]
            },
            "TARGETS": {
                "TARGET_HOURS_WEEK": config["target_hours_week"]
            },
            "SOLVER": {
                "USE_GUROBI": config["use_gurobi"],
                "TIME_LIMIT_SEC": config["time_limit_sec"],
                "MIP_GAP": float(config["mip_gap"]),
                "GLPK_MSG": 0
            }
        }
    return CONFIG  # Fallback to default

# At start of optimize_roster():
CONFIG = load_config_from_db()
```

## Frontend Integration

### Connect Settings UI to API

Update `OptimizerSettings.tsx` to use real API calls:

```typescript
// Replace mock data with API calls
useEffect(() => {
  async function loadConfigs() {
    const response = await fetch('http://localhost:8001/api/optimizer/configs')
    const data = await response.json()
    setConfigs(data)
    const active = data.find(c => c.is_active)
    if (active) {
      setSelectedConfigId(active.id)
      setCurrentConfig(active)
    }
  }
  loadConfigs()
}, [])

// Save function
const handleSave = async () => {
  setIsSaving(true)
  try {
    if (currentConfig.id) {
      // Update
      await fetch(`http://localhost:8001/api/optimizer/configs/${currentConfig.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      })
    } else {
      // Create
      const response = await fetch('http://localhost:8001/api/optimizer/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentConfig)
      })
      const newConfig = await response.json()
      setCurrentConfig(newConfig)
      setSelectedConfigId(newConfig.id)
    }
    // Reload configs
    const response = await fetch('http://localhost:8001/api/optimizer/configs')
    setConfigs(await response.json())
    setIsEditing(false)
  } finally {
    setIsSaving(false)
  }
}
```

### Connect Schedule View to Optimizer

Update `RosterView.tsx` to trigger real optimization:

```typescript
const runOptimization = async () => {
  setIsOptimizing(true)
  try {
    const response = await fetch('http://localhost:8001/api/optimize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: format(start, 'yyyy-MM-dd'),
        end_date: format(end, 'yyyy-MM-dd'),
        department_filter: selectedDepartment,
        save_results: true
      })
    })

    const result = await response.json()

    if (result.status === 'completed') {
      // Load optimized schedule
      setScheduleData(transformResultToSchedule(result.roster))
    } else {
      // Poll for completion
      pollJobStatus(result.job_id)
    }
  } finally {
    setIsOptimizing(false)
  }
}
```

## Testing

### 1. Test Optimizer API Directly

```bash
curl -X POST http://localhost:8002/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-01",
    "end_date": "2025-12-07",
    "save_results": true
  }'
```

### 2. Test Through Main API

```bash
curl -X POST http://localhost:8001/api/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-01",
    "end_date": "2025-12-07"
  }'
```

### 3. Check Job Status

```bash
curl http://localhost:8001/api/optimizer/jobs/{job_id}
```

## Performance Considerations

### Dataset Size Thresholds

- **Small** (< 500 employees, < 2000 shifts): Run synchronously (~2-5 min)
- **Large** (> 500 employees OR > 2000 shifts): Queue for background processing

### Background Processing

For large datasets, the optimizer runs in background:

1. Client POSTs to `/api/optimize`
2. API returns `job_id` immediately
3. Client polls `/api/optimizer/jobs/{job_id}` for status
4. When `status === 'completed'`, fetch results

### Optimization Tips

- Use `time_limit_sec` wisely (30-300 seconds)
- Higher `mip_gap` = faster but less optimal
- Enable `use_gurobi` for 10-100x speedup (requires license)
- Consider caching results for recurring schedules

## Monitoring

### Optimization Runs Table

Query recent optimizations:

```sql
SELECT
    id,
    job_id,
    status,
    start_date,
    end_date,
    total_shifts_scheduled,
    uncovered_shifts_count,
    duration_seconds,
    created_at
FROM optimization_runs
ORDER BY created_at DESC
LIMIT 10;
```

### Performance Metrics

```sql
SELECT
    AVG(duration_seconds) as avg_duration,
    AVG(total_shifts_scheduled) as avg_shifts,
    AVG(uncovered_shifts_count) as avg_gaps,
    COUNT(*) as total_runs
FROM optimization_runs
WHERE status = 'completed'
    AND created_at > NOW() - INTERVAL '7 days';
```

## Troubleshooting

### Optimizer Not Starting

Check:
1. PuLP installed: `pip list | grep PuLP`
2. Port 8002 available: `lsof -i :8002`
3. Environment variables set

### No Results Returned

Check:
1. Database has employees: `SELECT COUNT(*) FROM employees`
2. Shift requirements exist: `SELECT COUNT(*) FROM shift_requirements`
3. Date range includes shifts
4. Active configuration exists: `SELECT * FROM optimizer_configs WHERE is_active = TRUE`

### Slow Performance

Optimize:
1. Increase `time_limit_sec` to 300-600
2. Increase `mip_gap` to 0.05 (5%)
3. Consider Gurobi license
4. Add database indexes on employee_id, shift_date

## Next Steps

1. ✅ Run `optimizer_schema_addon.sql` in Supabase
2. ✅ Configure optimizer `.env` file
3. ⏳ Start optimizer API on port 8002
4. ⏳ Add API proxy endpoints to main.py
5. ⏳ Update frontend to use real API calls
6. ⏳ Test end-to-end optimization flow
7. ⏳ Set up monitoring and alerting

