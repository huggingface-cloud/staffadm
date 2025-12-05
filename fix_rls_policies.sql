-- ================================================================
-- FIX RLS POLICIES FOR API ACCESS
-- Run this in Supabase SQL Editor to allow backend API access
-- ================================================================

-- The issue: RLS is enabled on employees, roster_entries, shift_requirements, contracts
-- but NO policies are defined, so even service_role can't access via joins

-- Solution: Create policies that allow service_role full access

-- ================================================================
-- 1. EMPLOYEES TABLE POLICIES
-- ================================================================

-- Allow service_role to read all employees
CREATE POLICY "service_role_read_employees"
ON employees
FOR SELECT
TO service_role
USING (true);

-- Allow service_role to insert/update/delete employees
CREATE POLICY "service_role_all_employees"
ON employees
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================================
-- 2. CONTRACTS TABLE POLICIES
-- ================================================================

CREATE POLICY "service_role_read_contracts"
ON contracts
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "service_role_all_contracts"
ON contracts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================================
-- 3. SHIFT_REQUIREMENTS TABLE POLICIES
-- ================================================================

CREATE POLICY "service_role_read_shift_requirements"
ON shift_requirements
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "service_role_all_shift_requirements"
ON shift_requirements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================================
-- 4. ROSTER_ENTRIES TABLE POLICIES
-- ================================================================

CREATE POLICY "service_role_read_roster_entries"
ON roster_entries
FOR SELECT
TO service_role
USING (true);

CREATE POLICY "service_role_all_roster_entries"
ON roster_entries
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Check if policies are created
SELECT schemaname, tablename, policyname, roles
FROM pg_policies
WHERE tablename IN ('employees', 'contracts', 'shift_requirements', 'roster_entries')
ORDER BY tablename, policyname;

-- Test query that should work after policies are applied
-- (You can run this to verify)
/*
SELECT
    e.id,
    e.first_name,
    e.last_name,
    oc.name as operating_company,
    d.name as department
FROM employees e
LEFT JOIN operating_companies oc ON e.opco_id = oc.id
LEFT JOIN departments d ON e.department_id = d.id
LIMIT 5;
*/
