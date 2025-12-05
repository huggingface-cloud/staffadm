# Staff Admin & Rostering API

FastAPI backend for the Staff Admin & Rostering System.

## Features

### 🎯 Intelligent Rostering Engine
- Automatic employee-to-shift assignment
- Qualification matching and validation
- Availability checking (absences, anomalies)
- Contract compliance (hours, rest periods)
- Resource gap analysis with explanations

### 👥 Employee Management
- Comprehensive employee endpoints
- Active qualifications tracking
- Anomaly/restriction monitoring
- Contract status visibility

### 📊 Data Management
- Shifts with requirements
- Absences tracking
- Department and role management
- Qualification types

## Tech Stack

- **FastAPI** - Modern, fast web framework
- **Python 3.12+** - Latest Python
- **Supabase** - PostgreSQL database
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

## Installation

### Prerequisites

- Python 3.12 or higher
- pip
- Supabase account with database setup

### Setup

1. **Create and activate virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Supabase credentials:
   ```
   SUPABASE_URL=your-supabase-url
   SUPABASE_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_KEY=your-service-role-key
   ```

4. **Run the server:**
   ```bash
   python main.py
   ```

   Or with uvicorn directly:
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

5. **Access the API:**
   - API: http://localhost:8000
   - Swagger Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## API Endpoints

### Core Endpoints

#### `GET /`
Health check and API information

#### `GET /health`
Health status

### Employee Endpoints

#### `GET /api/employees`
Get all employees with comprehensive details

**Query Parameters:**
- `opco_id` (optional) - Filter by operating company
- `dept_id` (optional) - Filter by department
- `is_active` (optional) - Filter by active status

**Response includes:**
- Core employee details
- Operating company and department
- Roles
- Active qualifications with expiry
- Active anomalies/restrictions
- Active contract details

**Example:**
```bash
curl "http://localhost:8000/api/employees?dept_id=123&is_active=true"
```

#### `GET /api/employees/{employee_id}`
Get single employee with full details including historical data

**Response includes:**
- All active data
- All historical qualifications
- All historical anomalies
- All contracts

### Rostering Endpoints

#### `POST /api/roster/assign`
Run the intelligent rostering engine

**Request Body:**
```json
{
  "start_date": "2025-01-01",
  "end_date": "2025-01-07",
  "dept_id": "uuid-optional"
}
```

**Response:**
```json
{
  "assignments": [
    {
      "shift_id": "uuid",
      "employee_id": "uuid",
      "employee_code": "EMP001",
      "employee_name": "John Doe",
      "confidence": "perfect",
      "warnings": []
    }
  ],
  "gaps": [
    {
      "shift_id": "uuid",
      "shift_date": "2025-01-01",
      "shift_time": "09:00 - 17:00",
      "location": "Terminal 1",
      "required_count": 5,
      "assigned_count": 3,
      "gap": 2,
      "reasons": [
        {
          "type": "absences",
          "count": 2,
          "details": "2 qualified employee(s) on absence",
          "affected": ["Jane Smith", "Bob Wilson"]
        }
      ]
    }
  ],
  "summary": {
    "total_shifts": 10,
    "fully_assigned": 7,
    "partially_assigned": 2,
    "unassigned": 1,
    "total_required": 50,
    "total_assigned": 45,
    "coverage_percentage": 90.0
  }
}
```

### Supporting Endpoints

#### `GET /api/shifts`
Get shifts with requirements

**Query Parameters:**
- `start_date` - Filter from date
- `end_date` - Filter to date
- `dept_id` - Filter by department

#### `GET /api/absences`
Get employee absences

**Query Parameters:**
- `employee_id` - Filter by employee
- `status` - Filter by status (approved, pending, etc.)

#### `GET /api/qualifications`
Get all qualification types

#### `GET /api/departments`
Get departments with roles

**Query Parameters:**
- `opco_id` - Filter by operating company

## Rostering Engine Logic

The `RosteringEngine` class implements intelligent assignment:

### 1. **Initialization**
- Loads employees with qualifications, anomalies, contracts
- Loads shifts with requirements
- Loads absences
- Loads role-qualification mappings
- Loads existing roster assignments

### 2. **Eligibility Filtering**
For each shift requirement, finds eligible employees by:
- Department match
- Role assignment
- Not on absence
- Active contract
- Required qualifications (based on skill level)

### 3. **Suitability Scoring**
Ranks eligible employees by:
- **Qualifications** (+10 per valid qualification)
- **No anomalies** (+20)
- **Workload balance** (+15 if < 5 shifts, -10 if > 10)
- **Rest period compliance** (+10)

### 4. **Assignment**
- Assigns highest-ranked employees
- Prevents double-booking
- Generates warnings for issues

### 5. **Gap Analysis**
For unfilled shifts, identifies:
- No qualified staff
- Insufficient staff numbers
- Absences (with affected employees)
- Contract limits
- Active anomalies

## Project Structure

```
api/
├── venv/                 # Virtual environment
├── main.py              # FastAPI application
├── rostering_engine.py  # Rostering logic
├── models.py            # Pydantic models
├── database.py          # Supabase client
├── config.py            # Settings management
├── requirements.txt     # Dependencies
├── .env.example         # Environment template
└── README.md           # This file
```

## Development

### Running Tests
```bash
pytest
```

### Code Formatting
```bash
black .
isort .
```

### Type Checking
```bash
mypy .
```

## Production Deployment

### With Docker

Create `Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:
```bash
docker build -t staffadm-api .
docker run -p 8000:8000 --env-file .env staffadm-api
```

### With Gunicorn

```bash
pip install gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_KEY` | Supabase anon key | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | Yes |

## Error Handling

The API returns standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found
- `500` - Internal Server Error

Error responses include details:
```json
{
  "detail": "Error message here"
}
```

## Performance Considerations

- **Caching**: Consider caching employee/shift data for roster generation
- **Pagination**: Add pagination for large employee lists
- **Batch Operations**: Support bulk shift imports
- **Async Processing**: Move rostering to background tasks for large datasets

## Future Enhancements

- [ ] WebSocket support for real-time roster updates
- [ ] Background task queue (Celery/RQ)
- [ ] Caching layer (Redis)
- [ ] Authentication and authorization
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Metrics and monitoring
- [ ] Automated testing suite
- [ ] GraphQL API option

## License

Proprietary - Internal Use Only
