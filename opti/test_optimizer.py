#!/usr/bin/env python3
"""
Test script to debug optimizer issues
"""
import os
import sys
from datetime import datetime
from supabase import create_client

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

from optimizer_optimized import load_data_from_supabase, RosterOptimizer, CONFIG

SUPABASE_URL = "https://xueqvozgeebhlffxmiqp.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90"

def test_optimizer():
    print("=" * 60)
    print("OPTIMIZER DEBUG TEST")
    print("=" * 60)

    # Create Supabase client
    supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # Fetch employees
    print("\n1. Fetching employees...")
    employees_response = supabase.table("employees").select(
        "id, first_name, last_name, department_id, active_for_rostering"
    ).eq("active_for_rostering", True).execute()

    employees_data = employees_response.data
    print(f"   Found {len(employees_data)} employees")
    if employees_data:
        print(f"   Sample: {employees_data[0]}")

    # Fetch shifts
    print("\n2. Fetching shifts...")
    shifts_response = supabase.table("shift_requirements").select(
        "id, start_time, end_time, headcount_needed, required_role_id, department_id, location"
    ).gte("start_time", "2025-12-01").lte("start_time", "2025-12-08").execute()

    shifts_data = shifts_response.data
    print(f"   Found {len(shifts_data)} shifts")
    if shifts_data:
        print(f"   Sample: {shifts_data[0]}")

    # Load data
    print("\n3. Loading data into optimizer format...")
    try:
        employees, shifts, employee_quals, employee_absences, employee_anomalies = load_data_from_supabase(
            employees_data, shifts_data
        )
        print(f"   Loaded {len(employees)} employees, {len(shifts)} shifts")

        # Show sample shift
        if shifts:
            shift_id = list(shifts.keys())[0]
            print(f"   Sample shift: {shifts[shift_id]}")
    except Exception as e:
        print(f"   ERROR loading data: {e}")
        import traceback
        traceback.print_exc()
        return

    # Create optimizer
    print("\n4. Creating optimizer instance...")
    try:
        optimizer = RosterOptimizer(
            employees, shifts, employee_quals,
            employee_absences, employee_anomalies
        )
        print(f"   Created optimizer with {len(optimizer.employee_ids)} employees, {len(optimizer.shift_ids)} shifts")
        print(f"   Eligible assignments: {sum(len(v) for v in optimizer.employee_allowed_shifts.values())}")

        # Show eligibility details
        for emp_id in list(optimizer.employee_ids)[:2]:
            eligible_shifts = optimizer.employee_allowed_shifts[emp_id]
            print(f"   Employee {emp_id[:8]}: {len(eligible_shifts)} eligible shifts")

    except Exception as e:
        print(f"   ERROR creating optimizer: {e}")
        import traceback
        traceback.print_exc()
        return

    # Run optimization
    print("\n5. Running optimization...")
    try:
        result = optimizer.solve()
        print(f"   Status: {result['status']}")
        print(f"   Objective: {result.get('objective_value', 'N/A')}")
        print(f"   Assigned shifts: {sum(len(r['shifts_assigned']) for r in result['roster'])}")
        print(f"   Uncovered shifts: {len(result['uncovered_shifts'])}")
    except Exception as e:
        print(f"   ERROR running optimization: {e}")
        import traceback
        traceback.print_exc()
        return

    print("\n" + "=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)

if __name__ == "__main__":
    test_optimizer()
