const { PrismaClient } = require('@prisma/client');

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { id: null, telegramId: null };
  for (const arg of args) {
    if (arg.startsWith('--id=')) result.id = arg.substring(5);
    if (arg.startsWith('--tg=') || arg.startsWith('--telegram=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : null;
      result.telegramId = value;
    }
  }
  return result;
}

async function main() {
  const prisma = new PrismaClient();
  const { id, telegramId } = parseArgs();

  if (!id && !telegramId) {
    console.error('Usage: node promote_user.js --id <userId> | --tg <telegramId>');
    process.exit(1);
  }

  try {
    let user = id
      ? await prisma.user.findUnique({ where: { id }, select: { id: true, telegramId: true, role: true, isActive: true, email: true } })
      : await prisma.user.findUnique({ where: { telegramId: String(telegramId) }, select: { id: true, telegramId: true, role: true, isActive: true, email: true } });

    if (!user) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log('👤 Found user:', user);

    // Ensure email for AdminJS login
    const ensuredEmail = user.email || `admin_${user.telegramId}@botrt.local`;

    // Promote to OWNER and activate
    user = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'OWNER', isActive: true, email: ensuredEmail },
      select: { id: true, telegramId: true, role: true, isActive: true, email: true }
    });
    console.log('✅ Updated user:', user);

    // Revoke all sessions to force refresh
    const revoked = await prisma.userSession.deleteMany({ where: { userId: user.id } });
    console.log('🔐 Sessions revoked:', revoked.count);

    console.log('🎉 Done. AdminJS login (if needed):');
    console.log('   Email:', user.email);
    console.log('   Password: ChangeMe123!');
  } catch (e) {
    console.error('💥 Error:', e.message || e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();


