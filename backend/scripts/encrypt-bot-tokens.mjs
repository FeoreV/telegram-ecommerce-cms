#!/usr/bin/env node
/**
 * Script to encrypt existing bot tokens in the database
 * Run this once after deploying the encryption changes
 *
 * Usage: node backend/scripts/encrypt-bot-tokens.mjs
 */

import { PrismaClient } from '@prisma/client';
import { encryptionService } from '../dist/src/services/EncryptionService.js';

const prisma = new PrismaClient();

async function encryptBotTokens() {
  try {
    console.log('🔐 Starting bot token encryption migration...\n');

    const stores = await prisma.store.findMany({
      where: {
        botToken: { not: null },
        botStatus: { not: 'INACTIVE' }
      },
      select: {
        id: true,
        name: true,
        botToken: true
      }
    });

    console.log(`Found ${stores.length} stores with bot tokens\n`);

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const store of stores) {
      try {
        // Check if token is already encrypted by trying to decrypt
        let isAlreadyEncrypted = false;
        try {
          await encryptionService.decryptData(store.botToken);
          isAlreadyEncrypted = true;
        } catch (e) {
          // Token is not encrypted or invalid
        }

        if (isAlreadyEncrypted) {
          console.log(`⏭️  Store "${store.name}" (${store.id}): Token already encrypted, skipping`);
          skipCount++;
          continue;
        }

        // Encrypt the token
        const encrypted = await encryptionService.encryptData(store.botToken);

        // Update in database
        await prisma.store.update({
          where: { id: store.id },
          data: { botToken: encrypted }
        });

        console.log(`✅ Store "${store.name}" (${store.id}): Token encrypted successfully`);
        successCount++;

      } catch (error) {
        console.error(`❌ Store "${store.name}" (${store.id}): Failed to encrypt token`);
        console.error(`   Error: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully encrypted: ${successCount}`);
    console.log(`   ⏭️  Skipped (already encrypted): ${skipCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📝 Total processed: ${stores.length}`);

    if (errorCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
    } else {
      console.log('\n⚠️  Migration completed with errors. Please review the failed stores.');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Migration failed with error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
encryptBotTokens().catch(console.error);

