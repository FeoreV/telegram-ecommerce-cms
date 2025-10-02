-- Миграция для добавления кастомных ролей и инвайт ссылок
-- Выполнить после обновления schema.prisma

-- 1. Создание таблицы кастомных ролей
CREATE TABLE IF NOT EXISTS `custom_roles` (
  `id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `store_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `description` TEXT NULL,
  `permissions` TEXT NOT NULL,
  `color` VARCHAR(191) NOT NULL DEFAULT '#6366f1',
  `icon` VARCHAR(191) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_by` VARCHAR(191) NOT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `custom_roles_store_id_name_key` (`store_id`, `name`),
  KEY `custom_roles_store_id_idx` (`store_id`),
  KEY `custom_roles_is_active_idx` (`is_active`),
  KEY `custom_roles_created_by_idx` (`created_by`),
  
  CONSTRAINT `custom_roles_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `custom_roles_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. Создание таблицы инвайт ссылок
CREATE TABLE IF NOT EXISTS `invite_links` (
  `id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  `store_id` VARCHAR(191) NOT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `role` VARCHAR(191) NULL,
  `custom_role_id` VARCHAR(191) NULL,
  `permissions` TEXT NULL,
  `max_uses` INTEGER NOT NULL DEFAULT 1,
  `used_count` INTEGER NOT NULL DEFAULT 0,
  `expires_at` DATETIME(3) NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `description` TEXT NULL,
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `invite_links_token_key` (`token`),
  KEY `invite_links_store_id_idx` (`store_id`),
  KEY `invite_links_created_by_idx` (`created_by`),
  KEY `invite_links_is_active_idx` (`is_active`),
  KEY `invite_links_expires_at_idx` (`expires_at`),
  
  CONSTRAINT `invite_links_store_id_fkey` FOREIGN KEY (`store_id`) REFERENCES `stores` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `invite_links_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `invite_links_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 3. Обновление таблицы store_vendors для поддержки кастомных ролей
ALTER TABLE `store_vendors` 
ADD COLUMN `custom_role_id` VARCHAR(191) NULL,
ADD KEY `store_vendors_custom_role_id_idx` (`custom_role_id`),
ADD CONSTRAINT `store_vendors_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Обновление таблицы employee_invitations для связи с инвайт ссылками
ALTER TABLE `employee_invitations` 
ADD COLUMN `custom_role_id` VARCHAR(191) NULL,
ADD COLUMN `invite_link_id` VARCHAR(191) NULL,
ADD KEY `employee_invitations_custom_role_id_idx` (`custom_role_id`),
ADD KEY `employee_invitations_invite_link_id_idx` (`invite_link_id`),
ADD CONSTRAINT `employee_invitations_custom_role_id_fkey` FOREIGN KEY (`custom_role_id`) REFERENCES `custom_roles` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT `employee_invitations_invite_link_id_fkey` FOREIGN KEY (`invite_link_id`) REFERENCES `invite_links` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. Изменение поля role в employee_invitations на необязательное
ALTER TABLE `employee_invitations` 
MODIFY COLUMN `role` VARCHAR(191) NULL;

-- 6. Добавление новых связей в таблицу users
-- (Эти поля уже должны быть в схеме, но добавляем для гарантии)
-- Связи с created_invite_links и created_custom_roles уже определены через внешние ключи

-- 7. Создание индексов для производительности
CREATE INDEX IF NOT EXISTS `custom_roles_name_idx` ON `custom_roles` (`name`);
CREATE INDEX IF NOT EXISTS `invite_links_token_idx` ON `invite_links` (`token`);
CREATE INDEX IF NOT EXISTS `invite_links_used_count_idx` ON `invite_links` (`used_count`);

-- 8. Создание предустановленных кастомных ролей (опционально)
-- Можно создать базовые роли для примера

INSERT IGNORE INTO `custom_roles` (
  `id`, `store_id`, `name`, `description`, `permissions`, `color`, `icon`, `created_by`, `created_at`, `updated_at`
) 
SELECT 
  CONCAT('role_', `id`, '_manager'),
  `id`,
  'Менеджер продаж',
  'Управление товарами и заказами',
  '["PRODUCT_CREATE","PRODUCT_UPDATE","PRODUCT_VIEW","ORDER_VIEW","ORDER_UPDATE","INVENTORY_VIEW"]',
  '#10b981',
  '💼',
  `owner_id`,
  NOW(),
  NOW()
FROM `stores` 
WHERE `id` IN (
  SELECT DISTINCT `store_id` FROM `store_admins` 
  UNION 
  SELECT `id` FROM `stores` LIMIT 5
);

INSERT IGNORE INTO `custom_roles` (
  `id`, `store_id`, `name`, `description`, `permissions`, `color`, `icon`, `created_by`, `created_at`, `updated_at`
) 
SELECT 
  CONCAT('role_', `id`, '_support'),
  `id`,
  'Поддержка клиентов',
  'Работа с заказами и клиентами',
  '["ORDER_VIEW","ORDER_UPDATE","ANALYTICS_VIEW"]',
  '#3b82f6',
  '🎧',
  `owner_id`,
  NOW(),
  NOW()
FROM `stores` 
WHERE `id` IN (
  SELECT DISTINCT `store_id` FROM `store_admins` 
  UNION 
  SELECT `id` FROM `stores` LIMIT 5
);

-- 9. Очистка устаревших данных (опционально)
-- Удаляем просроченные инвайт ссылки
DELETE FROM `invite_links` WHERE `expires_at` < NOW() AND `expires_at` IS NOT NULL;

-- 10. Добавление проверочных ограничений
-- ALTER TABLE `invite_links` ADD CONSTRAINT `invite_links_max_uses_check` CHECK (`max_uses` > 0);
-- ALTER TABLE `invite_links` ADD CONSTRAINT `invite_links_used_count_check` CHECK (`used_count` >= 0);
-- ALTER TABLE `custom_roles` ADD CONSTRAINT `custom_roles_color_check` CHECK (`color` REGEXP '^#[0-9A-Fa-f]{6}$');

-- Обновление статистики таблиц
ANALYZE TABLE `custom_roles`;
ANALYZE TABLE `invite_links`;
ANALYZE TABLE `store_vendors`;
ANALYZE TABLE `employee_invitations`;

-- Готово! 
-- После выполнения этой миграции:
-- 1. Запустите npx prisma generate для обновления клиента
-- 2. Перезапустите приложение
-- 3. Проверьте работу новых функций в админке
