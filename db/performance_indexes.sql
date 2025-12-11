-- ======================================================================
-- PERFORMANCE OPTIMIZATION: Database Indexes
-- Creates indexes to improve query performance
-- ======================================================================

-- 1. EMPLOYEE-RELATED INDEXES
-- ======================================================================

-- Fast lookups by department
CREATE INDEX IF NOT EXISTS idx_employees_department
    ON employees(department_id) WHERE active_for_rostering = true;

-- Email lookups (for auth/search)
CREATE INDEX IF NOT EXISTS idx_employees_email
    ON employees(email);

-- Active employees for rostering queries
CREATE INDEX IF NOT EXISTS idx_employees_active
    ON employees(active_for_rostering, department_id);

-- 2. SHIFT REQUIREMENTS INDEXES
-- ======================================================================

-- Date range queries (most common)
CREATE INDEX IF NOT EXISTS idx_shift_requirements_dates
    ON shift_requirements(start_time, end_time);

-- Department filtering
CREATE INDEX IF NOT EXISTS idx_shift_requirements_dept
    ON shift_requirements(department_id, start_time);

-- Composite index for optimizer queries
CREATE INDEX IF NOT EXISTS idx_shift_requirements_optimizer
    ON shift_requirements(department_id, start_time, end_time, headcount_needed);

-- 3. ROSTER ASSIGNMENTS INDEXES
-- ======================================================================

-- Employee-based lookups
CREATE INDEX IF NOT EXISTS idx_roster_assignments_employee
    ON roster_assignments(employee_id, shift_date);

-- Shift-based lookups
CREATE INDEX IF NOT EXISTS idx_roster_assignments_shift
    ON roster_assignments(shift_id, shift_date);

-- Date range queries for cross-department hours
CREATE INDEX IF NOT EXISTS idx_roster_assignments_dates
    ON roster_assignments(shift_date, shift_start_time, shift_end_time);

-- Optimization run tracking
CREATE INDEX IF NOT EXISTS idx_roster_assignments_run
    ON roster_assignments(optimization_run_id);

-- Weekly hours reporting (composite)
CREATE INDEX IF NOT EXISTS idx_roster_assignments_weekly
    ON roster_assignments(employee_id, shift_date, employee_weekly_hours);

-- 4. CONTRACTS INDEXES
-- ======================================================================

-- Active contracts lookup
CREATE INDEX IF NOT EXISTS idx_contracts_active
    ON contracts(employee_id, is_active, valid_from, valid_until);

-- Validity period queries
CREATE INDEX IF NOT EXISTS idx_contracts_validity
    ON contracts(is_active, valid_from, valid_until);

-- 5. ROLES & QUALIFICATIONS INDEXES
-- ======================================================================

-- Department-based role lookups
CREATE INDEX IF NOT EXISTS idx_roles_department
    ON roles(department_id) WHERE is_active = true;

-- Employee qualifications
CREATE INDEX IF NOT EXISTS idx_employee_qualifications_employee
    ON employee_qualifications(employee_id, expiry_date);

-- 6. OPTIMIZATION RUNS INDEXES
-- ======================================================================

-- Department filtering for history
CREATE INDEX IF NOT EXISTS idx_optimization_runs_dept
    ON optimization_runs(department_id, created_at DESC);

-- Admin user tracking
CREATE INDEX IF NOT EXISTS idx_optimization_runs_admin
    ON optimization_runs(created_by_admin_id, created_at DESC);

-- Status queries
CREATE INDEX IF NOT EXISTS idx_optimization_runs_status
    ON optimization_runs(status, created_at DESC);

-- 7. ADMIN USERS INDEXES (Already created in auth_schema.sql)
-- ======================================================================
-- These should already exist:
-- - idx_admin_users_email
-- - idx_admin_users_department

-- 8. COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ======================================================================

-- Shift requirements with role filtering (if role columns exist)
CREATE INDEX IF NOT EXISTS idx_shift_requirements_role_filter
    ON shift_requirements(department_id, start_time)
    INCLUDE (required_role_id, headcount_needed);

-- Employee with contract lookup
CREATE INDEX IF NOT EXISTS idx_employees_with_contracts
    ON employees(id, department_id, active_for_rostering);

-- 9. PARTIAL INDEXES FOR SPECIFIC SCENARIOS
-- ======================================================================

-- Only active future shifts (reduces index size)
CREATE INDEX IF NOT EXISTS idx_shift_requirements_future
    ON shift_requirements(department_id, start_time, headcount_needed)
    WHERE start_time >= CURRENT_DATE;

-- Only active employees with contracts
CREATE INDEX IF NOT EXISTS idx_employees_rostering_ready
    ON employees(department_id, id)
    WHERE active_for_rostering = true;

-- 10. ANALYZE TABLES FOR QUERY PLANNER
-- ======================================================================

ANALYZE employees;
ANALYZE shift_requirements;
ANALYZE roster_assignments;
ANALYZE contracts;
ANALYZE roles;
ANALYZE qualifications;
ANALYZE employee_qualifications;
ANALYZE optimization_runs;
ANALYZE admin_users;

-- Display index information
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN ('employees', 'shift_requirements', 'roster_assignments', 'contracts', 'optimization_runs')
ORDER BY tablename, indexname;
