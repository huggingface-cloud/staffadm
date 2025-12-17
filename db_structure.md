-- =================================================================
-- STAFF ADMIN & ROSTERING SYSTEM - MASTER SCHEMA (v1.2)
-- Updates: Guaranteed minimum 5 rows in core operational tables for testing.
-- Database: PostgreSQL / Supabase
-- =================================================================

-- 1. SETUP & EXTENSIONS
---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS (Type Safety)
---------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer', 'employee');
CREATE TYPE shift_status AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE roster_status AS ENUM ('assigned', 'confirmed', 'swapped', 'sick', 'absent', 'absent_retrospective');
CREATE TYPE audit_op AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE contract_type_enum AS ENUM ('Full Time', 'Part Time', 'Zero Hours', 'Seasonal');
CREATE TYPE skill_level_enum AS ENUM ('Minimum', 'Recommended');
CREATE TYPE anomaly_type_enum AS ENUM ('Injury', 'Pregnancy', 'Long-Term Sickness', 'Other Restriction');


-- =================================================================
-- SECTION A: CORE MASTER & ORGANIZATION TABLES
-- (Order is crucial for Foreign Key dependencies)
-- =================================================================

-- Operating Companies (Tenant Isolation)
CREATE TABLE operating_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Qualification Types (Master List) - MUST BE DEFINED EARLY
CREATE TABLE qualification_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    name TEXT NOT NULL, 
    details TEXT,
    validity_period_months INT, 
    is_mandatory BOOLEAN DEFAULT FALSE
);

-- Departments (Organizational Hierarchy)
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    parent_dept_id UUID REFERENCES departments(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roles (Job Definitions)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Role Qualifications (Minimum/Recommended Skills for a Role)
CREATE TABLE role_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES roles(id) NOT NULL,
    qualification_type_id UUID REFERENCES qualification_types(id) NOT NULL,
    skill_level skill_level_enum NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (role_id, qualification_type_id, skill_level)
);


-- =================================================================
-- SECTION B: PEOPLE & LINKAGE TABLES
-- =================================================================

-- Employees (PII - Requires strict RLS)
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id), 
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    department_id UUID REFERENCES departments(id) NOT NULL,
    
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    joining_date DATE NOT NULL,
    
    active_for_rostering BOOLEAN DEFAULT TRUE, 
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts (Links to Employee)
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    contract_type contract_type_enum NOT NULL, 
    weekly_hours_limit INT DEFAULT 40,
    min_rest_hours INT DEFAULT 11,
    
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Roles (What roles the Employee is mapped/qualified to perform)
CREATE TABLE employee_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    role_id UUID REFERENCES roles(id) NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_primary BOOLEAN DEFAULT FALSE, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, role_id)
);

-- Employee Qualifications (Attained Qualifications & Expiry)
CREATE TABLE employee_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    qualification_type_id UUID REFERENCES qualification_types(id) NOT NULL,
    
    achieved_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_ref TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employee Anomalies (Temporary restrictions like injury/pregnancy)
CREATE TABLE employee_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    anomaly_type anomaly_type_enum NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    restriction_comment TEXT,
    
    can_perform_role_ids UUID[], 
    cannot_perform_role_ids UUID[], 
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =================================================================
-- SECTION C: OPERATIONS & ABSENCES
-- =================================================================

-- Shift Requirements (The Demand - from Planning System)
CREATE TABLE shift_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) NOT NULL,
    
    external_ref_id TEXT, 
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    required_role_id UUID REFERENCES roles(id) NOT NULL, 
    headcount_needed INT DEFAULT 1,
    location TEXT,
    
    required_skill_level skill_level_enum DEFAULT 'Minimum', 
    
    status shift_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Roster Entries (The Supply - Assignments)
CREATE TABLE roster_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES shift_requirements(id) NOT NULL,
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    status roster_status DEFAULT 'assigned',
    
    assigned_by UUID REFERENCES auth.users(id), 
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Absences (Leave, Sick, Swap requests)
CREATE TABLE absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    absence_type TEXT NOT NULL, 
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING',
    is_retrospective BOOLEAN DEFAULT FALSE, 
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =================================================================
-- SECTION D: AUTH & PERMISSIONS
-- =================================================================

-- API Keys for System-to-System Auth
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) NOT NULL,
    key_hash TEXT NOT NULL, 
    prefix TEXT NOT NULL, 
    label TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Permissions (RBAC)
CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    role user_role NOT NULL,
    department_id UUID REFERENCES departments(id), 
    opco_id UUID REFERENCES operating_companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =================================================================
-- SECTION E: HIGH-SCALE LOGGING & INDEXING
-- =================================================================

-- 1. System Events (CDC Outbox)
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL, 
    payload JSONB NOT NULL,
    department_id UUID, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Audit Logs (Partitioned Master Table)
CREATE TABLE audit_logs (
    id UUID, 
    table_name TEXT NOT NULL, 
    record_id UUID NOT NULL, 
    operation audit_op NOT NULL,
    old_values JSONB, 
    new_values JSONB, 
    changed_by UUID, 
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create Partitions 
CREATE TABLE audit_logs_2025_12 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');
CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');


-- 3. INDEXING (Performance Optimization)
CREATE INDEX idx_emp_dept ON employees(department_id);
CREATE INDEX idx_roster_shift ON roster_entries(shift_id);
CREATE INDEX idx_roster_emp ON roster_entries(employee_id);
CREATE INDEX idx_shift_dept_time ON shift_requirements(department_id, start_time);
CREATE INDEX idx_roster_emp_status ON roster_entries(employee_id, status);
CREATE INDEX idx_anom_emp_date ON employee_anomalies(employee_id, start_date);


-- =================================================================
-- SECTION F: TRIGGERS & RLS
-- =================================================================

-- 1. Audit Trigger Function (Lightweight & Synchronous)
CREATE OR REPLACE FUNCTION trigger_audit_log() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (id, table_name, record_id, operation, old_values, new_values, changed_by, created_at)
    VALUES (
        uuid_generate_v4(),
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP::audit_op,
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid(),
        NOW()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Audit to Critical Tables
CREATE TRIGGER audit_roster_changes
AFTER INSERT OR UPDATE OR DELETE ON roster_entries
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_employee_changes
AFTER INSERT OR UPDATE OR DELETE ON employees
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

CREATE TRIGGER audit_anomoly_changes
AFTER INSERT OR UPDATE OR DELETE ON employee_anomalies
FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();


-- 2. RLS BASELINE (Ensure Security by Default)
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE roster_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;


-- =================================================================
-- SECTION G: SEED DATA (Minimum 5 rows in core tables, Dec 2025 Reference)
-- =================================================================

DO $$
DECLARE
    v_opco_id UUID DEFAULT uuid_generate_v4();
    v_dept_gro_lhr UUID DEFAULT uuid_generate_v4();
    v_dept_eng_lhr UUID DEFAULT uuid_generate_v4();
    v_role_agent UUID DEFAULT uuid_generate_v4();
    v_role_mechanic UUID DEFAULT uuid_generate_v4();
    v_qual_dcs UUID DEFAULT uuid_generate_v4();
    v_qual_b777 UUID DEFAULT uuid_generate_v4();
    
    v_emp_ids UUID[] := ARRAY[uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4()];
    v_shift_ids UUID[] := ARRAY[uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4(), uuid_generate_v4()];
BEGIN
    -- 1. CORE ORGANIZATION
    ---------------------------------------------------------------------
    INSERT INTO operating_companies (id, name, code) 
    VALUES (v_opco_id, 'British Airways', 'BA');
    
    INSERT INTO departments (id, opco_id, name, code) 
    VALUES (v_dept_gro_lhr, v_opco_id, 'Ground Operations - LHR', 'GRO-LHR');
    INSERT INTO departments (id, opco_id, name, code) 
    VALUES (v_dept_eng_lhr, v_opco_id, 'Engineering - LHR', 'ENG-LHR');
    
    -- 2. ROLES & QUALS
    ---------------------------------------------------------------------
    INSERT INTO roles (id, opco_id, name) 
    VALUES (v_role_agent, v_opco_id, 'Check-in Agent L1');
    INSERT INTO roles (id, opco_id, name) 
    VALUES (v_role_mechanic, v_opco_id, 'Aircraft Mechanic L2');
    
    INSERT INTO qualification_types (id, opco_id, name, validity_period_months) 
    VALUES 
    (v_qual_dcs, v_opco_id, 'DCS System Access', 24),
    (v_qual_b777, v_opco_id, 'B777 Engine Type Rating', 12);

    INSERT INTO role_qualifications (role_id, qualification_type_id, skill_level)
    VALUES 
    (v_role_agent, v_qual_dcs, 'Minimum'),
    (v_role_mechanic, v_qual_b777, 'Minimum');


    -- 3. EMPLOYEES (6 ROWS)
    ---------------------------------------------------------------------
    INSERT INTO employees (id, opco_id, department_id, first_name, last_name, email, joining_date)
    VALUES 
    (v_emp_ids[1], v_opco_id, v_dept_gro_lhr, 'Alice', 'Smith', 'alice.s@ba.test', '2023-01-01'), -- Agent, Fully Available
    (v_emp_ids[2], v_opco_id, v_dept_gro_lhr, 'Bob', 'Jones', 'bob.j@ba.test', '2024-05-15'),  -- Agent, New Hore (Qual Limit Check)
    (v_emp_ids[3], v_opco_id, v_dept_eng_lhr, 'Charlie', 'Day', 'charlie.d@ba.test', '2022-10-01'), -- Mechanic, Standard
    (v_emp_ids[4], v_opco_id, v_dept_eng_lhr, 'Diana', 'Prince', 'diana.p@ba.test', '2021-03-01'), -- Mechanic, Anomaly (Injury)
    (v_emp_ids[5], v_opco_id, v_dept_gro_lhr, 'Eve', 'Moneypenny', 'eve.m@ba.test', '2023-11-20'), -- Agent, Absent (Holiday)
    (v_emp_ids[6], v_opco_id, v_dept_eng_lhr, 'Frank', 'Sinatra', 'frank.s@ba.test', '2023-11-20'); -- Mechanic, Viewer/Manager Role

    -- 4. CONTRACTS (6 ROWS)
    ---------------------------------------------------------------------
    FOR i IN 1..6 LOOP
        INSERT INTO contracts (employee_id, contract_type, valid_from, is_active)
        VALUES (v_emp_ids[i], 'Full Time', '2023-01-01', TRUE);
    END LOOP;

    -- 5. EMPLOYEE ROLES & QUALS
    ---------------------------------------------------------------------
    -- Alice (Agent)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[1], v_role_agent, '2023-01-01', TRUE);
    INSERT INTO employee_qualifications (employee_id, qualification_type_id, achieved_date, expiry_date) VALUES (v_emp_ids[1], v_qual_dcs, '2024-06-01', '2026-06-01');
    -- Bob (Agent)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[2], v_role_agent, '2024-05-15', TRUE);
    -- Charlie (Mechanic)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[3], v_role_mechanic, '2022-10-01', TRUE);
    INSERT INTO employee_qualifications (employee_id, qualification_type_id, achieved_date, expiry_date) VALUES (v_emp_ids[3], v_qual_b777, '2024-11-01', '2025-11-01'); -- **EXPIRED** (Dec 2025 Ref Date)
    -- Diana (Mechanic)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[4], v_role_mechanic, '2021-03-01', TRUE);
    INSERT INTO employee_qualifications (employee_id, qualification_type_id, achieved_date, expiry_date) VALUES (v_emp_ids[4], v_qual_b777, '2024-11-01', '2026-11-01');
    -- Eve (Agent)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[5], v_role_agent, '2023-11-20', TRUE);
    INSERT INTO employee_qualifications (employee_id, qualification_type_id, achieved_date, expiry_date) VALUES (v_emp_ids[5], v_qual_dcs, '2024-06-01', '2026-06-01');
    -- Frank (Mechanic)
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) VALUES (v_emp_ids[6], v_role_mechanic, '2023-11-20', TRUE);
    INSERT INTO employee_qualifications (employee_id, qualification_type_id, achieved_date, expiry_date) VALUES (v_emp_ids[6], v_qual_b777, '2024-11-01', '2026-11-01');


    -- 6. ABSENCES & ANOMALIES
    ---------------------------------------------------------------------
    -- Diana's Injury (Anomaly)
    INSERT INTO employee_anomalies (employee_id, anomaly_type, start_date, end_date, restriction_comment, cannot_perform_role_ids)
    VALUES (v_emp_ids[4], 'Injury', '2025-12-01', '2026-01-31', 'Cannot climb ladders/lift over 5kg.', ARRAY[v_role_mechanic]);

    -- Eve's Holiday (Absence)
    INSERT INTO absences (employee_id, absence_type, start_date, end_date, status)
    VALUES (v_emp_ids[5], 'ANNUAL_LEAVE', '2025-12-05', '2025-12-12', 'APPROVED');


    -- 7. SHIFT REQUIREMENTS (6 ROWS - Dec 2025)
    ---------------------------------------------------------------------
    INSERT INTO shift_requirements (id, department_id, required_role_id, start_time, end_time, location, headcount_needed, status)
    VALUES 
    (v_shift_ids[1], v_dept_gro_lhr, v_role_agent, '2025-12-06 06:00:00+00', '2025-12-06 14:00:00+00', 'T5 Zone C', 2, 'published'),  -- Agent Early 
    (v_shift_ids[2], v_dept_gro_lhr, v_role_agent, '2025-12-07 14:00:00+00', '2025-12-07 22:00:00+00', 'T5 Zone C', 1, 'published'),  -- Agent Late
    (v_shift_ids[3], v_dept_eng_lhr, v_role_mechanic, '2025-12-08 09:00:00+00', '2025-12-08 17:00:00+00', 'Hangar 1', 2, 'published'),  -- Mechanic Day 1
    (v_shift_ids[4], v_dept_eng_lhr, v_role_mechanic, '2025-12-09 09:00:00+00', '2025-12-09 17:00:00+00', 'Hangar 1', 1, 'published'),  -- Mechanic Day 2
    (v_shift_ids[5], v_dept_gro_lhr, v_role_agent, '2025-12-13 08:00:00+00', '2025-12-13 16:00:00+00', 'T5 Zone A', 1, 'draft'),      -- Agent Post-Holiday
    (v_shift_ids[6], v_dept_eng_lhr, v_role_mechanic, '2025-12-10 22:00:00+00', '2025-12-11 06:00:00+00', 'Night Shift', 1, 'published'); -- Mechanic Night


    -- 8. ROSTER ENTRIES (5 ROWS)
    ---------------------------------------------------------------------
    -- Assignment checks for testing:
    -- Alice is assigned to Shift 1 (Valid)
    INSERT INTO roster_entries (shift_id, employee_id, status) VALUES (v_shift_ids[1], v_emp_ids[1], 'assigned'); 
    -- Bob is assigned to Shift 2 (Valid, but testing will show he only has 1 qual and needs to check the 'first six months' rule later)
    INSERT INTO roster_entries (shift_id, employee_id, status) VALUES (v_shift_ids[2], v_emp_ids[2], 'assigned'); 
    -- Charlie is assigned to Shift 3 (Invalid: Qual expired)
    INSERT INTO roster_entries (shift_id, employee_id, status) VALUES (v_shift_ids[3], v_emp_ids[3], 'assigned'); 
    -- Diana is assigned to Shift 4 (Invalid: Anomaly restriction)
    INSERT INTO roster_entries (shift_id, employee_id, status) VALUES (v_shift_ids[4], v_emp_ids[4], 'assigned'); 
    -- Frank is assigned to Shift 3 (Valid)
    INSERT INTO roster_entries (shift_id, employee_id, status) VALUES (v_shift_ids[3], v_emp_ids[6], 'assigned'); 

END $$;