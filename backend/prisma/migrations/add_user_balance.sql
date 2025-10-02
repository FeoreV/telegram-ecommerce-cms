-- Add balance column to users table
ALTER TABLE users ADD COLUMN balance REAL NOT NULL DEFAULT 0;

