# 🎯 Staff Admin - Workforce Management System

A complete roster optimization and staff management application with department-based access control.

## ✨ Features

- 📅 **Smart Roster Management** - Visual schedule with drag-and-drop
- ⚡ **AI-Powered Optimization** - Automatic optimal shift assignments using linear programming
- 👥 **Employee Management** - Complete employee profiles with roles and qualifications
- 📊 **Analytics Dashboard** - Real-time workforce insights
- 🔐 **Multi-Department Access Control** - Super Admin and Department Admin roles
- 📈 **Workforce Forecasting** - Predict staffing gaps and trends
- ⏱️ **Hours Tracking** - Monitor employee weekly hours and overtime

## 🚀 Quick Deploy (15 Minutes)

Deploy the entire application to free hosting platforms:

```bash
# See detailed instructions
cat QUICK_DEPLOY.md
```

### Deployment Branches

| Branch | Service | Platform | Purpose |
|--------|---------|----------|---------|
| `deploy-frontend` | Next.js Frontend | Vercel | User interface |
| `deploy-backend` | FastAPI API | Railway | Main backend API |
| `deploy-optimizer` | Optimizer Service | Railway | Roster optimization |
| `deploy-database` | SQL Scripts | Supabase | Database migrations |

## 🏗️ Architecture

```
┌─────────────────┐
│   Vercel        │
│  (Frontend)     │
│  Next.js + React│
└────────┬────────┘
         │
         ↓
┌─────────────────┐      ┌──────────────┐
│   Railway       │      │   Railway    │
│  (Backend API)  │◄────►│  (Optimizer) │
│  FastAPI        │      │  PuLP        │
└────────┬────────┘      └──────┬───────┘
         │                      │
         └──────────┬───────────┘
                    ↓
            ┌───────────────┐
            │   Supabase    │
            │  (Database)   │
            │  PostgreSQL   │
            └───────────────┘
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Hooks** - State management

### Backend
- **FastAPI** - Python web framework
- **JWT Authentication** - Secure auth
- **Supabase** - PostgreSQL database
- **Caching Layer** - Query optimization

### Optimizer
- **PuLP** - Linear programming
- **FastAPI** - API server
- **Python** - Optimization algorithms

### Database
- **PostgreSQL** (Supabase)
- **Row Level Security** - Data protection
- **Real-time capabilities** - Live updates

## 📁 Project Structure

```
staffadm/
├── web/                 # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   ├── contexts/       # Auth context
│   └── lib/            # API client
├── api/                # FastAPI backend
│   ├── main.py        # API routes
│   ├── auth.py        # Authentication
│   ├── cache_manager.py # Caching
│   └── requirements.txt
├── opti/               # Optimizer service
│   ├── optimizer_api.py
│   ├── optimizer_optimized.py
│   └── requirements.txt
└── db/                 # SQL migrations
    └── *.sql

```

## 🔑 Default Credentials

- **Super Admin**
  - Email: `admin@staffadmin.com`
  - Password: `password123`

## 📚 Documentation

- **[QUICK_DEPLOY.md](QUICK_DEPLOY.md)** - 15-minute deployment guide
- **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** - Comprehensive deployment instructions
- **deploy-frontend** branch → [DEPLOY_FRONTEND.md](DEPLOY_FRONTEND.md)
- **deploy-backend** branch → [DEPLOY_BACKEND.md](DEPLOY_BACKEND.md)
- **deploy-optimizer** branch → [DEPLOY_OPTIMIZER.md](DEPLOY_OPTIMIZER.md)
- **deploy-database** branch → [DEPLOY_DATABASE.md](DEPLOY_DATABASE.md)

## 🎯 Deployment Workflow

1. **Apply Database Migration** (Supabase SQL Editor)
2. **Deploy Backend** (Railway from `deploy-backend` branch)
3. **Deploy Optimizer** (Railway from `deploy-optimizer` branch)
4. **Deploy Frontend** (Vercel from `deploy-frontend` branch)
5. **Update CORS Settings** (Railway environment variables)

See [QUICK_DEPLOY.md](QUICK_DEPLOY.md) for step-by-step instructions.

## 💰 Hosting Costs

**$0/month** on free tiers:
- Vercel: Free Hobby plan
- Railway: $5/month credit (covers both backend + optimizer)
- Supabase: Free tier

## 🧪 Local Development

### Prerequisites
- Node.js 18+
- Python 3.12+
- Supabase account

### Setup

```bash
# Frontend
cd web
npm install
cp .env.example .env.local
# Edit .env.local with your backend URL
npm run dev

# Backend
cd api
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase credentials
python main.py

# Optimizer
cd opti
python3 -m venv rostering_venv
source rostering_venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your Supabase credentials
python optimizer_api.py
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with Claude Code
- Powered by FastAPI and Next.js
- Database by Supabase
- Optimization by PuLP

---

**Ready to deploy?** Follow [QUICK_DEPLOY.md](QUICK_DEPLOY.md) for instant deployment! 🚀
