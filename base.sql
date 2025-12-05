-- =================================================================
-- STAFF ADMIN & ROSTERING SYSTEM - MASTER SCHEMA (v1.1)
-- Updates: Normalized Roles, Employee Anomalies, Contract Checks
-- =================================================================

-- 1. SETUP & EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS (Type Safety)
CREATE TYPE user_role AS ENUM ('admin', 'manager', 'viewer', 'employee');
CREATE TYPE shift_status AS ENUM ('draft', 'published', 'cancelled');
CREATE TYPE roster_status AS ENUM ('assigned', 'confirmed', 'swapped', 'sick', 'absent', 'absent_retrospective');
CREATE TYPE audit_op AS ENUM ('INSERT', 'UPDATE', 'DELETE');
CREATE TYPE contract_type_enum AS ENUM ('Full Time', 'Part Time', 'Zero Hours', 'Seasonal');
CREATE TYPE skill_level_enum AS ENUM ('Minimum', 'Recommended');
CREATE TYPE anomaly_type_enum AS ENUM ('Injury', 'Pregnancy', 'Long-Term Sickness', 'Other Restriction');

-- =================================================================
-- SECTION A: CORE ORGANIZATION & ROLES
-- =================================================================

CREATE TABLE operating_companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    parent_dept_id UUID REFERENCES departments(id),
    name TEXT NOT NULL,
    code TEXT NOT NULL, 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW TABLE: Master list of roles (e.g., 'Check-in Agent', 'Aircraft Mechanic')
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW JUNCTION TABLE: Links Roles to Qualifications required
CREATE TABLE role_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role_id UUID REFERENCES roles(id) NOT NULL,
    qualification_type_id UUID REFERENCES qualification_types(id) NOT NULL,
    skill_level skill_level_enum NOT NULL, -- Minimum or Recommended
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (role_id, qualification_type_id, skill_level)
);


-- =================================================================
-- SECTION B: AUTHENTICATION & PERMISSIONS
-- (Unchanged from v1.0)
-- =================================================================

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

CREATE TABLE user_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    role user_role NOT NULL,
    department_id UUID REFERENCES departments(id), 
    opco_id UUID REFERENCES operating_companies(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- SECTION C: PEOPLE & CONTRACTS (PII ZONE)
-- =================================================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id), 
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    department_id UUID REFERENCES departments(id) NOT NULL,
    
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    joining_date DATE NOT NULL,
    
    -- NEW: Controlled by active contract status
    active_for_rostering BOOLEAN DEFAULT TRUE, 
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NEW JUNCTION TABLE: Links Employee to the Roles they are mapped to
CREATE TABLE employee_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    role_id UUID REFERENCES roles(id) NOT NULL,
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_primary BOOLEAN DEFAULT FALSE, -- Their main role
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (employee_id, role_id)
);

-- NEW TABLE: Detailed Employee Anomaly/Restriction (Replaces JSONB)
CREATE TABLE employee_anomalies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    anomaly_type anomaly_type_enum NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE,
    restriction_comment TEXT, -- Further detail for planner
    
    -- NEW: Specific restrictions for rostering engine
    can_perform_role_ids UUID[], -- List of role IDs they CAN perform
    cannot_perform_role_ids UUID[], -- List of role IDs they CANNOT perform
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract table update
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    contract_type contract_type_enum NOT NULL, -- Enum usage
    weekly_hours_limit INT DEFAULT 40,
    min_rest_hours INT DEFAULT 11,
    
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =================================================================
-- SECTION D: QUALIFICATIONS
-- =================================================================

CREATE TABLE qualification_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opco_id UUID REFERENCES operating_companies(id) NOT NULL,
    name TEXT NOT NULL, 
    details TEXT, -- New column for further details
    validity_period_months INT, 
    is_mandatory BOOLEAN DEFAULT FALSE
);

CREATE TABLE employee_qualifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    qualification_type_id UUID REFERENCES qualification_types(id) NOT NULL,
    
    achieved_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    certificate_ref TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- SECTION E: OPERATIONS (SHIFTS & ROSTER)
-- =================================================================

-- Shift Requirements (The Demand)
CREATE TABLE shift_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID REFERENCES departments(id) NOT NULL,
    
    external_ref_id TEXT, 
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    
    -- NEW: Role is now directly linked
    required_role_id UUID REFERENCES roles(id) NOT NULL, 
    headcount_needed INT DEFAULT 1,
    location TEXT,
    
    -- Rostering engine inputs
    required_skill_level skill_level_enum DEFAULT 'Minimum', -- Ideal or Sub optimal case
    
    status shift_status DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- The Supply (Assignments)
CREATE TABLE roster_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID REFERENCES shift_requirements(id) NOT NULL,
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    status roster_status DEFAULT 'assigned',
    
    assigned_by UUID REFERENCES auth.users(id), 
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE absences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,
    
    absence_type TEXT NOT NULL, 
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'PENDING',
    is_retrospective BOOLEAN DEFAULT FALSE, -- New flag for post-shift entry
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =================================================================
-- SECTION F, G, H, I: LOGGING, INDEXING, TRIGGERS, SECURITY
-- (Logic/Structure Unchanged from v1.0)
-- =================================================================

-- Audit Log Parent Table (Partitioned for scale)
CREATE TABLE audit_logs (
    id UUID, table_name TEXT NOT NULL, record_id UUID NOT NULL, operation audit_op NOT NULL,
    old_values JSONB, new_values JSONB, changed_by UUID, created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- System Events (CDC Outbox)
CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL, payload JSONB NOT NULL, department_id UUID, created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing, Triggers (Audit, Events), and Security (RLS) definitions 
-- from the previous iteration must be reapplied to the new tables 
-- (e.g., audit_employee_changes must now also cover employee_anomalies). 
-- Omitted here for brevity, but critical for deployment.

-- =================================================================
-- SECTION J: SEED DATA (Valid for Dec 2025)
-- =================================================================

DO $$
DECLARE
    v_opco_id UUID;
    v_dept_eng UUID;
    v_role_eng_l2 UUID;
    v_qual_b777 UUID;
    v_emp_normal UUID;
    v_emp_restricted UUID;
    v_shift_normal UUID;
    v_shift_restricted UUID;
BEGIN
    -- 1. OpCo & Department
    INSERT INTO operating_companies (name, code) VALUES ('British Airways', 'BA') RETURNING id INTO v_opco_id;
    INSERT INTO departments (opco_id, name, code, parent_dept_id) 
    VALUES (v_opco_id, 'Engineering', 'ENG-LHR', NULL) RETURNING id INTO v_dept_eng;

    -- 2. Role & Qualification
    INSERT INTO roles (opco_id, name) VALUES (v_opco_id, 'Aircraft Mechanic L2') RETURNING id INTO v_role_eng_l2;
    INSERT INTO qualification_types (opco_id, name, validity_period_months) 
    VALUES (v_opco_id, 'B777 Engine Type Rating', 12) RETURNING id INTO v_qual_b777;

    -- 3. Link Role to Qualification (Minimum Requirement)
    INSERT INTO role_qualifications (role_id, qualification_type_id, skill_level)
    VALUES (v_role_eng_l2, v_qual_b777, 'Minimum');

    -- 4. Employees
    INSERT INTO employees (opco_id, department_id, first_name, last_name, email, joining_date)
    VALUES 
    (v_opco_id, v_dept_eng, 'Alice', 'Smith', 'alice.s@ba.test', '2023-01-01') RETURNING id INTO v_emp_normal;
    INSERT INTO employees (opco_id, department_id, first_name, last_name, email, joining_date)
    VALUES 
    (v_opco_id, v_dept_eng, 'Bob', 'Jones', 'bob.j@ba.test', '2023-01-01') RETURNING id INTO v_emp_restricted;
    
    -- 5. Contracts & Role Mapping (Both employees have active contracts and the role)
    INSERT INTO contracts (employee_id, contract_type, valid_from) 
    VALUES (v_emp_normal, 'Full Time', '2023-01-01');
    INSERT INTO contracts (employee_id, contract_type, valid_from) 
    VALUES (v_emp_restricted, 'Full Time', '2023-01-01');
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) 
    VALUES (v_emp_normal, v_role_eng_l2, '2023-01-01', TRUE);
    INSERT INTO employee_roles (employee_id, role_id, valid_from, is_primary) 
    VALUES (v_emp_restricted, v_role_eng_l2, '2023-01-01', TRUE);
    
    -- 6. Restriction (Bob has a current injury)
    INSERT INTO employee_anomalies (employee_id, anomaly_type, start_date, end_date, restriction_comment, cannot_perform_role_ids)
    VALUES (v_emp_restricted, 'Injury', '2025-12-01', '2026-01-31', 'Cannot lift more than 5kg.', ARRAY[v_role_eng_l2]); -- Bob cannot perform his main role

    -- 7. Shifts
    INSERT INTO shift_requirements (department_id, required_role_id, start_time, end_time, location, headcount_needed)
    VALUES (v_dept_eng, v_role_eng_l2, '2025-12-07 09:00:00+00', '2025-12-07 17:00:00+00', 'Hangar 1, Bay 3', 1) RETURNING id INTO v_shift_normal;

END $$;