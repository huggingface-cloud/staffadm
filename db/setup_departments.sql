-- ======================================================================
-- DEPARTMENT SETUP: Customer Services, Baggage, Aircraft Maintenance
-- Complete data population for all tables
-- ======================================================================

-- 1. CREATE DEPARTMENTS
-- ======================================================================

INSERT INTO departments (id, name, code, location, is_active, created_at)
VALUES
    (gen_random_uuid(), 'Customer Services', 'CS', 'Terminal 1', true, NOW()),
    (gen_random_uuid(), 'Baggage Handling', 'BH', 'Baggage Hall', true, NOW()),
    (gen_random_uuid(), 'Aircraft Maintenance', 'AM', 'Hangar 3', true, NOW())
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    is_active = EXCLUDED.is_active;

-- Store department IDs for later use
DO $$
DECLARE
    cs_dept_id UUID;
    bh_dept_id UUID;
    am_dept_id UUID;
BEGIN
    -- Get department IDs
    SELECT id INTO cs_dept_id FROM departments WHERE code = 'CS';
    SELECT id INTO bh_dept_id FROM departments WHERE code = 'BH';
    SELECT id INTO am_dept_id FROM departments WHERE code = 'AM';

    -- 2. CREATE ADMIN USERS FOR EACH DEPARTMENT
    -- ======================================================================
    -- Password for all: password123
    -- Hash: $2b$12$UXrNNKf5q.E1Vv/6dZZ5XOgIo.3bgzsKOWSYn1wFWT2fikH7B3zle

    INSERT INTO admin_users (id, email, password_hash, full_name, department_id, role, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'cs.admin@staffadmin.com', '$2b$12$UXrNNKf5q.E1Vv/6dZZ5XOgIo.3bgzsKOWSYn1wFWT2fikH7B3zle', 'Customer Services Admin', cs_dept_id, 'dept_admin', true, NOW()),
        (gen_random_uuid(), 'bh.admin@staffadmin.com', '$2b$12$UXrNNKf5q.E1Vv/6dZZ5XOgIo.3bgzsKOWSYn1wFWT2fikH7B3zle', 'Baggage Handling Admin', bh_dept_id, 'dept_admin', true, NOW()),
        (gen_random_uuid(), 'am.admin@staffadmin.com', '$2b$12$UXrNNKf5q.E1Vv/6dZZ5XOgIo.3bgzsKOWSYn1wFWT2fikH7B3zle', 'Aircraft Maintenance Admin', am_dept_id, 'dept_admin', true, NOW())
    ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        department_id = EXCLUDED.department_id;

    -- 3. CREATE ROLES FOR EACH DEPARTMENT
    -- ======================================================================

    -- Customer Services Roles
    INSERT INTO roles (id, name, department_id, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'Check-in Agent', cs_dept_id, 'Handles passenger check-in and boarding', true, NOW()),
        (gen_random_uuid(), 'Gate Agent', cs_dept_id, 'Manages boarding gates and passenger flow', true, NOW()),
        (gen_random_uuid(), 'Customer Service Rep', cs_dept_id, 'Assists passengers with inquiries and issues', true, NOW()),
        (gen_random_uuid(), 'Lounge Attendant', cs_dept_id, 'Manages premium lounge services', true, NOW())
    ON CONFLICT DO NOTHING;

    -- Baggage Handling Roles
    INSERT INTO roles (id, name, department_id, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'Baggage Handler', bh_dept_id, 'Loads and unloads aircraft baggage', true, NOW()),
        (gen_random_uuid(), 'Baggage Screener', bh_dept_id, 'Screens baggage for security', true, NOW()),
        (gen_random_uuid(), 'Ramp Agent', bh_dept_id, 'Operates ground support equipment', true, NOW()),
        (gen_random_uuid(), 'Baggage Service Agent', bh_dept_id, 'Handles lost and delayed baggage', true, NOW())
    ON CONFLICT DO NOTHING;

    -- Aircraft Maintenance Roles
    INSERT INTO roles (id, name, department_id, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'Aircraft Mechanic', am_dept_id, 'Performs aircraft maintenance and repairs', true, NOW()),
        (gen_random_uuid(), 'Avionics Technician', am_dept_id, 'Maintains aircraft electronic systems', true, NOW()),
        (gen_random_uuid(), 'Quality Inspector', am_dept_id, 'Inspects maintenance work quality', true, NOW()),
        (gen_random_uuid(), 'Line Maintenance Tech', am_dept_id, 'Performs pre-flight checks and minor repairs', true, NOW())
    ON CONFLICT DO NOTHING;

    -- 4. CREATE SKILLS
    -- ======================================================================

    -- Customer Services Skills
    INSERT INTO skills (id, name, category, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'Amadeus GDS', 'Software', 'Global distribution system proficiency', true, NOW()),
        (gen_random_uuid(), 'Customer Service', 'Soft Skills', 'Excellent customer interaction skills', true, NOW()),
        (gen_random_uuid(), 'Language: Mandarin', 'Language', 'Fluent in Mandarin Chinese', true, NOW()),
        (gen_random_uuid(), 'Language: Spanish', 'Language', 'Fluent in Spanish', true, NOW()),
        (gen_random_uuid(), 'Wheelchair Assistance', 'Special Services', 'Trained in wheelchair passenger assistance', true, NOW())
    ON CONFLICT DO NOTHING;

    -- Baggage Handling Skills
    INSERT INTO skills (id, name, category, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'Forklift Operation', 'Equipment', 'Certified forklift operator', true, NOW()),
        (gen_random_uuid(), 'Belt Loader Operation', 'Equipment', 'Operates baggage belt loaders', true, NOW()),
        (gen_random_uuid(), 'Hazmat Handling', 'Safety', 'Certified in hazardous materials handling', true, NOW()),
        (gen_random_uuid(), 'Heavy Lifting', 'Physical', 'Capable of lifting 50+ lbs repeatedly', true, NOW())
    ON CONFLICT DO NOTHING;

    -- Aircraft Maintenance Skills
    INSERT INTO skills (id, name, category, description, is_active, created_at)
    VALUES
        (gen_random_uuid(), 'A&P License', 'Certification', 'FAA Airframe & Powerplant license', true, NOW()),
        (gen_random_uuid(), 'Boeing 737 Type Rating', 'Aircraft Type', 'Certified on Boeing 737 aircraft', true, NOW()),
        (gen_random_uuid(), 'Airbus A320 Type Rating', 'Aircraft Type', 'Certified on Airbus A320 family', true, NOW()),
        (gen_random_uuid(), 'NDT Level 2', 'Testing', 'Non-Destructive Testing Level 2 certified', true, NOW()),
        (gen_random_uuid(), 'Avionics Systems', 'Electronics', 'Advanced avionics troubleshooting', true, NOW())
    ON CONFLICT DO NOTHING;

    -- 5. CREATE QUALIFICATIONS
    -- ======================================================================

    -- Customer Services Qualifications
    INSERT INTO qualifications (id, name, issuing_authority, validity_period_days, is_mandatory, description, created_at)
    VALUES
        (gen_random_uuid(), 'Aviation Security Training', 'TSA', 365, true, 'Annual security awareness training', NOW()),
        (gen_random_uuid(), 'First Aid Certificate', 'Red Cross', 730, false, 'Basic first aid and CPR', NOW()),
        (gen_random_uuid(), 'Customer Service Excellence', 'IATA', 1095, false, 'IATA customer service certification', NOW())
    ON CONFLICT DO NOTHING;

    -- Baggage Handling Qualifications
    INSERT INTO qualifications (id, name, issuing_authority, validity_period_days, is_mandatory, description, created_at)
    VALUES
        (gen_random_uuid(), 'Ramp Safety Training', 'Airport Authority', 365, true, 'Annual ramp safety certification', NOW()),
        (gen_random_uuid(), 'Forklift License', 'OSHA', 1095, true, 'Forklift operation license', NOW()),
        (gen_random_uuid(), 'DG Awareness', 'IATA', 730, true, 'Dangerous goods awareness training', NOW())
    ON CONFLICT DO NOTHING;

    -- Aircraft Maintenance Qualifications
    INSERT INTO qualifications (id, name, issuing_authority, validity_period_days, is_mandatory, description, created_at)
    VALUES
        (gen_random_uuid(), 'A&P License', 'FAA', NULL, true, 'Airframe & Powerplant Mechanic License', NOW()),
        (gen_random_uuid(), 'Type Rating - B737', 'Boeing', 730, true, 'Boeing 737 type rating', NOW()),
        (gen_random_uuid(), 'Type Rating - A320', 'Airbus', 730, true, 'Airbus A320 type rating', NOW()),
        (gen_random_uuid(), 'ETOPS Certification', 'FAA', 365, false, 'Extended operations certification', NOW())
    ON CONFLICT DO NOTHING;

    -- 6. CREATE SAMPLE EMPLOYEES (10 per department)
    -- ======================================================================

    -- Customer Services Employees
    INSERT INTO employees (id, first_name, last_name, email, phone, hire_date, department_id, active_for_rostering, created_at)
    VALUES
        (gen_random_uuid(), 'Sarah', 'Johnson', 'sarah.johnson@airport.com', '+1-555-0101', '2022-01-15', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Michael', 'Chen', 'michael.chen@airport.com', '+1-555-0102', '2021-06-20', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Elena', 'Rodriguez', 'elena.rodriguez@airport.com', '+1-555-0103', '2023-03-10', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'James', 'Williams', 'james.williams@airport.com', '+1-555-0104', '2020-09-05', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Priya', 'Patel', 'priya.patel@airport.com', '+1-555-0105', '2022-11-22', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'David', 'Kim', 'david.kim@airport.com', '+1-555-0106', '2021-04-18', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Maria', 'Garcia', 'maria.garcia@airport.com', '+1-555-0107', '2023-01-08', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Robert', 'Brown', 'robert.brown@airport.com', '+1-555-0108', '2020-12-15', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Lisa', 'Anderson', 'lisa.anderson@airport.com', '+1-555-0109', '2022-07-30', cs_dept_id, true, NOW()),
        (gen_random_uuid(), 'Thomas', 'Lee', 'thomas.lee@airport.com', '+1-555-0110', '2021-10-12', cs_dept_id, true, NOW())
    ON CONFLICT (email) DO NOTHING;

    -- Baggage Handling Employees
    INSERT INTO employees (id, first_name, last_name, email, phone, hire_date, department_id, active_for_rostering, created_at)
    VALUES
        (gen_random_uuid(), 'Carlos', 'Martinez', 'carlos.martinez@airport.com', '+1-555-0201', '2021-02-10', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Ahmed', 'Hassan', 'ahmed.hassan@airport.com', '+1-555-0202', '2022-08-15', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'John', 'Smith', 'john.smith@airport.com', '+1-555-0203', '2020-05-20', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Marcus', 'Thompson', 'marcus.thompson@airport.com', '+1-555-0204', '2023-02-28', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Kevin', 'Wright', 'kevin.wright@airport.com', '+1-555-0205', '2021-11-05', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Daniel', 'Moore', 'daniel.moore@airport.com', '+1-555-0206', '2022-04-12', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Jose', 'Hernandez', 'jose.hernandez@airport.com', '+1-555-0207', '2020-10-30', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Patrick', 'Murphy', 'patrick.murphy@airport.com', '+1-555-0208', '2023-06-18', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'William', 'Davis', 'william.davis@airport.com', '+1-555-0209', '2021-07-22', bh_dept_id, true, NOW()),
        (gen_random_uuid(), 'Anthony', 'Wilson', 'anthony.wilson@airport.com', '+1-555-0210', '2022-12-08', bh_dept_id, true, NOW())
    ON CONFLICT (email) DO NOTHING;

    -- Aircraft Maintenance Employees
    INSERT INTO employees (id, first_name, last_name, email, phone, hire_date, department_id, active_for_rostering, created_at)
    VALUES
        (gen_random_uuid(), 'Robert', 'Jackson', 'robert.jackson@airport.com', '+1-555-0301', '2018-03-15', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Steven', 'White', 'steven.white@airport.com', '+1-555-0302', '2019-07-20', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Paul', 'Harris', 'paul.harris@airport.com', '+1-555-0303', '2020-01-10', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Mark', 'Martin', 'mark.martin@airport.com', '+1-555-0304', '2021-05-25', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Christopher', 'Taylor', 'christopher.taylor@airport.com', '+1-555-0305', '2022-09-12', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Brian', 'Anderson', 'brian.anderson@airport.com', '+1-555-0306', '2019-11-30', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Kevin', 'Thomas', 'kevin.thomas@airport.com', '+1-555-0307', '2020-06-18', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Ronald', 'Moore', 'ronald.moore@airport.com', '+1-555-0308', '2018-12-05', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'Kenneth', 'Clark', 'kenneth.clark@airport.com', '+1-555-0309', '2021-08-22', am_dept_id, true, NOW()),
        (gen_random_uuid(), 'George', 'Lewis', 'george.lewis@airport.com', '+1-555-0310', '2022-02-14', am_dept_id, true, NOW())
    ON CONFLICT (email) DO NOTHING;

    -- 7. CREATE CONTRACTS FOR EMPLOYEES
    -- ======================================================================
    -- Adding contracts with different weekly hour limits for realistic testing

    INSERT INTO contracts (employee_id, weekly_hours_limit, min_rest_hours, contract_type, is_active, valid_from, created_at)
    SELECT id, 40, 11, 'Full-Time', true, hire_date, NOW()
    FROM employees WHERE department_id = cs_dept_id AND email LIKE '%johnson%'
    ON CONFLICT DO NOTHING;

    INSERT INTO contracts (employee_id, weekly_hours_limit, min_rest_hours, contract_type, is_active, valid_from, created_at)
    SELECT id, 40, 11, 'Full-Time', true, hire_date, NOW()
    FROM employees WHERE department_id IN (cs_dept_id, bh_dept_id, am_dept_id)
    ON CONFLICT DO NOTHING;

    -- 8. CREATE SHIFT REQUIREMENTS (Next 2 weeks starting today)
    -- ======================================================================

    -- Customer Services Shifts (Daily coverage 6am-11pm)
    INSERT INTO shift_requirements (id, start_time, end_time, headcount_needed, department_id, location, created_at)
    SELECT
        gen_random_uuid(),
        (CURRENT_DATE + day_offset + time_offset)::timestamp,
        (CURRENT_DATE + day_offset + time_offset + INTERVAL '8 hours')::timestamp,
        CASE
            WHEN extract(hour from time_offset) BETWEEN 6 AND 14 THEN 5  -- Morning: 5 agents
            WHEN extract(hour from time_offset) BETWEEN 14 AND 22 THEN 4 -- Afternoon: 4 agents
            ELSE 2 -- Evening: 2 agents
        END,
        cs_dept_id,
        'Terminal 1',
        NOW()
    FROM
        generate_series(0, 13) AS day_offset,
        generate_series(INTERVAL '6 hours', INTERVAL '22 hours', INTERVAL '8 hours') AS time_offset
    ON CONFLICT DO NOTHING;

    -- Baggage Handling Shifts (24/7 coverage)
    INSERT INTO shift_requirements (id, start_time, end_time, headcount_needed, department_id, location, created_at)
    SELECT
        gen_random_uuid(),
        (CURRENT_DATE + day_offset + time_offset)::timestamp,
        (CURRENT_DATE + day_offset + time_offset + INTERVAL '8 hours')::timestamp,
        CASE
            WHEN extract(hour from time_offset) BETWEEN 6 AND 18 THEN 6  -- Day: 6 handlers
            ELSE 4 -- Night: 4 handlers
        END,
        bh_dept_id,
        'Baggage Hall',
        NOW()
    FROM
        generate_series(0, 13) AS day_offset,
        generate_series(INTERVAL '0 hours', INTERVAL '16 hours', INTERVAL '8 hours') AS time_offset
    ON CONFLICT DO NOTHING;

    -- Aircraft Maintenance Shifts (24/7 with handovers)
    INSERT INTO shift_requirements (id, start_time, end_time, headcount_needed, department_id, location, created_at)
    SELECT
        gen_random_uuid(),
        (CURRENT_DATE + day_offset + time_offset)::timestamp,
        (CURRENT_DATE + day_offset + time_offset + INTERVAL '12 hours')::timestamp,
        3,  -- 3 mechanics per shift
        am_dept_id,
        'Hangar 3',
        NOW()
    FROM
        generate_series(0, 13) AS day_offset,
        generate_series(INTERVAL '0 hours', INTERVAL '12 hours', INTERVAL '12 hours') AS time_offset
    ON CONFLICT DO NOTHING;

END $$;
