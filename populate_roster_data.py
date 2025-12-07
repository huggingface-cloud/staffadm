#!/usr/bin/env python3
"""
Populate roster database with sample assignments.
This creates roster_assignments to show real data in the UI.
"""

import os
import sys
from datetime import datetime, timedelta
from supabase import create_client
import random

# Supabase configuration
SUPABASE_URL = "https://xueqvozgeebhlffxmiqp.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_employees():
    """Fetch all active employees."""
    response = supabase.table("employees").select("id, first_name, last_name").eq("active_for_rostering", True).execute()
    return response.data

def get_shifts():
    """Fetch all shift requirements."""
    response = supabase.table("shift_requirements").select("id, start_time, end_time, headcount_needed, required_role_id").execute()
    return response.data

def create_assignments():
    """Create roster assignments for shifts."""
    print("Fetching employees...")
    employees = get_employees()
    if not employees:
        print("❌ No active employees found. Please add employees first.")
        return

    print(f"✅ Found {len(employees)} active employees")

    print("\nFetching shifts...")
    shifts = get_shifts()
    if not shifts:
        print("❌ No shift requirements found. Please add shifts first.")
        return

    print(f"✅ Found {len(shifts)} shift requirements")

    # Clear existing roster assignments to start fresh
    print("\nClearing existing assignments...")
    supabase.table("roster_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

    print("\nCreating assignments...")
    assignments = []

    for shift in shifts:
        # Calculate how many employees to assign (between 50% and 100% of needed headcount)
        headcount_needed = shift["headcount_needed"]
        num_to_assign = random.randint(max(1, headcount_needed // 2), headcount_needed)

        # Randomly select employees for this shift
        selected_employees = random.sample(employees, min(num_to_assign, len(employees)))

        for emp in selected_employees:
            # Generate realistic weekly hours
            base_hours = random.randint(32, 40)
            variance = random.randint(-5, 10)
            weekly_hours = base_hours + variance

            # Calculate overtime
            overtime_hours = max(0, weekly_hours - 40)

            # Determine if cross-department (10% chance)
            is_cross_dept = random.random() < 0.1

            # Extract date from shift start_time
            shift_date = shift["start_time"].split("T")[0]

            assignment = {
                "shift_id": shift["id"],
                "employee_id": emp["id"],
                "shift_date": shift_date,
                "shift_start_time": shift["start_time"],
                "shift_end_time": shift["end_time"],
                "shift_role": "Check-in Agent",  # Default role
                "shift_location": "Terminal 5",  # Default location
                "employee_weekly_hours": weekly_hours,
                "employee_overtime_hours": overtime_hours,
                "is_cross_department": is_cross_dept
            }
            assignments.append(assignment)

    # Insert assignments in batches
    batch_size = 100
    for i in range(0, len(assignments), batch_size):
        batch = assignments[i:i + batch_size]
        try:
            supabase.table("roster_assignments").insert(batch).execute()
            print(f"  ✅ Inserted {len(batch)} assignments (batch {i//batch_size + 1})")
        except Exception as e:
            print(f"  ❌ Error inserting batch: {e}")

    print(f"\n✅ Successfully created {len(assignments)} roster assignments!")

    # Show some statistics
    total_shifts = len(shifts)
    total_assignments = len(assignments)
    avg_fill_rate = (total_assignments / sum(s["headcount_needed"] for s in shifts)) * 100 if shifts else 0

    print(f"\n📊 Statistics:")
    print(f"   Total shifts: {total_shifts}")
    print(f"   Total assignments: {total_assignments}")
    print(f"   Average fill rate: {avg_fill_rate:.1f}%")
    print(f"   Employees utilized: {len(set(a['employee_id'] for a in assignments))}/{len(employees)}")

if __name__ == "__main__":
    print("=" * 60)
    print("  Roster Assignment Data Population Script")
    print("=" * 60)
    print()

    try:
        create_assignments()
        print("\n✅ Data population completed successfully!")
    except Exception as e:
        print(f"\n❌ Error: {e}")
        sys.exit(1)
