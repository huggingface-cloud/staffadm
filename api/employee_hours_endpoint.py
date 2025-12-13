# Employee Hours Tracking API Endpoint
# Add this to main.py after the other /api/employees endpoints

@app.get("/api/employee-hours")
async def get_employee_hours(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format")
):
    """
    Get employee hours summary for a date range with daily breakdown.
    Returns data for the Employee Hours Tracking page.
    """
    try:
        supabase = get_supabase()

        # Fetch employees with contracts
        employees_response = supabase.table('employees').select('''
            id,
            first_name,
            last_name,
            department_id,
            departments(name),
            contracts(weekly_hours_limit)
        ''').eq('active_for_rostering', True).execute()

        if not employees_response.data:
            return []

        # Fetch roster assignments for date range
        assignments_response = supabase.table('roster_assignments').select('''
            employee_id,
            shift_date,
            shift_start_time,
            shift_end_time
        ''').gte('shift_date', start_date).lte('shift_date', end_date).execute()

        # Group assignments by employee
        from collections import defaultdict
        from datetime import datetime, timedelta

        employee_assignments = defaultdict(list)
        for assignment in assignments_response.data:
            employee_assignments[assignment['employee_id']].append(assignment)

        # Calculate hours for each employee
        employee_hours_data = []

        for emp in employees_response.data:
            emp_id = emp['id']
            emp_name = f"{emp['first_name']} {emp['last_name']}"
            dept_name = emp['departments']['name'] if emp.get('departments') else 'Unknown'

            # Get contracted weekly hours
            contracted_hours = 40  # default
            if emp.get('contracts') and len(emp['contracts']) > 0:
                contracted_hours = emp['contracts'][0].get('weekly_hours_limit', 40)

            # Calculate daily hours
            daily_hours_map = defaultdict(float)
            daily_shift_count = defaultdict(int)

            for assignment in employee_assignments.get(emp_id, []):
                date = assignment['shift_date']
                start = datetime.fromisoformat(assignment['shift_start_time'].replace('+00:00', ''))
                end = datetime.fromisoformat(assignment['shift_end_time'].replace('+00:00', ''))
                hours = (end - start).total_seconds() / 3600

                daily_hours_map[date] += hours
                daily_shift_count[date] += 1

            # Build daily hours list
            daily_hours = [
                {
                    'date': date,
                    'hours': hours,
                    'shiftCount': daily_shift_count[date]
                }
                for date, hours in sorted(daily_hours_map.items())
            ]

            # Calculate weekly total (using ISO week)
            weekly_hours = defaultdict(float)
            for assignment in employee_assignments.get(emp_id, []):
                date_obj = datetime.fromisoformat(assignment['shift_date'])
                week_key = date_obj.isocalendar()[1]  # ISO week number

                start = datetime.fromisoformat(assignment['shift_start_time'].replace('+00:00', ''))
                end = datetime.fromisoformat(assignment['shift_end_time'].replace('+00:00', ''))
                hours = (end - start).total_seconds() / 3600

                weekly_hours[week_key] += hours

            # Get max weekly hours for the period
            max_weekly = max(weekly_hours.values()) if weekly_hours else 0

            # Calculate monthly total
            monthly_total = sum(daily_hours_map.values())

            employee_hours_data.append({
                'employeeId': emp_id,
                'employeeName': emp_name,
                'department': dept_name,
                'dailyHours': daily_hours,
                'weeklyTotal': round(max_weekly, 1),
                'monthlyTotal': round(monthly_total, 1),
                'contractedWeeklyHours': contracted_hours
            })

        # Sort by weekly hours descending
        employee_hours_data.sort(key=lambda x: x['weeklyTotal'], reverse=True)

        return employee_hours_data

    except Exception as e:
        logger.error(f"Error fetching employee hours: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch employee hours: {str(e)}")
