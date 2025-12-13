# 🎨 Frontend Deployment Branch

This branch contains only the **Next.js frontend** application.

## 📁 What's Included

- `/web` - Next.js application
- Environment configuration
- Deployment files for Vercel

## 🚀 Deploy to Vercel

### Option 1: Deploy via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and login with GitHub
2. Click "Add New..." → "Project"
3. Select this repository: `StaffAdminV1`
4. **Important**: Configure these settings:
   - **Branch**: `deploy-frontend`
   - **Root Directory**: `staffadm/web`
   - **Framework Preset**: Next.js (auto-detected)
5. Add Environment Variable:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app
   ```
6. Click "Deploy"

### Option 2: Deploy via Vercel CLI

```bash
cd staffadm/web
npm install -g vercel
vercel --prod
```

## 🔧 Environment Variables

Set these in Vercel dashboard:

| Variable | Value | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_API_URL` | `https://your-backend.railway.app` | Backend API endpoint |

## ✅ Post-Deployment

1. Get your Vercel URL (e.g., `https://staff-admin.vercel.app`)
2. Update CORS settings in backend to include this URL
3. Test login at `/login`

## 🔗 Dependencies

- Backend API (deploy-backend branch)
- Supabase database (already hosted)

## 📝 Login Credentials

- Email: `admin@staffadmin.com`
- Password: `password123`
