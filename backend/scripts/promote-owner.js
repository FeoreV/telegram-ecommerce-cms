const { PrismaClient } = require('../node_modules/@prisma/client');

const prisma = new PrismaClient();

async function promoteOwner(telegramId) {
  if (!telegramId) {
    console.error('Usage: node promote-owner.js <telegramId>');
    process.exit(1);
  }

  try {
    const user = await prisma.user.update({
      where: { telegramId },
      data: { role: 'OWNER' },
    });
    console.log(`Updated user ${user.id} to role ${user.role}`);
  } catch (error) {
    console.error('Failed to update role', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

promoteOwner(process.argv[2]);
