# StaffAdmin - Local Development Guide

Complete guide for running StaffAdmin locally and sharing with colleagues via ngrok.

## 🚀 Quick Start

### 1. Start All Services

```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm
./start-all-services.sh
```

This will start:
- **Backend API** on http://localhost:8000
- **Optimizer API** on http://localhost:9001
- **Frontend** on http://localhost:3000

### 2. Access the Application

- **Main App**: http://localhost:3000
- **Health Dashboard**: http://localhost:3000/health
- **Backend API Docs**: http://localhost:8000/docs
- **Optimizer API Docs**: http://localhost:9001/docs

### 3. Stop All Services

```bash
./stop-all-services.sh
```

---

## 📊 System Health Dashboard

The health dashboard shows real-time status of all services:

**URL**: http://localhost:3000/health

### Features:
- ✅ Real-time service status monitoring
- ⏱️ Response time tracking
- 🔄 Auto-refresh every 10 seconds
- 📋 Copy URLs to clipboard
- 🔗 Quick links to open services
- 🌐 ngrok URL placeholders for sharing

---

## 🌐 Exposing Services via ngrok

### Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start ngrok Tunnels

Open **3 separate terminal windows** and run:

**Terminal 1 - Backend API:**
```bash
ngrok http 8000
```

**Terminal 2 - Optimizer API:**
```bash
ngrok http 9001
```

**Terminal 3 - Frontend:**
```bash
ngrok http 3000
```

### Step 3: Copy ngrok URLs

From each ngrok terminal, copy the **Forwarding** URL (looks like `https://abc123.ngrok.io`)

### Step 4: Update Configuration

**Update Backend CORS** (`api/.env`):
```bash
CORS_ORIGINS=http://localhost:3000,https://YOUR-FRONTEND-NGROK-URL.ngrok.io
```

**Update Frontend API URL** (`web/.env.local`):
```bash
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-NGROK-URL.ngrok.io
```

**Update Backend Optimizer URL** (`api/.env`):
```bash
OPTIMIZER_API_URL=https://YOUR-OPTIMIZER-NGROK-URL.ngrok.io
```

### Step 5: Restart Services

```bash
./stop-all-services.sh
./start-all-services.sh
```

### Step 6: Share with Colleagues

Share the **Frontend ngrok URL** with your colleagues:
```
https://YOUR-FRONTEND-NGROK-URL.ngrok.io
```

They can access the app and login with:
- **Super Admin**: admin@staffadmin.com / password123
- **Dept Admin**: groundops.admin@staffadmin.com / password123

---

## 🔧 Manual Service Management

### Start Services Individually

**Backend API:**
```bash
cd api
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Optimizer API:**
```bash
cd opti
python3 optimizer_api.py
```

**Frontend:**
```bash
cd web
npm run dev
```

### View Logs

```bash
# Backend logs
tail -f /tmp/backend.log

# Optimizer logs
tail -f /tmp/optimizer.log

# Frontend logs
tail -f /tmp/frontend.log
```

### Check Running Services

```bash
# Check what's running on ports
lsof -i:8000  # Backend
lsof -i:9001  # Optimizer
lsof -i:3000  # Frontend
```

### Kill Specific Service

```bash
# Kill by port
lsof -ti:8000 | xargs kill -9  # Backend
lsof -ti:9001 | xargs kill -9  # Optimizer
lsof -ti:3000 | xargs kill -9  # Frontend
```

---

## 📝 Environment Variables

### Backend API (`api/.env`)

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=eyJhbGc...  # Service role key

JWT_SECRET_KEY=local-dev-secret-key-change-in-production-12345678
JWT_ALGORITHM=HS256

OPTIMIZER_API_URL=http://localhost:9001

CORS_ORIGINS=http://localhost:3000,http://localhost:8000
```

### Optimizer API (`opti/.env`)

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=eyJhbGc...  # Service role key

CORS_ORIGINS=http://localhost:3000,http://localhost:8000

PORT=9001
```

### Frontend (`web/.env.local`)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000

NEXT_PUBLIC_SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...  # Anon key
```

---

## 🐛 Troubleshooting

### Service Won't Start

**Check logs:**
```bash
tail -f /tmp/backend.log
tail -f /tmp/optimizer.log
tail -f /tmp/frontend.log
```

**Common issues:**
1. **Port already in use**: Run `./stop-all-services.sh` first
2. **Module not found**: Install dependencies
   ```bash
   cd api && pip3 install -r requirements.txt
   cd opti && pip3 install -r requirements.txt
   cd web && npm install
   ```
3. **Environment variables missing**: Check `.env` files exist

### CORS Errors

Update `CORS_ORIGINS` in backend and optimizer to include:
- Frontend local URL: `http://localhost:3000`
- Frontend ngrok URL (if using): `https://YOUR-NGROK.ngrok.io`

### Can't Access via ngrok

1. Verify ngrok is running (check terminal)
2. Check the forwarding URL is correct
3. Update environment variables with ngrok URLs
4. Restart all services
5. Try incognito/private browser window

### Health Dashboard Shows Services Offline

1. Check services are actually running: `lsof -i:8000,9001,3000`
2. Visit each service URL directly
3. Check browser console for errors
4. Try manual refresh on the dashboard

---

## 📦 Service Architecture

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

---

## 🎯 Test Credentials

### Super Admin (Access all departments)
- Email: `admin@staffadmin.com`
- Password: `password123`

### Department Admins
- Ground Ops: `groundops.admin@staffadmin.com` / `password123`
- Passenger Service: `passengerservice.admin@staffadmin.com` / `password123`
- Cabin Services: `cabinservices.admin@staffadmin.com` / `password123`

---

## 📚 Useful Commands

```bash
# Start everything
./start-all-services.sh

# Stop everything
./stop-all-services.sh

# View ngrok setup instructions
./setup-ngrok.sh

# Check service health
curl http://localhost:8000/health
curl http://localhost:9001/
curl http://localhost:3000

# View real-time logs
tail -f /tmp/backend.log /tmp/optimizer.log /tmp/frontend.log
```

---

## 🔗 Important URLs

| Service | Local | Health Check |
|---------|-------|--------------|
| Frontend | http://localhost:3000 | http://localhost:3000/health |
| Backend API | http://localhost:8000 | http://localhost:8000/health |
| Backend Docs | http://localhost:8000/docs | - |
| Optimizer API | http://localhost:9001 | http://localhost:9001/ |
| Optimizer Docs | http://localhost:9001/docs | - |

---

## 🎉 You're All Set!

Your StaffAdmin development environment is ready. Visit http://localhost:3000/health to monitor all services!

For deployment to production, see [RENDER_DEPLOYMENT_GUIDE.md](../RENDER_DEPLOYMENT_GUIDE.md)
