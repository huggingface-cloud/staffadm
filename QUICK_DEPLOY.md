# 🚀 Quick Deployment Guide - Deploy from GitHub in 15 Minutes

This guide will help you deploy the entire Staff Admin application using **4 specialized deployment branches**.

## 📋 What You'll Deploy

| Component | Branch | Platform | Free Tier |
|-----------|--------|----------|-----------|
| **Frontend** | `deploy-frontend` | Vercel | ✅ Yes |
| **Backend API** | `deploy-backend` | Railway | ✅ Yes |
| **Optimizer** | `deploy-optimizer` | Railway | ✅ Yes |
| **Database** | `deploy-database` | Supabase | ✅ Already hosted |

**Total Cost**: $0/month on free tiers!

---

## ⚡ Quick Start (Follow in Order)

### Step 1: Apply Database Migration (2 mins)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click "SQL Editor"
4. Run this SQL:
   ```sql
   ALTER TABLE roster_assignments
   ADD CONSTRAINT unique_shift_employee
   UNIQUE (shift_id, employee_id);
   ```
5. ✅ Done! This prevents duplicate shift assignments

📖 **Detailed docs**: See `deploy-database` branch → `DEPLOY_DATABASE.md`

---

### Step 2: Deploy Backend API to Railway (5 mins)

1. Go to [railway.app](https://railway.app)
2. Sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select repository: `StaffAdminV1`
5. **Configure**:
   - **Branch**: `deploy-backend`
   - **Root Directory**: `staffadm/api`
6. **Add Environment Variables**:
   ```bash
   SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
   SUPABASE_KEY=<your_service_role_key_from_supabase>
   JWT_SECRET_KEY=<generate_with_command_below>
   JWT_ALGORITHM=HS256
   OPTIMIZER_API_URL=http://localhost:9001
   CORS_ORIGINS=http://localhost:3000
   PORT=8001
   ```

   **Generate JWT_SECRET_KEY**:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

7. Click "Deploy"
8. **Copy your backend URL**: `https://your-backend.up.railway.app`

📖 **Detailed docs**: See `deploy-backend` branch → `DEPLOY_BACKEND.md`

---

### Step 3: Deploy Optimizer to Railway (5 mins)

1. In Railway, same project, click "New" → "Service"
2. Select "Deploy from GitHub repo"
3. Select repository: `StaffAdminV1`
4. **Configure**:
   - **Branch**: `deploy-optimizer`
   - **Root Directory**: `staffadm/opti`
5. **Add Environment Variables**:
   ```bash
   SUPABASE_URL=https://xueqvozgeebhlffxmiqp.supabase.co
   SUPABASE_KEY=<your_service_role_key_from_supabase>
   CORS_ORIGINS=<backend_url_from_step2>
   PORT=9001
   ```
6. Click "Deploy"
7. **Copy your optimizer URL**: `https://your-optimizer.up.railway.app`

📖 **Detailed docs**: See `deploy-optimizer` branch → `DEPLOY_OPTIMIZER.md`

---

### Step 4: Update Backend with Optimizer URL (1 min)

1. Go back to your **Backend service** in Railway
2. Update environment variable:
   ```bash
   OPTIMIZER_API_URL=<optimizer_url_from_step3>
   ```
3. Redeploy (Railway will auto-redeploy)

---

### Step 5: Deploy Frontend to Vercel (3 mins)

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click "Add New..." → "Project"
4. Select repository: `StaffAdminV1`
5. **Configure**:
   - **Branch**: `deploy-frontend`
   - **Root Directory**: `staffadm/web`
   - **Framework Preset**: Next.js (auto-detected)
6. **Add Environment Variable**:
   ```bash
   NEXT_PUBLIC_API_URL=<backend_url_from_step2>
   ```
7. Click "Deploy"
8. **Copy your app URL**: `https://your-app.vercel.app`

📖 **Detailed docs**: See `deploy-frontend` branch → `DEPLOY_FRONTEND.md`

---

### Step 6: Update CORS Settings (2 mins)

#### Update Backend CORS
1. Go to Railway → Backend service → Variables
2. Update:
   ```bash
   CORS_ORIGINS=<vercel_url_from_step5>,http://localhost:3000
   ```
3. Redeploy

#### Update Optimizer CORS
1. Go to Railway → Optimizer service → Variables
2. Update:
   ```bash
   CORS_ORIGINS=<backend_url_from_step2>,http://localhost:8001
   ```
3. Redeploy

---

## ✅ Testing Your Deployment

### 1. Test Backend API
```bash
curl https://your-backend.railway.app/health
```
Expected: `{"status":"healthy"}`

### 2. Test Login
```bash
curl -X POST https://your-backend.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staffadmin.com","password":"password123"}'
```
Expected: Returns `access_token`

### 3. Test Frontend
1. Visit: `https://your-app.vercel.app`
2. Login with:
   - Email: `admin@staffadmin.com`
   - Password: `password123`
3. Should see dashboard with department filter (top right)

### 4. Test Optimizer
1. Click "Optimize" button in the app
2. Should create optimized schedule
3. Check for success message

---

## 🎉 Share with Your Team

Once deployed, share this with your team:

**App URL**: `https://your-app.vercel.app`

**Login**:
- Email: `admin@staffadmin.com`
- Password: `password123`

**Features to Demo**:
- 📅 Schedule View - Roster management
- 👥 Employees - Team directory
- 📊 Dashboard - Statistics
- ⚡ Optimizer - Auto-scheduling
- 🔍 Department Filter - Multi-department view

---

## 🔧 Troubleshooting

### Backend fails to connect
- ✅ Check `SUPABASE_KEY` is the **service_role** key
- ✅ Verify all environment variables are set
- ✅ Check Railway logs for errors

### Frontend can't reach backend
- ✅ Verify `NEXT_PUBLIC_API_URL` in Vercel
- ✅ Check CORS includes Vercel URL
- ✅ Test backend `/health` endpoint directly

### Optimizer returns error
- ✅ Ensure optimizer service is running
- ✅ Verify `OPTIMIZER_API_URL` in backend
- ✅ Check optimizer Railway logs

### Duplicate employees in shifts
- ✅ Run the database migration from Step 1
- ✅ Verify constraint exists:
   ```sql
   SELECT * FROM information_schema.table_constraints
   WHERE constraint_name = 'unique_shift_employee';
   ```

---

## 📚 Detailed Documentation

Each deployment branch has its own detailed README:

- **Frontend**: `deploy-frontend` → `DEPLOY_FRONTEND.md`
- **Backend**: `deploy-backend` → `DEPLOY_BACKEND.md`
- **Optimizer**: `deploy-optimizer` → `DEPLOY_OPTIMIZER.md`
- **Database**: `deploy-database` → `DEPLOY_DATABASE.md`

---

## 💰 Free Tier Limits

### Railway (Both services combined)
- **Free Plan**: $5/month credit
- ~500 hours of runtime
- Auto-sleeps after 20 mins inactivity
- Sufficient for team testing and demos

### Vercel (Frontend)
- **Hobby Plan**: 100% free
- 100 GB bandwidth
- Unlimited deployments
- Perfect for demos

### Supabase (Database)
- **Free Plan**: 100% free
- 500 MB database
- 2 GB bandwidth
- Auto-backups included

---

## 🔄 Updating Deployment

When you push to deployment branches, services auto-update:

```bash
# Update frontend
git checkout deploy-frontend
git merge Dev  # or cherry-pick specific commits
git push origin deploy-frontend

# Vercel will auto-deploy!
```

Same process for backend and optimizer branches.

---

## 📞 Need Help?

- **Railway Issues**: https://railway.app/help
- **Vercel Issues**: https://vercel.com/docs
- **Supabase Issues**: https://supabase.com/docs

---

**Deployment Time**: ~15 minutes total
**Difficulty**: Beginner-friendly
**Cost**: $0/month
