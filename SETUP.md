# Complete Setup Guide

## ✅ What We Built

You now have a complete **Staff Admin & Rostering System** with:
- **FastAPI Backend** (Python) - Intelligent rostering engine with full API
- **Next.js Frontend** (React/TypeScript) - Beautiful UI connected to the backend
- **Connected Architecture** - Frontend calls Python API on port 8001

---

## 🚀 Quick Start (Both Services)

### 1. Start the FastAPI Backend

```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm/api

# Make sure .env file has your Supabase credentials
# (You already did this!)

# Start the API
./run.sh
# OR
python main.py
```

**Backend will be running on:** http://localhost:8001

### 2. Start the Next.js Frontend

```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm/web

# Run the dev server
npm run dev
```

**Frontend will be running on:** http://localhost:3000

### 3. Access the Application

Open your browser to **http://localhost:3000**

You'll see two tabs:
- **🎯 Roster Engine** - Intelligent shift assignment
- **👥 Employees** - View employees with qualifications and anomalies

---

## 📋 What Each Service Does

### FastAPI Backend (Port 8001)

**Main Endpoints:**
- `GET /api/employees` - Get all employees with qualifications & anomalies
- `POST /api/roster/assign` - Run intelligent rostering engine
- `GET /api/shifts` - Get shifts with requirements
- `GET /api/absences` - Get employee absences
- `GET /api/departments` - Get departments with roles

**Interactive Docs:** http://localhost:8001/docs

### Next.js Frontend (Port 3000)

**Features:**
- Employee view with:
  - Active qualifications
  - Active anomalies/restrictions
  - Contract details
  - Clickable details modal
- Roster Engine UI
- Connected to Python backend via API calls

---

## 🔧 Configuration

### Backend (.env file already created)

Located at: `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/api/.env`

```env
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Frontend (Optional)

Create: `/Users/sasidharnemani/Development/StaffAdminV1/staffadm/web/.env.local`

```env
# API URL (already defaults to http://localhost:8001)
NEXT_PUBLIC_API_URL=http://localhost:8001
```

---

## 🎯 Testing the Integration

### 1. Test Backend Directly

```bash
# Get employees
curl http://localhost:8001/api/employees

# Check health
curl http://localhost:8001/health
```

### 2. Test Frontend → Backend Connection

1. Open http://localhost:3000
2. Click "👥 Employees" tab
3. You should see employees loaded from FastAPI
4. Click "View Details" on any employee
5. See qualifications and anomalies

### 3. Test Rostering Engine

1. Click "🎯 Roster Engine" tab
2. Select date range (e.g., 2025-01-01 to 2025-01-07)
3. Click "Generate Roster"
4. See assignments and resource gaps

---

## 📊 Employee Data Structure

When you call `/api/employees`, each employee includes:

```json
{
  "id": "uuid",
  "employee_code": "EMP001",
  "full_name": "John Doe",
  "email": "john@example.com",
  "department": {
    "name": "Ground Operations",
    "code": "GRND"
  },
  "roles": [
    {"role_name": "Check-in Agent"}
  ],
  "active_qualifications": [
    {
      "qualification_types": {
        "name": "Passenger Handling",
        "validity_period_months": 12
      },
      "acquired_date": "2024-01-15",
      "expiry_date": "2025-01-15",
      "is_valid": true
    }
  ],
  "active_anomalies": [
    {
      "anomaly_type": "Injury",
      "restrictions": "No heavy lifting",
      "start_date": "2024-12-01",
      "is_active": true
    }
  ],
  "active_contract": {
    "contract_type": "Full Time",
    "weekly_hours": 40,
    "is_active": true
  },
  "total_qualifications": 3,
  "has_anomalies": true
}
```

---

## 🛠️ Troubleshooting

### Backend won't start?

1. Check virtual environment is activated:
   ```bash
   cd api
   source venv/bin/activate
   ```

2. Verify .env file exists and has correct credentials:
   ```bash
   cat api/.env
   ```

3. Check Supabase project is running and accessible

### Frontend shows "Failed to connect to API"?

1. Make sure FastAPI is running on port 8001:
   ```bash
   curl http://localhost:8001/health
   ```

2. Check browser console for CORS errors
   - FastAPI has CORS enabled for all origins in development

### Port conflicts?

**Backend on different port:**
```bash
cd api
uvicorn main:app --reload --port 9000
```

Then update frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:9000
```

---

## 📁 Project Structure

```
staffadm/
├── api/                        # FastAPI Backend
│   ├── main.py                # API endpoints
│   ├── rostering_engine.py    # Intelligent assignment logic
│   ├── models.py              # Pydantic models
│   ├── database.py            # Supabase client
│   ├── .env                   # Configuration (✅ Created)
│   ├── run.sh                 # Startup script
│   └── README.md              # Backend docs
│
├── web/                        # Next.js Frontend
│   ├── app/
│   │   └── page.tsx           # Main UI
│   ├── components/
│   │   ├── EmployeesNew.tsx   # Employee view (✅ New!)
│   │   └── RosterEngine.tsx   # Rostering UI
│   ├── lib/
│   │   └── api.ts             # API client (✅ New!)
│   └── package.json
│
├── base.sql                    # Database schema
├── QUICKSTART.md              # Quick reference
└── SETUP.md                   # This file
```

---

## ✅ Success Checklist

- [x] FastAPI backend installed and configured
- [x] Supabase credentials in api/.env
- [x] Backend runs on http://localhost:8001
- [x] Frontend installed (npm packages)
- [x] Frontend runs on http://localhost:3000
- [x] Can access employee data from UI
- [x] Employees show qualifications and anomalies
- [x] Backend and frontend are connected

---

## 🎉 You're All Set!

**To use the system:**

1. Start backend: `cd api && ./run.sh`
2. Start frontend: `cd web && npm run dev`
3. Open browser: http://localhost:3000

**Your main features:**
- View employees with all details (qualifications, anomalies, contracts)
- Generate intelligent roster assignments
- See why shifts can't be filled (resource gap analysis)

All changes are committed and pushed to the **Dev** branch! 🚀
