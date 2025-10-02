const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBotToken(searchTerm) {
  try {
    console.log(`🔍 Ищем магазин/бота: "${searchTerm}"\n`);

    // Поиск по имени магазина, slug или botUsername
    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm } },
          { slug: { contains: searchTerm } },
          { botUsername: { contains: searchTerm } }
        ]
      },
      select: {
        id: true,
        name: true,
        slug: true,
        botToken: true,
        botUsername: true,
        botStatus: true,
        botCreatedAt: true,
        botLastActive: true,
        _count: {
          select: {
            products: true,
            orders: true
          }
        }
      }
    });

    if (stores.length === 0) {
      console.log('❌ Магазин не найден\n');
      console.log('💡 Доступные магазины:');
      
      const allStores = await prisma.store.findMany({
        select: {
          name: true,
          slug: true,
          botUsername: true
        }
      });
      
      allStores.forEach(store => {
        console.log(`  - ${store.name} (/${store.slug}) ${store.botUsername ? `[@${store.botUsername}]` : '[Нет бота]'}`);
      });
      return;
    }

    stores.forEach((store, index) => {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📦 Магазин #${index + 1}: ${store.name}`);
      console.log(`${'='.repeat(60)}`);
      console.log(`ID:           ${store.id}`);
      console.log(`Slug:         /${store.slug}`);
      console.log(`Bot Username: ${store.botUsername || '❌ Не установлен'}`);
      console.log(`Bot Status:   ${store.botStatus}`);
      console.log(`Bot Token:    ${store.botToken ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
      
      if (store.botToken) {
        // Показываем только первые и последние символы токена
        const token = store.botToken;
        const masked = token.slice(0, 10) + '...' + token.slice(-10);
        console.log(`Token (masked): ${masked}`);
      }
      
      console.log(`Создан:       ${store.botCreatedAt ? new Date(store.botCreatedAt).toLocaleString('ru-RU') : 'Не установлено'}`);
      console.log(`Последняя активность: ${store.botLastActive ? new Date(store.botLastActive).toLocaleString('ru-RU') : 'Никогда'}`);
      console.log(`\n📊 Статистика:`);
      console.log(`  - Товаров: ${store._count.products}`);
      console.log(`  - Заказов: ${store._count.orders}`);
      
      if (!store.botToken) {
        console.log(`\n⚠️  ПРОБЛЕМА: У этого магазина нет токена бота!`);
        console.log(`📝 Решение:`);
        console.log(`   1. Создайте бота через @BotFather в Telegram`);
        console.log(`   2. Получите токен`);
        console.log(`   3. Добавьте токен через админку: Телеграм боты -> Создать нового бота`);
        console.log(`   ИЛИ`);
        console.log(`   Используйте команду: node backend/scripts/add-bot-token.js ${store.id} "ВАШ_ТОКЕН"`);
      } else {
        console.log(`\n✅ Токен установлен. Действия должны отображаться в админке.`);
      }
    });

    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргумент из командной строки
const searchTerm = process.argv[2] || 'paymenttest';
checkBotToken(searchTerm);

