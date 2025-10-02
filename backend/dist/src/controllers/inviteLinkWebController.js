"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInviteLinkPage = void 0;
const prisma_1 = require("../lib/prisma");
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
exports.handleInviteLinkPage = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        throw new errorHandler_1.AppError('Токен инвайт ссылки не найден', 400);
    }
    try {
        const inviteLink = await prisma_1.prisma.inviteLink.findUnique({
            where: { token },
            include: {
                store: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        logoUrl: true
                    }
                },
                customRole: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        permissions: true,
                        color: true,
                        icon: true
                    }
                },
                creator: {
                    select: {
                        firstName: true,
                        lastName: true,
                        username: true
                    }
                }
            }
        });
        if (!inviteLink) {
            return res.status(404).send(getErrorPage('Инвайт ссылка не найдена', 'Возможно, ссылка была удалена или никогда не существовала.'));
        }
        if (!inviteLink.isActive) {
            return res.status(400).send(getErrorPage('Инвайт ссылка деактивирована', 'Эта ссылка больше не активна.'));
        }
        if (inviteLink.expiresAt && inviteLink.expiresAt < new Date()) {
            return res.status(400).send(getErrorPage('Срок действия истек', 'Срок действия этой инвайт ссылки истек.'));
        }
        if (inviteLink.usedCount >= inviteLink.maxUses) {
            return res.status(400).send(getErrorPage('Лимит исчерпан', 'Эта инвайт ссылка была использована максимальное количество раз.'));
        }
        let roleDisplay = '';
        let permissions = [];
        let roleColor = '#6366f1';
        let roleIcon = '👤';
        if (inviteLink.customRole) {
            roleDisplay = inviteLink.customRole.name;
            permissions = JSON.parse(inviteLink.customRole.permissions);
            roleColor = inviteLink.customRole.color;
            roleIcon = inviteLink.customRole.icon || '⚡';
        }
        else if (inviteLink.role) {
            roleDisplay = inviteLink.role === 'ADMIN' ? 'Администратор' : 'Продавец';
            roleIcon = inviteLink.role === 'ADMIN' ? '👑' : '🛍️';
            roleColor = inviteLink.role === 'ADMIN' ? '#ef4444' : '#10b981';
            if (inviteLink.permissions) {
                permissions = JSON.parse(inviteLink.permissions);
            }
        }
        res.send(getInvitePage(inviteLink, roleDisplay, roleColor, roleIcon, permissions));
    }
    catch (error) {
        logger_1.logger.error('Error handling invite link page:', (0, logger_1.toLogMetadata)(error));
        res.status(500).send(getErrorPage('Произошла ошибка', 'Попробуйте позже или обратитесь к администратору.'));
    }
});
function getInvitePage(inviteLink, roleDisplay, roleColor, roleIcon, permissions) {
    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Присоединиться к команде - ${inviteLink.store.name}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
          animation: slideUp 0.6s ease-out;
        }
        
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        .header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .store-logo {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          margin: 0 auto 20px;
          background: linear-gradient(135deg, ${roleColor}20, ${roleColor}40);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 32px;
        }
        
        .store-name {
          font-size: 28px;
          font-weight: bold;
          color: #1f2937;
          margin-bottom: 8px;
        }
        
        .role-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 25px;
          background: ${roleColor}15;
          color: ${roleColor};
          font-weight: bold;
          font-size: 14px;
          margin-bottom: 20px;
        }
        
        .description {
          color: #6b7280;
          font-size: 16px;
          line-height: 1.5;
        }
        
        .info-section {
          background: #f9fafb;
          border-radius: 12px;
          padding: 24px;
          margin: 30px 0;
          border-left: 4px solid ${roleColor};
        }
        
        .info-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        
        .info-item:last-child {
          margin-bottom: 0;
        }
        
        .info-label {
          font-weight: 600;
          color: #374151;
        }
        
        .info-value {
          color: #6b7280;
          text-align: right;
          flex: 1;
          margin-left: 16px;
        }
        
        .form-section {
          margin: 30px 0;
        }
        
        .form-group {
          margin-bottom: 20px;
        }
        
        .form-row {
          display: flex;
          gap: 12px;
        }
        
        .form-row .form-group {
          flex: 1;
        }
        
        label {
          display: block;
          margin-bottom: 6px;
          font-weight: 600;
          color: #374151;
          font-size: 14px;
        }
        
        input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          font-size: 16px;
          transition: all 0.2s ease;
          background: #ffffff;
        }
        
        input:focus {
          outline: none;
          border-color: ${roleColor};
          box-shadow: 0 0 0 3px ${roleColor}20;
        }
        
        .required {
          color: #ef4444;
        }
        
        .permissions {
          margin: 20px 0;
        }
        
        .permissions-title {
          font-weight: 600;
          color: #374151;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .permissions-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        
        .permission-tag {
          background: ${roleColor}10;
          color: ${roleColor};
          padding: 4px 12px;
          border-radius: 16px;
          font-size: 12px;
          font-weight: 500;
        }
        
        .usage-stats {
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 8px;
          padding: 12px;
          margin: 20px 0;
          font-size: 14px;
          color: #92400e;
          text-align: center;
        }
        
        .buttons {
          display: flex;
          gap: 12px;
          margin-top: 30px;
        }
        
        .btn {
          flex: 1;
          padding: 14px 24px;
          border: none;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        
        .btn-primary {
          background: ${roleColor};
          color: white;
        }
        
        .btn-primary:hover {
          background: ${roleColor}dd;
          transform: translateY(-1px);
        }
        
        .btn-secondary {
          background: #f3f4f6;
          color: #6b7280;
          border: 1px solid #d1d5db;
        }
        
        .btn-secondary:hover {
          background: #e5e7eb;
        }
        
        .loading {
          opacity: 0.7;
          cursor: not-allowed;
        }
        
        .error {
          background: #fef2f2;
          border: 1px solid #fca5a5;
          color: #dc2626;
          padding: 12px;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
        }
        
        .success {
          background: #f0fdf4;
          border: 1px solid #86efac;
          color: #166534;
          padding: 12px;
          border-radius: 8px;
          margin: 20px 0;
          font-size: 14px;
        }
        
        @media (max-width: 480px) {
          .container {
            padding: 20px;
            margin: 10px;
          }
          
          .form-row {
            flex-direction: column;
            gap: 0;
          }
          
          .buttons {
            flex-direction: column;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="store-logo">
            ${inviteLink.store.logoUrl ? `<img src="${inviteLink.store.logoUrl}" alt="Logo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">` : '🏪'}
          </div>
          <div class="store-name">${inviteLink.store.name}</div>
          <div class="role-badge">
            <span>${roleIcon}</span>
            ${roleDisplay}
          </div>
          <div class="description">
            Вас пригласили присоединиться к команде!
            ${inviteLink.description ? `<br><em>"${inviteLink.description}"</em>` : ''}
          </div>
        </div>

        <div class="info-section">
          <div class="info-item">
            <span class="info-label">Пригласил:</span>
            <span class="info-value">${inviteLink.creator.firstName} ${inviteLink.creator.lastName}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Роль:</span>
            <span class="info-value">${roleDisplay}</span>
          </div>
          ${inviteLink.expiresAt ? `
            <div class="info-item">
              <span class="info-label">Действительно до:</span>
              <span class="info-value">${new Date(inviteLink.expiresAt).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}</span>
            </div>
          ` : ''}
        </div>

        ${permissions.length > 0 ? `
          <div class="permissions">
            <div class="permissions-title">
              <span>🔐</span>
              Разрешения:
            </div>
            <div class="permissions-list">
              ${permissions.map(permission => `
                <span class="permission-tag">${getPermissionLabel(permission)}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <div class="usage-stats">
          ⏱️ Использовано ${inviteLink.usedCount} из ${inviteLink.maxUses} раз
        </div>

        <form id="inviteForm" class="form-section">
          <div class="form-row">
            <div class="form-group">
              <label for="firstName">Имя <span class="required">*</span></label>
              <input type="text" id="firstName" name="firstName" required>
            </div>
            <div class="form-group">
              <label for="lastName">Фамилия <span class="required">*</span></label>
              <input type="text" id="lastName" name="lastName" required>
            </div>
          </div>
          
          <div class="form-group">
            <label for="email">Email <span class="required">*</span></label>
            <input type="email" id="email" name="email" required>
          </div>
          
          <div class="form-group">
            <label for="telegramId">Telegram ID (необязательно)</label>
            <input type="text" id="telegramId" name="telegramId" placeholder="@username или ID">
          </div>

          <div id="message"></div>

          <div class="buttons">
            <button type="submit" class="btn btn-primary" id="joinBtn">
              ✨ Присоединиться к команде
            </button>
            <button type="button" class="btn btn-secondary" onclick="window.close()">
              Отмена
            </button>
          </div>
        </form>
      </div>

      <script>
        document.getElementById('inviteForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const joinBtn = document.getElementById('joinBtn');
          const messageDiv = document.getElementById('message');
          
          // Получаем данные формы
          const formData = new FormData(e.target);
          const data = {
            token: '${inviteLink.token}',
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            telegramId: formData.get('telegramId') || undefined
          };

          // Показываем состояние загрузки
          joinBtn.disabled = true;
          joinBtn.classList.add('loading');
          joinBtn.textContent = 'Обработка...';
          messageDiv.innerHTML = '';

          try {
            const response = await fetch('/api/invite-links/use', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok) {
              messageDiv.innerHTML = '<div class="success">🎉 ' + result.message + '</div>';
              joinBtn.textContent = '✅ Успешно присоединились!';
              
              // Перенаправляем на фронтенд через некоторое время
              setTimeout(() => {
                window.location.href = '${process.env.FRONTEND_URL || '/'}';
              }, 2000);
            } else {
              messageDiv.innerHTML = '<div class="error">❌ ' + (result.message || 'Произошла ошибка') + '</div>';
              resetButton();
            }
          } catch (error) {
            messageDiv.innerHTML = '<div class="error">❌ Произошла ошибка при обработке запроса</div>';
            resetButton();
          }

          function resetButton() {
            joinBtn.disabled = false;
            joinBtn.classList.remove('loading');
            joinBtn.textContent = '✨ Присоединиться к команде';
          }
        });
      </script>
    </body>
    </html>
  `;
}
function getErrorPage(title, message) {
    return `
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .container {
          background: white;
          border-radius: 16px;
          padding: 40px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.15);
          max-width: 400px;
          width: 100%;
          text-align: center;
        }
        
        .icon {
          font-size: 64px;
          margin-bottom: 20px;
          display: block;
        }
        
        .title {
          font-size: 24px;
          font-weight: bold;
          color: #dc2626;
          margin-bottom: 16px;
        }
        
        .message {
          color: #6b7280;
          line-height: 1.5;
          margin-bottom: 30px;
        }
        
        .btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">❌</div>
        <div class="title">${title}</div>
        <div class="message">${message}</div>
        <button class="btn" onclick="window.close()">Закрыть</button>
      </div>
    </body>
    </html>
  `;
}
function getPermissionLabel(permission) {
    const labels = {
        'PRODUCT_CREATE': 'Создание товаров',
        'PRODUCT_UPDATE': 'Редактирование товаров',
        'PRODUCT_DELETE': 'Удаление товаров',
        'PRODUCT_VIEW': 'Просмотр товаров',
        'ORDER_VIEW': 'Просмотр заказов',
        'ORDER_UPDATE': 'Обновление заказов',
        'ORDER_CONFIRM': 'Подтверждение заказов',
        'ORDER_REJECT': 'Отклонение заказов',
        'ORDER_DELETE': 'Удаление заказов',
        'INVENTORY_VIEW': 'Просмотр склада',
        'INVENTORY_UPDATE': 'Управление складом',
        'ANALYTICS_VIEW': 'Просмотр аналитики',
        'ANALYTICS_EXPORT': 'Экспорт отчетов',
        'USER_VIEW': 'Просмотр пользователей',
        'USER_UPDATE': 'Редактирование пользователей',
        'USER_CREATE': 'Создание пользователей',
        'STORE_VIEW': 'Просмотр настроек магазина',
        'STORE_UPDATE': 'Изменение настроек магазина',
        'NOTIFICATION_SEND': 'Отправка уведомлений',
        'BOT_MANAGE': 'Управление ботом',
        'BOT_CONFIG': 'Настройка бота'
    };
    return labels[permission] || permission;
}
//# sourceMappingURL=inviteLinkWebController.js.map