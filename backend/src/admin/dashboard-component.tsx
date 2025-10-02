import React, { useEffect } from 'react';
import ThemeSwitcher from './theme-switcher';

const Box: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>;
const H1: React.FC<any> = ({ children, ...props }) => <h1 {...props}>{children}</h1>;
const H2: React.FC<any> = ({ children, ...props }) => <h2 {...props}>{children}</h2>;
const Text: React.FC<any> = ({ children, ...props }) => <p {...props}>{children}</p>;
const Section: React.FC<any> = ({ children, ...props }) => <section {...props}>{children}</section>;
const Badge: React.FC<any> = ({ children, ...props }) => <span className={`badge ${props.variant || ''}`} {...props}>{children}</span>;

const DashboardComponent: React.FC = () => {
  // Добавляем CSS стили для темной темы при монтировании компонента
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'admin-dark-theme-styles';
    style.textContent = `
      /* Темная тема для AdminJS */
      .theme--dark .app-sidebar {
        background-color: var(--color-sidebar-bg) !important;
        color: var(--color-sidebar-text) !important;
      }
      
      .theme--dark .app-sidebar .sidebar-nav .nav-item .nav-link {
        color: var(--color-sidebar-text) !important;
      }
      
      .theme--dark .app-sidebar .sidebar-nav .nav-item .nav-link:hover {
        background-color: rgba(255, 255, 255, 0.1) !important;
      }
      
      .theme--dark .navbar {
        background-color: var(--color-bg-secondary) !important;
        border-bottom: 1px solid var(--color-border) !important;
      }
      
      .theme--dark .navbar .navbar-brand,
      .theme--dark .navbar .nav-link {
        color: var(--color-text) !important;
      }
      
      .theme--dark .main {
        background-color: var(--color-bg) !important;
      }
      
      .theme--dark .card,
      .theme--dark .modal-content,
      .theme--dark .dropdown-menu {
        background-color: var(--color-bg-secondary) !important;
        border-color: var(--color-border) !important;
        color: var(--color-text) !important;
      }
      
      .theme--dark .form-control,
      .theme--dark .form-select {
        background-color: var(--color-bg) !important;
        border-color: var(--color-border) !important;
        color: var(--color-text) !important;
      }
      
      .theme--dark .form-control:focus,
      .theme--dark .form-select:focus {
        background-color: var(--color-bg) !important;
        border-color: var(--color-primary) !important;
        color: var(--color-text) !important;
        box-shadow: 0 0 0 0.2rem rgba(0, 136, 204, 0.25) !important;
      }
      
      .theme--dark .table {
        color: var(--color-text) !important;
      }
      
      .theme--dark .table td,
      .theme--dark .table th {
        border-color: var(--color-border) !important;
      }
      
      .theme--dark .table-striped tbody tr:nth-of-type(odd) {
        background-color: rgba(255, 255, 255, 0.05) !important;
      }
      
      .theme--dark .btn-secondary {
        background-color: #404040 !important;
        border-color: #404040 !important;
        color: var(--color-text) !important;
      }
      
      .theme--dark .btn-secondary:hover {
        background-color: #505050 !important;
        border-color: #505050 !important;
      }
      
      .theme--dark .text-muted {
        color: var(--color-text-secondary) !important;
      }
      
      .theme--dark .bg-light {
        background-color: var(--color-bg-secondary) !important;
      }
      
      .theme--dark .border {
        border-color: var(--color-border) !important;
      }
      
      /* Кастомные стили для дашборда */
      .theme--dark .badge.primary {
        background-color: var(--color-primary) !important;
        color: white !important;
      }
      
      .theme--dark .badge.success {
        background-color: #28a745 !important;
        color: white !important;
      }
      
      .theme--dark .badge.info {
        background-color: #17a2b8 !important;
        color: white !important;
      }
    `;
    
    if (!document.getElementById('admin-dark-theme-styles')) {
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById('admin-dark-theme-styles');
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  return (
    <>
      <ThemeSwitcher />
      <Box p="xxl">
        <H1>Telegram E-commerce Dashboard</H1>
      <Text mb="xl">Добро пожаловать в админ-панель Telegram магазинов!</Text>
      
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gridGap="lg">
        <Section>
          <H2 mb="lg">📊 Быстрый старт</H2>
          <Text mb="default" style={{ color: 'var(--color-text, #333333)' }}>
            Начните с создания:
          </Text>
          <ul style={{ 
            marginLeft: '20px', 
            color: 'var(--color-text, #333333)' 
          }}>
            <li>Категории товаров</li>
            <li>Магазины</li>
            <li>Товары</li>
          </ul>
        </Section>
        
        <Section>
          <H2 mb="lg">🤖 Telegram Bot</H2>
          <Text mb="default">
            Ваш бот доступен в Telegram для покупателей. 
            Заказы будут появляться в разделе "Orders" для подтверждения оплаты.
          </Text>
        </Section>
        
        <Section>
          <H2 mb="lg">⚡ Основные функции</H2>
          <Box mb="default">
            <Badge variant="primary" mr="sm">Управление товарами</Badge>
            <Badge variant="success" mr="sm">Подтверждение платежей</Badge>
            <Badge variant="info" mr="sm">Логи действий</Badge>
          </Box>
          <Text>
            Все изменения автоматически синхронизируются с Telegram ботом.
          </Text>
        </Section>
        
        <Section>
          <H2 mb="lg">🔧 Настройки</H2>
          <Text mb="default" style={{ color: 'var(--color-text, #333333)' }}>
            Рекомендуемые настройки:
          </Text>
          <ul style={{ 
            marginLeft: '20px', 
            color: 'var(--color-text, #333333)' 
          }}>
            <li>Настройте контактную информацию магазинов</li>
            <li>Добавьте описания товаров</li>
            <li>Настройте валюту</li>
          </ul>
        </Section>
      </Box>
      
      <Box mt="xxl">
        <H2>📋 Процесс заказа</H2>
        <Text>
          1. Покупатель оформляет заказ в Telegram боте<br/>
          2. Заказ появляется со статусом "Pending Admin Confirmation"<br/>
          3. Вы подтверждаете оплату в разделе Orders<br/>
          4. Покупатель получает уведомление о подтверждении
        </Text>
      </Box>
    </Box>
    </>
  );
};

export default DashboardComponent;
