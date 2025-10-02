## Payments and Balance

Consolidated instructions for configuring payment requisites, payment proofs, and balance display in the Telegram bot.

### Configure payment requisites (API)
Endpoint: PUT /api/bots/:storeId/settings

Payload example:
```json
{
  "settings": {
    "paymentRequisites": {
      "card": "1234 5678 9012 3456",
      "bank": "Сбербанк",
      "receiver": "Иванов Иван Иванович",
      "comment": "Оплата заказа"
    },
    "paymentInstructions": "Переведите точную сумму и прикрепите чек."
  }
}
```

Fallback: if requisites are not set, the bot shows store contactInfo.

### Bot flow
1) Order created → show requisites (or contact info fallback)
2) Button "📸 Загрузить чек" opens instructions and accepts proof
3) Admin verifies payment manually and updates order

### Balance feature
- Backend profile response includes balance
- Bot shows balance in profile and provides "💳 Пополнить баланс" with P2P requisites

### Admin UI
- Requisites can also be managed via admin panel in bot settings (card, bank, receiver, comment, instructions)

### Notes
- Requisites fields are optional; show only filled values
- Ensure currency consistency when displaying amounts


