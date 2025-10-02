const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function forceDeleteStore(searchTerm) {
  try {
    console.log(`🔍 Поиск магазина: "${searchTerm}"\n`);

    // Поиск магазина
    const stores = await prisma.store.findMany({
      where: {
        OR: [
          { name: { contains: searchTerm } },
          { slug: { contains: searchTerm } },
          { id: searchTerm }
        ]
      },
      select: {
        id: true,
        name: true,
        slug: true,
        botToken: true,
        botUsername: true,
        botStatus: true,
        createdAt: true,
        _count: {
          select: {
            products: true,
            orders: true,
            admins: true,
            vendors: true
          }
        }
      }
    });

    if (stores.length === 0) {
      console.log('❌ Магазин не найден\n');
      return;
    }

    if (stores.length > 1) {
      console.log(`⚠️  Найдено несколько магазинов (${stores.length}). Уточните запрос:\n`);
      stores.forEach((store, index) => {
        console.log(`${index + 1}. ${store.name} (/${store.slug}) [ID: ${store.id}]`);
      });
      console.log('\nИспользуйте точный ID магазина для удаления.');
      return;
    }

    const store = stores[0];

    console.log(`${'='.repeat(60)}`);
    console.log(`📦 УДАЛЕНИЕ МАГАЗИНА`);
    console.log(`${'='.repeat(60)}`);
    console.log(`ID:           ${store.id}`);
    console.log(`Название:     ${store.name}`);
    console.log(`Slug:         /${store.slug}`);
    console.log(`Bot Username: ${store.botUsername || '❌ Не установлен'}`);
    console.log(`Bot Status:   ${store.botStatus}`);
    console.log(`Bot Token:    ${store.botToken ? '✅ ЕСТЬ' : '❌ НЕТ'}`);
    console.log(`Создан:       ${new Date(store.createdAt).toLocaleString('ru-RU')}`);
    console.log(`\n📊 Будет удалено:`);
    console.log(`  - Товаров: ${store._count.products}`);
    console.log(`  - Заказов: ${store._count.orders}`);
    console.log(`  - Админов: ${store._count.admins}`);
    console.log(`  - Вендоров: ${store._count.vendors}`);
    console.log(`${'='.repeat(60)}`);

    console.log(`\n🗑️  Удаление магазина...`);

    // Удаляем магазин (каскадное удаление обрабатывается Prisma)
    await prisma.store.delete({
      where: { id: store.id }
    });

    console.log(`\n✅ Магазин "${store.name}" успешно удален!`);
    console.log(`\n📝 Удалено:`);
    console.log(`  ✓ Магазин`);
    console.log(`  ✓ ${store._count.products} товаров`);
    console.log(`  ✓ ${store._count.orders} заказов`);
    console.log(`  ✓ Все связанные данные (логи, уведомления, и т.д.)`);
    console.log(`\n${'='.repeat(60)}\n`);

  } catch (error) {
    console.error('❌ Ошибка при удалении:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

// Получаем аргумент из командной строки
const searchTerm = process.argv[2];

if (!searchTerm) {
  console.log('📖 Использование:');
  console.log('   node backend/scripts/force-delete-store.js <название_или_id_магазина>');
  console.log('');
  console.log('⚠️  ВНИМАНИЕ: Этот скрипт удаляет магазин БЕЗ подтверждения!');
  console.log('');
  console.log('📝 Примеры:');
  console.log('   node backend/scripts/force-delete-store.js paymenttest');
  console.log('   node backend/scripts/force-delete-store.js cmg9asld800056s4cqgw1xufd');
  console.log('');
  process.exit(1);
}

forceDeleteStore(searchTerm);

