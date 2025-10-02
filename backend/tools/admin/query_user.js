const { PrismaClient } = require('@prisma/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { id: null, telegramId: null };
  for (const arg of args) {
    if (arg.startsWith('--id=')) result.id = arg.substring(5);
    if (arg.startsWith('--tg=') || arg.startsWith('--telegram=')) {
      const [k, v] = arg.split('=');
      result.telegramId = v;
    }
  }
  return result;
}

async function main() {
  const prisma = new PrismaClient();
  const { id, telegramId } = parseArgs();
  if (!id && !telegramId) {
    console.error('Usage: node query_user.js --id <userId> | --tg <telegramId>');
    process.exit(1);
  }
  try {
    let user = id
      ? await prisma.user.findUnique({ where: { id }, select: { id: true, telegramId: true, role: true, email: true, isActive: true } })
      : await prisma.user.findUnique({ where: { telegramId: String(telegramId) }, select: { id: true, telegramId: true, role: true, email: true, isActive: true } });
    console.log('USER', user);
  } catch (e) {
    console.error('ERROR', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


