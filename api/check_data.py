"""Quick script to check if there's data in the database."""
from database import get_supabase

supabase = get_supabase()

# Check employees
emp_response = supabase.table("employees").select("id, first_name, last_name, email, active_for_rostering").execute()
print(f"Employees found: {len(emp_response.data)}")
if emp_response.data:
    print("Sample employees:")
    for emp in emp_response.data[:5]:
        print(f"  - {emp['first_name']} {emp['last_name']} ({emp['email']}) - active_for_rostering: {emp.get('active_for_rostering')}")
else:
    print("  No employees in database!")

print()

# Check departments
dept_response = supabase.table("departments").select("id, name, code").execute()
print(f"Departments found: {len(dept_response.data)}")

print()

# Check roles
role_response = supabase.table("roles").select("id, role_name").execute()
print(f"Roles found: {len(role_response.data)}")

print()

# Check shift_requirements
shift_response = supabase.table("shift_requirements").select("id, start_time, end_time").execute()
print(f"Shift requirements found: {len(shift_response.data)}")
