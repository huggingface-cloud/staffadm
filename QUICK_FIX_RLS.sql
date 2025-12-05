-- ================================================================
-- QUICK FIX: Enable API access by creating RLS policies
-- Copy and paste this entire script into Supabase SQL Editor and run it
-- ================================================================

-- Allow service_role full access to employees
CREATE POLICY IF NOT EXISTS "Allow service_role all on employees"
ON employees FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service_role full access to contracts
CREATE POLICY IF NOT EXISTS "Allow service_role all on contracts"
ON contracts FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service_role full access to shift_requirements
CREATE POLICY IF NOT EXISTS "Allow service_role all on shift_requirements"
ON shift_requirements FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow service_role full access to roster_entries
CREATE POLICY IF NOT EXISTS "Allow service_role all on roster_entries"
ON roster_entries FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
