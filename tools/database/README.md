# Database Tools

Utilities for database management and operations.

## 📁 Available Tools

### `delete_all_users.js`
**⚠️ DANGER: Use with extreme caution!**

Deletes ALL users from the database. This is a destructive operation.

**Usage:**
```bash
cd backend
node ../tools/database/delete_all_users.js
```

**When to use:**
- Resetting development database
- Testing scenarios
- Fresh start during development

**Never use in production!**

---

### `init-db.sql`
SQL script for initializing database with required tables and initial data.

**Usage:**
```bash
# For MySQL
mysql -u username -p database_name < tools/database/init-db.sql

# For PostgreSQL
psql -U username -d database_name -f tools/database/init-db.sql
```

**What it does:**
- Creates necessary database schema
- Sets up initial tables
- Inserts default configuration

---

### `optimize-database.sh`
Shell script for database optimization and maintenance.

**Usage:**
```bash
chmod +x tools/database/optimize-database.sh
./tools/database/optimize-database.sh
```

**Operations:**
- Analyzes table statistics
- Optimizes table structure
- Rebuilds indexes
- Cleans up orphaned records
- Generates maintenance report

**Recommended schedule:** Weekly or after large data operations

---

## 🛠️ Database Maintenance Best Practices

### Regular Maintenance
1. **Backups**: Always backup before running any maintenance scripts
2. **Off-peak hours**: Run optimization during low traffic periods
3. **Monitor**: Check database performance before and after optimization
4. **Test**: Test scripts on development environment first

### Development Workflow
```bash
# 1. Initialize fresh database
npm run prisma:migrate:reset

# 2. Seed with test data
npm run prisma:seed

# 3. If needed, run custom initialization
./tools/database/init-db.sql
```

### Production Workflow
```bash
# 1. Always backup first
./tools/maintenance/backup.sh

# 2. Run optimizations
./tools/database/optimize-database.sh

# 3. Verify database health
./tools/maintenance/health-check.js
```

---

## 📊 Database Statistics

To check database statistics:
```bash
# From backend directory
npx prisma studio  # Visual database browser

# Or use Prisma CLI
npx prisma db execute --file tools/database/check-stats.sql
```

---

## 🔒 Security Notes

- Never commit database credentials
- Use environment variables for sensitive data
- Regularly rotate database passwords
- Monitor database access logs
- Keep database software updated

---

## 📚 Additional Resources

- [Prisma Documentation](https://www.prisma.io/docs)
- [MySQL Optimization Guide](https://dev.mysql.com/doc/refman/8.0/en/optimization.html)
- [PostgreSQL Maintenance](https://www.postgresql.org/docs/current/maintenance.html)
