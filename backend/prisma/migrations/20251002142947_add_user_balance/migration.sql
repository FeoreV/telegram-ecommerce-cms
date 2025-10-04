-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "username" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "phone" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "profile_photo" TEXT,
    "balance" REAL NOT NULL DEFAULT 0
);
INSERT INTO "new_users" ("createdAt", "email", "first_name", "id", "isActive", "last_login_at", "last_name", "password", "phone", "profile_photo", "role", "telegram_id", "updatedAt", "username") SELECT "createdAt", "email", "first_name", "id", "isActive", "last_login_at", "last_name", "password", "phone", "profile_photo", "role", "telegram_id", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_telegram_id_key" ON "users"("telegram_id");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
