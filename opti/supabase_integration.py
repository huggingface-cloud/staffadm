"""
Supabase Integration Layer for Roster Optimizer
Handles database connections and data transformation between Supabase and optimizer.
"""

import os
import json
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from supabase import create_client, Client
from optimizer_optimized import optimize_roster_from_supabase


class SupabaseRosterService:
    """
    Service class to handle Supabase operations for roster optimization.
    """

    def __init__(self, supabase_url: Optional[str] = None, supabase_key: Optional[str] = None):
        """
        Initialize Supabase client.

        Args:
            supabase_url: Supabase project URL (defaults to env var)
            supabase_key: Supabase anon/service key (defaults to env var)
        """
        self.url = supabase_url or os.getenv('SUPABASE_URL')
        # Support both SUPABASE_KEY and legacy SUPABASE_SERVICE_KEY for backwards compatibility
        self.key = supabase_key or os.getenv('SUPABASE_KEY') or os.getenv('SUPABASE_SERVICE_KEY')

        if not self.url or not self.key:
            raise ValueError("Supabase URL and key must be provided")

        self.client: Client = create_client(self.url, self.key)

    # ======================================================================
    # DATA FETCHING FROM SUPABASE
    # ======================================================================

    def fetch_employees(self, filters: Optional[Dict] = None) -> List[dict]:
        """
        Fetch employees with their contract information.

        Uses separate queries to avoid performance issues with nested joins.

        IMPORTANT: By default, only fetches employees where active_for_rostering=True.

        Example filters:
            {'department': 'Ground_Operations'}
            {'active_for_rostering': False}  # To include inactive employees
        """
        # Fetch employees first - always filter by active_for_rostering unless explicitly overridden
        query = self.client.table('employees').select('''
            id,
            first_name,
            last_name,
            active_for_rostering,
            department_id
        ''')

        # Default to active_for_rostering=True unless explicitly provided in filters
        if not filters or 'active_for_rostering' not in filters:
            query = query.eq('active_for_rostering', True)

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)

        employees_response = query.execute()
        employees = employees_response.data

        if not employees:
            return []

        # Fetch active contracts separately for all employees
        # This avoids the performance issue with !inner joins
        employee_ids = [emp['id'] for emp in employees]

        contracts_response = self.client.table('contracts').select('''
            employee_id,
            weekly_hours_limit,
            min_rest_hours,
            contract_type,
            is_active,
            valid_from,
            valid_until
        ''').in_('employee_id', employee_ids).eq('is_active', True).execute()

        # Create a map of employee_id -> contract data
        contracts_map = {}
        for contract in contracts_response.data:
            emp_id = contract['employee_id']
            # Store as list to match the expected structure (employees can have multiple contracts)
            if emp_id not in contracts_map:
                contracts_map[emp_id] = []
            contracts_map[emp_id].append(contract)

        # Merge contract data into employee records
        for emp in employees:
            emp['contracts'] = contracts_map.get(emp['id'], [])

        return employees

    def fetch_shifts(self, start_date: str, end_date: str, filters: Optional[Dict] = None) -> List[dict]:
        """
        Fetch shift requirements for a date range.

        Args:
            start_date: Start date in 'YYYY-MM-DD' format
            end_date: End date in 'YYYY-MM-DD' format
            filters: Additional filters like {'department': 'Ground_Operations'}
        """
        # Simplified query matching actual schema
        query = self.client.table('shift_requirements').select('''
            id,
            start_time,
            end_time,
            headcount_needed,
            required_role_id,
            department_id,
            location
        ''').gte('start_time', start_date).lte('start_time', end_date)

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)

        response = query.execute()
        return response.data

    def fetch_employee_cross_dept_hours(self, start_date: str, end_date: str) -> Dict[str, float]:
        """
        Fetch total hours already assigned to employees across ALL departments
        for the given date range. This is critical for department admins to
        respect global weekly hour limits when creating their department roster.

        Args:
            start_date: Start date in 'YYYY-MM-DD' format
            end_date: End date in 'YYYY-MM-DD' format

        Returns:
            Dictionary mapping employee_id -> total hours already assigned in this period
        """
        from datetime import datetime
        from collections import defaultdict

        # Fetch all roster assignments in this date range across ALL departments
        response = self.client.table('roster_assignments').select('''
            employee_id,
            shift_start_time,
            shift_end_time
        ''').gte('shift_date', start_date).lte('shift_date', end_date).execute()

        # Calculate total hours per employee
        employee_hours = defaultdict(float)

        for assignment in response.data:
            emp_id = assignment['employee_id']
            start_time = datetime.fromisoformat(assignment['shift_start_time'].replace('+00:00', ''))
            end_time = datetime.fromisoformat(assignment['shift_end_time'].replace('+00:00', ''))
            duration = (end_time - start_time).total_seconds() / 3600
            employee_hours[emp_id] += duration

        return dict(employee_hours)

    # ======================================================================
    # OPTIMIZATION WORKFLOW
    # ======================================================================

    def run_optimization(
        self,
        start_date: str,
        end_date: str,
        employee_filters: Optional[Dict] = None,
        shift_filters: Optional[Dict] = None,
        department_id: Optional[str] = None,
        fetch_existing_hours: bool = False
    ) -> Dict:
        """
        Complete optimization workflow:
        1. Fetch employees and shifts from Supabase
        2. Optionally fetch existing cross-department hours (for dept admin)
        3. Run optimization with constraints
        4. Return results

        Args:
            start_date: Start date 'YYYY-MM-DD'
            end_date: End date 'YYYY-MM-DD'
            employee_filters: Filters for employee selection
            shift_filters: Filters for shift selection
            department_id: Department ID to optimize for (used for filtering and tracking)
            fetch_existing_hours: If True, fetch existing hours across ALL departments
                                  to enforce global weekly hour limits

        Returns:
            Optimization results dict
        """

        print(f"Fetching data from {start_date} to {end_date}...")
        if department_id:
            print(f"Optimizing for department: {department_id}")

        # Fetch data
        employees = self.fetch_employees(employee_filters)
        shifts = self.fetch_shifts(start_date, end_date, shift_filters)

        print(f"Fetched {len(employees)} employees and {len(shifts)} shifts")

        if not employees or not shifts:
            return {
                'status': 'NoData',
                'error': 'No employees or shifts found for the given criteria',
                'roster': [],
                'uncovered_shifts': [],
                'statistics': {}
            }

        # Fetch cross-department hours if requested (typically for dept admins)
        employee_existing_hours = None
        if fetch_existing_hours:
            print("Fetching existing cross-department hours...")
            employee_existing_hours = self.fetch_employee_cross_dept_hours(start_date, end_date)
            print(f"Found existing hours for {len(employee_existing_hours)} employees")

        # Run optimization
        print("Running optimization...")
        results = optimize_roster_from_supabase(
            employees,
            shifts,
            employee_existing_hours=employee_existing_hours
        )

        # Store department_id in results for later saving
        if department_id:
            results['department_id'] = department_id

        return results

    def save_optimization_result(self, result: Dict, run_metadata: Optional[Dict] = None) -> str:
        """
        Save optimization results to Supabase for audit/history.

        Args:
            result: Optimization result dict
            run_metadata: Additional metadata like user_id, description

        Returns:
            Created record ID
        """

        # Generate a unique job_id
        import uuid
        job_id = str(uuid.uuid4())

        record = {
            'job_id': job_id,
            'status': 'completed' if result['status'] == 'Optimal' else 'failed',
            'objective_value': result.get('objective_value'),
            'total_shifts_scheduled': sum(len(r['shifts_assigned']) for r in result['roster']),
            'uncovered_shifts_count': len(result['uncovered_shifts']),
            'results_json': result,  # Store full result as JSONB
            **(run_metadata or {})
        }

        response = self.client.table('optimization_runs').insert(record).execute()
        return response.data[0]['id']

    def save_roster_assignments(self, result: Dict, optimization_run_id: str) -> None:
        """
        Save individual roster assignments to database for easy querying.

        Args:
            result: Optimization result dict
            optimization_run_id: ID of the optimization run
        """
        from datetime import datetime, timedelta
        from collections import defaultdict

        # CRITICAL FIX: Calculate actual weekly hours per employee per ISO week
        # Previously stored total_hours across ALL weeks, causing incorrect UI display
        employee_weekly_hours = defaultdict(lambda: defaultdict(float))

        for entry in result['roster']:
            emp_id = entry['employee_id']
            for shift in entry['shifts_assigned']:
                start_time = datetime.fromisoformat(shift['start_time'].replace('+00:00', ''))
                # Get ISO week number (Monday=week start)
                year, week_num, _ = start_time.isocalendar()
                week_key = f"{year}-W{week_num:02d}"

                employee_weekly_hours[emp_id][week_key] += shift['duration_h']

        assignments = []
        for entry in result['roster']:
            emp_id = entry['employee_id']
            max_hours_week = entry.get('max_hours_week', 40)

            for shift in entry['shifts_assigned']:
                # Parse start time
                start_time = datetime.fromisoformat(shift['start_time'].replace('+00:00', ''))
                end_time = start_time + timedelta(hours=shift['duration_h'])
                shift_date = start_time.date()

                # Get THIS specific week's hours for this employee
                year, week_num, _ = start_time.isocalendar()
                week_key = f"{year}-W{week_num:02d}"
                this_week_hours = employee_weekly_hours[emp_id][week_key]

                assignments.append({
                    'optimization_run_id': optimization_run_id,
                    'employee_id': emp_id,
                    'shift_id': shift['shift_id'],
                    'shift_date': shift_date.isoformat(),
                    'shift_start_time': shift['start_time'],
                    'shift_end_time': end_time.isoformat() + '+00:00',
                    'shift_role': shift.get('role'),
                    'employee_weekly_hours': this_week_hours,  # ✅ FIXED: Now shows correct weekly hours
                    'employee_overtime_hours': max(0, this_week_hours - max_hours_week)
                })

        if assignments:
            # Use upsert to handle duplicate shift_id/employee_id combinations
            # This allows re-running optimization without manual cleanup
            self.client.table('roster_assignments').upsert(
                assignments,
                on_conflict='shift_id,employee_id'
            ).execute()

    # ======================================================================
    # COMPLETE WORKFLOW WITH PERSISTENCE
    # ======================================================================

    def optimize_and_save(
        self,
        start_date: str,
        end_date: str,
        user_id: Optional[str] = None,
        description: Optional[str] = None,
        employee_filters: Optional[Dict] = None,
        shift_filters: Optional[Dict] = None,
        department_id: Optional[str] = None,
        fetch_existing_hours: bool = False
    ) -> Dict:
        """
        Complete workflow: optimize and save results to database.

        Args:
            start_date: Start date 'YYYY-MM-DD'
            end_date: End date 'YYYY-MM-DD'
            user_id: Admin user ID for audit trail
            description: Optional description for this optimization run
            employee_filters: Filters for employee selection
            shift_filters: Filters for shift selection
            department_id: Department ID to optimize for
            fetch_existing_hours: If True, fetch existing cross-department hours

        Returns:
            Dict with optimization results and database IDs
        """

        # Run optimization
        result = self.run_optimization(
            start_date,
            end_date,
            employee_filters,
            shift_filters,
            department_id,
            fetch_existing_hours
        )

        # Save to database
        run_metadata = {
            'user_id': user_id,
            'description': description,
            'start_date': start_date,
            'end_date': end_date,
            'department_id': department_id,
            'created_by_admin_id': user_id  # Map to the new column name
        }

        optimization_run_id = self.save_optimization_result(result, run_metadata)
        self.save_roster_assignments(result, optimization_run_id)

        print(f"Optimization saved with ID: {optimization_run_id}")

        result['optimization_run_id'] = optimization_run_id

        return result


# ======================================================================
# COMMAND-LINE INTERFACE FOR TESTING
# ======================================================================

def cli():
    """Command-line interface for testing."""
    import argparse

    parser = argparse.ArgumentParser(description='Optimize roster using Supabase data')
    parser.add_argument('--start-date', required=True, help='Start date YYYY-MM-DD')
    parser.add_argument('--end-date', required=True, help='End date YYYY-MM-DD')
    parser.add_argument('--department', help='Filter by department')
    parser.add_argument('--save', action='store_true', help='Save results to database')
    parser.add_argument('--user-id', help='User ID for audit trail')

    args = parser.parse_args()

    # Initialize service
    service = SupabaseRosterService()

    # Build filters
    filters = {}
    if args.department:
        filters['department'] = args.department

    # Run optimization
    if args.save:
        result = service.optimize_and_save(
            args.start_date,
            args.end_date,
            user_id=args.user_id,
            employee_filters=filters,
            shift_filters=filters
        )
    else:
        result = service.run_optimization(
            args.start_date,
            args.end_date,
            employee_filters=filters,
            shift_filters=filters
        )

    # Print summary
    print("\n=== OPTIMIZATION SUMMARY ===")
    print(f"Status: {result['status']}")
    print(f"Objective Value: {result.get('objective_value')}")
    print(f"Total Hours: {result['statistics']['total_hours']:.1f}h")
    print(f"Uncovered Shifts: {len(result['uncovered_shifts'])}")
    print(f"Overtime Hours: {result['statistics']['total_overtime']:.1f}h")

    if result['uncovered_shifts']:
        print(f"\nUncovered shift IDs: {', '.join(result['uncovered_shifts'][:10])}")


if __name__ == '__main__':
    cli()
