import express from 'express';
import { prisma } from '../lib/prisma';
import { authMiddleware } from '../middleware/auth';
import { requireRole, UserRole } from '../auth';
import { logger } from '../utils/logger';

const router = express.Router();

// Apply authentication
router.use(authMiddleware);
router.use(requireRole([UserRole.OWNER, UserRole.ADMIN]));

// Simple HTML admin dashboard
router.get('/', async (req, res) => {
  try {
    const stats = {
      users: await prisma.user.count(),
      stores: await prisma.store.count(),
      products: await prisma.product.count(),
      orders: await prisma.order.count(),
      categories: await prisma.category.count(),
    };

    const recentOrders = await prisma.order.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        currency: true,
        createdAt: true,
        customer: {
          select: {
            username: true,
            firstName: true
          }
        },
        store: {
          select: {
            name: true
          }
        }
      }
    });

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Telegram E-commerce Admin</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
            background: white;
            min-height: 100vh;
            box-shadow: 0 0 50px rgba(0,0,0,0.1);
        }
        .header { 
            background: #3b82f6; 
            color: white; 
            padding: 20px; 
            border-radius: 10px; 
            margin-bottom: 30px;
            text-align: center;
        }
        .stats { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .stat-card { 
            background: #f8fafc; 
            padding: 25px; 
            border-radius: 12px; 
            text-align: center; 
            border: 1px solid #e2e8f0;
            transition: transform 0.2s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-number { 
            font-size: 2.5em; 
            font-weight: bold; 
            color: #3b82f6; 
            margin-bottom: 10px;
        }
        .stat-label { 
            font-size: 1.1em; 
            color: #64748b; 
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .recent-orders { 
            background: #f8fafc; 
            padding: 25px; 
            border-radius: 12px; 
            border: 1px solid #e2e8f0;
        }
        .recent-orders h3 { 
            margin-bottom: 20px; 
            color: #1e293b;
            font-size: 1.4em;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
        }
        th, td { 
            padding: 12px; 
            text-align: left; 
            border-bottom: 1px solid #e2e8f0; 
        }
        th { 
            background: #3b82f6; 
            color: white; 
            font-weight: 600;
        }
        tr:hover { background: #f1f5f9; }
        .status { 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            font-weight: bold;
            text-transform: uppercase;
        }
        .status.pending { background: #fef3c7; color: #92400e; }
        .status.paid { background: #d1fae5; color: #065f46; }
        .status.shipped { background: #dbeafe; color: #1e40af; }
        .status.delivered { background: #dcfce7; color: #166534; }
        .status.cancelled { background: #fee2e2; color: #991b1b; }
        .nav { 
            margin: 20px 0; 
            text-align: center; 
        }
        .nav a { 
            background: #3b82f6; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 6px; 
            margin: 0 10px;
            display: inline-block;
        }
        .nav a:hover { background: #2563eb; }
        .timestamp {
            text-align: center;
            color: #64748b;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Telegram E-commerce Admin Dashboard</h1>
            <p>Управление системой электронной коммерции</p>
        </div>
        
        <div class="nav">
            <a href="/api/admin/data/users">👥 Пользователи</a>
            <a href="/api/admin/data/stores">🏪 Магазины</a>
            <a href="/api/admin/data/products">📦 Товары</a>
            <a href="/api/admin/data/orders">📋 Заказы</a>
            <a href="/api/admin/data/stats">📊 Статистика</a>
        </div>

        <div class="stats">
            <div class="stat-card">
                <div class="stat-number">${stats.users}</div>
                <div class="stat-label">Пользователи</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.stores}</div>
                <div class="stat-label">Магазины</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.products}</div>
                <div class="stat-label">Товары</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.orders}</div>
                <div class="stat-label">Заказы</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${stats.categories}</div>
                <div class="stat-label">Категории</div>
            </div>
        </div>

        <div class="recent-orders">
            <h3>📋 Последние заказы</h3>
            <table>
                <thead>
                    <tr>
                        <th>№ Заказа</th>
                        <th>Клиент</th>
                        <th>Магазин</th>
                        <th>Сумма</th>
                        <th>Статус</th>
                        <th>Дата</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentOrders.map(order => `
                        <tr>
                            <td><strong>${order.orderNumber}</strong></td>
                            <td>${order.customer?.username || order.customer?.firstName || 'N/A'}</td>
                            <td>${order.store?.name || 'N/A'}</td>
                            <td>${order.totalAmount} ${order.currency}</td>
                            <td><span class="status ${order.status.toLowerCase()}">${order.status}</span></td>
                            <td>${new Date(order.createdAt).toLocaleDateString('ru-RU')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="timestamp">
            Обновлено: ${new Date().toLocaleString('ru-RU')}
        </div>
    </div>

    <script>
        // Auto refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    logger.error('Admin dashboard error:', error);
    res.status(500).send(`
      <h1>Ошибка админ-панели</h1>
      <p>Не удалось загрузить данные: ${error}</p>
      <a href="/admin">Обновить</a>
    `);
  }
});

export default router;
