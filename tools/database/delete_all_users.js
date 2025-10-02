const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteAll() {
  try {
    console.log('🗑️ УДАЛЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ с telegramId 8064031592...');
    
    const result = await prisma.user.deleteMany({
      where: { telegramId: '8064031592' }
    });
    
    console.log(`✅ Удалено ${result.count} пользователей`);
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAll();
