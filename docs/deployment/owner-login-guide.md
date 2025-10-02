# 👑 OWNER ACCESS - Telegram ID: 1204234702

## ✅ Готово! Права владельца выданы

### 🔑 Данные для входа:

**Telegram ID:** `1204234702`  
**Роль:** `OWNER` (полные права)  
**Токен:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWZ3ajgwcTgwMDAwajhvdjlpazRpMnd4IiwidGVsZWdyYW1JZCI6IjEyMDQyMzQ3MDIiLCJyb2xlIjoiT1dORVIiLCJpYXQiOjE3NTg2Mzg3OTcsImV4cCI6MTc1OTI0MzU5NywiYXVkIjoidGVsZWdyYW0tZWNvbW1lcmNlLWZyb250ZW5kIiwiaXNzIjoidGVsZWdyYW0tZWNvbW1lcmNlLWJvdCJ9.t_CK4lTmTknTl3HXAeQKP-WFk4guX4sGquk_gGVKpMI`

### 🚀 Быстрый вход:

1. Откройте http://localhost:3000
2. Нажмите F12 (консоль браузера)  
3. Вставьте и выполните этот код:

```javascript
// Данные владельца 1204234702
const ownerToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWZ3ajgwcTgwMDAwajhvdjlpazRpMnd4IiwidGVsZWdyYW1JZCI6IjEyMDQyMzQ3MDIiLCJyb2xlIjoiT1dORVIiLCJpYXQiOjE3NTg2Mzg3OTcsImV4cCI6MTc1OTI0MzU5NywiYXVkIjoidGVsZWdyYW0tZWNvbW1lcmNlLWZyb250ZW5kIiwiaXNzIjoidGVsZWdyYW0tZWNvbW1lcmNlLWJvdCJ9.t_CK4lTmTknTl3HXAeQKP-WFk4guX4sGquk_gGVKpMI";

const ownerUser = {
  id: "cmfwj80q80000j8ov9ik4i2wx",
  telegramId: "1204234702",
  username: "owner", 
  firstName: "Owner",
  lastName: "User",
  role: "OWNER"
};

localStorage.setItem('authToken', ownerToken);
localStorage.setItem('user', JSON.stringify(ownerUser));
location.reload();
```

4. Перейдите на http://localhost:3000/stores

### 🎯 Что вы получаете:

- ✅ **Полные права владельца** системы
- ✅ **Создание магазинов** через веб и Telegram
- ✅ **Управление всеми пользователями**
- ✅ **Доступ ко всем магазинам**
- ✅ **Административные функции**
- ✅ **Telegram бот интеграция**

### 🤖 Telegram бот:

После авторизации на странице /stores:
1. Найдите синий виджет "Создать магазин в Telegram"
2. Нажмите "Открыть бот" 
3. Создавайте магазины прямо в Telegram!

### ⏱ Срок действия:

Токен действует **7 дней** (до: 2025-09-30).  
После истечения просто выполните повторную авторизацию.

### 🔄 Повторная авторизация:

Если токен истек, выполните:
```javascript
fetch('/api/auth/telegram', {
  method: 'POST', 
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    telegramId: "1204234702",
    username: "owner",
    firstName: "Owner", 
    lastName: "User"
  })
}).then(r => r.json()).then(data => {
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify(data.user));
  location.reload();
});
```

---

**👑 Поздравляем! Вы теперь владелец системы с полными правами!**
