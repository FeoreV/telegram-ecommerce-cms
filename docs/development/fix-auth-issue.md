# Fixing Prisma Authentication Error

## Root Cause
The "table users does not exist" error during authentication is caused by runtime environment issues, not actual missing tables.

## Solution Steps

### 1. Clean Database State
```bash
cd backend
npx prisma db push --force-reset
npx prisma migrate deploy
npx prisma generate
```

### 2. Fix Environment Loading
Ensure the `.env` file exists in the backend directory with:
```env
DATABASE_URL=mysql://root:@localhost:3306/telegram_ecommerce
NODE_ENV=development
JWT_SECRET=dev-jwt-secret-change-in-production
PORT=3001
```

### 3. Clean Application State
```bash
# Stop all processes
Get-Process node | Stop-Process -Force

# Clean builds
rm -rf dist/
rm -rf node_modules/.cache/

# Rebuild everything
npm run build
npm run db:generate
```

### 4. Start Fresh
```bash
npm run dev
```

## Alternative: Use Production Start
If development server continues having issues:
```bash
npm run build
npm start
```

## Verification
Test authentication:
```bash
curl -X POST http://localhost:3001/api/auth/telegram \
  -H "Content-Type: application/json" \
  -d '{"telegramId":"123456789","username":"test"}'
```

Should return a JWT token and user data.

## Prevention
- Always restart the development server after schema changes
- Use `npx prisma generate` after any schema modifications
- Verify `.env` file is present and readable
