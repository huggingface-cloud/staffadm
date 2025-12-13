-- Migration: Add unique constraint to roster_assignments table
-- Date: 2025-12-13
-- Purpose: Prevent duplicate shift-employee assignments

-- Add unique constraint to prevent an employee being assigned to the same shift multiple times
ALTER TABLE roster_assignments
ADD CONSTRAINT unique_shift_employee
UNIQUE (shift_id, employee_id);

-- This constraint ensures data integrity by preventing:
-- 1. Duplicate assignments from the optimizer
-- 2. Manual duplicate assignments through the UI
-- 3. Race conditions in concurrent assignment operations

-- To apply: Run this SQL in Supabase SQL Editor or via psql
