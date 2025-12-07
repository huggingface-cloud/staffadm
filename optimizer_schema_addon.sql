-- ================================================================
-- OPTIMIZER INTEGRATION SCHEMA ADDON
-- Additional tables for roster optimizer integration
-- Run this AFTER base.sql
-- ================================================================

-- Optimizer Configuration Profiles
CREATE TABLE IF NOT EXISTS optimizer_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT FALSE, -- Only one can be active at a time

    -- Hard Constraints
    min_rest_hours INT DEFAULT 11,
    max_shift_duration_hours INT DEFAULT 14,
    max_consecutive_shifts INT DEFAULT 5,
    max_work_days_per_week INT DEFAULT 6,
    qual_expiry_threshold_days INT DEFAULT 90,

    -- Soft Penalties
    coverage_weight INT DEFAULT 1000,
    cross_dept_penalty INT DEFAULT 100,
    fairness_penalty_per_hour INT DEFAULT 10,
    overtime_penalty_per_hour INT DEFAULT 50,

    -- Targets
    target_hours_week INT DEFAULT 35,

    -- Solver Settings
    use_gurobi BOOLEAN DEFAULT FALSE,
    time_limit_sec INT DEFAULT 120,
    mip_gap DECIMAL(5,4) DEFAULT 0.01,

    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimization Job Tracking
CREATE TABLE IF NOT EXISTS optimization_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT UNIQUE NOT NULL,

    -- Job Metadata
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    department_filter UUID REFERENCES departments(id),
    config_id UUID REFERENCES optimizer_configs(id),

    -- User Info
    user_id UUID,
    description TEXT,

    -- Results
    objective_value DECIMAL(12,2),
    total_shifts_scheduled INT,
    total_hours_assigned DECIMAL(10,2),
    total_overtime_hours DECIMAL(10,2),
    fairness_deviation DECIMAL(10,2),
    uncovered_shifts_count INT DEFAULT 0,
    uncovered_shift_ids TEXT[], -- Array of shift IDs that couldn't be covered

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_seconds INT,

    -- Error tracking
    error_message TEXT,

    -- Store full results as JSON
    results_json JSONB
);

-- Roster Assignment Results (denormalized for easy querying)
CREATE TABLE IF NOT EXISTS roster_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    optimization_run_id UUID REFERENCES optimization_runs(id) ON DELETE CASCADE,

    employee_id UUID REFERENCES employees(id) NOT NULL,
    shift_id UUID REFERENCES shift_requirements(id) NOT NULL,

    -- Cached denormalized data for performance
    shift_date DATE NOT NULL,
    shift_start_time TIMESTAMPTZ NOT NULL,
    shift_end_time TIMESTAMPTZ NOT NULL,
    shift_role TEXT,
    shift_location TEXT,

    -- Employee stats for this assignment
    employee_weekly_hours DECIMAL(6,2),
    employee_overtime_hours DECIMAL(6,2),
    is_cross_department BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optimization Queue (for background job processing)
CREATE TABLE IF NOT EXISTS optimization_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id TEXT UNIQUE NOT NULL,
    optimization_run_id UUID REFERENCES optimization_runs(id),

    priority INT DEFAULT 0, -- Higher = process first
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),

    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 3,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    picked_up_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    error_message TEXT
);

-- ================================================================
-- INDEXES FOR PERFORMANCE
-- ================================================================

CREATE INDEX idx_optimizer_configs_active ON optimizer_configs(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_optimization_runs_status ON optimization_runs(status);
CREATE INDEX idx_optimization_runs_dates ON optimization_runs(start_date, end_date);
CREATE INDEX idx_optimization_runs_user ON optimization_runs(user_id);
CREATE INDEX idx_roster_assignments_run ON roster_assignments(optimization_run_id);
CREATE INDEX idx_roster_assignments_employee ON roster_assignments(employee_id);
CREATE INDEX idx_roster_assignments_shift ON roster_assignments(shift_id);
CREATE INDEX idx_roster_assignments_date ON roster_assignments(shift_date);
CREATE INDEX idx_optimization_queue_status ON optimization_queue(status, priority DESC);

-- ================================================================
-- TRIGGERS
-- ================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_optimizer_config_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER optimizer_configs_updated_at
    BEFORE UPDATE ON optimizer_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_optimizer_config_timestamp();

-- Ensure only one config is active at a time
CREATE OR REPLACE FUNCTION ensure_single_active_config()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE optimizer_configs
        SET is_active = FALSE
        WHERE id != NEW.id AND is_active = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER single_active_config
    BEFORE INSERT OR UPDATE OF is_active ON optimizer_configs
    FOR EACH ROW
    WHEN (NEW.is_active = TRUE)
    EXECUTE FUNCTION ensure_single_active_config();

-- ================================================================
-- SEED DEFAULT CONFIGURATION
-- ================================================================

INSERT INTO optimizer_configs (
    name,
    description,
    is_active,
    min_rest_hours,
    max_shift_duration_hours,
    max_consecutive_shifts,
    max_work_days_per_week,
    qual_expiry_threshold_days,
    coverage_weight,
    cross_dept_penalty,
    fairness_penalty_per_hour,
    overtime_penalty_per_hour,
    target_hours_week,
    use_gurobi,
    time_limit_sec,
    mip_gap
) VALUES (
    'Default Configuration',
    'Standard optimizer settings for balanced scheduling',
    TRUE,
    11,    -- min_rest_hours
    14,    -- max_shift_duration_hours
    5,     -- max_consecutive_shifts
    6,     -- max_work_days_per_week
    90,    -- qual_expiry_threshold_days
    1000,  -- coverage_weight
    100,   -- cross_dept_penalty
    10,    -- fairness_penalty_per_hour
    50,    -- overtime_penalty_per_hour
    35,    -- target_hours_week
    FALSE, -- use_gurobi
    120,   -- time_limit_sec
    0.01   -- mip_gap (1%)
) ON CONFLICT (name) DO NOTHING;

-- Aggressive Configuration (prioritize coverage over fairness)
INSERT INTO optimizer_configs (
    name,
    description,
    is_active,
    coverage_weight,
    fairness_penalty_per_hour,
    overtime_penalty_per_hour,
    time_limit_sec
) VALUES (
    'Aggressive Coverage',
    'Maximize shift coverage, allow more overtime and deviation',
    FALSE,
    2000,  -- Double coverage weight
    5,     -- Lower fairness penalty
    25,    -- Lower overtime penalty
    180    -- More time to find solution
) ON CONFLICT (name) DO NOTHING;

-- Conservative Configuration (prioritize fairness and work-life balance)
INSERT INTO optimizer_configs (
    name,
    description,
    is_active,
    max_consecutive_shifts,
    max_work_days_per_week,
    coverage_weight,
    fairness_penalty_per_hour,
    overtime_penalty_per_hour,
    target_hours_week
) VALUES (
    'Work-Life Balance',
    'Prioritize employee wellbeing with stricter limits',
    FALSE,
    4,     -- Max 4 consecutive shifts
    5,     -- Max 5 work days per week
    800,   -- Lower coverage weight
    20,    -- Higher fairness penalty
    100,   -- Higher overtime penalty
    32     -- Lower target hours
) ON CONFLICT (name) DO NOTHING;

-- ================================================================
-- RLS POLICIES (if needed)
-- ================================================================

ALTER TABLE optimizer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_queue ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
CREATE POLICY "service_role_optimizer_configs" ON optimizer_configs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_optimization_runs" ON optimization_runs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_roster_assignments" ON roster_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_optimization_queue" ON optimization_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
