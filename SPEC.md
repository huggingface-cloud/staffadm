# App Specification

## Purpose
- **Automated staff rostering** - Optimize employee shift assignments based on constraints, qualifications, and business rules
- **Employee management** - Track employees, contracts, qualifications, roles, and availability across multiple departments
- **Workforce analytics** - Monitor hours worked, overtime, gaps in coverage, and workforce trends
- **Department administration** - Multi-department support with role-based access control

## Core Features
- **Intelligent Optimization Engine** - PuLP-based constraint solver that assigns employees to shifts while respecting weekly hours, rest periods, qualifications, and contracts
- **Multi-Department Rostering** - Separate rosters, employees, and shifts per department with cross-department visibility for super admins
- **Employee Hours Tracking** - Real-time calculation of daily, weekly, and monthly hours with overtime detection
- **Shift Requirements Management** - Define shifts with required headcount, roles, qualifications, and time slots
- **Workforce Gap Analysis** - Identify understaffed shifts and forecast coverage issues
- **Admin Panel** - Bulk data generation, user management, department configuration
- **Role-Based Access Control** - Super admins see all departments; department admins see only their department
- **Optimization History** - Track all optimization runs with results, assignments, and metadata

## Non-goals
- **Payroll processing** - Does not calculate wages or integrate with payroll systems
- **Time clock / attendance tracking** - Does not track actual clock-in/clock-out times
- **Leave management workflows** - Does not handle leave requests, approvals, or workflows (tracks absences only)
- **Direct employee communication** - No built-in messaging, notifications, or mobile app for employees
- **Budget management** - Does not track costs, budgets, or financial planning
- **Performance reviews** - No employee evaluation or performance tracking features

## Users

### User Types
1. **Super Admin**
   - Full system access across all departments
   - Can manage all employees, shifts, and configurations
   - Can run optimizations for any department
   - Access to admin panel (bulk generation, system settings)

2. **Department Admin**
   - Access restricted to assigned department only
   - Can view and manage department employees, shifts, and rosters
   - Can run optimizations for their department
   - Cannot access other departments or admin panel

3. **Employees** (future)
   - Currently not implemented as active users
   - Data is managed by admins only

### Permissions Matrix
| Feature | Super Admin | Department Admin |
|---------|-------------|------------------|
| View all departments | ✅ | ❌ |
| View own department | ✅ | ✅ |
| Manage employees | ✅ | ✅ (own dept) |
| Manage shifts | ✅ | ✅ (own dept) |
| Run optimization | ✅ | ✅ (own dept) |
| Admin panel | ✅ | ❌ |
| System settings | ✅ | ❌ |
| Optimizer version config | ✅ | ❌ |

## Data

### Key Entities

**1. Operating Company (OPCO)**
- Top-level organization (e.g., airline)
- Contains multiple departments

**2. Departments**
- Organizational units (Ground Ops, Passenger Service, Cabin Services)
- Belongs to OPCO
- Has employees, shifts, and rosters

**3. Employees**
- Personal info (name, email, ID)
- Assigned to one department
- Has contracts, roles, qualifications, anomalies
- Active/inactive status for rostering

**4. Contracts**
- Weekly hours limit (e.g., 40 hours)
- Minimum rest hours between shifts (e.g., 11 hours)
- Contract type (full-time, part-time, casual)
- Validity period (from/until dates)
- One active contract per employee

**5. Roles**
- Job functions (Check-in Agent, Ground Handler, Supervisor)
- Belongs to department
- Has seniority level

**6. Qualifications**
- Certifications, training, skills
- Expiry dates (e.g., First Aid, Aircraft Marshalling)
- Valid/invalid status

**7. Employee-Role Assignments**
- Links employees to roles they can perform
- Defines which roles an employee is qualified for

**8. Employee Qualifications**
- Links employees to their certifications
- Tracks expiry dates

**9. Shift Requirements**
- Date and time (start/end)
- Headcount needed (e.g., 3 agents)
- Required role
- Location (optional)
- Department

**10. Roster Assignments**
- Employee assigned to specific shift
- Calculated weekly hours and overtime
- Linked to optimization run

**11. Optimization Runs**
- Metadata for each optimization execution
- Date range, status, objective value
- Created by admin user
- Contains all assignments generated

**12. Absences**
- Employee unavailability (leave, sick, vacation)
- Date range (start/end)
- Absence type

**13. Employee Anomalies**
- Special constraints or preferences
- Cannot work Sundays, prefers mornings, etc.

**14. Admin Users**
- System administrators
- Authentication credentials
- Role (super_admin / department_admin)
- Department assignment (for dept admins)

### Relationships
```
OPCO (1) ──── (N) Departments
Department (1) ──── (N) Employees
Department (1) ──── (N) Shift Requirements
Department (1) ──── (N) Roles
Employee (1) ──── (N) Employee-Role Assignments
Employee (1) ──── (N) Employee Qualifications
Employee (1) ──── (1) Active Contract
Employee (1) ──── (N) Roster Assignments
Employee (1) ──── (N) Absences
Shift Requirement (1) ──── (N) Roster Assignments
Optimization Run (1) ──── (N) Roster Assignments
Admin User (1) ──── (N) Optimization Runs
Role (1) ──── (N) Employee-Role Assignments
Qualification Type (1) ──── (N) Employee Qualifications
```

### Persistence
- **Primary Database**: PostgreSQL via Supabase
- **Connection**: Supabase Python client with service role key
- **Schema**: Defined in `base.sql` with foreign key constraints
- **Row Level Security (RLS)**: Enabled on admin_users table
- **Indexes**: Performance indexes for foreign keys and date ranges
- **Constraints**:
  - Unique constraint on (shift_id, employee_id) in roster_assignments
  - NOT NULL on critical fields (department_id, employee names, etc.)

## External Integrations

### Supabase (Primary Backend)
- **Purpose**: Database, authentication, row-level security
- **Endpoints**: REST API via PostgREST
- **Connection**: HTTPS with API key + service role key
- **Tables**: All app data stored in Supabase PostgreSQL
- **Features Used**:
  - Database (PostgreSQL)
  - REST API (PostgREST)
  - Auth (JWT-based, custom implementation)
  - Row Level Security for multi-tenant isolation

### Authentication
- **Method**: Custom JWT-based authentication (not Supabase Auth)
- **Storage**: Admin users in `admin_users` table with bcrypt hashed passwords
- **Token**: JWT with user_id, email, role, department_id
- **Secret**: Configurable JWT_SECRET_KEY in environment
- **Algorithm**: HS256
- **Expiration**: Configurable (default 24 hours)
- **Endpoints**:
  - `POST /api/auth/login` - Username/password login
  - `GET /api/auth/me` - Get current user info
  - `POST /api/auth/logout` - Clear session

### Optimizer Service
- **Purpose**: Run constraint-based optimization algorithms
- **Technology**: Python FastAPI + PuLP (linear programming library)
- **Deployment**: Separate microservice (port 9001)
- **Communication**: HTTP REST API
- **Endpoints**:
  - `GET /` - Health check
  - `POST /optimize` - Run optimization algorithm
- **Input**: Date range, employee filters, shift requirements
- **Output**: Optimized roster with assignments and metrics
- **Algorithms**: PuLP with COIN-OR CBC solver
- **Future**: Multi-version support (v1.0, v1.1, v2.0 with OR-Tools)

### Payments
- **Status**: Not integrated
- **Future**: Potential integration for subscription management

### Storage
- **Code/Static Assets**: Git repositories (GitHub)
- **Environment Variables**: `.env` files (not committed)
- **Logs**: Local filesystem (`/tmp/*.log`)
- **Cache**: In-memory Python dictionary with TTLs (300-600 seconds)

## Platforms

### Web Application (Primary)
- **Framework**: Next.js 14 (React, TypeScript)
- **Styling**: Tailwind CSS
- **State Management**: React hooks (useState, useEffect)
- **Routing**: Next.js App Router
- **Components**:
  - Schedule (roster view with calendar)
  - Dashboard (employee overview, stats)
  - Employee Hours (weekly/monthly hours tracking)
  - Forecast (workforce gaps and trends)
  - Employees (employee management CRUD)
  - Admin Panel (bulk data generation)
  - Settings (optimizer configuration)
  - Health (service status monitoring)
- **Deployment**: Vercel (recommended) or any Node.js host
- **Port**: 3000 (development)

### Backend API
- **Framework**: FastAPI (Python 3.12)
- **API Type**: RESTful HTTP/JSON
- **Documentation**: Auto-generated OpenAPI/Swagger at `/docs`
- **Endpoints**: 50+ REST endpoints for all CRUD operations
- **Middleware**:
  - CORS (configurable origins)
  - Cache headers (path-based TTLs)
  - Authentication (JWT verification)
  - Department filtering (RLS enforcement)
- **Deployment**: Render.com or any Python WSGI/ASGI host
- **Port**: 8000 (development)
- **Server**: Uvicorn (ASGI)

### Optimizer Service (Microservice)
- **Framework**: FastAPI (Python 3.12)
- **Engine**: PuLP linear programming library
- **Solver**: COIN-OR CBC (default), optional Gurobi
- **Deployment**: Separate from main backend for isolation
- **Port**: 9001 (development)
- **Future**: Multiple versions (9001, 9002, 9003)

### CLI Tools
- **Development Scripts**:
  - `start-all-services.sh` - Launch all services
  - `stop-all-services.sh` - Stop all services
  - `setup-ngrok.sh` - Instructions for remote access
- **Database Migrations**: SQL files in `db/` directory
- **Performance Indexes**: `db/performance_indexes.sql`
- **Admin Setup**: `db/auth_schema.sql`

### Mobile
- **Status**: Not implemented
- **Future**: Potential React Native or Progressive Web App (PWA)

### Desktop
- **Status**: Not implemented
- **Access**: Web app works on desktop browsers

## Architecture

### Service Architecture
```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────┐
│   Frontend      │────▶│   Backend API    │────▶│   Supabase    │
│   (Next.js)     │     │   (FastAPI)      │     │   (Database)  │
│   Port 3000     │     │   Port 8000      │     │               │
└─────────────────┘     └──────────────────┘     └───────────────┘
                               │
                               ▼
                        ┌──────────────────┐
                        │  Optimizer API   │
                        │  (FastAPI+PuLP)  │
                        │  Port 9001       │
                        └──────────────────┘
```

### Data Flow
1. User interacts with Next.js frontend
2. Frontend calls Backend API (FastAPI)
3. Backend authenticates user (JWT)
4. Backend applies department filter based on user role
5. Backend queries Supabase database
6. For optimization: Backend forwards request to Optimizer Service
7. Optimizer fetches data from Supabase
8. Optimizer runs PuLP algorithm
9. Optimizer saves results to Supabase
10. Results returned through Backend to Frontend

### Security Model
- **Authentication**: JWT tokens with role and department claims
- **Authorization**: Middleware enforces department access rules
- **Database**: Row Level Security on sensitive tables
- **API Keys**: Service role key for backend, anon key for frontend (future)
- **CORS**: Restricted to configured origins
- **Environment Variables**: Secrets never committed to Git

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React, TypeScript, Tailwind CSS |
| **Backend** | FastAPI, Python 3.12, Uvicorn |
| **Optimizer** | FastAPI, PuLP, COIN-OR CBC |
| **Database** | PostgreSQL (via Supabase) |
| **Auth** | Custom JWT (HS256) |
| **Cache** | In-memory Python dict |
| **Testing** | (To be implemented) |
| **Deployment** | Vercel (frontend), Render.com (backend), Supabase (database) |
| **Version Control** | Git, GitHub |
| **Development** | VS Code, Claude Code |
