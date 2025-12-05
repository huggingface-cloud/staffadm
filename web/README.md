# Staff Admin & Rostering System

A comprehensive staff management and intelligent rostering application built with Next.js, TypeScript, and Supabase.

## Features

### 🎯 Intelligent Roster Assignment Engine

The core of the system is an intelligent rostering engine that automatically assigns employees to shifts based on multiple criteria:

- **Qualification Matching**: Ensures employees have required qualifications for each role
- **Availability Checking**: Respects absences, leave, and employee availability
- **Contract Compliance**: Enforces weekly hours, consecutive days, and rest period requirements
- **Anomaly Awareness**: Considers employee restrictions (injury, pregnancy, etc.)
- **Resource Gap Analysis**: Identifies and explains why shifts cannot be filled

### 📊 Resource Gap Analysis

When shifts cannot be fully assigned, the system provides detailed explanations:

- **No Qualified Staff**: Not enough employees with required qualifications
- **Insufficient Staff**: General shortage of available employees
- **Absences**: Qualified employees are on leave
- **Contract Limits**: Employees have reached their weekly hour limits
- **Anomalies**: Employees have active restrictions
- **Rest Period Violations**: Insufficient rest between shifts

### 👥 Employee Management

- View all employees with their details, roles, and qualifications
- Filter by department and operating company
- Track contract status and employee availability

## Tech Stack

- **Frontend**: Next.js 16, React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **State Management**: React Hooks
- **Date Handling**: date-fns

## Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env.local` file based on `.env.local.example`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. Run the database schema in Supabase:
   - Use the `base.sql` file in the parent directory
   - This creates all tables with seeded test data

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000)

## Usage

### Roster Assignment

1. Navigate to the "Roster Engine" tab
2. Select a date range for roster assignment
3. Click "Generate Roster"
4. Review the results:
   - **Assignments**: See all successful employee-shift assignments with confidence levels
   - **Resource Gaps**: Identify unfilled shifts and understand why

### Understanding Confidence Levels

- **Perfect**: Employee matches all requirements with no warnings
- **Good**: Minor warnings (e.g., approaching qualification expiry)
- **Suboptimal**: Critical warnings (e.g., rest period violations, expired qualifications)

### Resource Gap Reasons

The system categorizes shortage reasons:

- 🎓 **No Qualified Staff**: Skill/qualification mismatch
- 👥 **Insufficient Staff**: General shortage
- 🏖️ **All on Absence**: Employees unavailable
- ⏰ **Contract Limits**: Working hour restrictions
- ⚠️ **Anomalies**: Employee restrictions active
- 😴 **Rest Period Violation**: Insufficient rest time

## API Endpoints

### POST /api/roster/assign
Generate roster assignments
- Body: `{ start_date, end_date, dept_id? }`
- Returns: Assignments, unassignable shifts, and summary

### GET /api/employees
Fetch all employees with related data
- Query params: `opco_id`, `dept_id`

### Other Endpoints
- GET /api/absences
- GET /api/shifts
- GET /api/rosters
- GET /api/qualifications
- GET /api/departments
- GET /api/contracts
- GET /api/anomalies

## Architecture

### Rostering Engine Logic

The `RosteringEngine` class implements:

1. **Initialization**: Loads employees, shifts, absences, and role requirements
2. **Eligibility Filtering**: Filters employees by department, role, contract, absences, qualifications
3. **Suitability Scoring**: Ranks eligible employees by qualifications, anomalies, workload, rest periods
4. **Assignment**: Assigns highest-ranked eligible employees
5. **Gap Analysis**: Identifies and categorizes assignment failures

### Key Validations

- **Rest Period**: Enforces minimum hours between shifts
- **Weekly Hours**: Tracks and limits weekly working hours
- **Consecutive Days**: Respects maximum consecutive working days
- **Qualification Expiry**: Warns about expiring/expired qualifications
- **Anomaly Restrictions**: Considers employee restrictions

## Project Structure

```
web/
├── app/
│   ├── api/              # API routes
│   │   ├── employees/
│   │   ├── roster/
│   │   └── ...
│   ├── layout.tsx
│   └── page.tsx          # Main UI
├── components/
│   ├── Employees.tsx
│   └── RosterEngine.tsx  # Main rostering UI
├── lib/
│   ├── supabase.ts       # Supabase client
│   └── rosteringEngine.ts # Core rostering logic
└── README.md
```

## Future Enhancements

- Real-time roster updates with Supabase subscriptions
- Shift swap management
- Holiday bidding system
- Forecast and utilization reports
- Bulk shift import/export
- Email/SMS notifications for assignments
- Mobile app for employees
- Advanced scheduling algorithms

## License

Proprietary - Internal Use Only
