# ⚡ Optimizer Deployment Branch - Render.com

This branch deploys the **Optimizer Service** to Render.com.

## ⚡ Quick Deploy

1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect this repository
4. Configure:
   - **Branch**: `deploy-render-optimizer`
   - **Root Directory**: `staffadm/opti`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn optimizer_api:app --host 0.0.0.0 --port $PORT`

## 🔧 Environment Variables Required

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=<your_service_role_key>
CORS_ORIGINS=<backend_url>
```

## 📖 Full Instructions

See [RENDER_DEPLOYMENT_GUIDE.md](../../RENDER_DEPLOYMENT_GUIDE.md) - Step 5

## ✅ After Deployment

Your optimizer will be available at:
```
https://staffadmin-optimizer.onrender.com
```

Test with:
```bash
curl -X POST https://staffadmin-optimizer.onrender.com/optimize \
  -H "Content-Type: application/json" \
  -d '{"start_date":"2025-12-13","end_date":"2025-12-20","save_results":true}'
```

## 🔗 Update Backend

After deploying, update backend's `OPTIMIZER_API_URL` environment variable to this URL.
