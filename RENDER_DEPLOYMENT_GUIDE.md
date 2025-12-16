# 🎨 Render.com Deployment Guide - Step by Step

Deploy your Staff Admin application to Render.com in **15 minutes** - completely free!

## 🌟 Why Render.com?

- ✅ **750 free hours/month** (enough for 1 service 24/7)
- ✅ **No credit card required**
- ✅ **Auto-deploy from GitHub**
- ✅ **Better free tier than Railway**
- ✅ **PostgreSQL database included** (not needed, we use Supabase)

---

## 📋 Prerequisites

1. GitHub account (already have ✅)
2. Render.com account (we'll create)
3. Repository pushed to GitHub (already done ✅)
4. Supabase database (already set up ✅)

---

## 🚀 Step-by-Step Deployment

### STEP 1: Create Render.com Account (2 minutes)

1. Go to [render.com](https://render.com)
2. Click **"Get Started"**
3. Sign up with your **GitHub account**
4. Authorize Render to access your repositories
5. ✅ You're in!

---

### STEP 2: Apply Database Migration (1 minute)

Before deploying, ensure the unique constraint is applied:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Click **SQL Editor**
4. Run this:

```sql
ALTER TABLE roster_assignments
ADD CONSTRAINT unique_shift_employee
UNIQUE (shift_id, employee_id);
```

5. ✅ Click "Run"

---

### STEP 3: Deploy Backend API (5 minutes)

1. In Render dashboard, click **"New +"** → **"Web Service"**

2. **Connect Repository**:
   - Click "Connect account" if needed
   - Select repository: **`StaffAdminV1`** or **`staffadm`**
   - Click "Connect"

3. **Configure Service**:

   | Setting | Value |
   |---------|-------|
   | **Name** | `staffadmin-backend` |
   | **Region** | Oregon (US West) |
   | **Branch** | `deploy-render-backend` |
   | **Root Directory** | `staffadm/api` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |

4. **Add Environment Variables**:

   Click **"Advanced"** → **"Add Environment Variable"**

   Add these one by one:

   ```
   SUPABASE_URL = https://xueqvozgeebhlffxmiqp.supabase.co
   ```

   ```
   SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90
   ```

   ```
   JWT_ALGORITHM = HS256
   ```

   **For JWT_SECRET_KEY** - Generate it first:

   Open terminal and run:
   ```bash
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```

   Copy the output and add:
   ```
   JWT_SECRET_KEY = <paste_generated_key_here>
   ```

   ```
   OPTIMIZER_API_URL = http://localhost:9001
   ```
   *(We'll update this after deploying optimizer)*

   ```
   CORS_ORIGINS = http://localhost:3000
   ```
   *(We'll update this after deploying frontend)*

5. **Select Free Plan**:
   - Instance Type: **Free**
   - ✅ Click **"Create Web Service"**

6. **Wait for Deployment** (~3-5 minutes)
   - Watch the build logs
   - When you see "Your service is live 🎉", it's ready!

7. **Copy Your Backend URL**:

   At the top of the page, you'll see:
   ```
   https://staffadmin-backend.onrender.com
   ```

   **📋 SAVE THIS URL!** You'll need it for optimizer and frontend.

---

### STEP 4: Test Backend API (1 minute)

Open a new terminal and test:

```bash
# Test health endpoint
curl https://staffadmin-backend.onrender.com/health
```

Expected response: `{"status":"healthy"}`

```bash
# Test login
curl -X POST https://staffadmin-backend.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@staffadmin.com","password":"password123"}'
```

Expected: JSON response with `access_token`

✅ If both work, backend is deployed successfully!

---

### STEP 5: Deploy Optimizer Service (5 minutes)

1. In Render dashboard, click **"New +"** → **"Web Service"**

2. **Select Repository**: Same repository (`StaffAdminV1` or `staffadm`)

3. **Configure Service**:

   | Setting | Value |
   |---------|-------|
   | **Name** | `staffadmin-optimizer` |
   | **Region** | Oregon (US West) |
   | **Branch** | `deploy-render-optimizer` |
   | **Root Directory** | `staffadm/opti` |
   | **Runtime** | Python 3 |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn optimizer_api:app --host 0.0.0.0 --port $PORT` |

4. **Add Environment Variables**:

   ```
   SUPABASE_URL = https://xueqvozgeebhlffxmiqp.supabase.co
   ```

   ```
   SUPABASE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1ZXF2b3pnZWViaGxmZnhtaXFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc4ODcwMSwiZXhwIjoyMDgwMzY0NzAxfQ.305q-C9loNljanzQ567sNvafSm0W4nRPgScWj4g7G90
   ```

   ```
   CORS_ORIGINS = https://staffadmin-backend.onrender.com
   ```
   *(Use your backend URL from Step 3)*

5. **Select Free Plan** → Click **"Create Web Service"**

6. **Wait for Deployment** (~3-5 minutes)

7. **Copy Your Optimizer URL**:
   ```
   https://staffadmin-optimizer.onrender.com
   ```

   **📋 SAVE THIS URL!**

---

### STEP 6: Update Backend with Optimizer URL (2 minutes)

1. Go back to **staffadmin-backend** service in Render
2. Click **"Environment"** in left sidebar
3. Find `OPTIMIZER_API_URL` variable
4. Click **"Edit"**
5. Update value to: `https://staffadmin-optimizer.onrender.com`
6. Click **"Save Changes"**
7. Service will automatically redeploy (~1-2 mins)

---

### STEP 7: Test Optimizer (1 minute)

```bash
# Test optimizer
curl -X POST https://staffadmin-optimizer.onrender.com/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "start_date": "2025-12-13",
    "end_date": "2025-12-20",
    "save_results": true
  }'
```

Expected: JSON response with optimization results and `"status": "Optimal"`

✅ If it works, optimizer is deployed successfully!

---

### STEP 8: Deploy Frontend to Vercel (3 minutes)

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"Add New..."** → **"Project"**
4. Select repository: **`StaffAdminV1`** or **`staffadm`**

5. **Configure Project**:

   | Setting | Value |
   |---------|-------|
   | **Framework Preset** | Next.js (auto-detected) |
   | **Root Directory** | `staffadm/web` |
   | **Build Command** | `npm run build` (default) |
   | **Output Directory** | `.next` (default) |

6. **Add Environment Variable**:

   Click **"Environment Variables"**

   ```
   NEXT_PUBLIC_API_URL = https://staffadmin-backend.onrender.com
   ```
   *(Use your backend URL from Step 3)*

7. Click **"Deploy"**

8. **Wait for Deployment** (~2-3 minutes)

9. **Copy Your Frontend URL**:
   ```
   https://your-app.vercel.app
   ```

   **📋 SAVE THIS URL!**

---

### STEP 9: Update CORS Settings (2 minutes)

Now that frontend is deployed, update CORS:

#### Update Backend:
1. Go to **staffadmin-backend** in Render
2. Click **"Environment"**
3. Edit `CORS_ORIGINS`:
   ```
   https://your-app.vercel.app,http://localhost:3000
   ```
4. Save (auto-redeploys)

#### Update Optimizer:
1. Go to **staffadmin-optimizer** in Render
2. Click **"Environment"**
3. Edit `CORS_ORIGINS`:
   ```
   https://staffadmin-backend.onrender.com,http://localhost:8001
   ```
4. Save (auto-redeploys)

---

## ✅ STEP 10: Test Complete Application (3 minutes)

### 1. Open Your App
Visit: `https://your-app.vercel.app`

### 2. Login
- Email: `admin@staffadmin.com`
- Password: `password123`

### 3. Test Features:
- ✅ Department filter appears (top right)
- ✅ Schedule page loads with shifts
- ✅ Employees page shows all employees
- ✅ Click **"Optimize"** button
- ✅ Optimization runs successfully
- ✅ Schedule updates with optimized assignments

### 4. Verify No Duplicates
- Check any shift
- Each employee should appear only ONCE per shift
- ✅ No duplicate names

---

## 🎉 Deployment Complete!

You now have:

| Service | URL | Status |
|---------|-----|--------|
| **Frontend** | `https://your-app.vercel.app` | ✅ Live |
| **Backend** | `https://staffadmin-backend.onrender.com` | ✅ Live |
| **Optimizer** | `https://staffadmin-optimizer.onrender.com` | ✅ Live |
| **Database** | Supabase (already hosted) | ✅ Live |

**Total Cost**: $0/month 💰

---

## 📊 Render Free Tier Details

- **750 hours/month free** (1 service can run 24/7)
- Services sleep after **15 minutes** of inactivity
- **Cold start**: 30-60 seconds (first request after sleeping)
- **Automatic HTTPS** included
- **Auto-deploy** on git push

### How to Keep Services Awake:
- Use a monitoring service like [UptimeRobot](https://uptimerobot.com) (free)
- Ping your backend every 10 minutes
- Or accept cold starts (usually fine for team demos)

---

## 🐛 Troubleshooting

### Service won't build
- ✅ Check build logs in Render dashboard
- ✅ Verify root directory is correct
- ✅ Ensure `requirements.txt` exists
- ✅ Check Python version compatibility

### Environment variables not working
- ✅ Click "Manual Deploy" after changing variables
- ✅ Verify no typos in variable names
- ✅ Check values don't have extra spaces

### Frontend can't connect to backend
- ✅ Verify `NEXT_PUBLIC_API_URL` in Vercel
- ✅ Check CORS includes Vercel URL
- ✅ Test backend URL directly in browser

### Optimizer returns errors
- ✅ Check optimizer logs in Render
- ✅ Verify `OPTIMIZER_API_URL` in backend
- ✅ Test optimizer endpoint directly

### Cold starts are slow
- ✅ Normal behavior on free tier
- ✅ First request takes 30-60s
- ✅ Subsequent requests are fast
- ✅ Consider UptimeRobot to keep awake

---

## 🔄 Updating Your Deployment

When you make changes:

```bash
# Make changes to your code
git add .
git commit -m "your changes"

# Push to deployment branch
git push origin deploy-render-backend  # Backend updates
git push origin deploy-render-optimizer  # Optimizer updates
git push origin deploy-frontend  # Frontend updates
```

Render and Vercel will **auto-deploy** automatically! 🎉

---

## 📱 Share with Your Team

Send them:

**App URL**: `https://your-app.vercel.app`

**Login**:
- Email: `admin@staffadmin.com`
- Password: `password123`

**Features to Demo**:
- 📅 Schedule management
- ⚡ Auto-optimization
- 👥 Employee directory
- 📊 Analytics dashboard
- 🔍 Department filtering (Super Admin)

---

## 🎯 Next Steps

- [ ] Test all features
- [ ] Share URL with team
- [ ] Set up monitoring (optional)
- [ ] Configure custom domain (optional)
- [ ] Add more employees/shifts
- [ ] Create department admins

---

**Congratulations!** 🎉 Your Staff Admin application is now live and accessible to your team!

**Need help?** Check Render docs: https://render.com/docs
