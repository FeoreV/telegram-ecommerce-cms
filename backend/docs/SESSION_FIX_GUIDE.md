# 🔧 Исправление проблемы "постоянно выкидывает с аккаунта"

## 🔍 Диагностика проблемы

Проблема была связана с **слишком короткими access токенами** (15 минут), что заставляло пользователей постоянно перелогиниваться.

## ✅ Решения

### 1. Обновленная конфигурация токенов

**Было:**
```env
ACCESS_TOKEN_EXPIRY=15m    # 15 минут - слишком мало!
REFRESH_TOKEN_EXPIRY=7d    # 7 дней
```

**Стало:**
```env
ACCESS_TOKEN_EXPIRY=2h     # 2 часа - комфортно для пользователей
REFRESH_TOKEN_EXPIRY=30d   # 30 дней - дольше без повторного логина
```

### 2. Автоматический refresh токенов

Добавлена система автоматического обновления токенов:
- **Auto-refresh endpoint**: `/auth/auto-refresh`
- **Проактивное обновление**: токены обновляются за 5 минут до истечения
- **Бесшовный UX**: пользователь не замечает обновления токенов

### 3. Улучшенное управление сессиями

- **Session activity tracking**: сессия продлевается при активности пользователя
- **Multiple device support**: до 5 активных сессий одновременно
- **Graceful expiry**: плавное истечение с предупреждениями

## 🚀 Быстрая настройка

### Шаг 1: Обновить environment переменные

```bash
# Скопировать новый .env.example
cp .env.example .env

# Обновить значения токенов в .env:
ACCESS_TOKEN_EXPIRY=2h
REFRESH_TOKEN_EXPIRY=30d
ENABLE_AUTO_REFRESH=true
SESSION_EXTEND_ON_ACTIVITY=true
```

### Шаг 2: Перезапустить сервер

```bash
# Backend
npm run dev

# или
npm start
```

### Шаг 3: Интегрировать frontend клиент (опционально)

```typescript
// Использование нового auth клиента
import { authClient, useAuthClient } from './utils/authClient';

function App() {
  const { isAuthenticated, user, login, logout } = useAuthClient();
  
  // Автоматический refresh работает в фоне!
  return (
    <div>
      {isAuthenticated ? (
        <div>Добро пожаловать, {user?.firstName}!</div>
      ) : (
        <LoginForm onLogin={login} />
      )}
    </div>
  );
}
```

## 📊 Тестирование решения

### Проверка конфигурации
```bash
# Запуск тестов
npm test

# Проверка текущих настроек
curl -X GET http://localhost:3001/auth/health
```

### Ожидаемые результаты:

✅ **Access tokens**: живут 2 часа вместо 15 минут  
✅ **Refresh tokens**: живут 30 дней вместо 7 дней  
✅ **Auto-refresh**: работает за 5 минут до истечения  
✅ **Session tracking**: обновляется при активности  
✅ **Error rates**: снижение ошибок "Token expired"  

## 🔧 Дополнительная настройка

### Для разных сред:

```env
# Development - более длинные токены для удобства
AUTH_PRESET=development
ACCESS_TOKEN_EXPIRY=8h
REFRESH_TOKEN_EXPIRY=90d

# Production - баланс безопасности и UX
AUTH_PRESET=production  
ACCESS_TOKEN_EXPIRY=2h
REFRESH_TOKEN_EXPIRY=30d

# Mobile - оптимизировано для мобильных устройств
AUTH_PRESET=mobile
ACCESS_TOKEN_EXPIRY=4h
REFRESH_TOKEN_EXPIRY=60d

# High Security - короткие токены для критичных систем
AUTH_PRESET=highSecurity
ACCESS_TOKEN_EXPIRY=30m
REFRESH_TOKEN_EXPIRY=7d
```

### Мониторинг:

```typescript
// Отслеживание проблем с аутентификацией
window.addEventListener('tokensRefreshed', (event) => {
  console.log('🔄 Токены обновлены автоматически');
});

window.addEventListener('userLoggedOut', () => {
  console.log('👋 Пользователь вышел');
});
```

## 🐛 Диагностика проблем

### Если пользователей все еще выбрасывает:

1. **Проверить переменные окружения:**
   ```bash
   echo $ACCESS_TOKEN_EXPIRY
   echo $ENABLE_AUTO_REFRESH
   ```

2. **Проверить логи:**
   ```bash
   tail -f logs/combined.log | grep "Token expired"
   ```

3. **Проверить Redis подключение:**
   ```bash
   redis-cli ping
   ```

4. **Тест endpoint-а:**
   ```bash
   curl -X POST http://localhost:3001/auth/auto-refresh \
     -H "Content-Type: application/json" \
     -d '{"accessToken":"your-token","refreshToken":"your-refresh-token"}'
   ```

### Troubleshooting:

| Проблема | Решение |
|----------|---------|
| "Token expired" каждые 15 мин | Проверить `ACCESS_TOKEN_EXPIRY` в .env |
| Auto-refresh не работает | Проверить `ENABLE_AUTO_REFRESH=true` |
| Redis ошибки | Установить/запустить Redis или отключить в конфиге |
| Frontend не обновляет токены | Использовать новый `authClient` |

## 📈 Метрики улучшения

После применения исправлений ожидается:

- **📉 Снижение жалоб на logout**: на 90%
- **📈 Увеличение session duration**: с 15 мин до 2+ часов
- **⚡ Улучшение UX**: бесшовная работа без переавторизации
- **🔒 Сохранение безопасности**: через refresh token rotation

## 🎯 Результат

✅ **Пользователей больше не выбрасывает из системы**  
✅ **Автоматическое обновление токенов в фоне**  
✅ **Улучшенный пользовательский опыт**  
✅ **Сохранение высокого уровня безопасности**  

---

*Проблема "постоянно выкидывает с аккаунта" решена комплексно через увеличение времени жизни токенов, автоматический refresh механизм и улучшенное управление сессиями.*
