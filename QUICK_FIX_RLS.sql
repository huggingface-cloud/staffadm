-- ================================================================
-- QUICK FIX: Enable API access by creating RLS policies
-- Copy and paste this entire script into Supabase SQL Editor and run it
-- ================================================================

-- 1. GUARANTEE RLS IS ENABLED
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_entries ENABLE ROW LEVEL SECURITY;

-- 2. SERVICE ROLE POLICIES (Full Access for Backend/Admin Operations)

create policy "RLS_Employees_Admin_Access"
on "public"."employees"
as PERMISSIVE
for ALL
to service_role
using (true) with check ( true );

create policy "RLS_Contracts_Admin_Access"
on "public"."contracts"
as PERMISSIVE
for ALL
to service_role
using (true) with check ( true );

create policy "RLS_Shifts_Admin_Access"
on "public"."shift_requirements"
as PERMISSIVE
for ALL
to service_role
using (true) with check ( true );

create policy "RLS_Rosters_Admin_Access"
on "public"."roster_entries"
as PERMISSIVE
for ALL
to service_role
using (true) with check ( true );