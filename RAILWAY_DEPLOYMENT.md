# 🚂 Railway Deployment - Your Existing Project

You already have a Railway project set up! Here's how to configure and deploy your services.

## 📋 Your Railway Project Details

- **Project Name**: alluring-beauty
- **Project ID**: `fcfa5b9e-2f7c-456f-af60-738ee1147e27`
- **Environment**: production
- **Service Name**: staffadm
- **Service ID**: `17d6b9da-8110-4f88-bc05-b9afd7b7fb84`

## 🚀 Deployment Steps

### Step 1: Configure Backend Service (Already Created)

Your service "staffadm" is already created. Let's configure it properly:

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Select project: **alluring-beauty**
3. Click on service: **staffadm**
4. Go to **Settings** tab

#### Set Root Directory
- Click "Settings"
- Find "Root Directory"
- Set to: `staffadm/api`
- Save

#### Set Source Branch
- In Settings → "Source"
- Set Branch: `deploy-backend`
- Save

### Step 2: Add Environment Variables

In your service dashboard, go to **Variables** tab and add:

```bash
# Database
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90

# JWT (Generate new secret key)
JWT_SECRET_KEY=<run command below to generate>
JWT_ALGORITHM=HS256

# Optimizer (will update after creating optimizer service)
OPTIMIZER_API_URL=http://localhost:9001

# CORS
CORS_ORIGINS=http://localhost:3000

# Port (Railway provides this automatically, but you can set it)
PORT=8001
```

**Generate JWT_SECRET_KEY**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Step 3: Deploy Backend

After setting variables:
1. Click "Deploy" button (or wait for auto-deploy)
2. Watch the build logs
3. Once deployed, Railway will give you a URL like:
   ```
   https://staffadm-production.up.railway.app
   ```

### Step 4: Create Optimizer Service

1. In the same project "alluring-beauty", click **New** → **Service**
2. Select **GitHub Repo**
3. Choose your repository
4. Configure:
   - **Service Name**: `staffadm-optimizer`
   - **Branch**: `deploy-optimizer`
   - **Root Directory**: `staffadm/opti`

#### Add Optimizer Environment Variables:

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90
CORS_ORIGINS=<your_backend_url_from_step3>
PORT=9001
```

### Step 5: Update Backend with Optimizer URL

1. Go back to **staffadm** service
2. Update `OPTIMIZER_API_URL` variable:
   ```
   OPTIMIZER_API_URL=<optimizer_url_from_step4>
   ```
3. Redeploy

### Step 6: Update CORS for Production

Once you deploy frontend to Vercel, update:

#### Backend Service:
```bash
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

#### Optimizer Service:
```bash
CORS_ORIGINS=<backend_railway_url>,http://localhost:8001
```

## ✅ Testing

### Test Backend Health
```bash
curl https://staffadm-production.up.railway.app/health
```

Expected: `{"status":"healthy"}`

### Test Login
```bash
curl -X POST https://staffadm-production.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staffadmin.com","password":"password123"}'
```

Expected: Returns `access_token`

### Test Optimizer
```bash
curl -X POST https://staffadm-optimizer-production.up.railway.app/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-13",
    "end_date": "2025-12-20",
    "save_results": true
  }'
```

Expected: Returns optimization result

## 🔗 Your URLs

After deployment, you'll have:

- **Backend API**: `https://staffadm-production.up.railway.app`
- **Optimizer**: `https://staffadm-optimizer-production.up.railway.app`

Save these URLs - you'll need them for:
- Frontend `NEXT_PUBLIC_API_URL`
- CORS configuration
- Testing

## 📊 Railway Dashboard

Access your project:
```
https://railway.app/project/fcfa5b9e-2f7c-456f-af60-738ee1147e27
```

## 🐛 Troubleshooting

### Service won't start
- Check build logs in Railway dashboard
- Verify `staffadm/api` or `staffadm/opti` directories exist
- Ensure `requirements.txt` is present
- Check Python version compatibility

### Environment variables not working
- Click "Redeploy" after adding/changing variables
- Verify variable names match exactly
- Check for typos in URLs/keys

### 404 errors
- Verify Root Directory is set correctly
- Ensure branch is correct (`deploy-backend` or `deploy-optimizer`)
- Check that Procfile or railway.json exists

## 💡 Tips

1. **Auto-Deploy**: Railway auto-deploys when you push to the branch
2. **Logs**: Check logs in real-time in Railway dashboard
3. **Metrics**: View CPU/memory usage in Metrics tab
4. **Rollback**: Can rollback to previous deployments
5. **Custom Domain**: Add custom domain in Settings

## 🎯 Next Steps

1. ✅ Configure backend service settings
2. ✅ Add all environment variables
3. ✅ Deploy backend
4. ✅ Create optimizer service
5. ✅ Test both services
6. ⬜ Deploy frontend to Vercel
7. ⬜ Update CORS settings

Once both services are running, proceed to deploy the frontend to Vercel!
