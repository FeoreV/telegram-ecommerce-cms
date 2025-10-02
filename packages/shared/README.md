# @botrt/shared

Общие утилиты и хелперы для всех приложений в монорепозитории BotRT.

## Установка

```bash
pnpm add @botrt/shared@workspace:*
```

## Использование

```typescript
import { 
  formatPrice, 
  isValidEmail, 
  retry,
  sleep,
  groupBy 
} from '@botrt/shared';

// Форматирование цены
const price = formatPrice(1299.99, 'RUB'); // "₽1,299.99"

// Валидация email
const isValid = isValidEmail('user@example.com'); // true

// Retry с экспоненциальной задержкой
const result = await retry(async () => {
  return await fetchData();
}, 3, 1000);

// Группировка массива
const grouped = groupBy(users, 'role');
```

## Доступные утилиты

### Validation
- `isValidEmail(email: string): boolean`
- `isValidPhoneNumber(phone: string): boolean`
- `isValidTelegramUsername(username: string): boolean`

### String Utilities
- `formatPrice(amount: number, currency?: string): string`
- `generateSlug(text: string): string`
- `truncate(text: string, maxLength: number): string`
- `capitalize(text: string): string`

### Date Utilities
- `formatDate(date: Date | string, locale?: string): string`
- `formatDateTime(date: Date | string, locale?: string): string`
- `daysBetween(date1: Date, date2: Date): number`

### Number Utilities
- `roundTo(num: number, decimals?: number): number`
- `formatLargeNumber(num: number): string`
- `randomInRange(min: number, max: number): number`

### Array Utilities
- `groupBy<T>(array: T[], key: keyof T): Record<string, T[]>`
- `unique<T>(array: T[]): T[]`
- `chunk<T>(array: T[], size: number): T[][]`

### Object Utilities
- `deepClone<T>(obj: T): T`
- `isEmpty(obj: any): boolean`
- `pick<T>(obj: T, keys: K[]): Pick<T, K>`
- `omit<T>(obj: T, keys: K[]): Omit<T, K>`

### Async Utilities
- `sleep(ms: number): Promise<void>`
- `retry<T>(fn: () => Promise<T>, maxRetries?: number, delay?: number): Promise<T>`

### Error Utilities
- `AppError` - Класс структурированной ошибки
- `getErrorMessage(error: unknown): string`

