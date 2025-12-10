-- Admin Users and Authentication Schema
-- Run this in Supabase SQL Editor

-- 1. Create admin_users table
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    department_id UUID REFERENCES departments(id),
    role VARCHAR(50) NOT NULL DEFAULT 'dept_admin', -- 'super_admin' or 'dept_admin'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_department ON admin_users(department_id);

-- 3. Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Create trigger for admin_users
DROP TRIGGER IF EXISTS update_admin_users_updated_at ON admin_users;
CREATE TRIGGER update_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Add department_id to optimization_runs table (if not exists)
ALTER TABLE optimization_runs
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id),
ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES admin_users(id);

-- 6. Create index for department filtering on optimization_runs
CREATE INDEX IF NOT EXISTS idx_optimization_runs_department ON optimization_runs(department_id);

-- 7. Insert sample admin users (passwords are hashed 'password123')
-- Note: In production, use bcrypt with proper salt
INSERT INTO admin_users (email, password_hash, full_name, department_id, role, is_active)
VALUES
    ('admin@staffadmin.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYk8h7xEhyO', 'Super Admin', NULL, 'super_admin', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 8. Insert department-specific admins (get department IDs first)
-- You'll need to replace these UUIDs with actual department IDs from your departments table
-- Example:
-- INSERT INTO admin_users (email, password_hash, full_name, department_id, role, is_active)
-- SELECT
--     'ground.ops@staffadmin.com',
--     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYk8h7xEhyO',
--     'Ground Operations Admin',
--     id,
--     'dept_admin',
--     TRUE
-- FROM departments WHERE name = 'Ground Operations - LHR'
-- ON CONFLICT (email) DO NOTHING;

-- 9. Enable RLS (Row Level Security) for admin_users table
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- 10. Create RLS policies for admin_users
-- Only authenticated admins can read their own record
CREATE POLICY "Admins can read own record" ON admin_users
    FOR SELECT
    USING (auth.uid() = id);

-- Super admins can read all admin records
CREATE POLICY "Super admins can read all admins" ON admin_users
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM admin_users
            WHERE id = auth.uid() AND role = 'super_admin'
        )
    );

COMMENT ON TABLE admin_users IS 'Admin users with department-based access control';
COMMENT ON COLUMN admin_users.role IS 'super_admin: full access, dept_admin: department-specific access';
COMMENT ON COLUMN admin_users.department_id IS 'NULL for super_admin, specific department for dept_admin';
