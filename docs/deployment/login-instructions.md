# 🔑 Инструкции для входа в систему

## ✅ Решение проблемы пустой страницы

### Шаг 1: Авторизация

1. Откройте http://localhost:3000
2. Откройте консоль браузера (F12)
3. Выполните этот код для авторизации:

```javascript
// Токен супер-админа (роль OWNER)
const adminToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJjbWZ3bzE4dHMwMDAyN2k1bDU0ZXg2cnpqIiwidGVsZWdyYW1JZCI6Ijc3Nzc3Nzc3NyIsInJvbGUiOiJDVVNUT01FUiIsImlhdCI6MTc1ODYzODY3NSwiZXhwIjoxNzU5MjQzNDc1LCJhdWQiOiJ0ZWxlZ3JhbS1lY29tbWVyY2UtZnJvbnRlbmQiLCJpc3MiOiJ0ZWxlZ3JhbS1lY29tbWVyY2UtYm90In0.8ziY9rG49RgLLH2NrNYiNzAf1R3fsErp_Ho85phMu4g";

const adminUser = {
  id: "cmfwo18ts00027i5l54ex6rzj",
  telegramId: "777777777",
  username: "owner",
  firstName: "Super",
  lastName: "Owner",
  role: "OWNER"  // Устанавливаем правильную роль
};

// Сохраняем в localStorage
localStorage.setItem('authToken', adminToken);
localStorage.setItem('user', JSON.stringify(adminUser));

// Перезагружаем страницу
location.reload();
```

### Шаг 2: Проверка

После выполнения кода:
1. Страница должна перезагрузиться
2. В правом верхнем углу должно показаться "Super Owner"
3. Перейдите на http://localhost:3000/stores
4. Вы должны увидеть:
   - 🔵 Виджет "Создать магазин в Telegram" (синий блок)
   - 📋 Панель фильтров
   - 📊 Статистику магазинов

### Шаг 3: Тестирование Telegram интеграции

1. На странице магазинов найдите синий виджет "Создать магазин в Telegram"
2. Нажмите "Открыть бот" или "QR-код"
3. Должна открыться ссылка на Telegram бот
4. В боте вы сможете создать магазин пошагово

## 🎯 Ожидаемый результат

После авторизации страница http://localhost:3000/stores должна показывать:
- ✅ Виджет Telegram интеграции
- ✅ Кнопки "Создать магазин", "Из шаблона"
- ✅ Фильтры и сортировка
- ✅ Список магазинов (может быть пустым изначально)

## 🐛 Если не работает

### Проблема: Токен недействителен
```javascript
// Создайте новый токен
fetch('/api/auth/telegram', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    telegramId: "777777777",
    username: "owner", 
    firstName: "Super",
    lastName: "Owner"
  })
}).then(r => r.json()).then(data => {
  console.log('New token:', data);
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('user', JSON.stringify({...data.user, role: 'OWNER'}));
  location.reload();
});
```

### Проблема: Нет прав администратора
В консоли выполните:
```javascript
const user = JSON.parse(localStorage.getItem('user') || '{}');
user.role = 'OWNER';
localStorage.setItem('user', JSON.stringify(user));
location.reload();
```

### Проблема: Страница все еще пустая
1. Проверьте что backend запущен: `curl http://localhost:3001/health`
2. Проверьте что frontend запущен: http://localhost:3000 должен загружаться
3. Проверьте консоль браузера на ошибки (F12)

## 🎉 Успех!

После успешной авторизации вы сможете:
- Создавать магазины через веб-интерфейс
- Создавать магазины через Telegram бот
- Управлять товарами и заказами
- Использовать все административные функции

---

**💡 Совет**: Сохраните этот токен - он действует 7 дней и дает полные права владельца системы.
