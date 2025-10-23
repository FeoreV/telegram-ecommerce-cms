# 🔐 Vault Setup Guide

Полное руководство по настройке HashiCorp Vault для максимальной безопасности платформы.

## 🎯 Обзор

Vault обеспечивает централизованное управление секретами, шифрование данных и ротацию ключей для всей платформы.

### Компоненты безопасности:
- **KV Secrets Engine** - хранение API ключей, JWT секретов, паролей БД
- **Transit Engine** - шифрование/дешифрование данных приложения  
- **Database Engine** - динамические учетные данные БД
- **AppRole Auth** - аутентификация приложений

## 🚀 Быстрый старт (Development)

### 1. Запуск Vault в Docker

```bash
# Запустить Vault
docker-compose -f config/vault/docker-compose.vault.yml up -d

# Дождаться инициализации (проверить логи)
docker logs botrt-vault-init

# Получить учетные данные
docker exec botrt-vault cat /vault/config/credentials.json
```

### 2. Настройка секретов

```bash
# Перейти в директорию tools
cd tools/vault

# Выполнить настройку секретов
./setup-vault-secrets.sh
```

### 3. Обновление конфигурации приложения

```bash
# Скопировать пример конфигурации Vault
cp config/environments/vault.env.example .env.vault

# Обновить .env.vault с полученными учетными данными
# VAULT_ROLE_ID и VAULT_SECRET_ID из credentials.json

# Обновить основной .env файл
echo "USE_VAULT=true" >> .env
echo "VAULT_ADDR=http://82.147.84.78:8200" >> .env
echo "VAULT_ROLE_ID=your-role-id" >> .env
echo "VAULT_SECRET_ID=your-secret-id" >> .env
```

## 🔧 Production Setup

### 1. Производственный Vault

```bash
# Создать production конфигурацию
mkdir -p /opt/vault/config
mkdir -p /opt/vault/data

# Создать конфигурационный файл
cat > /opt/vault/config/vault.hcl <<EOF
ui = true
disable_mlock = false

storage "file" {
  path = "/opt/vault/data"
}

listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
}

api_addr = "https://vault.yourdomain.com:8200"
cluster_addr = "https://vault.yourdomain.com:8201"
EOF

# Запустить Vault
vault server -config=/opt/vault/config/vault.hcl
```

### 2. Инициализация и настройка

```bash
export VAULT_ADDR='https://vault.yourdomain.com:8200'

# Инициализация с 5 ключами, порог 3
vault operator init -key-shares=5 -key-threshold=3

# Распечатать Vault (3 ключа из 5)
vault operator unseal <unseal-key-1>
vault operator unseal <unseal-key-2>
vault operator unseal <unseal-key-3>

# Войти с root токеном
vault auth <root-token>
```

### 3. Настройка политик безопасности

```bash
# Создать политику для приложения
vault policy write telegram-ecommerce-policy - <<EOF
# KV Secrets
path "kv/data/app/*" {
  capabilities = ["read"]
}

# Transit encryption
path "transit/encrypt/telegram-ecommerce-key" {
  capabilities = ["update"]
}

path "transit/decrypt/telegram-ecommerce-key" {
  capabilities = ["update"]
}

# Database credentials
path "database/creds/telegram-ecommerce-role" {
  capabilities = ["read"]
}
EOF

# Создать роль AppRole
vault write auth/approle/role/telegram-ecommerce \
    token_policies="telegram-ecommerce-policy" \
    token_ttl=1h \
    token_max_ttl=4h \
    bind_secret_id=true \
    secret_id_ttl=24h \
    secret_id_num_uses=0
```

### 4. Настройка Database Engine

```bash
# Включить database engine
vault secrets enable database

# Настроить подключение к PostgreSQL
vault write database/config/postgresql \
    plugin_name=postgresql-database-plugin \
    connection_url="postgresql://{{username}}:{{password}}@82.147.84.78:5432/telegram_ecommerce?sslmode=require" \
    allowed_roles="telegram-ecommerce-role" \
    username="vault_admin" \
    password="vault_admin_password"

# Создать роль для приложения
vault write database/roles/telegram-ecommerce-role \
    db_name=postgresql \
    creation_statements="CREATE ROLE \"{{name}}\" WITH LOGIN PASSWORD '{{password}}' VALID UNTIL '{{expiration}}'; \
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO \"{{name}}\"; \
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO \"{{name}}\";" \
    default_ttl="1h" \
    max_ttl="24h"
```

## 🔐 Секреты приложения

### Структура секретов в Vault:

```
kv/
├── app/
│   ├── jwt                 # JWT токены
│   ├── database           # Подключение к БД
│   ├── telegram           # Токены Telegram
│   ├── admin              # Админские пароли
│   ├── smtp               # Email настройки
│   ├── encryption         # Ключи шифрования
│   └── redis              # Redis настройки
└── shared/
    ├── certificates       # TLS сертификаты
    └── api-keys           # Внешние API ключи
```

### Пример заполнения секретов:

```bash
# JWT секреты
vault kv put kv/app/jwt \
    secret="$(openssl rand -base64 64 | tr -d '=+/')" \
    refreshSecret="$(openssl rand -base64 64 | tr -d '=+/')" \
    expiresIn="15m" \
    refreshExpiresIn="7d"

# Telegram секреты
vault kv put kv/app/telegram \
    botToken="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11" \
    webhookSecret="$(openssl rand -base64 32 | tr -d '=+/')"

# Шифрование
vault kv put kv/app/encryption \
    masterKey="$(openssl rand -hex 32)" \
    dataEncryptionKey="$(openssl rand -hex 32)"
```

## 🔄 Ротация секретов

### Автоматическая ротация JWT токенов:

```bash
# Создать новый JWT секрет
NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '=+/')

# Обновить в Vault
vault kv patch kv/app/jwt secret="$NEW_JWT_SECRET"

# Приложение автоматически подхватит новый секрет при следующем обновлении токенов
```

### Ротация ключей шифрования:

```bash
# Создать новую версию ключа в Transit
vault write -f transit/keys/telegram-ecommerce-key/rotate

# Приложение будет использовать новый ключ для шифрования,
# но сможет расшифровать данные, зашифрованные старым ключом
```

## 🛡️ Безопасность Production

### 1. TLS Configuration

```bash
# Создать сертификаты
openssl req -x509 -newkey rsa:4096 -keyout vault.key -out vault.crt -days 365 -nodes

# Обновить конфигурацию Vault
listener "tcp" {
  address       = "0.0.0.0:8200"
  tls_cert_file = "/opt/vault/tls/vault.crt"
  tls_key_file  = "/opt/vault/tls/vault.key"
  tls_min_version = "tls12"
}
```

### 2. Аудит

```bash
# Включить аудит
vault audit enable file file_path=/opt/vault/logs/audit.log

# Настроить ротацию логов
logrotate /opt/vault/logs/audit.log
```

### 3. Backup

```bash
# Создать snapshot
vault operator raft snapshot save backup.snap

# Восстановление
vault operator raft snapshot restore backup.snap
```

## 🔍 Мониторинг

### Health Checks

```bash
# Проверка статуса Vault
curl -s http://82.147.84.78:8200/v1/sys/health | jq

# Проверка через приложение
curl -s http://82.147.84.78:3001/health/vault | jq
```

### Метрики

```bash
# Prometheus метрики
curl -s http://82.147.84.78:8200/v1/sys/metrics?format=prometheus
```

## 🚨 Troubleshooting

### Частые проблемы:

1. **Vault sealed** - выполнить unseal
2. **Token expired** - проверить TTL и обновить
3. **Permission denied** - проверить политики
4. **Connection refused** - проверить сеть и firewall

### Логи:

```bash
# Логи Vault
docker logs botrt-vault

# Логи приложения
tail -f backend/logs/combined.log | grep -i vault

# Аудит логи
tail -f /opt/vault/logs/audit.log
```

## ✅ Проверка настройки

```bash
# 1. Проверить статус Vault
vault status

# 2. Проверить секреты
vault kv get kv/app/jwt

# 3. Проверить политики
vault policy read telegram-ecommerce-policy

# 4. Проверить AppRole
vault read auth/approle/role/telegram-ecommerce

# 5. Проверить здоровье приложения
curl http://82.147.84.78:3001/health/vault
```
