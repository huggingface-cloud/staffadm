# 🗄️ Database Setup Branch

This branch contains database migrations and SQL scripts for Supabase.

## 📁 What's Included

- `/db` - All SQL migration files
- Setup scripts for departments, employees, shifts
- Unique constraint migrations

## 🚀 Setup Supabase Database

Your database is already hosted on Supabase at:
```
https://xueqvozgeebhlffxmiqp.supabase.co
```

## 📝 Apply Migrations

### Required Migration: Unique Constraint

**IMPORTANT**: Apply this migration to prevent duplicate shift assignments:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to "SQL Editor"
4. Run this SQL:

```sql
ALTER TABLE roster_assignments
ADD CONSTRAINT unique_shift_employee
UNIQUE (shift_id, employee_id);
```

This is located in: `db/add_unique_constraint_roster_assignments.sql`

## 📋 Database Schema

The database includes these main tables:

- `admin_users` - Admin authentication
- `departments` - Organizational departments
- `employees` - Staff members
- `roles` - Job roles
- `qualifications` - Employee certifications
- `skills` - Employee skills
- `contracts` - Employment contracts
- `shift_requirements` - Shift scheduling needs
- `roster_assignments` - Scheduled shifts
- `absences` - Employee time off

## 🔑 Credentials

### Service Role Key (for backend/optimizer)

Get from Supabase Dashboard → Settings → API:
- Use the **service_role** key (not anon key)
- This key has full database access

### Admin Login

- Email: `admin@staffadmin.com`
- Password: `password123`

## 🛠️ Optional Setup Scripts

If starting fresh, you can run these in order:

1. `setup_departments.sql` - Create departments and sample data
2. `add_unique_constraint_roster_assignments.sql` - Add constraints

## 🔗 Environment Variables

Add these to your backend and optimizer services:

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=your_service_role_key_here
```

## ✅ Verify Setup

Test database connection:

```bash
curl -X GET "https://xueqvozgeebhlffxmiqp.supabase.co/rest/v1/departments" \
  -H "apikey: YOUR_SERVICE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_KEY"
```

Should return list of departments.

## 📊 Database Stats

Current data:
- **Departments**: 2 (Engineering - LHR, Ground Operations - LHR)
- **Employees**: 22 active employees
- **Shift Requirements**: Multiple shifts per day
- **Admin Users**: 1 super admin + department admins

## 🔒 Security

- Row Level Security (RLS) is enabled on tables
- Service role key bypasses RLS (use carefully)
- Admin authentication via JWT tokens
- Department-based access control

## 📝 Notes

- Supabase free tier: 500 MB database, 2 GB bandwidth
- Auto-backups included
- Real-time subscriptions available (not currently used)
- Can upgrade to paid tier for more storage/features
