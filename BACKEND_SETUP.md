# 🏗️ Backend Setup Guide - Ghana Hotel Management SaaS

This guide will walk you through setting up the complete backend infrastructure for the multi-tenant SaaS platform.

## 📋 Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** 14+ (local or cloud)
- **Redis** (optional, for caching)
- **Git**

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the root directory:

```bash
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/ghana_hotel_saas"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# JWT
JWT_SECRET="your-jwt-secret-here"

# Email (for notifications)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"

# File Upload (Cloudinary)
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"

# Payment Gateway (Stripe)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_PUBLISHABLE_KEY="pk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# Redis (for caching and sessions)
REDIS_URL="redis://localhost:6379"

# App Configuration
NODE_ENV="development"
APP_URL="http://localhost:3000"
```

### 2. Database Setup

#### Option A: Local PostgreSQL

1. Install PostgreSQL locally
2. Create database:
```sql
CREATE DATABASE ghana_hotel_saas;
CREATE USER hotel_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ghana_hotel_saas TO hotel_user;
```

#### Option B: Cloud PostgreSQL (Recommended)

- **Supabase** (Free tier available)
- **Railway** (Free tier available)
- **Neon** (Free tier available)
- **AWS RDS** (Production)

### 3. Database Migration

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Or run migrations (recommended for production)
npm run db:migrate
```

### 4. Seed Database

```bash
# Populate with demo data
npm run db:seed
```

This creates:
- Demo tenant (`demo`)
- Demo property
- Demo users (admin, manager, staff)
- Demo rooms
- Demo guests
- System settings

### 5. Start Development Server

```bash
npm run dev
```

## 🔐 Authentication

### Demo Credentials

After seeding, you can login with:

```
Tenant: demo
Admin: admin@demohotel.com / password123
Manager: manager@demohotel.com / password123
Staff: staff@demohotel.com / password123
```

### Multi-Tenant Access

Each hotel gets their own subdomain:
- `demo.localhost:3000` - Demo Hotel
- `hotel1.localhost:3000` - Hotel 1
- `hotel2.localhost:3000` - Hotel 2

## 🏗️ Architecture Overview

### Database Schema

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Tenant    │    │    User     │    │  Property   │
│             │    │             │    │             │
│ - id        │◄───┤ - tenantId  │    │ - tenantId  │
│ - subdomain │    │ - email     │    │ - name      │
│ - plan      │    │ - role      │    │ - address   │
│ - status    │    │ - password  │    └─────────────┘
└─────────────┘    └─────────────┘
       │                   │
       │                   │
       ▼                   ▼
┌─────────────┐    ┌─────────────┐
│    Guest    │    │ Reservation │
│             │    │             │
│ - tenantId  │    │ - tenantId  │
│ - serialNum │    │ - guestId   │
│ - name      │    │ - roomId    │
│ - source    │    │ - status    │
└─────────────┘    └─────────────┘
```

### API Structure

```
/api/
├── auth/[...nextauth]/     # Authentication
├── guests/                 # Guest management
├── reservations/           # Reservation management
├── rooms/                  # Room management
├── housekeeping/           # Housekeeping tasks
├── maintenance/            # Maintenance requests
├── inventory/              # Inventory management
├── invoices/               # Invoice management
├── settings/               # System settings
└── tenants/                # Tenant management
```

### Tenant Isolation

Every API request includes tenant context:
- Extracted from subdomain
- Validated against database
- Applied to all queries
- Logged in audit trail

## 🔧 Development Commands

```bash
# Database
npm run db:generate    # Generate Prisma client
npm run db:push        # Push schema changes
npm run db:migrate     # Run migrations
npm run db:seed        # Seed demo data
npm run db:studio      # Open Prisma Studio

# Development
npm run dev            # Start development server
npm run build          # Build for production
npm run start          # Start production server
npm run lint           # Run ESLint
```

## 🚀 Production Deployment

### 1. Environment Variables

Set production environment variables:
- `DATABASE_URL` - Production PostgreSQL
- `NEXTAUTH_SECRET` - Strong secret key
- `NEXTAUTH_URL` - Production domain
- `REDIS_URL` - Production Redis

### 2. Database Migration

```bash
# Generate migration
npx prisma migrate dev --name production

# Apply to production
npx prisma migrate deploy
```

### 3. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### 4. Set up Custom Domains

Configure DNS for multi-tenant subdomains:
- `*.yourdomain.com` → Vercel
- Each hotel gets: `hotelname.yourdomain.com`

## 🔒 Security Features

### Authentication & Authorization
- JWT-based sessions
- Role-based access control (RBAC)
- Tenant isolation
- Password hashing with bcrypt

### Data Protection
- Row-level security (RLS)
- Tenant data isolation
- Audit logging
- Input validation

### API Security
- Rate limiting
- CORS configuration
- Request validation
- Error handling

## 📊 Monitoring & Logging

### Audit Logs
All system actions are logged:
- User actions
- Data changes
- API requests
- Error events

### Health Checks
```bash
# Database health
GET /api/health/database

# Application health
GET /api/health
```

## 🔄 API Integration

### RESTful Endpoints

All endpoints follow REST conventions:
- `GET /api/guests` - List guests
- `POST /api/guests` - Create guest
- `PUT /api/guests/:id` - Update guest
- `DELETE /api/guests/:id` - Delete guest

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "pages": 5
  },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z"
  }
}
```

## 🧪 Testing

### API Testing
```bash
# Run API tests
npm run test:api

# Run integration tests
npm run test:integration
```

### Database Testing
```bash
# Test database connection
npm run test:db

# Test migrations
npm run test:migrations
```

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check `DATABASE_URL` in `.env`
   - Verify PostgreSQL is running
   - Check firewall settings

2. **Authentication Issues**
   - Verify `NEXTAUTH_SECRET` is set
   - Check `NEXTAUTH_URL` matches your domain
   - Clear browser cookies

3. **Tenant Not Found**
   - Verify subdomain exists in database
   - Check tenant status is 'active'
   - Review middleware configuration

### Debug Mode

Enable debug logging:
```bash
DEBUG=prisma:* npm run dev
```

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

## 🤝 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the logs
3. Create an issue in the repository
4. Contact the development team

---

**🎉 Congratulations!** Your SaaS backend is now ready for multi-tenant hotel management.
