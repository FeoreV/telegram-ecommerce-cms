# 🔄 Server Update Instructions

## Problem: Git Pull Conflicts with .env files

When you run `git pull` on the server and see:
```
error: Your local changes to the following files would be overwritten by merge:
        backend/.env
        backend/logs/audit.json
        bot/.env
Please commit your changes or stash them before you merge.
```

**Don't panic!** This is normal. `.env` files should NOT be in git.

---

## ✅ Solution: Use Safe Update Script

### Quick Fix (Recommended):

```bash
# On the server
cd ~/telegram-ecommerce-cms
git pull  # Download the update scripts first (might fail, that's OK)

# If git pull fails, manually download the script:
curl -o scripts/safe-git-pull.sh https://raw.githubusercontent.com/FeoreV/telegram-ecommerce-cms/main/scripts/safe-git-pull.sh
chmod +x scripts/safe-git-pull.sh

# Now run the safe pull:
./scripts/safe-git-pull.sh
```

This script will:
1. ✅ Backup your `.env` files
2. ✅ Reset log files (they're regenerated anyway)
3. ✅ Pull latest code
4. ✅ Restore your `.env` files
5. ✅ Update `.gitignore` to prevent future conflicts

---

## 🚀 Complete Server Update (Pull + Rebuild + Restart):

```bash
cd ~/telegram-ecommerce-cms

# Download update script if you don't have it
curl -o scripts/server-update.sh https://raw.githubusercontent.com/FeoreV/telegram-ecommerce-cms/main/scripts/server-update.sh
chmod +x scripts/server-update.sh

# Run complete update
./scripts/server-update.sh
```

This does **everything**:
1. Safe git pull (preserves .env)
2. Install dependencies
3. Run database migrations
4. Build backend & frontend
5. Restart all services with PM2

---

## 🛠️ Manual Fix (if scripts don't work):

### Step 1: Backup .env files
```bash
cd ~/telegram-ecommerce-cms
mkdir -p backups
cp backend/.env backups/backend.env.backup
cp frontend/.env backups/frontend.env.backup 2>/dev/null || true
cp bot/.env backups/bot.env.backup 2>/dev/null || true
```

### Step 2: Reset files that block the merge
```bash
# Reset log files (they're not important)
git checkout HEAD -- backend/logs/audit.json
git checkout HEAD -- bot/logs/bot-combined.log
git checkout HEAD -- bot/logs/bot-error.log

# Stash .env files temporarily
git stash
```

### Step 3: Pull latest code
```bash
git pull origin main
```

### Step 4: Restore .env files
```bash
cp backups/backend.env.backup backend/.env
cp backups/frontend.env.backup frontend/.env 2>/dev/null || true
cp backups/bot.env.backup bot/.env 2>/dev/null || true
```

### Step 5: Update .gitignore
```bash
# Add .env files to .gitignore if not already there
echo "backend/.env" >> .gitignore
echo "frontend/.env" >> .gitignore
echo "bot/.env" >> .gitignore
echo "backend/logs/*.log" >> .gitignore
echo "bot/logs/*.log" >> .gitignore
```

### Step 6: Rebuild and restart
```bash
# Backend
cd backend
npm install
npm run build
pm2 restart backend
cd ..

# Frontend
cd frontend
npm install
npm run build
pm2 restart frontend
cd ..

# Bot (if you use it)
cd bot
npm install
pm2 restart bot
cd ..
```

---

## 🔍 Verify Everything Works:

```bash
# Check services status
pm2 status

# Check logs
pm2 logs backend --lines 20
pm2 logs frontend --lines 20

# Test endpoints
curl http://localhost:3001/health
curl http://localhost:3000
```

---

## ⚙️ One-Line Update (Copy-Paste):

For future updates, just use this:

```bash
cd ~/telegram-ecommerce-cms && bash scripts/server-update.sh
```

Or if the script is not there yet:

```bash
cd ~/telegram-ecommerce-cms && \
mkdir -p backups && \
cp backend/.env backups/backend.env.$(date +%s) && \
git checkout HEAD -- backend/logs/audit.json bot/logs/*.log 2>/dev/null || true && \
git stash && \
git pull origin main && \
cp backups/backend.env.* backend/.env && \
cd backend && npm install && npm run build && pm2 restart backend && cd .. && \
cd frontend && npm install && npm run build && pm2 restart frontend && cd ..
```

---

## 📝 Best Practices:

### ✅ DO:
- Always backup `.env` before updates
- Use the automated scripts
- Check `pm2 logs` after restart
- Test the application after update

### ❌ DON'T:
- Don't commit `.env` files to git
- Don't force push (`git push -f`)
- Don't manually edit files in production (use proper deployment)
- Don't skip testing after update

---

## 🆘 Troubleshooting:

### "permission denied" when running script
```bash
chmod +x scripts/safe-git-pull.sh
chmod +x scripts/server-update.sh
```

### "command not found: pm2"
PM2 is not installed. Install it:
```bash
npm install -g pm2
```

Or start services manually:
```bash
cd backend && npm run start &
cd frontend && npm run preview &
```

### Services won't restart
```bash
# Kill all node processes
pkill -f node

# Start fresh
cd ~/telegram-ecommerce-cms/backend
nohup npm run start > /dev/null 2>&1 &

cd ~/telegram-ecommerce-cms/frontend
nohup npm run preview > /dev/null 2>&1 &
```

### Lost .env file
Check backups:
```bash
ls -la backups/
# Restore from latest backup
cp backups/backend.env.backup backend/.env
```

If no backup, you need to recreate it. Check `config/environments/env.production.example` for template.

---

## 📞 Quick Commands Reference:

```bash
# Safe update (preserves .env)
bash scripts/safe-git-pull.sh

# Complete update (pull + build + restart)
bash scripts/server-update.sh

# Check status
pm2 status
pm2 logs

# Restart services
pm2 restart all

# View recent commits
git log --oneline -5

# Show current branch and status
git status
git branch
```

---

**Remember:** Always backup before updating! 🔐

