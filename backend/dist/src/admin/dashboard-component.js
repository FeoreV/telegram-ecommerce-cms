"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const theme_switcher_1 = __importDefault(require("./theme-switcher"));
const Box = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("div", { ...props, children: children });
const H1 = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("h1", { ...props, children: children });
const H2 = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("h2", { ...props, children: children });
const Text = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("p", { ...props, children: children });
const Section = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("section", { ...props, children: children });
const Badge = ({ children, ...props }) => (0, jsx_runtime_1.jsx)("span", { className: `badge ${props.variant || ''}`, ...props, children: children });
const DashboardComponent = () => {
    (0, react_1.useEffect)(() => {
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
    return ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)(theme_switcher_1.default, {}), (0, jsx_runtime_1.jsxs)(Box, { p: "xxl", children: [(0, jsx_runtime_1.jsx)(H1, { children: "Telegram E-commerce Dashboard" }), (0, jsx_runtime_1.jsx)(Text, { mb: "xl", children: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 \u0430\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C Telegram \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u0432!" }), (0, jsx_runtime_1.jsxs)(Box, { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gridGap: "lg", children: [(0, jsx_runtime_1.jsxs)(Section, { children: [(0, jsx_runtime_1.jsx)(H2, { mb: "lg", children: "\uD83D\uDCCA \u0411\u044B\u0441\u0442\u0440\u044B\u0439 \u0441\u0442\u0430\u0440\u0442" }), (0, jsx_runtime_1.jsx)(Text, { mb: "default", style: { color: 'var(--color-text, #333333)' }, children: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0441 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F:" }), (0, jsx_runtime_1.jsxs)("ul", { style: {
                                            marginLeft: '20px',
                                            color: 'var(--color-text, #333333)'
                                        }, children: [(0, jsx_runtime_1.jsx)("li", { children: "\u041A\u0430\u0442\u0435\u0433\u043E\u0440\u0438\u0438 \u0442\u043E\u0432\u0430\u0440\u043E\u0432" }), (0, jsx_runtime_1.jsx)("li", { children: "\u041C\u0430\u0433\u0430\u0437\u0438\u043D\u044B" }), (0, jsx_runtime_1.jsx)("li", { children: "\u0422\u043E\u0432\u0430\u0440\u044B" })] })] }), (0, jsx_runtime_1.jsxs)(Section, { children: [(0, jsx_runtime_1.jsx)(H2, { mb: "lg", children: "\uD83E\uDD16 Telegram Bot" }), (0, jsx_runtime_1.jsx)(Text, { mb: "default", children: "\u0412\u0430\u0448 \u0431\u043E\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D \u0432 Telegram \u0434\u043B\u044F \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u0435\u0439. \u0417\u0430\u043A\u0430\u0437\u044B \u0431\u0443\u0434\u0443\u0442 \u043F\u043E\u044F\u0432\u043B\u044F\u0442\u044C\u0441\u044F \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 \"Orders\" \u0434\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u043E\u043F\u043B\u0430\u0442\u044B." })] }), (0, jsx_runtime_1.jsxs)(Section, { children: [(0, jsx_runtime_1.jsx)(H2, { mb: "lg", children: "\u26A1 \u041E\u0441\u043D\u043E\u0432\u043D\u044B\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438" }), (0, jsx_runtime_1.jsxs)(Box, { mb: "default", children: [(0, jsx_runtime_1.jsx)(Badge, { variant: "primary", mr: "sm", children: "\u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430\u043C\u0438" }), (0, jsx_runtime_1.jsx)(Badge, { variant: "success", mr: "sm", children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0435 \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439" }), (0, jsx_runtime_1.jsx)(Badge, { variant: "info", mr: "sm", children: "\u041B\u043E\u0433\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0439" })] }), (0, jsx_runtime_1.jsx)(Text, { children: "\u0412\u0441\u0435 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u0443\u044E\u0442\u0441\u044F \u0441 Telegram \u0431\u043E\u0442\u043E\u043C." })] }), (0, jsx_runtime_1.jsxs)(Section, { children: [(0, jsx_runtime_1.jsx)(H2, { mb: "lg", children: "\uD83D\uDD27 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438" }), (0, jsx_runtime_1.jsx)(Text, { mb: "default", style: { color: 'var(--color-text, #333333)' }, children: "\u0420\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u043C\u044B\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438:" }), (0, jsx_runtime_1.jsxs)("ul", { style: {
                                            marginLeft: '20px',
                                            color: 'var(--color-text, #333333)'
                                        }, children: [(0, jsx_runtime_1.jsx)("li", { children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u043A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u0443\u044E \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u0432" }), (0, jsx_runtime_1.jsx)("li", { children: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u0442\u043E\u0432\u0430\u0440\u043E\u0432" }), (0, jsx_runtime_1.jsx)("li", { children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u0442\u0435 \u0432\u0430\u043B\u044E\u0442\u0443" })] })] })] }), (0, jsx_runtime_1.jsxs)(Box, { mt: "xxl", children: [(0, jsx_runtime_1.jsx)(H2, { children: "\uD83D\uDCCB \u041F\u0440\u043E\u0446\u0435\u0441\u0441 \u0437\u0430\u043A\u0430\u0437\u0430" }), (0, jsx_runtime_1.jsxs)(Text, { children: ["1. \u041F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C \u043E\u0444\u043E\u0440\u043C\u043B\u044F\u0435\u0442 \u0437\u0430\u043A\u0430\u0437 \u0432 Telegram \u0431\u043E\u0442\u0435", (0, jsx_runtime_1.jsx)("br", {}), "2. \u0417\u0430\u043A\u0430\u0437 \u043F\u043E\u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C \"Pending Admin Confirmation\"", (0, jsx_runtime_1.jsx)("br", {}), "3. \u0412\u044B \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442\u0435 \u043E\u043F\u043B\u0430\u0442\u0443 \u0432 \u0440\u0430\u0437\u0434\u0435\u043B\u0435 Orders", (0, jsx_runtime_1.jsx)("br", {}), "4. \u041F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C \u043F\u043E\u043B\u0443\u0447\u0430\u0435\u0442 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u043E \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u0438"] })] })] })] }));
};
exports.default = DashboardComponent;
//# sourceMappingURL=dashboard-component.js.map