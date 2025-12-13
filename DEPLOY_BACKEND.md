# 🔧 Backend API Deployment Branch

This branch contains only the **FastAPI backend** application.

## 📁 What's Included

- `/api` - FastAPI backend
- Procfile for Railway
- railway.json configuration
- requirements.txt

## 🚀 Deploy to Railway

### Option 1: Deploy via Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app) and login with GitHub
2. Click "New Project" → "Deploy from GitHub repo"
3. Select this repository: `StaffAdminV1`
4. **Important**: Configure these settings:
   - **Branch**: `deploy-backend`
   - **Root Directory**: `staffadm/api`
   - Railway will auto-detect Python and use Procfile
5. Add Environment Variables (see below)
6. Click "Deploy"

### Option 2: Deploy via Railway CLI

```bash
cd staffadm/api
npm install -g @railway/cli
railway login
railway init
railway up
```

## 🔧 Environment Variables

Set these in Railway dashboard under "Variables":

| Variable | Value | Description |
|----------|-------|-------------|
| `SUPABASE_URL` | `https://xueqvozgeebhlffxmiqp.supabase.co` | Supabase project URL |
| `SUPABASE_KEY` | `your_service_role_key` | Supabase service role key |
| `JWT_SECRET_KEY` | `generate_random_key` | JWT signing key |
| `JWT_ALGORITHM` | `HS256` | JWT algorithm |
| `OPTIMIZER_API_URL` | `https://your-optimizer.railway.app` | Optimizer service URL |
| `CORS_ORIGINS` | `https://your-app.vercel.app` | Frontend URL for CORS |
| `PORT` | `8001` | Port number |

**Generate JWT_SECRET_KEY**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

## ✅ Post-Deployment

1. Get your Railway URL (e.g., `https://staffadmin-api.railway.app`)
2. Test health endpoint: `https://your-url.railway.app/health`
3. Update frontend `NEXT_PUBLIC_API_URL` to this URL
4. Update optimizer `CORS_ORIGINS` to include this URL

## 🔗 Dependencies

- Supabase database (already hosted)
- Optimizer service (deploy-optimizer branch)

## 📡 API Endpoints

- `/health` - Health check
- `/api/auth/login` - Authentication
- `/api/employees` - Employee management
- `/api/shifts` - Shift management
- `/api/roster/view` - Roster view
- `/optimizer` - Trigger optimization

## 🧪 Test the API

```bash
# Health check
curl https://your-backend.railway.app/health

# Login
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staffadmin.com","password":"password123"}'
```
