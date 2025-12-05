"""
Comprehensive employee data check script.
Run this to see why employees might not be showing in the API.
"""
from database import get_supabase
from datetime import datetime

supabase = get_supabase()

print("=" * 80)
print("EMPLOYEE DATA DIAGNOSTIC")
print("=" * 80)
print()

# 1. Check total employees
print("1. TOTAL EMPLOYEES IN DATABASE")
print("-" * 80)
all_employees = supabase.table("employees").select("*").execute()
print(f"Total employees found: {len(all_employees.data)}")
print()

if len(all_employees.data) == 0:
    print("❌ No employees found in database!")
    print("   You need to insert employee data into the 'employees' table.")
    print()
else:
    # 2. Check active_for_rostering flag
    print("2. ACTIVE_FOR_ROSTERING STATUS")
    print("-" * 80)
    for emp in all_employees.data[:10]:  # Show first 10
        status = "✅ ACTIVE" if emp.get('active_for_rostering') else "❌ INACTIVE"
        print(f"{status} - {emp['first_name']} {emp['last_name']} ({emp['email']})")

    active_count = sum(1 for e in all_employees.data if e.get('active_for_rostering'))
    print(f"\nActive employees: {active_count}/{len(all_employees.data)}")
    print()

    if active_count == 0:
        print("⚠️  No employees have active_for_rostering=true")
        print("   Update employees with: UPDATE employees SET active_for_rostering = true;")
        print()

    # 3. Check departments
    print("3. EMPLOYEE DEPARTMENTS")
    print("-" * 80)
    employees_with_dept = [e for e in all_employees.data if e.get('department_id')]
    print(f"Employees with department: {len(employees_with_dept)}/{len(all_employees.data)}")

    if len(employees_with_dept) < len(all_employees.data):
        print("⚠️  Some employees don't have a department assigned")
    print()

    # 4. Check operating companies
    print("4. EMPLOYEE OPERATING COMPANIES")
    print("-" * 80)
    employees_with_opco = [e for e in all_employees.data if e.get('opco_id')]
    print(f"Employees with operating company: {len(employees_with_opco)}/{len(all_employees.data)}")

    if len(employees_with_opco) < len(all_employees.data):
        print("⚠️  Some employees don't have an operating company assigned")
    print()

    # 5. Test the actual API query
    print("5. API QUERY TEST (active_for_rostering=true)")
    print("-" * 80)
    try:
        api_query_result = supabase.table("employees").select("""
            *,
            operating_companies(id, name, code),
            departments(id, name, code)
        """).eq("active_for_rostering", True).execute()

        print(f"API query returns: {len(api_query_result.data)} employees")

        if len(api_query_result.data) > 0:
            print("\n✅ Sample employees that would show in API:")
            for emp in api_query_result.data[:5]:
                print(f"   - {emp['first_name']} {emp['last_name']} ({emp['email']})")
        else:
            print("\n❌ No employees match API query criteria!")
            print("\nPossible reasons:")
            print("   1. No employees have active_for_rostering=true")
            print("   2. Employees don't have required foreign keys (opco_id, department_id)")
            print("   3. Related tables (operating_companies, departments) are empty")
        print()

    except Exception as e:
        print(f"❌ Error running API query: {str(e)}")
        print()

    # 6. Check related data
    print("6. RELATED TABLE DATA")
    print("-" * 80)

    # Check departments
    depts = supabase.table("departments").select("id, name, code").execute()
    print(f"Departments: {len(depts.data)}")
    if depts.data:
        for dept in depts.data[:5]:
            print(f"   - {dept['name']} ({dept['code']})")
    print()

    # Check operating companies
    opcos = supabase.table("operating_companies").select("id, name, code").execute()
    print(f"Operating Companies: {len(opcos.data)}")
    if opcos.data:
        for opco in opcos.data[:5]:
            print(f"   - {opco['name']} ({opco['code']})")
    print()

    # Check roles
    roles = supabase.table("roles").select("id, name").execute()
    print(f"Roles: {len(roles.data)}")
    if roles.data:
        for role in roles.data[:5]:
            print(f"   - {role['name']}")
    print()

    # Check employee_roles
    emp_roles = supabase.table("employee_roles").select("employee_id, role_id").execute()
    print(f"Employee Role Assignments: {len(emp_roles.data)}")
    print()

    # Check qualifications
    quals = supabase.table("employee_qualifications").select("employee_id").execute()
    print(f"Employee Qualifications: {len(quals.data)}")
    print()

    # Check contracts
    contracts = supabase.table("contracts").select("employee_id, is_active").execute()
    active_contracts = [c for c in contracts.data if c.get('is_active')]
    print(f"Contracts: {len(contracts.data)} (Active: {len(active_contracts)})")
    print()

print("=" * 80)
print("RECOMMENDED SQL FIXES")
print("=" * 80)
print()

if len(all_employees.data) == 0:
    print("No employees found. You need to insert employee data first.")
else:
    if active_count == 0:
        print("-- Activate all employees for rostering:")
        print("UPDATE employees SET active_for_rostering = true;")
        print()

    if len(employees_with_dept) < len(all_employees.data):
        print("-- Check employees missing department:")
        print("SELECT id, first_name, last_name, email FROM employees WHERE department_id IS NULL;")
        print()

    if len(employees_with_opco) < len(all_employees.data):
        print("-- Check employees missing operating company:")
        print("SELECT id, first_name, last_name, email FROM employees WHERE opco_id IS NULL;")
        print()

print("\n✅ Diagnostic complete!")
