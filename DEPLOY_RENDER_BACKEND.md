# 🚀 Backend Deployment Branch - Render.com

This branch deploys the **FastAPI Backend** to Render.com.

## ⚡ Quick Deploy

1. Go to [render.com](https://render.com)
2. New Web Service
3. Connect this repository
4. Configure:
   - **Branch**: `deploy-render-backend`
   - **Root Directory**: `staffadm/api`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`

## 🔧 Environment Variables Required

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=<your_service_role_key>
JWT_SECRET_KEY=<generate_with_python>
JWT_ALGORITHM=HS256
OPTIMIZER_API_URL=<optimizer_url_after_deploying>
CORS_ORIGINS=<frontend_url>
```

## 📖 Full Instructions

See [RENDER_DEPLOYMENT_GUIDE.md](../../RENDER_DEPLOYMENT_GUIDE.md) - Step 3

## ✅ After Deployment

Your backend will be available at:
```
https://staffadmin-backend.onrender.com
```

Test with:
```bash
curl https://staffadmin-backend.onrender.com/health
```
