-- Миграция для добавления таблиц управления сотрудниками

-- Таблица приглашений сотрудников (уже создана через Prisma, но на всякий случай)
CREATE TABLE IF NOT EXISTS employee_invitations (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  invited_by TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN', 'VENDOR')),
  permissions TEXT,
  token TEXT UNIQUE NOT NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME,
  rejected_at DATETIME,
  message TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED')),
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users (id)
);

-- Индексы для employee_invitations
CREATE INDEX IF NOT EXISTS employee_invitations_token_idx ON employee_invitations (token);
CREATE INDEX IF NOT EXISTS employee_invitations_store_id_idx ON employee_invitations (store_id);
CREATE INDEX IF NOT EXISTS employee_invitations_user_id_idx ON employee_invitations (user_id);
CREATE INDEX IF NOT EXISTS employee_invitations_status_idx ON employee_invitations (status);
CREATE INDEX IF NOT EXISTS employee_invitations_expires_at_idx ON employee_invitations (expires_at);

-- Таблица активности сотрудников (уже создана через Prisma)
CREATE TABLE IF NOT EXISTS employee_activities (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  store_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Индексы для employee_activities
CREATE INDEX IF NOT EXISTS employee_activities_store_id_idx ON employee_activities (store_id);
CREATE INDEX IF NOT EXISTS employee_activities_user_id_idx ON employee_activities (user_id);
CREATE INDEX IF NOT EXISTS employee_activities_created_at_idx ON employee_activities (created_at);
CREATE INDEX IF NOT EXISTS employee_activities_action_idx ON employee_activities (action);

-- Таблица алертов безопасности
CREATE TABLE IF NOT EXISTS security_alerts (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  type TEXT NOT NULL CHECK (type IN ('SUSPICIOUS_ACTIVITY', 'UNAUTHORIZED_ACCESS', 'PERMISSION_ESCALATION', 'BULK_CHANGES', 'LOGIN_ANOMALY')),
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  description TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resolved_at DATETIME,
  resolved_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE,
  FOREIGN KEY (resolved_by) REFERENCES users (id)
);

-- Индексы для security_alerts
CREATE INDEX IF NOT EXISTS security_alerts_created_at_idx ON security_alerts (created_at);
CREATE INDEX IF NOT EXISTS security_alerts_type_idx ON security_alerts (type);
CREATE INDEX IF NOT EXISTS security_alerts_severity_idx ON security_alerts (severity);
CREATE INDEX IF NOT EXISTS security_alerts_user_id_idx ON security_alerts (user_id);
CREATE INDEX IF NOT EXISTS security_alerts_store_id_idx ON security_alerts (store_id);

-- Таблица логов аудита
CREATE TABLE IF NOT EXISTS employee_audit_logs (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  resource_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores (id) ON DELETE CASCADE
);

-- Индексы для employee_audit_logs
CREATE INDEX IF NOT EXISTS employee_audit_logs_created_at_idx ON employee_audit_logs (created_at);
CREATE INDEX IF NOT EXISTS employee_audit_logs_user_id_idx ON employee_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS employee_audit_logs_store_id_idx ON employee_audit_logs (store_id);
CREATE INDEX IF NOT EXISTS employee_audit_logs_action_idx ON employee_audit_logs (action);
CREATE INDEX IF NOT EXISTS employee_audit_logs_resource_idx ON employee_audit_logs (resource);

-- Добавляем недостающие поля в существующие таблицы (если их нет)
ALTER TABLE store_vendors ADD COLUMN assigned_by TEXT;
ALTER TABLE store_vendors ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- Обновляем существующие записи
UPDATE store_vendors 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Триггеры для автоматического обновления updated_at
CREATE TRIGGER IF NOT EXISTS employee_invitations_updated_at
  AFTER UPDATE ON employee_invitations
  FOR EACH ROW
BEGIN
  UPDATE employee_invitations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS store_vendors_updated_at
  AFTER UPDATE ON store_vendors
  FOR EACH ROW
BEGIN
  UPDATE store_vendors SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Вставляем базовые типы уведомлений для системы управления сотрудниками
INSERT OR IGNORE INTO notification_types (name, description, default_channels) VALUES
('EMPLOYEE_INVITATION', 'Приглашение нового сотрудника', '["EMAIL", "TELEGRAM"]'),
('EMPLOYEE_JOINED', 'Новый сотрудник присоединился', '["TELEGRAM", "EMAIL"]'),
('EMPLOYEE_INVITATION_REJECTED', 'Приглашение отклонено', '["TELEGRAM", "EMAIL"]'),
('EMPLOYEE_REMOVED', 'Сотрудник удален из команды', '["TELEGRAM", "EMAIL"]'),
('SECURITY_ALERT', 'Алерт безопасности', '["TELEGRAM", "EMAIL"]'),
('PERMISSION_CHANGED', 'Изменены права доступа', '["TELEGRAM", "EMAIL"]');

-- Создаем представление для быстрого доступа к информации о сотрудниках
CREATE VIEW IF NOT EXISTS employee_overview AS
SELECT 
    u.id as user_id,
    u.first_name,
    u.last_name,
    u.username,
    u.email,
    u.is_active,
    u.last_login_at,
    s.id as store_id,
    s.name as store_name,
    CASE 
        WHEN s.owner_id = u.id THEN 'OWNER'
        WHEN sa.user_id IS NOT NULL THEN 'ADMIN'
        WHEN sv.user_id IS NOT NULL THEN 'VENDOR'
        ELSE 'CUSTOMER'
    END as role,
    COALESCE(sv.permissions, '[]') as permissions,
    COALESCE(sv.is_active, TRUE) as assignment_active,
    COALESCE(sa.created_at, sv.created_at) as assigned_at,
    COALESCE(sa.assigned_by, sv.assigned_by) as assigned_by
FROM users u
CROSS JOIN stores s
LEFT JOIN store_admins sa ON sa.user_id = u.id AND sa.store_id = s.id
LEFT JOIN store_vendors sv ON sv.user_id = u.id AND sv.store_id = s.id
WHERE (s.owner_id = u.id OR sa.user_id IS NOT NULL OR sv.user_id IS NOT NULL);

-- Создаем представление для статистики безопасности
CREATE VIEW IF NOT EXISTS security_stats AS
SELECT 
    store_id,
    DATE(created_at) as date,
    type,
    severity,
    COUNT(*) as alert_count
FROM security_alerts
GROUP BY store_id, DATE(created_at), type, severity;

PRAGMA foreign_keys = ON;
