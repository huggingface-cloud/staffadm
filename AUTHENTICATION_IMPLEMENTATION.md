# Department-Based Authentication Implementation Plan

## Overview
Implement admin login system with department-based access control, allowing each department admin to run and save their own rosters while respecting cross-department employee max hours constraints.

## Key Requirements
1. ✅ Admin users can log in with email/password
2. ✅ Department admins see only their department's data
3. ✅ Super admins see all departments
4. ✅ Employees can work across departments
5. ✅ Max hours constraint applies globally (not per department)
6. ✅ Each admin can run and save rosters for their department

## Architecture

### Database Schema
- **admin_users** table: Stores admin credentials and department assignment
- **departments** table: Already exists
- **optimization_runs** table: Extended with `department_id` and `created_by_admin_id`

### Backend Components
1. **Authentication Service** (`staffadm/api/auth.py`)
   - JWT token generation and validation
   - Password hashing with bcrypt
   - Login/logout endpoints

2. **Auth Middleware**
   - Protect endpoints requiring authentication
   - Extract user info from JWT tokens
   - Validate department access

3. **Updated API Endpoints**
   - All endpoints filtered by department (except super_admin)
   - Optimizer respects department filtering but validates cross-department hours

### Frontend Components
1. **Login Page** (`staffadm/web/app/login/page.tsx`)
   - Email/password form
   - JWT token storage
   - Redirect after login

2. **Auth Context** (`staffadm/web/contexts/AuthContext.tsx`)
   - Global authentication state
   - User info (role, department)
   - Token management

3. **Protected Routes**
   - Redirect to login if not authenticated
   - Show department-specific data

## Cross-Department Employee Hours Validation

### How It Works:
1. **Department Admin runs roster for their department**
   - Only sees shifts for their department
   - Can assign any active employee to their shifts

2. **Optimizer validates global employee hours**
   - Checks total hours across ALL departments
   - Prevents employee from exceeding weekly max (48h)
   - Example: If employee works 30h for Dept A, they can only work 18h more for Dept B

3. **Implementation**:
   - When running optimization, fetch employee's total weekly hours from ALL departments
   - Add constraint: `employee_total_hours_all_depts <= 48h`
   - This is done in `optimizer_optimized.py`

## Files Created/Modified

### Created Files:
1. `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/db/auth_schema.sql` ✅
2. `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/api/auth.py` (next)
3. `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/api/auth_middleware.py` (next)
4. `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/web/app/login/page.tsx` (next)
5. `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/web/contexts/AuthContext.tsx` (next)

### Modified Files:
1. `staffadm/api/main.py` - Add auth endpoints and middleware
2. `staffadm/opti/optimizer_optimized.py` - Add cross-department hours validation
3. `staffadm/opti/supabase_integration.py` - Add department filtering
4. `staffadm/web/app/page.tsx` - Add auth protection

## Default Credentials (for testing)
- **Super Admin**:
  - Email: `admin@staffadmin.com`
  - Password: `password123`
  - Access: All departments

- **Department Admins**:
  - Will be created per department
  - Format: `{dept}.admin@staffadmin.com`
  - Password: `password123`

## Next Steps
1. ✅ Create database schema (completed)
2. Create authentication backend
3. Create login frontend
4. Add auth protection to all pages
5. Update optimizer to validate cross-department hours
6. Test with multi-department scenarios

## Security Considerations
- JWT tokens with expiration (24 hours)
- Bcrypt password hashing (12 rounds)
- HTTP-only cookies for token storage
- CORS protection
- Rate limiting on login endpoint
- RLS (Row Level Security) on Supabase tables
