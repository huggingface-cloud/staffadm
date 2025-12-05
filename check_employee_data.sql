-- ================================================================
-- EMPLOYEE DATA DIAGNOSTIC QUERIES
-- Run these in Supabase SQL Editor to check your employee data
-- ================================================================

-- 1. Check total employees in database
SELECT
    COUNT(*) as total_employees,
    COUNT(CASE WHEN active_for_rostering = true THEN 1 END) as active_employees,
    COUNT(CASE WHEN department_id IS NOT NULL THEN 1 END) as with_department,
    COUNT(CASE WHEN opco_id IS NOT NULL THEN 1 END) as with_opco
FROM employees;

-- 2. List all employees with their status
SELECT
    id,
    first_name,
    last_name,
    email,
    active_for_rostering,
    department_id,
    opco_id,
    joining_date
FROM employees
ORDER BY created_at DESC
LIMIT 20;

-- 3. Check employees that would show in API (active_for_rostering=true)
SELECT
    e.id,
    e.first_name,
    e.last_name,
    e.email,
    e.active_for_rostering,
    oc.name as operating_company,
    d.name as department
FROM employees e
LEFT JOIN operating_companies oc ON e.opco_id = oc.id
LEFT JOIN departments d ON e.department_id = d.id
WHERE e.active_for_rostering = true;

-- 4. Check employees with missing required data
SELECT
    id,
    first_name,
    last_name,
    email,
    CASE
        WHEN department_id IS NULL THEN '❌ Missing Department'
        WHEN opco_id IS NULL THEN '❌ Missing OpCo'
        WHEN NOT active_for_rostering THEN '❌ Not Active for Rostering'
        ELSE '✅ OK'
    END as status
FROM employees;

-- 5. Check related table data counts
SELECT
    'Operating Companies' as table_name, COUNT(*) as count FROM operating_companies
UNION ALL
SELECT 'Departments', COUNT(*) FROM departments
UNION ALL
SELECT 'Roles', COUNT(*) FROM roles
UNION ALL
SELECT 'Employees', COUNT(*) FROM employees
UNION ALL
SELECT 'Employee Roles', COUNT(*) FROM employee_roles
UNION ALL
SELECT 'Employee Qualifications', COUNT(*) FROM employee_qualifications
UNION ALL
SELECT 'Contracts', COUNT(*) FROM contracts
UNION ALL
SELECT 'Active Contracts', COUNT(*) FROM contracts WHERE is_active = true;

-- ================================================================
-- FIXES: Run these if needed
-- ================================================================

-- Fix 1: Activate all employees for rostering
-- UPDATE employees SET active_for_rostering = true;

-- Fix 2: Find specific employees by email to check their data
-- SELECT * FROM employees WHERE email LIKE '%youremail%';

-- Fix 3: Check a specific employee's complete data
-- SELECT
--     e.*,
--     json_agg(DISTINCT er.*) as employee_roles,
--     json_agg(DISTINCT eq.*) as qualifications,
--     json_agg(DISTINCT c.*) as contracts
-- FROM employees e
-- LEFT JOIN employee_roles er ON e.id = er.employee_id
-- LEFT JOIN employee_qualifications eq ON e.id = eq.employee_id
-- LEFT JOIN contracts c ON e.id = c.employee_id
-- WHERE e.id = 'your-employee-id'
-- GROUP BY e.id;
