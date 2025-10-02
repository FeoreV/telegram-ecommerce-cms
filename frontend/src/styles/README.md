# BEM Методология в Telegram E-commerce Platform

## Обзор

Этот проект использует BEM (Block Element Modifier) методологию для организации CSS стилей. BEM обеспечивает четкую, масштабируемую и поддерживаемую структуру стилей.

## Структура BEM

### Блок (Block)
Независимый компонент интерфейса.
```css
.layout { /* Блок */ }
.product { /* Блок */ }
.order { /* Блок */ }
```

### Элемент (Element)
Составная часть блока, которая не может существовать отдельно от него.
```css
.layout__header { /* Элемент header блока layout */ }
.product__title { /* Элемент title блока product */ }
.order__actions { /* Элемент actions блока order */ }
```

### Модификатор (Modifier)
Свойство блока или элемента, которое изменяет их внешний вид или поведение.
```css
.layout--dark { /* Модификатор dark для блока layout */ }
.product--compact { /* Модификатор compact для блока product */ }
.order__status--pending { /* Модификатор pending для элемента status */ }
```

## Структура файлов

```
frontend/src/styles/
├── main.css                     # Главный файл со всеми стилями
├── accessibility.css            # Стили доступности
└── README.md                   # Эта документация

frontend/src/components/
├── Layout.module.css           # Стили для Layout компонента
├── products/
│   └── ProductCard.module.css  # Стили для ProductCard
├── orders/
│   └── OrderCard.module.css    # Стили для OrderCard
├── mobile/
│   └── Mobile.module.css       # Стили для мобильных компонентов
└── ui/
    └── UI.module.css           # Стили для UI компонентов
```

## Конвенции именования

### 1. Блоки
- Используйте kebab-case для названий блоков
- Название должно описывать назначение: `layout`, `product`, `order`

### 2. Элементы
- Разделяются двумя подчеркиваниями: `__`
- camelCase для составных названий: `__userSection`, `__navItem`

### 3. Модификаторы
- Разделяются двумя дефисами: `--`
- camelCase для составных названий: `--isActive`, `--highContrast`

## Примеры использования

### Layout компонент
```css
.layout { /* Основной блок */ }
.layout__header { /* Элемент заголовка */ }
.layout__navItem { /* Элемент навигации */ }
.layout__navItem--active { /* Активное состояние */ }
.layout--dark { /* Темная тема */ }
```

### Product Card компонент
```css
.product { /* Основной блок */ }
.product__title { /* Заголовок товара */ }
.product__price { /* Цена товара */ }
.product__actions { /* Действия с товаром */ }
.product--compact { /* Компактный вид */ }
.product--selected { /* Выбранное состояние */ }
```

### Order Card компонент
```css
.order { /* Основной блок */ }
.order__customer { /* Информация о клиенте */ }
.order__status { /* Статус заказа */ }
.order__actions { /* Действия с заказом */ }
.order--pending { /* Ожидающий заказ */ }
.order--compact { /* Компактный вид */ }
```

## Утилитарные классы

Проект также включает утилитарные классы с префиксом `u-`:

```css
/* Отображение */
.u-display--flex { display: flex !important; }
.u-display--none { display: none !important; }

/* Позиционирование */
.u-justify--center { justify-content: center; }
.u-align--center { align-items: center; }

/* Отступы */
.u-margin--md { margin: var(--spacing-md); }
.u-padding--lg { padding: var(--spacing-lg); }

/* Текст */
.u-text--center { text-align: center; }
.u-text--bold { font-weight: var(--font-weight-bold); }
```

## CSS переменные

Все цвета, размеры и другие дизайн-токены определены как CSS переменные:

```css
:root {
  /* Цвета */
  --color-primary: #0088cc;
  --color-bg: #ffffff;
  --color-text: #333333;
  
  /* Отступы */
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  
  /* Тени */
  --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  /* Переходы */
  --transition-normal: 0.3s ease;
}
```

## Темная тема

Поддержка темной темы реализована через CSS классы:

```css
.theme--dark .layout {
  background-color: var(--color-bg-dark);
}

.theme--dark .product__title {
  color: var(--color-text-light);
}
```

## Адаптивность

Responsive утилиты для разных размеров экрана:

```css
@media (max-width: 768px) {
  .u-md-display--none { display: none !important; }
  .u-md-flex--column { flex-direction: column; }
}
```

## Доступность

Специальные классы для улучшения доступности:

```css
.accessibility--high-contrast { /* Высокая контрастность */ }
.accessibility--reduced-motion { /* Уменьшенная анимация */ }
.accessibility__sr-only { /* Только для скрин-ридеров */ }
.accessibility__skip-link { /* Ссылки для пропуска */ }
```

## Рекомендации

### 1. Избегайте вложенности
```css
/* Хорошо */
.product { }
.product__title { }
.product__title--large { }

/* Плохо */
.product .title.large { }
```

### 2. Используйте семантические названия
```css
/* Хорошо */
.product--featured { }
.button--primary { }

/* Плохо */
.product--red { }
.button--big { }
```

### 3. Группируйте связанные стили
```css
/* Блок */
.product { }

/* Элементы */
.product__title { }
.product__price { }
.product__actions { }

/* Модификаторы */
.product--compact { }
.product--featured { }
```

### 4. Используйте CSS переменные
```css
.product {
  color: var(--color-text);
  background-color: var(--color-bg);
  padding: var(--spacing-md);
}
```

## Инструменты

- **CSS Modules**: Локальная область видимости стилей
- **PostCSS**: Обработка CSS с плагинами
- **Autoprefixer**: Автоматические вендорные префиксы

## Миграция

При добавлении новых компонентов:

1. Создайте `.module.css` файл рядом с компонентом
2. Используйте BEM конвенции именования
3. Импортируйте стили как `styles` объект
4. Применяйте классы через `className={styles.blockName}`

```tsx
import styles from './MyComponent.module.css'

const MyComponent = () => (
  <div className={styles.myBlock}>
    <h1 className={styles.myBlock__title}>Title</h1>
    <p className={`${styles.myBlock__text} ${styles['myBlock__text--large']}`}>
      Text
    </p>
  </div>
)
```
