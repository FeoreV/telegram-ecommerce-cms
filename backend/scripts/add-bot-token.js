const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addBotToken(storeId, botToken) {
  try {
    console.log(`🔧 Добавление токена бота для магазина: ${storeId}\n`);

    // Проверка формата токена
    const tokenPattern = /^\d+:[A-Za-z0-9_-]+$/;
    if (!tokenPattern.test(botToken)) {
      console.error('❌ Неверный формат токена!');
      console.log('📝 Токен должен иметь формат: 1234567890:ABCdefGhIJklmNOpqRStuvwXYz');
      return;
    }

    // Находим магазин
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: {
        id: true,
        name: true,
        slug: true,
        botToken: true,
        botUsername: true,
        botStatus: true
      }
    });

    if (!store) {
      console.error(`❌ Магазин с ID "${storeId}" не найден`);
      return;
    }

    console.log(`📦 Найден магазин: ${store.name} (/${store.slug})`);

    if (store.botToken) {
      console.log(`⚠️  У этого магазина уже есть токен!`);
      console.log(`Текущий токен (masked): ${store.botToken.slice(0, 10)}...${store.botToken.slice(-10)}`);
      
      // Запрашиваем подтверждение (в продакшене лучше использовать readline)
      console.log(`\n❓ Хотите заменить токен? (yes/no)`);
      console.log(`   Используйте: node backend/scripts/update-bot-token.js ${storeId} "НОВЫЙ_ТОКЕН"`);
      return;
    }

    // Обновляем токен
    const updated = await prisma.store.update({
      where: { id: storeId },
      data: {
        botToken: botToken,
        botStatus: 'INACTIVE', // Статус останется INACTIVE до запуска бота
        botCreatedAt: new Date()
      }
    });

    console.log(`\n✅ Токен успешно добавлен!`);
    console.log(`📝 Следующие шаги:`);
    console.log(`   1. Перейдите в админку: Телеграм боты`);
    console.log(`   2. Найдите магазин "${store.name}"`);
    console.log(`   3. Теперь вы должны увидеть кнопки действий (Перезапустить, Настройки, Удалить)`);
    console.log(`   4. Нажмите "Перезапустить" чтобы активировать бота`);

  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ Этот токен уже используется другим магазином!');
    } else {
      console.error('❌ Ошибка:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргументы из командной строки
const storeId = process.argv[2];
const botToken = process.argv[3];

if (!storeId || !botToken) {
  console.log('📖 Использование:');
  console.log('   node backend/scripts/add-bot-token.js <STORE_ID> "<BOT_TOKEN>"');
  console.log('');
  console.log('📝 Пример:');
  console.log('   node backend/scripts/add-bot-token.js clxxxx123 "1234567890:ABCdefGhIJklmNOpqRStuvwXYz"');
  console.log('');
  console.log('💡 Сначала используйте check-bot-token.js чтобы найти ID магазина:');
  console.log('   node backend/scripts/check-bot-token.js paymenttest');
  process.exit(1);
}

addBotToken(storeId, botToken);

