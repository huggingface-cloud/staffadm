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
        self.key = supabase_key or os.getenv('SUPABASE_SERVICE_KEY')

        if not self.url or not self.key:
            raise ValueError("Supabase URL and key must be provided")

        self.client: Client = create_client(self.url, self.key)

    # ======================================================================
    # DATA FETCHING FROM SUPABASE
    # ======================================================================

    def fetch_employees(self, filters: Optional[Dict] = None) -> List[dict]:
        """
        Fetch employees with their qualifications, absences, and anomalies.

        Example filters:
            {'department': 'Ground_Operations'}
            {'active': True}
        """
        query = self.client.table('employees').select('''
            id,
            role,
            max_hours_week,
            department,
            qualifications:employee_qualifications(
                qual_id,
                expiry_date
            ),
            absences:employee_absences(
                start_date,
                end_date
            ),
            anomalies:employee_anomalies(
                restricted_roles,
                start_date,
                end_date
            )
        ''')

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)

        response = query.execute()
        return response.data

    def fetch_shifts(self, start_date: str, end_date: str, filters: Optional[Dict] = None) -> List[dict]:
        """
        Fetch shift requirements for a date range.

        Args:
            start_date: Start date in 'YYYY-MM-DD' format
            end_date: End date in 'YYYY-MM-DD' format
            filters: Additional filters like {'department': 'Ground_Operations'}
        """
        query = self.client.table('shift_requirements').select('''
            id,
            role,
            duration_hours,
            start_time,
            department,
            priority
        ''').gte('start_time', start_date).lte('start_time', end_date)

        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)

        response = query.execute()
        return response.data

    # ======================================================================
    # OPTIMIZATION WORKFLOW
    # ======================================================================

    def run_optimization(
        self,
        start_date: str,
        end_date: str,
        employee_filters: Optional[Dict] = None,
        shift_filters: Optional[Dict] = None
    ) -> Dict:
        """
        Complete optimization workflow:
        1. Fetch employees and shifts from Supabase
        2. Run optimization
        3. Return results

        Args:
            start_date: Start date 'YYYY-MM-DD'
            end_date: End date 'YYYY-MM-DD'
            employee_filters: Filters for employee selection
            shift_filters: Filters for shift selection

        Returns:
            Optimization results dict
        """

        print(f"Fetching data from {start_date} to {end_date}...")

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

        # Run optimization
        print("Running optimization...")
        results = optimize_roster_from_supabase(employees, shifts)

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

        record = {
            'status': result['status'],
            'objective_value': result.get('objective_value'),
            'total_shifts_assigned': sum(len(r['shifts_assigned']) for r in result['roster']),
            'uncovered_shifts_count': len(result['uncovered_shifts']),
            'statistics': json.dumps(result['statistics']),
            'roster_data': json.dumps(result['roster']),
            'uncovered_shifts': json.dumps(result['uncovered_shifts']),
            'created_at': datetime.now().isoformat(),
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

        assignments = []
        for entry in result['roster']:
            emp_id = entry['employee_id']
            for shift in entry['shifts_assigned']:
                assignments.append({
                    'optimization_run_id': optimization_run_id,
                    'employee_id': emp_id,
                    'shift_id': shift['shift_id'],
                    'start_time': shift['start_time'],
                    'duration_hours': shift['duration_h'],
                    'role': shift['role']
                })

        if assignments:
            self.client.table('roster_assignments').insert(assignments).execute()

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
        shift_filters: Optional[Dict] = None
    ) -> Dict:
        """
        Complete workflow: optimize and save results to database.

        Returns:
            Dict with optimization results and database IDs
        """

        # Run optimization
        result = self.run_optimization(start_date, end_date, employee_filters, shift_filters)

        # Save to database
        run_metadata = {
            'user_id': user_id,
            'description': description,
            'start_date': start_date,
            'end_date': end_date
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
