-- Создаем только новые таблицы, не трогая существующие
-- SQLite версия

-- 1. Создание таблицы кастомных ролей (только если не существует)
CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  icon TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by TEXT NOT NULL,
  
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- 2. Создание таблицы инвайт ссылок (только если не существует)
CREATE TABLE IF NOT EXISTS invite_links (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  role TEXT,
  custom_role_id TEXT,
  permissions TEXT,
  max_uses INTEGER DEFAULT 1,
  used_count INTEGER DEFAULT 0,
  expires_at DATETIME,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL
);

-- 3. Создание таблицы employee_invitations (только если не существует)
CREATE TABLE IF NOT EXISTS employee_invitations (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  role TEXT,
  custom_role_id TEXT,
  permissions TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME,
  rejected_at DATETIME,
  message TEXT,
  status TEXT DEFAULT 'PENDING',
  invite_link_id TEXT,
  
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id),
  FOREIGN KEY (custom_role_id) REFERENCES custom_roles(id) ON DELETE SET NULL,
  FOREIGN KEY (invite_link_id) REFERENCES invite_links(id) ON DELETE SET NULL
);

-- 4. Создание таблицы employee_activities (только если не существует)
CREATE TABLE IF NOT EXISTS employee_activities (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Добавляем колонку custom_role_id в store_vendors (если не существует)
-- Сначала проверим, существует ли колонка
PRAGMA table_info(store_vendors);

-- Если колонка не существует, добавляем её
-- В SQLite нельзя использовать IF NOT EXISTS для ALTER TABLE, поэтому используем безопасный подход
-- Эта команда будет выполнена безопасно в коде приложения

-- 6. Создание индексов
CREATE INDEX IF NOT EXISTS idx_custom_roles_store_id ON custom_roles(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_active ON custom_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by ON custom_roles(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_roles_store_name ON custom_roles(store_id, name) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_store_id ON invite_links(store_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_created_by ON invite_links(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_links_is_active ON invite_links(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_links_expires_at ON invite_links(expires_at);

CREATE INDEX IF NOT EXISTS idx_employee_invitations_token ON employee_invitations(token);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_store_id ON employee_invitations(store_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_user_id ON employee_invitations(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_status ON employee_invitations(status);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_expires_at ON employee_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_employee_activities_store_id ON employee_activities(store_id);
CREATE INDEX IF NOT EXISTS idx_employee_activities_user_id ON employee_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_activities_created_at ON employee_activities(created_at);
CREATE INDEX IF NOT EXISTS idx_employee_activities_action ON employee_activities(action);
