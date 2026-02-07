# 🚀 Deployment Guide - Voice Sheets Assistant

Complete guide for deploying the Voice-Driven Google Sheets Assistant to production.

---

## 📋 **Pre-Deployment Checklist**

### Required Accounts & Services

- [ ] **Vercel Account** (recommended for Next.js)
- [ ] **PostgreSQL Database** (Supabase, Neon, or AWS RDS)
- [ ] **Google Cloud Project** with billing enabled
- [ ] **OpenAI Account** with API access
- [ ] **Domain Name** (optional but recommended)

---

## 🔧 **Environment Setup**

### 1. Database Configuration

**Recommended Providers:**
- **Supabase** (easiest, includes pgBouncer)
- **Neon** (serverless, autoscaling)
- **AWS RDS** (full control)

**Setup Steps:**
```bash
# 1. Create PostgreSQL database
# 2. Get connection string
# 3. Add to .env

DATABASE_URL="postgresql://user:password@host:5432/dbname?pgbouncer=true"
```

**Run Migrations:**
```bash
npx prisma db push
npx prisma generate
```

### 2. Google Cloud Setup

**Enable Required APIs:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable:
   - Google Sheets API
   - Google Drive API
   - Google Speech-to-Text API (optional)

**OAuth 2.0 Configuration:**
```
1. Go to APIs & Services > Credentials
2. Create OAuth 2.0 Client ID:
   - Application type: Web application
   - Authorized redirect URIs:
     - https://yourdomain.com/api/auth/callback/google
     - http://localhost:3000/api/auth/callback/google (for testing)
   - Authorized JavaScript origins:
     - https://yourdomain.com
     - http://localhost:3000
```

**OAuth Consent Screen:**
```
1. External user type
2. Add scopes:
   - https://www.googleapis.com/auth/spreadsheets
   - https://www.googleapis.com/auth/drive.file
   - openid, email, profile
3. Add test users (for development)
4. Submit for verification (for production)
```

### 3. OpenAI API

```bash
# Get API key from: https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-your-openai-api-key"
OPENAI_MODEL="gpt-4-turbo-preview"
```

### 4. Security Configuration

**Generate Secure Keys:**
```bash
# NextAuth Secret (32+ characters)
openssl rand -base64 32

# Encryption Key (32+ characters)
openssl rand -base64 32
```

**Complete Environment Variables:**
```env
# Database
DATABASE_URL="postgresql://..."

# NextAuth
NEXTAUTH_SECRET="your-generated-secret-here"
NEXTAUTH_URL="https://yourdomain.com"

# Google OAuth
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"

# OpenAI
OPENAI_API_KEY="sk-your-api-key"
OPENAI_MODEL="gpt-4-turbo-preview"

# Encryption
ENCRYPTION_KEY="your-generated-encryption-key"

# Optional: Redis (for rate limiting)
REDIS_URL="redis://..."

# Production
NODE_ENV="production"
```

---

## 🌐 **Deployment Options**

### Option 1: Vercel (Recommended)

**Why Vercel:**
- Built for Next.js
- Automatic deployments
- Edge network globally
- Zero configuration

**Deploy Steps:**

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Add environment variables in Vercel dashboard
# Settings > Environment Variables > Add all from .env

# 5. Redeploy
vercel --prod
```

**Vercel Configuration:**

Create `vercel.json`:
```json
{
  "framework": "nextjs",
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install",
  "env": {
    "DATABASE_URL": "@database-url",
    "NEXTAUTH_SECRET": "@nextauth-secret",
    "GOOGLE_CLIENT_ID": "@google-client-id",
    "GOOGLE_CLIENT_SECRET": "@google-client-secret",
    "OPENAI_API_KEY": "@openai-api-key",
    "ENCRYPTION_KEY": "@encryption-key"
  }
}
```

### Option 2: Docker + Cloud Run

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci
RUN npx prisma generate

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

**Deploy to Cloud Run:**
```bash
# Build and push
docker build -t gcr.io/PROJECT_ID/voice-sheets .
docker push gcr.io/PROJECT_ID/voice-sheets

# Deploy
gcloud run deploy voice-sheets \
  --image gcr.io/PROJECT_ID/voice-sheets \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Option 3: Traditional VPS

**Server Requirements:**
- Ubuntu 22.04 LTS
- 2+ GB RAM
- Node.js 20+
- PostgreSQL 15+
- Nginx (reverse proxy)

**Setup:**
```bash
# 1. Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql nginx

# 2. Clone repo
git clone your-repo
cd voice-sheets

# 3. Install packages
npm install
npx prisma generate

# 4. Build
npm run build

# 5. Start with PM2
npm install -g pm2
pm2 start npm --name "voice-sheets" -- start
pm2 startup
pm2 save
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🔒 **Security Hardening**

### SSL/TLS Certificate

**Free with Certbot:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

### Headers & CSP

Add to `next.config.js`:
```javascript
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  }
];

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};
```

### Rate Limiting

Fully integrated via `lib/middleware/with-rate-limit.ts` into all 16 API route files.

**Configurations (per user):**
- `voice_transcribe`: 20 requests/minute (heavy operations)
- `sheet_operation`: 30 requests/minute (create, execute, dry-run, undo)
- `api_call`: 60 requests/minute (all other endpoints)
- `auth_attempt`: 5 requests/15 minutes

Rate-limited responses return 429 status with `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` headers.

---

## 📊 **Monitoring & Logging**

### Sentry (Error Tracking)

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### Vercel Analytics

Already included with Vercel deployment.

### Database Monitoring

**Supabase:** Built-in dashboard
**Self-hosted:** Use pgAdmin or Grafana

---

## 🧪 **Testing Production Build**

```bash
# Build locally
npm run build

# Start production server
npm start

# Test critical flows:
# 1. Authentication
# 2. Voice commands
# 3. Sheet operations
# 4. Undo functionality
```

---

## 🔄 **Database Migrations**

**Production Migration Strategy:**

```bash
# 1. Backup database first
pg_dump dbname > backup.sql

# 2. Run migrations
npx prisma migrate deploy

# 3. Verify
npx prisma db pull
```

---

## 📈 **Scaling Considerations**

### Horizontal Scaling

- **Stateless design** ✅ (already implemented)
- Use Redis for session caching
- Database connection pooling (pgBouncer)
- CDN for static assets

### Performance Optimization

```typescript
// Enable in next.config.js
module.exports = {
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  experimental: {
    optimizeCss: true,
  },
};
```

---

## 🚨 **Troubleshooting**

### Common Issues

**1. OAuth Callback Error**
```
Solution: Check redirect URI matches exactly in Google Console
```

**2. Prisma Connection Pool Exhausted**
```
Solution: Add ?pgbouncer=true to DATABASE_URL
```

**3. Rate Limit Not Working**
```
Solution: Ensure Redis is connected or database rate limits enabled
```

### Health Check Endpoint

Already implemented at `/api/health`. Returns database connectivity status:
```bash
curl https://yourdomain.com/api/health
# {"status":"healthy","timestamp":"...","database":"connected"}
```

---

## ✅ **Post-Deployment Checklist**

- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables secured
- [ ] Database backups configured
- [ ] Monitoring/logging active (Sentry, Vercel Analytics)
- [ ] OAuth consent screen verified (for production users)
- [ ] Rate limiting tested
- [ ] Error pages working (/auth/error)
- [ ] Health check endpoint responding
- [ ] Domain DNS configured
- [ ] README updated with production URL

---

## 📞 **Support & Maintenance**

### Regular Tasks

**Daily:**
- Monitor error logs
- Check rate limit stats

**Weekly:**
- Review audit logs
- Database backup verification

**Monthly:**
- Update dependencies
- Review and cleanup expired rollback actions
- Security patches

### Cleanup Jobs

Set up cron jobs:
```bash
# Cleanup expired rate limits
0 0 * * * curl https://yourdomain.com/api/maintenance/cleanup-rate-limits

# Cleanup expired rollbacks
0 1 * * * curl https://yourdomain.com/api/maintenance/cleanup-rollbacks
```

---

## 🎉 **Launch**

Your Voice-Driven Google Sheets Assistant is now live! 🚀

**Next Steps:**
1. Share with beta testers
2. Gather feedback
3. Monitor performance
4. Iterate and improve

**Production URL:** https://yourdomain.com

Built with safety, security, and scalability from day one.
