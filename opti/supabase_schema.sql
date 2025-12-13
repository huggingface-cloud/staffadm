-- Supabase Database Schema for Roster Optimization
-- Run this in your Supabase SQL Editor

-- ======================================================================
-- CORE TABLES
-- ======================================================================

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  department TEXT,
  max_hours_week INTEGER DEFAULT 40,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee qualifications
CREATE TABLE IF NOT EXISTS employee_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  qual_id TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(employee_id, qual_id)
);

-- Employee absences
CREATE TABLE IF NOT EXISTS employee_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee anomalies (temporary restrictions)
CREATE TABLE IF NOT EXISTS employee_anomalies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  restricted_roles TEXT[] NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift requirements
CREATE TABLE IF NOT EXISTS shift_requirements (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL,
  department TEXT,
  duration_hours INTEGER NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ======================================================================
-- OPTIMIZATION TRACKING TABLES
-- ======================================================================

-- Optimization runs (results storage)
CREATE TABLE IF NOT EXISTS optimization_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL, -- 'queued', 'running', 'Optimal', 'Infeasible', 'failed'
  objective_value NUMERIC,
  total_shifts_assigned INTEGER,
  uncovered_shifts_count INTEGER,
  statistics JSONB,
  roster_data JSONB,
  uncovered_shifts JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Individual roster assignments (for easy querying)
CREATE TABLE IF NOT EXISTS roster_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimization_run_id UUID REFERENCES optimization_runs(id) ON DELETE CASCADE,
  employee_id TEXT REFERENCES employees(id),
  shift_id TEXT REFERENCES shift_requirements(id),
  start_time TIMESTAMPTZ NOT NULL,
  duration_hours INTEGER NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent duplicate assignments of the same employee to the same shift
  UNIQUE(employee_id, shift_id, optimization_run_id)
);

-- Optimization queue (for background processing)
CREATE TABLE IF NOT EXISTS optimization_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES optimization_runs(id),
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ======================================================================
-- INDEXES FOR PERFORMANCE
-- ======================================================================

CREATE INDEX IF NOT EXISTS idx_employee_quals_employee ON employee_qualifications(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_absences_employee ON employee_absences(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_anomalies_employee ON employee_anomalies(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_anomalies_dates ON employee_anomalies(start_date, end_date) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_shifts_start_time ON shift_requirements(start_time);
CREATE INDEX IF NOT EXISTS idx_shifts_role ON shift_requirements(role);
CREATE INDEX IF NOT EXISTS idx_shifts_department ON shift_requirements(department);

CREATE INDEX IF NOT EXISTS idx_roster_assignments_run ON roster_assignments(optimization_run_id);
CREATE INDEX IF NOT EXISTS idx_roster_assignments_employee ON roster_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_roster_assignments_shift ON roster_assignments(shift_id);

CREATE INDEX IF NOT EXISTS idx_optimization_runs_status ON optimization_runs(status);
CREATE INDEX IF NOT EXISTS idx_optimization_runs_dates ON optimization_runs(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_queue_status ON optimization_queue(status) WHERE status = 'pending';

-- ======================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ======================================================================

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_anomalies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE optimization_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_assignments ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust based on your auth requirements)

-- Employees: authenticated users can read
CREATE POLICY "Employees readable by authenticated users"
  ON employees FOR SELECT
  TO authenticated
  USING (true);

-- Optimization runs: users can read their own runs
CREATE POLICY "Users can read their own optimization runs"
  ON optimization_runs FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id OR user_id IS NULL);

-- Roster assignments: users can read assignments from their runs
CREATE POLICY "Users can read roster assignments"
  ON roster_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM optimization_runs
      WHERE id = roster_assignments.optimization_run_id
      AND (auth.uid()::text = user_id OR user_id IS NULL)
    )
  );

-- Service role can do everything (for backend operations)
CREATE POLICY "Service role full access - employees"
  ON employees FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access - optimization_runs"
  ON optimization_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ======================================================================
-- FUNCTIONS AND TRIGGERS
-- ======================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for employees table
CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ======================================================================
-- SAMPLE DATA (for testing)
-- ======================================================================

-- Insert sample employees
INSERT INTO employees (id, role, department, max_hours_week) VALUES
  ('emp_A01', 'Agent_GR', 'Ground_Operations', 40),
  ('emp_A02', 'Agent_GR', 'Ground_Operations', 35),
  ('emp_M01', 'Mechanic_B777', 'Maintenance', 40),
  ('emp_S01', 'Security', 'Security', 40)
ON CONFLICT (id) DO NOTHING;

-- Insert sample qualifications
INSERT INTO employee_qualifications (employee_id, qual_id, expiry_date) VALUES
  ('emp_A01', 'Qual_DCS', '2026-06-01'),
  ('emp_A01', 'Qual_Ramp_Access', '2026-06-01'),
  ('emp_A02', 'Qual_DCS', '2026-06-01'),
  ('emp_A02', 'Qual_Ramp_Access', '2026-03-01'),
  ('emp_M01', 'Qual_B777_Cert', '2027-01-15'),
  ('emp_S01', 'Qual_Security_Clearance', '2026-12-31')
ON CONFLICT (employee_id, qual_id) DO NOTHING;

-- Insert sample shifts
INSERT INTO shift_requirements (id, role, department, duration_hours, start_time) VALUES
  ('GR_S1_MON', 'Agent_GR', 'Ground_Operations', 8, '2025-12-09 08:00:00+00'),
  ('GR_S2_MON', 'Agent_GR', 'Ground_Operations', 8, '2025-12-09 16:00:00+00'),
  ('GR_S3_TUE', 'Agent_GR', 'Ground_Operations', 8, '2025-12-10 08:00:00+00'),
  ('MECH_S1_MON', 'Mechanic_B777', 'Maintenance', 10, '2025-12-09 06:00:00+00'),
  ('SEC_S1_MON', 'Security', 'Security', 12, '2025-12-09 20:00:00+00')
ON CONFLICT (id) DO NOTHING;

-- ======================================================================
-- VIEWS FOR EASY QUERYING
-- ======================================================================

-- View: Employee roster summary
CREATE OR REPLACE VIEW employee_roster_summary AS
SELECT
  ra.optimization_run_id,
  ra.employee_id,
  e.role,
  e.department,
  COUNT(ra.id) as total_shifts,
  SUM(ra.duration_hours) as total_hours,
  MIN(ra.start_time) as first_shift,
  MAX(ra.start_time) as last_shift
FROM roster_assignments ra
JOIN employees e ON e.id = ra.employee_id
GROUP BY ra.optimization_run_id, ra.employee_id, e.role, e.department;

-- View: Uncovered shifts per optimization run
CREATE OR REPLACE VIEW uncovered_shifts_view AS
SELECT
  sr.id as shift_id,
  sr.role,
  sr.department,
  sr.start_time,
  sr.duration_hours,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM roster_assignments ra
      WHERE ra.shift_id = sr.id
    ) THEN false
    ELSE true
  END as is_uncovered
FROM shift_requirements sr;

-- Grant access to views
GRANT SELECT ON employee_roster_summary TO authenticated, service_role;
GRANT SELECT ON uncovered_shifts_view TO authenticated, service_role;
