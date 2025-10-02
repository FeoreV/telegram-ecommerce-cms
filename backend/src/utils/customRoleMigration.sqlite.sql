-- SQLite миграция для добавления кастомных ролей и инвайт ссылок
-- Выполнить после обновления schema.prisma

-- 1. Создание таблицы кастомных ролей
CREATE TABLE IF NOT EXISTS custom_roles (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL,
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

-- 2. Создание таблицы инвайт ссылок
CREATE TABLE IF NOT EXISTS invite_links (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL,
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

-- 3. Обновление таблицы store_vendors для поддержки кастомных ролей
ALTER TABLE store_vendors ADD COLUMN custom_role_id TEXT REFERENCES custom_roles(id) ON DELETE SET NULL;

-- 4. Обновление таблицы employee_invitations для связи с инвайт ссылками  
ALTER TABLE employee_invitations ADD COLUMN custom_role_id TEXT REFERENCES custom_roles(id) ON DELETE SET NULL;
ALTER TABLE employee_invitations ADD COLUMN invite_link_id TEXT REFERENCES invite_links(id) ON DELETE SET NULL;

-- 5. Создание индексов для производительности
CREATE INDEX IF NOT EXISTS idx_custom_roles_store_id ON custom_roles(store_id);
CREATE INDEX IF NOT EXISTS idx_custom_roles_name ON custom_roles(name);
CREATE INDEX IF NOT EXISTS idx_custom_roles_is_active ON custom_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_roles_created_by ON custom_roles(created_by);

CREATE INDEX IF NOT EXISTS idx_invite_links_token ON invite_links(token);
CREATE INDEX IF NOT EXISTS idx_invite_links_store_id ON invite_links(store_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_created_by ON invite_links(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_links_is_active ON invite_links(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_links_expires_at ON invite_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_invite_links_used_count ON invite_links(used_count);

CREATE INDEX IF NOT EXISTS idx_store_vendors_custom_role_id ON store_vendors(custom_role_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_custom_role_id ON employee_invitations(custom_role_id);
CREATE INDEX IF NOT EXISTS idx_employee_invitations_invite_link_id ON employee_invitations(invite_link_id);

-- 6. Создание уникального индекса для имен ролей в рамках магазина
CREATE UNIQUE INDEX IF NOT EXISTS idx_custom_roles_store_name ON custom_roles(store_id, name) WHERE is_active = true;

-- Готово!
-- После выполнения этой миграции:
-- 1. Запустите npx prisma generate для обновления клиента  
-- 2. Перезапустите приложение
-- 3. Проверьте работу новых функций в админке
