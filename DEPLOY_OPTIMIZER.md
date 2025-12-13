# ⚡ Optimizer Service Deployment Branch

This branch contains only the **Optimizer service** (PuLP-based roster optimization).

## 📁 What's Included

- `/opti` - Optimizer service (FastAPI)
- Procfile for Railway
- railway.json configuration
- requirements.txt (includes PuLP)

## 🚀 Deploy to Railway

### Option 1: Deploy via Railway Dashboard (Recommended)

1. Go to [railway.app](https://railway.app) and login with GitHub
2. In your existing project (or create new), click "New" → "Service"
3. Select "Deploy from GitHub repo"
4. Select this repository: `StaffAdminV1`
5. **Important**: Configure these settings:
   - **Branch**: `deploy-optimizer`
   - **Root Directory**: `staffadm/opti`
   - Railway will auto-detect Python and use Procfile
6. Add Environment Variables (see below)
7. Click "Deploy"

### Option 2: Deploy via Railway CLI

```bash
cd staffadm/opti
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
| `CORS_ORIGINS` | `https://your-backend.railway.app` | Backend API URL for CORS |
| `PORT` | `9001` | Port number |

## ✅ Post-Deployment

1. Get your Railway URL (e.g., `https://staffadmin-optimizer.railway.app`)
2. Test optimizer endpoint: `https://your-url.railway.app/optimize` (POST)
3. Update backend `OPTIMIZER_API_URL` environment variable to this URL
4. Redeploy backend service to pick up the new URL

## 🔗 Dependencies

- Supabase database (already hosted)
- Called by backend API (deploy-backend branch)

## 📡 API Endpoints

- `/optimize` - Trigger roster optimization (POST)
  ```json
  {
    "start_date": "2025-12-13",
    "end_date": "2025-12-20",
    "save_results": true
  }
  ```

## 🧪 Test the Optimizer

```bash
# Test optimization
curl -X POST https://your-optimizer.railway.app/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-13",
    "end_date": "2025-12-20",
    "save_results": true
  }'
```

## 🎯 What the Optimizer Does

- Fetches shift requirements from Supabase
- Fetches available employees with contracts
- Uses PuLP (linear programming) to create optimal assignments
- Minimizes overtime and balances workload
- Saves results back to `roster_assignments` table

## ⚠️ Important Notes

- First request may take 30-60s on Railway free tier (cold start)
- Optimization runs can take 10-60s depending on dataset size
- Railway free tier has usage limits (~500 hours/month)
