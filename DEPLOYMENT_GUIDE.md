# 🚀 Deployment Guide - Staff Admin Application

This guide will help you deploy the Staff Admin application to free hosting platforms so your team can access it.

## 📋 Prerequisites

1. GitHub account (to connect repositories)
2. Accounts on these free platforms:
   - [Railway.app](https://railway.app) - For backend services
   - [Vercel](https://vercel.com) - For frontend
3. Your Supabase credentials (already set up)

## 🏗️ Architecture Overview

- **Frontend**: Next.js → Deploy to **Vercel**
- **Backend API**: FastAPI → Deploy to **Railway**
- **Optimizer Service**: FastAPI → Deploy to **Railway** (separate service)
- **Database**: Supabase (already hosted ✅)

---

## 📦 Step 1: Prepare the Repository

### 1.1 Apply Database Migration

First, apply the unique constraint to prevent duplicate assignments:

```sql
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
ALTER TABLE roster_assignments
ADD CONSTRAINT unique_shift_employee
UNIQUE (shift_id, employee_id);
```

### 1.2 Commit and Push

```bash
git add -A
git commit -m "chore: Add deployment configuration files"
git push origin V2
```

---

## 🚂 Step 2: Deploy Backend API (Railway)

### 2.1 Create Railway Account
1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Click "New Project"

### 2.2 Deploy from GitHub
1. Select "Deploy from GitHub repo"
2. Choose your repository: `StaffAdminV1`
3. Railway will auto-detect the monorepo structure

### 2.3 Configure Backend Service
1. In Railway dashboard, click "New" → "Service"
2. Select your GitHub repo
3. Set **Root Directory**: `staffadm/api`
4. Railway will automatically detect `requirements.txt` and `Procfile`

### 2.4 Set Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=<your_supabase_service_role_key>
JWT_SECRET_KEY=<generate_a_secure_random_key>
JWT_ALGORITHM=HS256
OPTIMIZER_API_URL=<will_set_after_deploying_optimizer>
CORS_ORIGINS=http://localhost:3000
PORT=8001
```

**To generate JWT_SECRET_KEY**:
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 2.5 Get Backend URL
After deployment, Railway will provide a URL like:
```
https://staffadmin-api-production.up.railway.app
```

**Save this URL** - you'll need it later!

---

## 🎯 Step 3: Deploy Optimizer Service (Railway)

### 3.1 Add New Service
1. In the same Railway project, click "New" → "Service"
2. Select your GitHub repo again
3. Set **Root Directory**: `staffadm/opti`

### 3.2 Set Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```bash
SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
SUPABASE_KEY=<your_supabase_service_role_key>
CORS_ORIGINS=<backend_api_url_from_step_2>
PORT=9001
```

### 3.3 Get Optimizer URL
After deployment, Railway will provide a URL like:
```
https://staffadmin-optimizer-production.up.railway.app
```

### 3.4 Update Backend Environment Variable
Go back to your **Backend API service** in Railway and update:
```bash
OPTIMIZER_API_URL=https://staffadmin-optimizer-production.up.railway.app
```

Then redeploy the backend service.

---

## ▲ Step 4: Deploy Frontend (Vercel)

### 4.1 Create Vercel Account
1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Click "Add New..." → "Project"

### 4.2 Import Repository
1. Select your GitHub repository
2. Vercel will auto-detect Next.js

### 4.3 Configure Project Settings

**Root Directory**: `staffadm/web`

**Build & Development Settings**:
- Build Command: `npm run build` (default)
- Output Directory: `.next` (default)
- Install Command: `npm install` (default)

### 4.4 Set Environment Variables

Add this environment variable in Vercel:

```bash
NEXT_PUBLIC_API_URL=https://staffadmin-api-production.up.railway.app
```

(Use the backend URL from Step 2.5)

### 4.5 Deploy
Click "Deploy" and wait for deployment to complete.

### 4.6 Get Frontend URL
Vercel will provide a URL like:
```
https://your-app.vercel.app
```

---

## 🔄 Step 5: Update CORS Origins

### 5.1 Update Backend CORS
Go back to **Railway → Backend API** and update environment variable:
```bash
CORS_ORIGINS=https://your-app.vercel.app,http://localhost:3000
```

### 5.2 Update Optimizer CORS
Go to **Railway → Optimizer Service** and update:
```bash
CORS_ORIGINS=https://staffadmin-api-production.up.railway.app,http://localhost:8001
```

Redeploy both services after updating CORS.

---

## ✅ Step 6: Test Deployment

1. Visit your Vercel URL: `https://your-app.vercel.app`
2. Login with credentials:
   - Email: `admin@staffadmin.com`
   - Password: `password123`
3. Test functionality:
   - ✅ Department filter appears (top right)
   - ✅ Schedule page loads
   - ✅ Employees page loads
   - ✅ Click "Optimize" button (should create optimized schedules)

---

## 📊 Free Tier Limits

### Railway (Free Plan)
- $5/month credit
- ~500 hours of runtime (sufficient for team testing)
- Auto-sleeps after 20 mins of inactivity

### Vercel (Hobby Plan)
- 100 GB bandwidth
- Unlimited deployments
- Perfect for team demos

### Supabase (Free Plan)
- 500 MB database
- 2 GB bandwidth
- More than enough for testing

---

## 🔧 Troubleshooting

### Backend fails to start
- Check Railway logs: Dashboard → Service → Deployments → View Logs
- Verify all environment variables are set
- Check `requirements.txt` includes all dependencies

### Frontend can't connect to backend
- Verify `NEXT_PUBLIC_API_URL` is set correctly in Vercel
- Check CORS_ORIGINS includes your Vercel URL
- Open browser DevTools → Network tab to see failed requests

### Optimizer returns 500 error
- Ensure optimizer service is deployed and running on Railway
- Verify `OPTIMIZER_API_URL` in backend points to correct optimizer URL
- Check optimizer service logs

### Database queries fail
- Verify `SUPABASE_KEY` is the **service_role** key (not anon key)
- Check Supabase dashboard for API errors

---

## 🎉 Sharing with Your Team

Once deployed, share these links with your team:

**App URL**: `https://your-app.vercel.app`

**Login Credentials**:
- **Super Admin**: `admin@staffadmin.com` / `password123`
- **Department Admins**: See database for other credentials

**Features to Demo**:
1. 📅 Schedule View - View and manage roster
2. 👥 Employees - View all employees with roles
3. 📊 Dashboard - Overview of roster statistics
4. ⚙️ Optimizer - Auto-generate optimal schedules
5. 🔍 Department Filter - Filter by department (Super Admin only)

---

## 📝 Notes

- Railway free tier may sleep services after inactivity - first request may take 30-60s to wake up
- For production use, consider upgrading to paid tiers for 24/7 uptime
- Set up monitoring via Railway/Vercel dashboards
- Enable Vercel Analytics for usage tracking

---

## 🚀 Quick Deploy Checklist

- [ ] Apply database migration (unique constraint)
- [ ] Deploy Backend API to Railway
- [ ] Deploy Optimizer Service to Railway
- [ ] Deploy Frontend to Vercel
- [ ] Update all CORS settings
- [ ] Test login and core features
- [ ] Share URL with team

---

**Need Help?**
- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Supabase Docs: https://supabase.com/docs
