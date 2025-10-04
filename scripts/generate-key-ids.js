#!/usr/bin/env node
/**
 * Скрипт генерации всех KEY_ID для системы
 * Использование: node scripts/generate-key-ids.js
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m'
};

console.log(`${colors.bright}${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║      🔐 Генератор Key IDs для всех сервисов              ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);

// Функция генерации безопасного ключа
function generateKeyId(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Список всех необходимых Key IDs
const keyIds = [
  { name: 'SECURITY_LOGS_KEY_ID', description: 'Шифрование логов безопасности' },
  { name: 'SBOM_SIGNING_KEY_ID', description: 'Подпись списка компонентов (SBOM)' },
  { name: 'COMMUNICATION_KEY_ID', description: 'Шифрование коммуникаций' },
  { name: 'WEBSOCKET_KEY_ID', description: 'Защита WebSocket соединений' },
  { name: 'BACKUP_KEY_ID', description: 'Шифрование бэкапов' },
  { name: 'STORAGE_KEY_ID', description: 'Шифрование данных в хранилище' },
  { name: 'LOG_KEY_ID', description: 'Шифрование обычных логов' }
];

// Дополнительные секреты
const additionalSecrets = [
  { name: 'JWT_SECRET', description: 'JWT токены', generator: () => crypto.randomBytes(64).toString('base64') },
  { name: 'JWT_REFRESH_SECRET', description: 'JWT refresh токены', generator: () => crypto.randomBytes(64).toString('base64') },
  { name: 'SESSION_SECRET', description: 'Сессии пользователей', generator: () => crypto.randomBytes(32).toString('base64') },
  { name: 'COOKIE_SECRET', description: 'Защита cookies', generator: () => crypto.randomBytes(32).toString('base64') }
];

console.log(`${colors.yellow}📝 Генерация ключей...${colors.reset}\n`);

// Генерируем все ключи
const generatedKeys = {};

// Key IDs
keyIds.forEach(({ name, description }) => {
  generatedKeys[name] = generateKeyId();
  console.log(`${colors.green}✓${colors.reset} ${name.padEnd(25)} - ${description}`);
});

console.log('');

// Дополнительные секреты
additionalSecrets.forEach(({ name, description, generator }) => {
  generatedKeys[name] = generator();
  console.log(`${colors.green}✓${colors.reset} ${name.padEnd(25)} - ${description}`);
});

console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);

// Формируем вывод для .env файла
const envContent = `# ============================================
# Key IDs для шифрования и защиты данных
# Сгенерировано: ${new Date().toLocaleString('ru-RU')}
# ============================================

# Ключи шифрования
${keyIds.map(({ name }) => `${name}=${generatedKeys[name]}`).join('\n')}

# JWT и сессии
${additionalSecrets.map(({ name }) => `${name}=${generatedKeys[name]}`).join('\n')}

# Дополнительные настройки безопасности
ENABLE_CSRF_PROTECTION=true
HASH_ALGORITHM=sha256
ENCRYPTION_ALGORITHM=aes-256-gcm
`;

console.log(`${colors.blue}📋 Копируйте следующие строки в ваш .env файл:${colors.reset}\n`);
console.log(envContent);

// Спрашиваем, сохранить ли в файл
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question(`${colors.yellow}Сохранить в файл .env.keys? (y/n): ${colors.reset}`, (answer) => {
  if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'д' || answer.toLowerCase() === 'да') {
    const filePath = path.join(process.cwd(), '.env.keys');
    fs.writeFileSync(filePath, envContent);
    console.log(`\n${colors.green}✓ Ключи сохранены в ${filePath}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  ВАЖНО:${colors.reset}`);
    console.log(`   1. Скопируйте содержимое .env.keys в ваш .env файл`);
    console.log(`   2. Удалите .env.keys после копирования`);
    console.log(`   3. Убедитесь, что .env в .gitignore`);
  } else {
    console.log(`\n${colors.blue}✓ Скопируйте ключи вручную из вывода выше${colors.reset}`);
  }
  
  console.log(`\n${colors.bright}${colors.green}╔═══════════════════════════════════════════════════════════╗`);
  console.log(`║                     ✓ ГОТОВО!                            ║`);
  console.log(`╚═══════════════════════════════════════════════════════════╝${colors.reset}\n`);
  
  console.log(`${colors.red}⚠️  ПРЕДУПРЕЖДЕНИЯ БЕЗОПАСНОСТИ:${colors.reset}`);
  console.log(`   • НИКОГДА не коммитьте .env файлы в Git`);
  console.log(`   • Храните ключи в безопасном месте`);
  console.log(`   • Используйте разные ключи для dev/prod`);
  console.log(`   • Регулярно ротируйте ключи в продакшене\n`);
  
  rl.close();
});

