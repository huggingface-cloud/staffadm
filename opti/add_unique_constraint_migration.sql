-- Migration: Add unique constraint to prevent duplicate employee-shift assignments
-- Date: 2025-12-08
-- Purpose: Fix issue where employees were being assigned multiple times to the same shift

-- First, remove any existing duplicate assignments (keep only the first occurrence)
DELETE FROM roster_assignments a
USING roster_assignments b
WHERE a.id < b.id
  AND a.employee_id = b.employee_id
  AND a.shift_id = b.shift_id
  AND a.optimization_run_id = b.optimization_run_id;

-- Now add the unique constraint
ALTER TABLE roster_assignments
ADD CONSTRAINT unique_employee_shift_assignment
UNIQUE (employee_id, shift_id, optimization_run_id);

-- Verify the constraint was added
SELECT conname, contype, confupdtype, confdeltype
FROM pg_constraint
WHERE conname = 'unique_employee_shift_assignment';
