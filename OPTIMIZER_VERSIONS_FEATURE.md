# Optimizer Version Selection Feature

## Overview
Allow different departments to select different versions of the optimization algorithm, enabling A/B testing, gradual rollouts, and backwards compatibility.

## Requirements
1. Multiple optimizer versions can run simultaneously
2. Each department can configure their preferred optimizer version
3. Super admin can set a default version for all departments
4. UI allows selection of optimizer version before running optimization
5. Backwards compatible - existing setups continue to work

## Architecture

### 1. Database Schema Changes

```sql
-- Add optimizer_version column to optimization_runs table
ALTER TABLE optimization_runs
ADD COLUMN optimizer_version VARCHAR(50) DEFAULT 'v1.0';

-- Add department optimizer preferences table
CREATE TABLE IF NOT EXISTS department_optimizer_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    preferred_optimizer_version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    fallback_version VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id),
    UNIQUE(department_id)
);

-- Create index for faster lookups
CREATE INDEX idx_dept_optimizer_config_dept ON department_optimizer_config(department_id);

-- Add system-wide default optimizer version setting
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id)
);

INSERT INTO system_config (key, value, description)
VALUES ('default_optimizer_version', 'v1.0', 'Default optimizer version for all departments')
ON CONFLICT (key) DO NOTHING;
```

### 2. Optimizer Service Architecture

#### Option A: Single Service with Version Router
```
optimizer_api.py (main entry point)
  ├── /optimize endpoint (version router)
  ├── optimizers/
  │   ├── v1_0.py (current PuLP implementation)
  │   ├── v1_1.py (improved algorithm)
  │   ├── v2_0.py (new OR-Tools implementation)
  │   └── base.py (abstract optimizer interface)
  └── version_manager.py (version selection logic)
```

**Pros:**
- Single deployment
- Easier to maintain
- Share common code (data loading, saving)

**Cons:**
- All versions in one process
- Memory overhead

#### Option B: Multiple Service Instances (Recommended)
```
Services:
  - optimizer-v1.onrender.com (port 9001) - Current production
  - optimizer-v1-1.onrender.com (port 9002) - Improved v1.1
  - optimizer-v2.onrender.com (port 9003) - New v2.0

Backend API Routes:
  POST /api/optimize
    → Reads optimizer version from request or department config
    → Routes to appropriate optimizer service URL
    → Returns unified response format
```

**Pros:**
- Independent scaling per version
- Isolated failures (one version crash doesn't affect others)
- Easy rollback (just change routing)
- Can use different technologies per version

**Cons:**
- More deployment complexity
- Higher infrastructure cost

### 3. API Changes

#### Backend API (main.py)

```python
# New endpoint to get/set department optimizer config
@app.get("/api/department/{department_id}/optimizer-config")
async def get_department_optimizer_config(
    department_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get the preferred optimizer version for a department"""
    supabase = get_supabase()

    # Check if department has custom config
    config = supabase.table('department_optimizer_config')\
        .select('*')\
        .eq('department_id', department_id)\
        .execute()

    if config.data:
        return config.data[0]

    # Return system default
    default = supabase.table('system_config')\
        .select('value')\
        .eq('key', 'default_optimizer_version')\
        .execute()

    return {
        'department_id': department_id,
        'preferred_optimizer_version': default.data[0]['value'] if default.data else 'v1.0',
        'is_default': True
    }

@app.post("/api/department/{department_id}/optimizer-config")
async def set_department_optimizer_config(
    department_id: str,
    version: str = Body(..., embed=True),
    current_user: dict = Depends(get_current_super_admin)  # Only super admin
):
    """Set the preferred optimizer version for a department"""
    supabase = get_supabase()

    supabase.table('department_optimizer_config').upsert({
        'department_id': department_id,
        'preferred_optimizer_version': version,
        'updated_by': current_user['id'],
        'updated_at': datetime.now().isoformat()
    }).execute()

    return {"success": True, "version": version}

# List available optimizer versions
@app.get("/api/optimizer/versions")
async def list_optimizer_versions():
    """List all available optimizer versions and their status"""
    versions = [
        {
            "version": "v1.0",
            "name": "PuLP Optimizer v1.0",
            "description": "Current production optimizer using PuLP library",
            "status": "stable",
            "url": "http://localhost:9001",
            "features": ["Basic optimization", "Contract constraints", "Weekly hours limits"]
        },
        {
            "version": "v1.1",
            "name": "PuLP Optimizer v1.1",
            "description": "Improved with better performance and constraint handling",
            "status": "beta",
            "url": "http://localhost:9002",
            "features": ["All v1.0 features", "Faster solving", "Better gap analysis"]
        },
        {
            "version": "v2.0",
            "name": "OR-Tools Optimizer v2.0",
            "description": "Next-gen optimizer using Google OR-Tools",
            "status": "experimental",
            "url": "http://localhost:9003",
            "features": ["All v1.1 features", "Advanced constraints", "Multi-objective optimization"]
        }
    ]

    # Check health of each version
    for version in versions:
        try:
            response = httpx.get(f"{version['url']}/", timeout=2.0)
            version['is_online'] = response.status_code == 200
        except:
            version['is_online'] = False

    return versions

# Modified optimize endpoint to support version selection
@app.post("/api/optimize")
async def optimize_roster(
    request: RosterRequest,
    optimizer_version: Optional[str] = None,  # Allow override
    current_user: dict = Depends(get_current_user)
):
    """Run optimization with specified or default optimizer version"""

    # Determine which optimizer version to use
    if not optimizer_version:
        # Get department's preferred version
        config = await get_department_optimizer_config(
            request.department_id or current_user['department_id'],
            current_user
        )
        optimizer_version = config['preferred_optimizer_version']

    # Map version to optimizer service URL
    version_urls = {
        'v1.0': os.getenv('OPTIMIZER_V1_URL', 'http://localhost:9001'),
        'v1.1': os.getenv('OPTIMIZER_V1_1_URL', 'http://localhost:9002'),
        'v2.0': os.getenv('OPTIMIZER_V2_URL', 'http://localhost:9003'),
    }

    optimizer_url = version_urls.get(optimizer_version, version_urls['v1.0'])

    # Call the optimizer service
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{optimizer_url}/optimize",
            json=request.dict(),
            timeout=300.0
        )

    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    result = response.json()
    result['optimizer_version'] = optimizer_version  # Include version in response

    return result
```

### 4. UI Changes

#### OptimizerSettings Component

Add new tab/section for version configuration:

```tsx
// components/OptimizerSettings.tsx

interface OptimizerVersion {
  version: string
  name: string
  description: string
  status: 'stable' | 'beta' | 'experimental'
  is_online: boolean
  features: string[]
}

function OptimizerVersionSelector() {
  const [versions, setVersions] = useState<OptimizerVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('v1.0')
  const [currentConfig, setCurrentConfig] = useState<any>(null)

  useEffect(() => {
    // Fetch available versions
    fetch('/api/optimizer/versions')
      .then(res => res.json())
      .then(setVersions)

    // Fetch current department config
    fetch(`/api/department/${departmentId}/optimizer-config`)
      .then(res => res.json())
      .then(setCurrentConfig)
  }, [])

  const handleVersionChange = async (version: string) => {
    await fetch(`/api/department/${departmentId}/optimizer-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version })
    })

    setSelectedVersion(version)
    toast.success(`Optimizer version updated to ${version}`)
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Optimizer Version</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {versions.map(version => (
          <div
            key={version.version}
            className={`border rounded-lg p-4 cursor-pointer ${
              selectedVersion === version.version
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200'
            } ${!version.is_online ? 'opacity-50' : ''}`}
            onClick={() => version.is_online && handleVersionChange(version.version)}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold">{version.name}</h4>
              <span className={`px-2 py-1 text-xs rounded ${
                version.status === 'stable' ? 'bg-green-100 text-green-800' :
                version.status === 'beta' ? 'bg-yellow-100 text-yellow-800' :
                'bg-orange-100 text-orange-800'
              }`}>
                {version.status}
              </span>
            </div>

            <p className="text-sm text-gray-600 mb-3">{version.description}</p>

            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${
                version.is_online ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-xs">
                {version.is_online ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="text-xs text-gray-500">
              <div className="font-semibold mb-1">Features:</div>
              <ul className="list-disc list-inside">
                {version.features.map(feature => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {currentConfig?.is_default && (
        <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm">
          ℹ️ Using system default version. Super admin can configure a department-specific version.
        </div>
      )}
    </div>
  )
}
```

#### RosterView Component

Add version selector in optimize modal:

```tsx
// In optimize modal
<select
  value={optimizerVersion}
  onChange={(e) => setOptimizerVersion(e.target.value)}
  className="border rounded px-3 py-2"
>
  {availableVersions
    .filter(v => v.is_online)
    .map(version => (
      <option key={version.version} value={version.version}>
        {version.name} ({version.status})
      </option>
    ))
  }
</select>
```

### 5. Environment Variables

```bash
# Backend API (.env)
OPTIMIZER_V1_URL=http://localhost:9001
OPTIMIZER_V1_1_URL=http://localhost:9002
OPTIMIZER_V2_URL=http://localhost:9003

# For production (Render):
OPTIMIZER_V1_URL=https://staffadmin-optimizer.onrender.com
OPTIMIZER_V1_1_URL=https://staffadmin-optimizer-v1-1.onrender.com
OPTIMIZER_V2_URL=https://staffadmin-optimizer-v2.onrender.com
```

### 6. Deployment Strategy

#### Phase 1: Setup (Week 1)
1. Add database schema changes
2. Deploy current optimizer as `v1.0` (no code changes)
3. Add version tracking to optimization_runs table

#### Phase 2: Backend Support (Week 2)
1. Add version management endpoints
2. Add routing logic in /api/optimize
3. Test with single version

#### Phase 3: UI Integration (Week 3)
1. Add version selector to Settings
2. Add version dropdown to optimize modal
3. Display version in optimization history

#### Phase 4: Multi-Version Deployment (Week 4)
1. Create v1.1 with improvements
2. Deploy as separate service
3. Enable for beta testing in one department

#### Phase 5: Advanced Versions (Future)
1. Develop v2.0 with OR-Tools
2. A/B test with multiple departments
3. Gradual rollout

### 7. Backwards Compatibility

- Default version is always v1.0 (current production)
- If version service is offline, fall back to v1.0
- All versions use same input/output format
- Existing optimizations continue to work

### 8. Monitoring & Rollback

```python
# Add to each optimization run
optimization_runs table stores:
  - optimizer_version used
  - response_time
  - success/failure
  - objective_value
  - constraints_satisfied

# Dashboard shows:
  - Version performance comparison
  - Success rates by version
  - Average solve times
  - Constraint violation rates

# Easy rollback:
  - Change department config back to v1.0
  - Or disable specific version service
```

## Implementation Checklist

### Database
- [ ] Add optimizer_version to optimization_runs
- [ ] Create department_optimizer_config table
- [ ] Create system_config table
- [ ] Add indexes

### Backend
- [ ] Add version listing endpoint
- [ ] Add department config endpoints
- [ ] Add version routing to /api/optimize
- [ ] Add version health checks
- [ ] Update optimization_runs to store version

### Optimizer Service
- [ ] Restructure for multiple versions (Option A or B)
- [ ] Add version identifier to responses
- [ ] Ensure consistent input/output format

### Frontend
- [ ] Add version selector to Settings
- [ ] Add version dropdown to optimize modal
- [ ] Display version in history/results
- [ ] Add version comparison dashboard

### DevOps
- [ ] Configure environment variables
- [ ] Deploy additional optimizer services (if Option B)
- [ ] Set up monitoring
- [ ] Document deployment process

### Testing
- [ ] Test version switching
- [ ] Test fallback behavior
- [ ] Test with offline versions
- [ ] Load test multiple versions

## Future Enhancements

1. **A/B Testing Framework**: Automatically split traffic between versions
2. **Version Analytics**: Detailed comparison dashboards
3. **Canary Deployments**: Gradual rollout of new versions
4. **Feature Flags**: Enable/disable features within versions
5. **Multi-Tenant Isolation**: Different versions for different organizations
