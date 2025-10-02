const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  const telegramId = '8064031592';

  try {
    console.log('🔍 Checking user by telegramId:', telegramId);
    let user = await prisma.user.findUnique({
      where: { telegramId },
      select: { id: true, telegramId: true, email: true, role: true, isActive: true }
    });

    if (!user) {
      console.log('❌ User not found. Aborting.');
      return;
    }

    console.log('👤 Current user:', user);

    // Ensure OWNER and active
    if (user.role !== 'OWNER' || !user.isActive) {
      user = await prisma.user.update({
        where: { telegramId },
        data: { role: 'OWNER', isActive: true },
        select: { id: true, telegramId: true, email: true, role: true, isActive: true }
      });
      console.log('✅ User updated to OWNER and activated:', user);
    } else {
      console.log('✅ User already OWNER and active');
    }

    // Ensure email exists for AdminJS login
    if (!user.email) {
      const email = `admin_${telegramId}@botrt.local`;
      user = await prisma.user.update({
        where: { telegramId },
        data: { email },
        select: { id: true, telegramId: true, email: true, role: true }
      });
      console.log('📧 Email set for AdminJS:', user.email);
    }

    // Revoke all sessions to force role refresh on next login
    const revoked = await prisma.userSession.deleteMany({ where: { userId: user.id } });
    console.log(`🔐 Revoked sessions: ${revoked.count}`);

    console.log('🎉 Fix completed. Use these AdminJS creds if needed:');
    console.log('   Email:', user.email);
    console.log('   Password: ChangeMe123!');
  } catch (err) {
    console.error('💥 Error fixing access:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();


