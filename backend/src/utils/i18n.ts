/**
 * Internationalization utility for bot messages
 */

export type SupportedLanguage = 'ru' | 'en' | 'uk';

interface Translations {
  [key: string]: {
    ru: string;
    en: string;
    uk: string;
  };
}

const translations: Translations = {
  // Commands
  'command.start': {
    ru: 'Главное меню',
    en: 'Main menu',
    uk: 'Головне меню'
  },
  'command.catalog': {
    ru: 'Каталог товаров',
    en: 'Product catalog',
    uk: 'Каталог товарів'
  },
  'command.orders': {
    ru: 'Мои заказы',
    en: 'My orders',
    uk: 'Мої замовлення'
  },
  'command.help': {
    ru: 'Помощь',
    en: 'Help',
    uk: 'Допомога'
  },

  // Welcome messages
  'welcome.greeting': {
    ru: 'Добро пожаловать',
    en: 'Welcome',
    uk: 'Ласкаво просимо'
  },
  'welcome.select_action': {
    ru: 'Выберите действие:',
    en: 'Select an action:',
    uk: 'Виберіть дію:'
  },

  // Store info
  'store.products_available': {
    ru: 'товаров в наличии',
    en: 'products available',
    uk: 'товарів в наявності'
  },
  'store.orders_completed': {
    ru: 'выполненных заказов',
    en: 'completed orders',
    uk: 'виконаних замовлень'
  },
  'store.currency': {
    ru: 'Валюта',
    en: 'Currency',
    uk: 'Валюта'
  },

  // Buttons
  'button.catalog': {
    ru: '🛒 Каталог товаров',
    en: '🛒 Product Catalog',
    uk: '🛒 Каталог товарів'
  },
  'button.profile': {
    ru: '👤 Профиль',
    en: '👤 Profile',
    uk: '👤 Профіль'
  },
  'button.help': {
    ru: '❓ Помощь и контакты',
    en: '❓ Help & Contacts',
    uk: '❓ Допомога та контакти'
  },
  'button.back': {
    ru: '🔙 Назад',
    en: '🔙 Back',
    uk: '🔙 Назад'
  },
  'button.main_menu': {
    ru: '🏠 Главное меню',
    en: '🏠 Main Menu',
    uk: '🏠 Головне меню'
  },

  // Orders
  'orders.title': {
    ru: 'Мои заказы',
    en: 'My Orders',
    uk: 'Мої замовлення'
  },
  'orders.no_orders': {
    ru: 'У вас пока нет заказов',
    en: 'You have no orders yet',
    uk: 'У вас поки немає замовлень'
  },
  'orders.order_number': {
    ru: 'Заказ',
    en: 'Order',
    uk: 'Замовлення'
  },
  'orders.status': {
    ru: 'Статус',
    en: 'Status',
    uk: 'Статус'
  },

  // Cart
  'cart.title': {
    ru: 'Ваша корзина',
    en: 'Your Cart',
    uk: 'Ваш кошик'
  },
  'cart.empty': {
    ru: 'Корзина пуста',
    en: 'Cart is empty',
    uk: 'Кошик порожній'
  },
  'cart.total': {
    ru: 'Итого',
    en: 'Total',
    uk: 'Разом'
  },
  'cart.quantity': {
    ru: 'Количество',
    en: 'Quantity',
    uk: 'Кількість'
  },

  // Product
  'product.price': {
    ru: 'Цена',
    en: 'Price',
    uk: 'Ціна'
  },
  'product.in_stock': {
    ru: 'В наличии',
    en: 'In stock',
    uk: 'В наявності'
  },
  'product.out_of_stock': {
    ru: 'Нет в наличии',
    en: 'Out of stock',
    uk: 'Немає в наявності'
  },

  // Payment
  'payment.instructions': {
    ru: 'Инструкции по оплате',
    en: 'Payment Instructions',
    uk: 'Інструкції з оплати'
  },
  'payment.requisites': {
    ru: 'Реквизиты для оплаты',
    en: 'Payment Details',
    uk: 'Реквізити для оплати'
  },
  'payment.amount': {
    ru: 'Сумма к оплате',
    en: 'Amount to Pay',
    uk: 'Сума до оплати'
  },

  // Help
  'help.title': {
    ru: 'Помощь и контакты',
    en: 'Help & Contacts',
    uk: 'Допомога та контакти'
  },
  'help.available_commands': {
    ru: 'Доступные команды',
    en: 'Available Commands',
    uk: 'Доступні команди'
  },
  'help.contact_info': {
    ru: 'Контактная информация',
    en: 'Contact Information',
    uk: 'Контактна інформація'
  },
  'help.how_to_order': {
    ru: 'Как сделать заказ',
    en: 'How to Order',
    uk: 'Як зробити замовлення'
  },

  // Errors
  'error.generic': {
    ru: 'Произошла ошибка. Попробуйте позже.',
    en: 'An error occurred. Please try again later.',
    uk: 'Сталася помилка. Спробуйте пізніше.'
  },
  'error.not_found': {
    ru: 'Не найдено',
    en: 'Not found',
    uk: 'Не знайдено'
  },
  'error.unknown_command': {
    ru: 'Неизвестная команда. Используйте /help для просмотра доступных команд.',
    en: 'Unknown command. Use /help to see available commands.',
    uk: 'Невідома команда. Використовуйте /help для перегляду доступних команд.'
  }
};

/**
 * Get translated text
 */
export function t(key: string, language: SupportedLanguage = 'ru'): string {
  const translation = translations[key];
  if (!translation) {
    console.warn(`Translation key not found: ${key}`);
    return key;
  }
  return translation[language] || translation.ru;
}

/**
 * Get multiple translations at once
 */
export function getTranslations(keys: string[], language: SupportedLanguage = 'ru'): { [key: string]: string } {
  const result: { [key: string]: string } = {};
  keys.forEach(key => {
    result[key] = t(key, language);
  });
  return result;
}

/**
 * Check if language is supported
 */
export function isSupportedLanguage(lang: string): lang is SupportedLanguage {
  return ['ru', 'en', 'uk'].includes(lang);
}

export default { t, getTranslations, isSupportedLanguage };

