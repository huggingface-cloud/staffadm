# StaffAdmin - Quick Start Guide

## ✅ All Services Are Running!

Your StaffAdmin application is currently running locally with all services operational.

---

## 🎯 Access Points

### Main Application
**URL**: http://localhost:3000

**Login Credentials:**
- Super Admin: `admin@staffadmin.com` / `password123`
- Ground Ops Admin: `groundops.admin@staffadmin.com` / `password123`

### System Health Dashboard
**URL**: http://localhost:3000/health

This dashboard shows real-time status of all services with:
- Service status indicators
- Response time monitoring
- Local and deployed URLs
- ngrok URL placeholders
- Auto-refresh every 10 seconds

### API Documentation
- **Backend API Docs**: http://localhost:8000/docs
- **Optimizer API Docs**: http://localhost:9001/docs

---

## 🔧 Service Management

### View Service Status
```bash
# Check all services
curl http://localhost:8000/health  # Backend
curl http://localhost:9001/        # Optimizer
curl http://localhost:3000          # Frontend

# Or visit the health dashboard
open http://localhost:3000/health
```

### Stop All Services
```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm
./stop-all-services.sh
```

### Restart All Services
```bash
cd /Users/sasidharnemani/Development/StaffAdminV1/staffadm
./start-all-services.sh
```

### View Logs
```bash
# Watch all logs in real-time
tail -f /tmp/backend.log /tmp/optimizer.log /tmp/frontend.log

# Or individual services
tail -f /tmp/backend.log    # Backend API
tail -f /tmp/optimizer.log  # Optimizer API
tail -f /tmp/frontend.log   # Frontend
```

---

## 🌐 Sharing with Colleagues via ngrok

### 1. Install ngrok (if not already installed)
```bash
brew install ngrok
# or download from https://ngrok.com/download
```

### 2. Open 3 Terminal Windows

**Terminal 1 - Backend:**
```bash
ngrok http 8000
```

**Terminal 2 - Optimizer:**
```bash
ngrok http 9001
```

**Terminal 3 - Frontend:**
```bash
ngrok http 3000
```

### 3. Copy the ngrok URLs

From each terminal, copy the "Forwarding" URL (e.g., `https://abc123.ngrok.io`)

### 4. Update Configuration Files

**Update `api/.env`:**
```bash
CORS_ORIGINS=http://localhost:3000,https://YOUR-FRONTEND-NGROK-URL.ngrok.io
OPTIMIZER_API_URL=https://YOUR-OPTIMIZER-NGROK-URL.ngrok.io
```

**Update `web/.env.local`:**
```bash
NEXT_PUBLIC_API_URL=https://YOUR-BACKEND-NGROK-URL.ngrok.io
```

### 5. Restart Services
```bash
./stop-all-services.sh
./start-all-services.sh
```

### 6. Share the Frontend URL

Give colleagues the **Frontend ngrok URL** to access the app:
```
https://YOUR-FRONTEND-NGROK-URL.ngrok.io
```

---

## 📊 Current Service Status

| Service | Port | Status | URL |
|---------|------|--------|-----|
| **Backend API** | 8000 | ✅ Running | http://localhost:8000 |
| **Optimizer API** | 9001 | ✅ Running | http://localhost:9001 |
| **Frontend** | 3000 | ✅ Running | http://localhost:3000 |

**Health Dashboard**: http://localhost:3000/health

---

## 🛠️ Troubleshooting

### Service Not Responding?

1. **Check if running:**
   ```bash
   lsof -i:8000  # Backend
   lsof -i:9001  # Optimizer
   lsof -i:3000  # Frontend
   ```

2. **Check logs:**
   ```bash
   tail -50 /tmp/backend.log
   tail -50 /tmp/optimizer.log
   tail -50 /tmp/frontend.log
   ```

3. **Restart services:**
   ```bash
   ./stop-all-services.sh
   ./start-all-services.sh
   ```

### CORS Errors with ngrok?

Make sure you updated `CORS_ORIGINS` in both:
- `api/.env`
- `opti/.env`

Then restart services.

### Port Already in Use?

```bash
# Kill services on specific ports
lsof -ti:8000 | xargs kill -9
lsof -ti:9001 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

---

## 📁 Important Files

- **Local Development Guide**: `LOCAL_DEVELOPMENT.md`
- **Environment Variables**: `RENDER_ENV_VARS.txt`
- **Deployment Guide**: `../RENDER_DEPLOYMENT_GUIDE.md`
- **Start Script**: `start-all-services.sh`
- **Stop Script**: `stop-all-services.sh`
- **ngrok Setup**: `setup-ngrok.sh`

---

## 🎉 Next Steps

1. **Explore the App**: http://localhost:3000
2. **Monitor Services**: http://localhost:3000/health
3. **Set up ngrok** (to share with colleagues)
4. **Deploy to production** (when ready - see RENDER_DEPLOYMENT_GUIDE.md)

---

## 💡 Pro Tips

- **Health Dashboard** auto-refreshes every 10 seconds
- Use **Copy buttons** to quickly copy URLs
- **ngrok free tier** provides temporary URLs (they change on restart)
- Check **service logs** if something isn't working
- The **health dashboard** works even if backend is down (it's a client-side React app)

---

**Need help?** Check `LOCAL_DEVELOPMENT.md` for detailed documentation.

**Ready to deploy?** See `../RENDER_DEPLOYMENT_GUIDE.md` for production deployment.
