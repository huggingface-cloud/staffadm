# 🚀 Quick Start Guide

## Prerequisites

You need your Supabase credentials:
- Project URL
- Anon Key
- Service Role Key

Get these from your Supabase dashboard: https://app.supabase.com

---

## 🐍 Running the FastAPI Backend

### Step 1: Configure Environment

```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm/api
cp .env.example .env
nano .env  # or use your preferred editor
```

Add your credentials:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Step 2: Start the API

```bash
./run.sh
```

That's it! The API will start on http://localhost:8000

### Step 3: Test It

**Option A - Use Interactive Docs (Easiest):**
1. Open http://localhost:8000/docs in your browser
2. Click on any endpoint to try it
3. Click "Try it out" → "Execute"

**Option B - Run Test Script:**
```bash
# In another terminal
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm/api
source venv/bin/activate
python test_api.py
```

**Option C - Use curl:**
```bash
curl http://localhost:8000/api/employees
```

---

## 🎯 Key Endpoints

Once running, access these endpoints:

### **GET /api/employees**
Core employee data with qualifications and anomalies
- **URL:** http://localhost:8000/api/employees
- **Docs:** http://localhost:8000/docs#/default/get_employees_api_employees_get

### **POST /api/roster/assign**
Intelligent rostering engine
- **URL:** http://localhost:8000/api/roster/assign
- **Docs:** http://localhost:8000/docs#/default/assign_roster_api_roster_assign_post

Example:
```bash
curl -X POST "http://localhost:8000/api/roster/assign" \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-01-01",
    "end_date": "2025-01-07"
  }'
```

---

## 🌐 Running the Next.js Frontend (Optional)

### Step 1: Configure Environment

```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm/web
cp .env.local.example .env.local
nano .env.local
```

Add same Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### Step 2: Start the Frontend

```bash
npm run dev
```

Access at http://localhost:3000

---

## 📊 Sample API Calls

### Get All Employees
```bash
curl http://localhost:8000/api/employees | jq
```

### Get Active Employees in Department
```bash
curl "http://localhost:8000/api/employees?is_active=true&dept_id=YOUR-DEPT-ID" | jq
```

### Get Single Employee
```bash
curl http://localhost:8000/api/employees/EMPLOYEE-UUID | jq
```

### Get Shifts
```bash
curl http://localhost:8000/api/shifts | jq
```

### Get Departments
```bash
curl http://localhost:8000/api/departments | jq
```

---

## 🛠️ Troubleshooting

### API won't start?

1. **Check if venv is activated:**
   ```bash
   source api/venv/bin/activate
   ```

2. **Verify dependencies installed:**
   ```bash
   pip install -r api/requirements.txt
   ```

3. **Check .env file exists:**
   ```bash
   ls api/.env
   ```

### Connection errors?

- Verify Supabase credentials in `.env`
- Check Supabase project is running
- Test connection: `curl http://localhost:8000/health`

### Port already in use?

Kill the process using port 8000:
```bash
lsof -ti:8000 | xargs kill -9
```

---

## 📖 Full Documentation

- **API Docs:** [api/README.md](api/README.md)
- **Frontend Docs:** [web/README.md](web/README.md)
- **Database Schema:** [base.sql](base.sql)
- **Requirements:** [req.md](req.md)

---

## 💡 Pro Tips

1. **Use the Swagger UI** - http://localhost:8000/docs is the easiest way to test the API

2. **Check logs** - The API prints detailed logs showing what it's doing

3. **Test script** - Run `python api/test_api.py` to quickly verify everything works

4. **Keep terminal open** - Leave the API running in one terminal while you test in another

---

## ✅ Success Checklist

- [ ] Supabase credentials configured in `api/.env`
- [ ] Virtual environment activated
- [ ] API running on http://localhost:8000
- [ ] Can access http://localhost:8000/docs
- [ ] Can see employees at http://localhost:8000/api/employees

**Need help?** Check the detailed README files in `api/` and `web/` directories.
