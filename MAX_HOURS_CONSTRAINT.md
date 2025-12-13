# Max Hours Per Week Constraint - Implementation Guide

## Overview
The system already has support for restricting employees to maximum hours per week through the **contracts table**. The optimizer can use this to ensure employees are not scheduled beyond their contracted hours.

## Database Schema

### Contracts Table (Already Exists!)
The `contracts` table in [base.sql](base.sql) lines 98-110 already has the necessary field:

```sql
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES employees(id) NOT NULL,

    contract_type contract_type_enum NOT NULL,
    weekly_hours_limit INT DEFAULT 40,        -- ⭐ THIS IS THE KEY FIELD
    min_rest_hours INT DEFAULT 11,

    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Key Fields:
- **`weekly_hours_limit`**: Maximum hours per week for this contract (default: 40)
- **`contract_type`**: Full Time, Part Time, Zero Hours, Seasonal
- **`is_active`**: Whether this contract is currently in effect
- **`valid_from` / `valid_until`**: Contract validity period

## How To Use

### 1. Set Employee Max Hours via Contracts

For each employee, create or update their active contract:

```sql
-- Example: Set employee to 35 hours per week
INSERT INTO contracts (
    employee_id,
    contract_type,
    weekly_hours_limit,
    valid_from,
    is_active
) VALUES (
    '<employee-uuid>',
    'Full Time',
    35,                    -- Max 35 hours per week
    '2025-01-01',
    TRUE
);
```

### 2. Common Contract Types & Hours

| Contract Type | Typical weekly_hours_limit |
|---------------|---------------------------|
| Full Time     | 35-40 hours               |
| Part Time     | 20-30 hours               |
| Zero Hours    | 0-16 hours                |
| Seasonal      | Variable (20-48 hours)    |

### 3. Optimizer Integration

The optimizer needs to be updated to:

1. **Fetch active contracts** when loading employee data
2. **Apply weekly hours constraint** during shift assignment
3. **Track cumulative hours** per employee per week
4. **Reject assignments** that would exceed `weekly_hours_limit`

#### Optimizer Code Changes Needed

In [`/opti/roster_optimizer.py`](opti/roster_optimizer.py), add contract hours enforcement:

```python
def load_employees_with_contracts(supabase, start_date, end_date):
    """Load employees with their active contract limits"""
    employees = supabase.table("employees")\
        .select("*, contracts!inner(*)")\
        .eq("active_for_rostering", True)\
        .eq("contracts.is_active", True)\
        .lte("contracts.valid_from", end_date)\
        .or_("contracts.valid_until.is.null,contracts.valid_until.gte.{start_date}")\
        .execute()

    return employees.data

def add_weekly_hours_constraints(prob, shifts, assignments, employees):
    """Add constraint: Each employee cannot exceed their weekly_hours_limit"""
    from pulp import lpSum

    # Group shifts by week
    weeks = group_shifts_by_week(shifts)

    for emp in employees:
        max_hours = emp.get("contracts", [{}])[0].get("weekly_hours_limit", 40)

        for week_start, week_shifts in weeks.items():
            # Sum of all shift durations assigned to this employee in this week
            prob += (
                lpSum([
                    assignments[(emp["id"], shift["id"])] * get_shift_duration(shift)
                    for shift in week_shifts
                ]) <= max_hours,
                f"WeeklyHours_{emp['id']}_{week_start}"
            )
```

## Example Scenarios

### Scenario 1: Part-Time Employee
```sql
-- Employee on 20 hours/week contract
UPDATE contracts
SET weekly_hours_limit = 20
WHERE employee_id = '<uuid>' AND is_active = TRUE;
```
**Result**: Optimizer will never assign more than 20 hours of shifts in any given week.

### Scenario 2: Full-Time with Overtime Limit
```sql
-- Employee on 38 hours/week (no overtime allowed)
UPDATE contracts
SET weekly_hours_limit = 38
WHERE employee_id = '<uuid>' AND is_active = TRUE;
```
**Result**: Hard cap at 38 hours/week enforced by optimizer.

### Scenario 3: Flexible Zero-Hours Contract
```sql
-- Zero-hours employee can work up to 16 hours/week
INSERT INTO contracts (employee_id, contract_type, weekly_hours_limit, valid_from, is_active)
VALUES ('<uuid>', 'Zero Hours', 16, '2025-01-01', TRUE);
```
**Result**: Maximum 16 hours of shifts per week.

## Querying Current Contract Limits

### Check an employee's current max hours:
```sql
SELECT
    e.first_name,
    e.last_name,
    c.contract_type,
    c.weekly_hours_limit,
    c.valid_from,
    c.valid_until
FROM employees e
JOIN contracts c ON e.id = c.employee_id
WHERE c.is_active = TRUE
  AND e.id = '<employee-uuid>';
```

### Find all employees with unusual hour limits:
```sql
SELECT
    e.first_name,
    e.last_name,
    c.contract_type,
    c.weekly_hours_limit
FROM employees e
JOIN contracts c ON e.id = c.employee_id
WHERE c.is_active = TRUE
  AND c.weekly_hours_limit NOT IN (35, 37.5, 40)  -- Non-standard hours
ORDER BY c.weekly_hours_limit;
```

## Optimizer Configuration

The optimizer config in [optimizer_schema_addon.sql](optimizer_schema_addon.sql) has a `target_hours_week` parameter (default: 35) which is used for **fairness optimization**, not as a hard limit.

### Key Difference:
- **`contracts.weekly_hours_limit`**: **HARD CONSTRAINT** - cannot be exceeded
- **`optimizer_configs.target_hours_week`**: **SOFT TARGET** - optimizer tries to get close to this for fairness

## Testing Max Hours Constraint

### Test Case 1: Verify constraint is respected
```sql
-- 1. Set employee to 30 hours/week
UPDATE contracts SET weekly_hours_limit = 30
WHERE employee_id = '<test-employee-id>' AND is_active = TRUE;

-- 2. Run optimizer for a week with many shifts available

-- 3. Check total hours assigned
SELECT
    SUM(EXTRACT(EPOCH FROM (shift_end_time - shift_start_time))/3600) as total_hours
FROM roster_assignments ra
JOIN shift_requirements sr ON ra.shift_id = sr.id
WHERE ra.employee_id = '<test-employee-id>'
  AND sr.start_time >= '2025-12-15'  -- Week start
  AND sr.start_time < '2025-12-22';  -- Week end

-- Should return <= 30 hours
```

## Migration Script (If Needed)

If any employees don't have contracts, run this to create defaults:

```sql
-- Create default contracts for employees without one
INSERT INTO contracts (employee_id, contract_type, weekly_hours_limit, valid_from, is_active)
SELECT
    e.id,
    'Full Time'::contract_type_enum,
    40,
    e.joining_date,
    TRUE
FROM employees e
LEFT JOIN contracts c ON e.id = c.employee_id AND c.is_active = TRUE
WHERE c.id IS NULL;
```

## Summary

✅ **Database schema already supports max hours** via `contracts.weekly_hours_limit`
✅ **Flexible per-employee limits** based on contract type
✅ **Multiple contracts** supported (e.g., contract changes over time)
⏳ **Optimizer integration** needed to enforce during shift assignment
⏳ **Admin UI** could be enhanced to edit contract hours easily

## Next Steps

1. **Update optimizer code** to fetch and enforce `weekly_hours_limit` from contracts
2. **Test with various contract types** (full-time, part-time, zero-hours)
3. **Add UI in Admin Panel** to easily modify employee contract hours
4. **Add validation** to prevent scheduling beyond contract limits in the frontend
