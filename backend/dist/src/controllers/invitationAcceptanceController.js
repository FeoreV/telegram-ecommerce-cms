"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleInvitationAcceptance = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const logger_1 = require("../utils/logger");
const sanitizer_1 = require("../utils/sanitizer");
exports.handleInvitationAcceptance = (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        throw new errorHandler_1.AppError('Токен приглашения не найден', 400);
    }
    try {
        const invitationInfo = await getInvitationByToken(token);
        if (!invitationInfo) {
            return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Приглашение не найдено</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              background: #f8f9fa;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              text-align: center;
            }
            .error { color: #dc3545; }
            .icon { font-size: 48px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">❌</div>
            <h2 class="error">Приглашение не найдено</h2>
            <p>Возможно, срок действия приглашения истек или оно уже было использовано.</p>
          </div>
        </body>
        </html>
      `);
        }
        res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Приглашение в команду</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
          }
          .container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            width: 100%;
            animation: slideUp 0.5s ease-out;
          }
          @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .icon {
            font-size: 64px;
            margin-bottom: 20px;
            display: block;
          }
          .store-name {
            color: #667eea;
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .role-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 20px;
            ${invitationInfo.role === 'ADMIN'
            ? 'background: #e3f2fd; color: #1976d2;'
            : 'background: #f3e5f5; color: #7b1fa2;'}
          }
          .info-section {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
          }
          .info-item {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          .info-label {
            font-weight: bold;
            color: #666;
          }
          .buttons {
            display: flex;
            gap: 15px;
            justify-content: center;
          }
          .btn {
            padding: 12px 24px;
            border: none;
            border-radius: 6px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-block;
            text-align: center;
            min-width: 120px;
          }
          .btn-accept {
            background: #28a745;
            color: white;
          }
          .btn-accept:hover {
            background: #218838;
            transform: translateY(-2px);
          }
          .btn-reject {
            background: #6c757d;
            color: white;
          }
          .btn-reject:hover {
            background: #5a6268;
            transform: translateY(-2px);
          }
          .message {
            background: #e8f4f8;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            border-left: 4px solid #17a2b8;
            font-style: italic;
          }
          .expires {
            text-align: center;
            color: #856404;
            background: #fff3cd;
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 20px;
            border: 1px solid #ffeaa7;
          }
          @media (max-width: 480px) {
            body { padding: 10px; }
            .container { padding: 20px; }
            .buttons { flex-direction: column; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="icon">🎉</span>
            <div class="store-name">${(0, sanitizer_1.sanitizeHtml)(invitationInfo.store.name)}</div>
            <span class="role-badge">
              ${invitationInfo.role === 'ADMIN' ? '👑 Администратор' : '🛍️ Продавец'}
            </span>
            <p>Вас пригласили присоединиться к команде!</p>
          </div>

          ${invitationInfo.message ? `
            <div class="message">
              <strong>Сообщение от ${(0, sanitizer_1.sanitizeHtml)(invitationInfo.inviter.firstName)} ${(0, sanitizer_1.sanitizeHtml)(invitationInfo.inviter.lastName)}:</strong><br>
              ${(0, sanitizer_1.sanitizeHtml)(invitationInfo.message)}
            </div>
          ` : ''}

          <div class="info-section">
            <div class="info-item">
              <span class="info-label">Пригласил:</span>
              <span>${(0, sanitizer_1.sanitizeHtml)(invitationInfo.inviter.firstName)} ${(0, sanitizer_1.sanitizeHtml)(invitationInfo.inviter.lastName)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Магазин:</span>
              <span>${(0, sanitizer_1.sanitizeHtml)(invitationInfo.store.name)}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Роль:</span>
              <span>${invitationInfo.role === 'ADMIN' ? 'Администратор' : 'Продавец'}</span>
            </div>
            ${invitationInfo.permissions ? `
              <div class="info-item">
                <span class="info-label">Разрешения:</span>
                <span>${(0, sanitizer_1.sanitizeHtml)(JSON.parse(invitationInfo.permissions).join(', '))}</span>
              </div>
            ` : ''}
          </div>

          <div class="expires">
            ⏰ Приглашение действительно до ${new Date(invitationInfo.expiresAt).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })}
          </div>

          <div class="buttons">
            <button class="btn btn-accept" id="acceptBtn" data-token="${(0, sanitizer_1.sanitizeHtml)(token)}">
              ✅ Принять
            </button>
            <button class="btn btn-reject" id="rejectBtn" data-token="${(0, sanitizer_1.sanitizeHtml)(token)}">
              ❌ Отклонить
            </button>
          </div>
        </div>

        <script>
          // SECURITY FIX: CWE-79 - Use event listeners instead of inline onclick to prevent XSS
          document.getElementById('acceptBtn').addEventListener('click', function() {
            acceptInvitation(this.dataset.token);
          });
          document.getElementById('rejectBtn').addEventListener('click', function() {
            rejectInvitation(this.dataset.token);
          });

          async function acceptInvitation(token) {
            try {
              const response = await fetch('/api/invitations/accept', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token })
              });

              const result = await response.json();

              if (response.ok) {
                showResult('success', '🎉 Добро пожаловать в команду!', result.message);
              } else {
                showResult('error', '❌ Ошибка', result.message || 'Не удалось принять приглашение');
              }
            } catch (error) {
              showResult('error', '❌ Ошибка', 'Произошла ошибка при принятии приглашения');
            }
          }

          async function rejectInvitation(token) {
            const reason = prompt('Укажите причину отклонения (необязательно):');

            try {
              const response = await fetch('/api/invitations/reject', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ token, reason })
              });

              const result = await response.json();

              if (response.ok) {
                showResult('info', '✋ Приглашение отклонено', result.message);
              } else {
                showResult('error', '❌ Ошибка', result.message || 'Не удалось отклонить приглашение');
              }
            } catch (error) {
              showResult('error', '❌ Ошибка', 'Произошла ошибка при отклонении приглашения');
            }
          }

          function showResult(type, title, message) {
            const container = document.querySelector('.container');
            const color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8';
            const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';

            // Clear container safely
            container.innerHTML = '';

            // Create elements safely
            const contentDiv = document.createElement('div');
            contentDiv.style.textAlign = 'center';

            const iconDiv = document.createElement('div');
            iconDiv.style.fontSize = '48px';
            iconDiv.style.marginBottom = '20px';
            iconDiv.textContent = icon;

            const titleH2 = document.createElement('h2');
            titleH2.style.color = color;
            titleH2.style.marginBottom = '15px';
            titleH2.textContent = title;

            const messageP = document.createElement('p');
            messageP.style.fontSize = '16px';
            messageP.style.color = '#666';
            messageP.style.marginBottom = '30px';
            messageP.textContent = message;

            const closeBtn = document.createElement('button');
            closeBtn.className = 'btn';
            closeBtn.style.background = color;
            closeBtn.style.color = 'white';
            closeBtn.textContent = 'Закрыть';
            closeBtn.onclick = () => window.close();

            contentDiv.appendChild(iconDiv);
            contentDiv.appendChild(titleH2);
            contentDiv.appendChild(messageP);
            contentDiv.appendChild(closeBtn);
            container.appendChild(contentDiv);
          }
        </script>
      </body>
      </html>
    `);
    }
    catch (error) {
        logger_1.logger.error('Error handling invitation acceptance:', error);
        res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Ошибка</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { color: #dc3545; text-align: center; }
        </style>
      </head>
      <body>
        <div class="error">
          <h2>Произошла ошибка</h2>
          <p>Попробуйте позже или обратитесь к администратору.</p>
        </div>
      </body>
      </html>
    `);
    }
});
async function getInvitationByToken(token) {
    const { prisma } = await import('../lib/prisma.js');
    return await prisma.employeeInvitation.findUnique({
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
            inviter: {
                select: {
                    firstName: true,
                    lastName: true,
                    username: true
                }
            }
        }
    });
}
//# sourceMappingURL=invitationAcceptanceController.js.map