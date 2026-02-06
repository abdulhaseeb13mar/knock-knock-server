# Setup Plan: Run Knock Knock Server on MacBook

## Project Overview

**Knock Knock Server** is a NestJS backend for an AI-powered email outreach platform. It requires Node.js, PostgreSQL, and Redis to run.

---

## Prerequisites to Install

### 1. Install Node.js & pnpm

- **Check current Node version**: `node --version`
- If Node.js not installed or outdated (need v18+), install via Homebrew:
  ```bash
  brew install node
  ```
- **Install pnpm** (package manager for this project):
  ```bash
  npm install -g pnpm
  ```
- **Verify**: `pnpm --version` (should be v9+)

### 2. Install PostgreSQL

- Install via Homebrew:
  ```bash
  brew install postgresql@16
  ```
- Start PostgreSQL service:
  ```bash
  brew services start postgresql@16
  ```
- Verify it's running:
  ```bash
  psql -U postgres -c "SELECT version();"
  ```
- Create a database for the project:
  ```bash
  createdb knock_knock
  ```

### 3. Install Redis

- Install via Homebrew:
  ```bash
  brew install redis
  ```
- Start Redis service:
  ```bash
  brew services start redis
  ```
- Verify it's running:
  ```bash
  redis-cli ping
  ```
  (Should respond with "PONG")

---

## Project Setup Steps

### Step 1: Install Dependencies

```bash
cd /Users/haseeb/work/knock-knock-server
pnpm install
```

### Step 2: Configure Environment Variables

- Copy the example environment file:
  ```bash
  cp .env.example .env
  ```
- Edit `.env` with your local configuration:

  ```
  PORT=3000
  JWT_SECRET=your-secure-random-key-here

  DATABASE_URL=postgresql://postgres:postgres@localhost:5432/knock_knock?schema=public
  REDIS_URL=redis://localhost:6379

  ENCRYPTION_KEY=<base64-32-byte-encryption-key>
  GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
  GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
  GOOGLE_REDIRECT_URI=http://localhost:3000/integrations/gmail/callback
  ```

**Notes on values:**

- `JWT_SECRET`: Any random string (use `openssl rand -base64 32` to generate)
- `ENCRYPTION_KEY`: Generate a base64-encoded 32-byte key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
- Google OAuth credentials: Optional for development (skip if you don't need Gmail integration)

### Step 3: Setup Database

- Generate Prisma client:
  ```bash
  pnpm run prisma:generate
  ```
- Run database migrations:
  ```bash
  pnpm run prisma:migrate
  ```
  (This creates all necessary tables in the `knock_knock` database)

### Step 4: Start the Development Server

```bash
pnpm run start:dev
```

This will start the NestJS application in watch mode on `http://localhost:3000`

---

## Verification Steps

### Check PostgreSQL Connection

```bash
psql -U postgres -d knock_knock -c "\dt"
```

(Should list database tables if migrations ran successfully)

### Check Redis Connection

```bash
redis-cli ping
```

(Should respond with "PONG")

### Test API

```bash
curl http://localhost:3000/health
```

(Or check the health endpoint defined in your app)

### View Logs

- Server logs will appear in your terminal running `pnpm run start:dev`
- Check for any connection errors to PostgreSQL or Redis

---

## Useful Commands for Development

```bash
pnpm run test              # Run unit tests
pnpm run test:watch       # Watch mode for tests
pnpm run lint             # Run ESLint
pnpm run format           # Format code with Prettier
pnpm run prisma:studio   # Open Prisma Studio (database GUI at localhost:5555)
```

---

## Troubleshooting

### PostgreSQL connection refused

- Verify service is running: `brew services list`
- Restart if needed: `brew services restart postgresql@16`
- Check credentials in `.env` match your PostgreSQL setup

### Redis connection refused

- Verify service is running: `brew services list`
- Restart if needed: `brew services restart redis`
- Check REDIS_URL in `.env` matches (default: `redis://localhost:6379`)

### Database migration fails

- Drop and recreate the database:
  ```bash
  dropdb knock_knock
  createdb knock_knock
  pnpm run prisma:migrate:dev
  ```

### Port 3000 already in use

- Change `PORT` in `.env` to an available port
- Or kill the process: `lsof -ti:3000 | xargs kill -9`

---

## Summary of Setup Time per Section

1. **Install Homebrew tools** (~5-10 min): PostgreSQL + Redis installation and service startup
2. **Project setup** (~5 min): Clone, `pnpm install`, `.env` configuration
3. **Database setup** (~2 min): Run migrations
4. **Server startup** (~1 min): `pnpm run start:dev`

**Total**: Approximately 15-20 minutes for first-time setup

---

## Next Steps After Running

Once the server is running on `http://localhost:3000`:

1. Set up a frontend client to interact with the API
2. Configure Google OAuth credentials if you need Gmail integration
3. Add AI provider credentials (OpenAI, Anthropic, or Grok) for email outreach features
