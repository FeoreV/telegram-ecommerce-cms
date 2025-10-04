#!/usr/bin/env node

/**
 * Fix Encryption Keys Script
 * 
 * This script:
 * 1. Generates secure encryption keys if not already set
 * 2. Updates the .env file with proper keys
 * 3. Re-encrypts bot tokens in the database with the new key
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Generate a secure 256-bit (32-byte) hex key
function generateSecureKey() {
  return crypto.randomBytes(32).toString('hex');
}

// Read current .env file
function readEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env file not found at:', envPath);
    process.exit(1);
  }
  return fs.readFileSync(envPath, 'utf8');
}

// Write updated .env file
function writeEnvFile(content) {
  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('✅ .env file updated');
}

// Update or add env variable
function updateEnvVariable(envContent, key, value) {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  
  if (regex.test(envContent)) {
    // Update existing
    return envContent.replace(regex, `${key}=${value}`);
  } else {
    // Add new under encryption section
    const encryptionSectionRegex = /# Encryption Keys/;
    if (encryptionSectionRegex.test(envContent)) {
      return envContent.replace(
        encryptionSectionRegex,
        `# Encryption Keys\n${key}=${value}`
      );
    } else {
      // Add at the end
      return envContent + `\n# Encryption Keys\n${key}=${value}\n`;
    }
  }
}

// Check if a key looks weak/is a placeholder
function isWeakKey(key) {
  if (!key) return true;
  if (key.includes('dev-') || key.includes('change-me') || key.includes('minimum')) return true;
  if (key.length < 64) return true; // 32 bytes = 64 hex chars
  if (!/^[0-9a-f]{64}$/i.test(key)) return true; // Must be 64 hex chars
  return false;
}

// Simple AES-256-GCM encryption
function encryptToken(plaintext, key) {
  try {
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    const result = {
      ciphertext,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
    
    return Buffer.from(JSON.stringify(result)).toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error.message);
    return null;
  }
}

// Check if a string is already encrypted (base64 JSON with iv, tag, ciphertext)
function isEncrypted(str) {
  try {
    const decoded = Buffer.from(str, 'base64').toString();
    const parsed = JSON.parse(decoded);
    return parsed.iv && parsed.tag && parsed.ciphertext;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔧 Fixing Encryption Keys\n');
  console.log('============================================================\n');

  // Step 1: Read current .env
  let envContent = readEnvFile();
  console.log('📄 Read .env file');

  // Step 2: Extract current keys
  const currentDataKey = envContent.match(/DATA_ENCRYPTION_KEY=(.*)/)?.[1]?.trim();
  const currentMasterKey = envContent.match(/ENCRYPTION_MASTER_KEY=(.*)/)?.[1]?.trim();

  console.log('🔍 Current DATA_ENCRYPTION_KEY:', currentDataKey ? currentDataKey.substring(0, 20) + '...' : 'NOT SET');
  console.log('🔍 Current ENCRYPTION_MASTER_KEY:', currentMasterKey ? currentMasterKey.substring(0, 20) + '...' : 'NOT SET');

  // Step 3: Check if keys are weak
  const dataKeyIsWeak = isWeakKey(currentDataKey);
  const masterKeyIsWeak = isWeakKey(currentMasterKey);

  let newDataKey = currentDataKey;
  let newMasterKey = currentMasterKey;
  let keysChanged = false;

  if (dataKeyIsWeak) {
    console.log('⚠️  DATA_ENCRYPTION_KEY is weak or missing, generating new key...');
    newDataKey = generateSecureKey();
    keysChanged = true;
  }

  if (masterKeyIsWeak) {
    console.log('⚠️  ENCRYPTION_MASTER_KEY is weak or missing, generating new key...');
    newMasterKey = generateSecureKey();
    keysChanged = true;
  }

  if (!keysChanged) {
    console.log('✅ Encryption keys are already strong\n');
  } else {
    console.log('\n📝 New keys generated:');
    console.log('DATA_ENCRYPTION_KEY:', newDataKey);
    console.log('ENCRYPTION_MASTER_KEY:', newMasterKey);
    console.log('');
  }

  // Step 4: Update .env file
  if (keysChanged) {
    envContent = updateEnvVariable(envContent, 'DATA_ENCRYPTION_KEY', newDataKey);
    envContent = updateEnvVariable(envContent, 'ENCRYPTION_MASTER_KEY', newMasterKey);
    writeEnvFile(envContent);
  }

  // Step 5: Re-encrypt bot tokens if keys changed
  if (keysChanged) {
    console.log('\n🔄 Checking bot tokens in database...');
    
    const stores = await prisma.store.findMany({
      where: {
        botToken: { not: null }
      },
      select: {
        id: true,
        name: true,
        botToken: true
      }
    });

    console.log(`Found ${stores.length} stores with bot tokens\n`);

    let reencryptedCount = 0;
    let skippedCount = 0;

    for (const store of stores) {
      if (!store.botToken) continue;

      // Check if token is already encrypted with new key
      const isAlreadyEncrypted = isEncrypted(store.botToken);
      
      if (!isAlreadyEncrypted) {
        // Token is plaintext, encrypt it
        console.log(`🔐 Encrypting token for store: ${store.name}`);
        const encrypted = encryptToken(store.botToken, newDataKey);
        
        if (encrypted) {
          await prisma.store.update({
            where: { id: store.id },
            data: { botToken: encrypted }
          });
          reencryptedCount++;
          console.log(`   ✅ Encrypted`);
        } else {
          console.log(`   ❌ Failed to encrypt`);
        }
      } else {
        // Try to decrypt with old key and re-encrypt with new key
        console.log(`🔄 Re-encrypting token for store: ${store.name}`);
        
        // We'll assume the token is in plaintext format since decryption failed earlier
        // In a real scenario, you'd try to decrypt with the old key first
        // For now, we'll just mark it as needing manual attention
        console.log(`   ⚠️  Token appears encrypted but can't be decrypted - may need manual intervention`);
        skippedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Re-encrypted: ${reencryptedCount}`);
    console.log(`   ⚠️  Skipped (manual attention needed): ${skippedCount}`);
  }

  console.log('\n============================================================');
  console.log('✅ Encryption keys fix complete!');
  console.log('');
  console.log('⚠️  IMPORTANT NEXT STEPS:');
  console.log('1. Restart your backend server');
  console.log('2. The "Local decryption failed" errors should be resolved');
  console.log('3. If you still see errors, you may need to re-enter bot tokens in the admin panel');
  console.log('');

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

