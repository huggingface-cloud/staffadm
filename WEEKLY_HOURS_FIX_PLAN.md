# Weekly Hours Constraint Fix - Root Cause Analysis

## Problem Identified

The optimizer is assigning employees WAY beyond their weekly limits:
- Alice Smith: 112h (limit: 48h → 233% violation!)
- Test User: 117h (limit: 48h → 244% violation!)
- Bob Jones: 88h (limit: 48h → 183% violation!)

## Root Causes

### 1. **Incorrect Weekly Hours Calculation** (CRITICAL BUG)
**File**: [supabase_integration.py:230](staffadm/opti/supabase_integration.py#L230)

```python
'employee_weekly_hours': entry.get('total_hours', 0),  # ❌ WRONG!
```

This stores the employee's TOTAL hours across the ENTIRE optimization period, not the hours for the specific week containing this shift.

**Example**:
- Optimization period: Dec 15-21 (1 week)
- Employee assigned 112h total
- EVERY assignment record shows `employee_weekly_hours: 112`
- UI displays "112h this week" on EVERY shift!

**Fix Needed**: Calculate actual weekly hours for the ISO week containing each shift.

### 2. **Weekly Hours Constraint Not Working**
The hard constraint exists in [optimizer_optimized.py:355-378](staffadm/opti/optimizer_optimized.py#L355-L378), but it's either:
- Not being created properly
- Contract data not loading (employees defaulting to 40h limit)
- Constraint being violated by solver

**Evidence**: Employees with 48h contracts are getting 112h assignments (233% of limit!)

### 3. **No Dynamic Availability Check**
**User's Suggestion**: "calculating weekly hours and if that is breached, they are unavailable for further rostering"

Currently, the optimizer:
- Creates ALL variables upfront
- Adds constraints after
- Solver may find infeasible solutions or violate constraints

**Better Approach**: Progressively disable employees as they hit limits during solve.

## Comprehensive Solution

### Step 1: Fix Weekly Hours Calculation in Database

**File**: `supabase_integration.py`

```python
def save_roster_assignments(self, result: Dict, optimization_run_id: str) -> None:
    from datetime import datetime, timedelta
    from collections import defaultdict

    # Calculate actual weekly hours per employee
    employee_weekly_hours = defaultdict(lambda: defaultdict(float))

    for entry in result['roster']:
        emp_id = entry['employee_id']
        for shift in entry['shifts_assigned']:
            start_time = datetime.fromisoformat(shift['start_time'].replace('+00:00', ''))
            # Get ISO week number (Monday=1)
            week_number = start_time.isocalendar()[1]
            year = start_time.isocalendar()[0]
            week_key = f"{year}-W{week_number:02d}"

            employee_weekly_hours[emp_id][week_key] += shift['duration_h']

    assignments = []
    for entry in result['roster']:
        emp_id = entry['employee_id']
        for shift in entry['shifts_assigned']:
            start_time = datetime.fromisoformat(shift['start_time'].replace('+00:00', ''))
            week_number = start_time.isocalendar()[1]
            year = start_time.isocalendar()[0]
            week_key = f"{year}-W{week_number:02d}"

            # Get THIS WEEK's hours for this employee
            this_week_hours = employee_weekly_hours[emp_id][week_key]

            assignments.append({
                'optimization_run_id': optimization_run_id,
                'employee_id': emp_id,
                'shift_id': shift['shift_id'],
                'shift_date': start_time.date().isoformat(),
                'shift_start_time': shift['start_time'],
                'shift_end_time': (start_time + timedelta(hours=shift['duration_h'])).isoformat() + '+00:00',
                'shift_role': shift.get('role'),
                'employee_weekly_hours': this_week_hours,  # ✅ CORRECT!
                'employee_overtime_hours': max(0, this_week_hours - entry.get('max_hours_week', 40))
            })

    if assignments:
        self.client.table('roster_assignments').insert(assignments).execute()
```

### Step 2: Add Debug Logging to Constraint Creation

**File**: `optimizer_optimized.py`

```python
# In add_hard_constraints(), after line 378:
print(f"Created {len(self.employees)} weekly hour constraints:")
for i in list(self.employee_ids)[:5]:  # Sample first 5
    max_h = self.employees[i]['max_hours_week']
    print(f"  Employee {i[:8]}: max {max_h}h/week, hard limit {max_h * 1.2}h")
```

### Step 3: Verify Contract Data Loading

Add logging in `optimize_roster_from_supabase()`:

```python
print("\n=== EMPLOYEE CONTRACT DATA ===")
for emp_id, emp_data in list(employees.items())[:5]:
    print(f"Employee {emp_id[:8]}: max_hours_week = {emp_data['max_hours_week']}h")
```

### Step 4: Implement Progressive Availability (Advanced)

**Concept**: As shifts are assigned during optimization, track cumulative weekly hours and mark employees as ineligible for additional shifts once they hit 120% limit.

**Implementation** (More complex - requires OR-Tools or custom solver callback):
```python
def _can_employee_take_shift(self, emp_id: str, shift_id: str) -> bool:
    shift = self.shifts[shift_id]
    emp = self.employees[emp_id]

    # Basic eligibility checks
    if shift['duration_hours'] > CONFIG["HARD_CONSTRAINTS"]["MAX_SHIFT_DURATION_HOURS"]:
        return False

    # Check if employee would exceed weekly limit
    week_num = shift['week_number']
    current_week_hours = self._get_employee_week_hours(emp_id, week_num)
    max_hours = emp['max_hours_week'] * 1.2  # 120% limit

    if current_week_hours + shift['duration_hours'] > max_hours:
        return False  # Would exceed limit

    return True
```

## Testing Plan

1. **Clear database**: Delete all roster_assignments
2. **Add debug logging**: Enable all constraint logging
3. **Run small optimization**: Dec 18 only (2 shifts)
4. **Verify**:
   - Contract data loads correctly
   - Constraints are created
   - Weekly hours are calculated per week
   - No violations in result

5. **Run full week**: Dec 15-21
6. **Check**:
   - No employee exceeds 120% of their weekly limit
   - Weekly hours displayed correctly in UI
   - Multiple weeks handled properly

## Next Steps

1. Implement Step 1 (Fix weekly hours calculation) - CRITICAL
2. Implement Steps 2-3 (Add debug logging) - DIAGNOSTIC
3. Test with clear database
4. If constraint still not working, investigate solver settings
5. Consider Step 4 (Progressive availability) if needed

## Expected Outcome

After fixes:
- ✅ Weekly hours calculated correctly per ISO week
- ✅ No employee exceeds 120% of weekly contract limit
- ✅ UI displays accurate weekly hours
- ✅ Constraint violations prevented by solver
