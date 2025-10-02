"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const EmployeeManagement = () => {
    const [employees, setEmployees] = (0, react_1.useState)([]);
    const [stores, setStores] = (0, react_1.useState)([]);
    const [selectedStore, setSelectedStore] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [showInviteForm, setShowInviteForm] = (0, react_1.useState)(false);
    const [inviteForm, setInviteForm] = (0, react_1.useState)({
        email: '',
        firstName: '',
        lastName: '',
        role: 'VENDOR',
        storeId: '',
        permissions: [],
        message: ''
    });
    const availablePermissions = [
        { value: 'PRODUCT_CREATE', label: 'Создание товаров' },
        { value: 'PRODUCT_UPDATE', label: 'Редактирование товаров' },
        { value: 'PRODUCT_DELETE', label: 'Удаление товаров' },
        { value: 'ORDER_VIEW', label: 'Просмотр заказов' },
        { value: 'ORDER_UPDATE', label: 'Обновление заказов' },
        { value: 'INVENTORY_VIEW', label: 'Просмотр склада' },
        { value: 'INVENTORY_UPDATE', label: 'Управление складом' },
        { value: 'ANALYTICS_VIEW', label: 'Просмотр аналитики' }
    ];
    (0, react_1.useEffect)(() => {
        fetchStores();
    }, []);
    (0, react_1.useEffect)(() => {
        if (selectedStore) {
            fetchEmployees(selectedStore);
        }
    }, [selectedStore]);
    const fetchStores = async () => {
        try {
            const response = await fetch('/api/stores/user');
            const data = await response.json();
            setStores(data.stores || []);
            if (data.stores?.length > 0) {
                setSelectedStore(data.stores[0].id);
            }
        }
        catch (error) {
            console.error('Error fetching stores:', error);
        }
    };
    const fetchEmployees = async (storeId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/employees/stores/${storeId}`);
            const data = await response.json();
            setEmployees(data.employees || []);
        }
        catch (error) {
            console.error('Error fetching employees:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const handleInviteSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/employees/invite', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...inviteForm,
                    storeId: selectedStore,
                    role: inviteForm.customRoleId ? undefined : inviteForm.role,
                    customRoleId: inviteForm.customRoleId || undefined
                })
            });
            if (response.ok) {
                alert('Приглашение отправлено!');
                setShowInviteForm(false);
                setInviteForm({
                    email: '',
                    firstName: '',
                    lastName: '',
                    role: 'VENDOR',
                    storeId: '',
                    permissions: [],
                    message: ''
                });
                if (selectedStore) {
                    fetchEmployees(selectedStore);
                }
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error sending invitation:', error);
            alert('Произошла ошибка при отправке приглашения');
        }
    };
    const handleRemoveEmployee = async (employeeId) => {
        if (!confirm('Вы уверены, что хотите удалить этого сотрудника?')) {
            return;
        }
        try {
            const response = await fetch(`/api/employees/stores/${selectedStore}/users/${employeeId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    reason: 'Удалено администратором'
                })
            });
            if (response.ok) {
                alert('Сотрудник удален');
                if (selectedStore) {
                    fetchEmployees(selectedStore);
                }
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error removing employee:', error);
            alert('Произошла ошибка при удалении сотрудника');
        }
    };
    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    const getRoleName = (role) => {
        return role === 'ADMIN' ? 'Администратор' : 'Продавец';
    };
    const getStatusColor = (isActive) => {
        return isActive ? '#28a745' : '#dc3545';
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: '20px', fontFamily: 'Arial, sans-serif' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: 'var(--color-text, #333)' }, children: "\uD83D\uDC65 \u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430\u043C\u0438" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setShowInviteForm(true), style: {
                            backgroundColor: 'var(--color-primary, #007bff)',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }, children: "\u2795 \u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438\u0442\u044C \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430" })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D:" }), (0, jsx_runtime_1.jsxs)("select", { value: selectedStore, onChange: (e) => setSelectedStore(e.target.value), style: {
                            padding: '8px 12px',
                            borderRadius: '4px',
                            border: '1px solid var(--color-border, #ddd)',
                            backgroundColor: 'var(--color-bg, #fff)',
                            color: 'var(--color-text, #333)',
                            fontSize: '14px'
                        }, children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D" }), stores.map(store => ((0, jsx_runtime_1.jsx)("option", { value: store.id, children: store.name }, store.id)))] })] }), loading ? ((0, jsx_runtime_1.jsx)("div", { style: { textAlign: 'center', padding: '40px' }, children: (0, jsx_runtime_1.jsx)("div", { children: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..." }) })) : selectedStore ? ((0, jsx_runtime_1.jsx)("div", { style: {
                    backgroundColor: 'var(--color-bg-secondary, #f8f9fa)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border, #dee2e6)'
                }, children: employees.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { padding: '40px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)("div", { style: { color: 'var(--color-text-secondary, #666)' }, children: "\u0412 \u044D\u0442\u043E\u043C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432" }) })) : ((0, jsx_runtime_1.jsxs)("table", { style: { width: '100%', borderCollapse: 'collapse' }, children: [(0, jsx_runtime_1.jsx)("thead", { children: (0, jsx_runtime_1.jsxs)("tr", { style: { backgroundColor: 'var(--color-bg, #fff)' }, children: [(0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u0420\u043E\u043B\u044C" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u0421\u0442\u0430\u0442\u0443\u0441" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0432\u0445\u043E\u0434" }), (0, jsx_runtime_1.jsx)("th", { style: { padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: "\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: employees.map(employee => ((0, jsx_runtime_1.jsxs)("tr", { style: { borderBottom: '1px solid var(--color-border, #dee2e6)' }, children: [(0, jsx_runtime_1.jsx)("td", { style: { padding: '12px' }, children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '10px' }, children: [(0, jsx_runtime_1.jsx)("div", { style: {
                                                        width: '40px',
                                                        height: '40px',
                                                        borderRadius: '50%',
                                                        backgroundColor: 'var(--color-primary, #007bff)',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '14px',
                                                        fontWeight: 'bold'
                                                    }, children: employee.user.firstName?.[0]?.toUpperCase() || '?' }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { style: { fontWeight: 'bold', color: 'var(--color-text, #333)' }, children: [employee.user.firstName, " ", employee.user.lastName] }), employee.user.email && ((0, jsx_runtime_1.jsx)("div", { style: { fontSize: '12px', color: 'var(--color-text-secondary, #666)' }, children: employee.user.email }))] })] }) }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '12px', color: 'var(--color-text, #333)' }, children: (0, jsx_runtime_1.jsx)("span", { style: {
                                                padding: '4px 8px',
                                                borderRadius: '12px',
                                                backgroundColor: employee.role === 'ADMIN' ? '#e3f2fd' : '#f3e5f5',
                                                color: employee.role === 'ADMIN' ? '#1976d2' : '#7b1fa2',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }, children: getRoleName(employee.role) }) }), (0, jsx_runtime_1.jsxs)("td", { style: { padding: '12px' }, children: [(0, jsx_runtime_1.jsx)("span", { style: {
                                                    display: 'inline-block',
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: getStatusColor(employee.isActive),
                                                    marginRight: '8px'
                                                } }), employee.isActive ? 'Активен' : 'Неактивен'] }), (0, jsx_runtime_1.jsxs)("td", { style: { padding: '12px', color: 'var(--color-text, #333)' }, children: [formatDate(employee.assignedAt), employee.assignedBy && ((0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '12px', color: 'var(--color-text-secondary, #666)' }, children: ["\u043E\u0442 ", employee.assignedBy.firstName, " ", employee.assignedBy.lastName] }))] }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '12px', color: 'var(--color-text, #333)' }, children: employee.user.lastLoginAt
                                            ? formatDate(employee.user.lastLoginAt)
                                            : 'Никогда' }), (0, jsx_runtime_1.jsx)("td", { style: { padding: '12px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)("button", { onClick: () => handleRemoveEmployee(employee.user.id), style: {
                                                backgroundColor: '#dc3545',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }, children: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C" }) })] }, employee.id))) })] })) })) : ((0, jsx_runtime_1.jsx)("div", { style: {
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--color-text-secondary, #666)'
                }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432" })), showInviteForm && ((0, jsx_runtime_1.jsx)("div", { style: {
                    position: 'fixed',
                    top: '0',
                    left: '0',
                    right: '0',
                    bottom: '0',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }, children: (0, jsx_runtime_1.jsxs)("div", { style: {
                        backgroundColor: 'var(--color-bg, #fff)',
                        padding: '30px',
                        borderRadius: '8px',
                        width: '500px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }, children: [(0, jsx_runtime_1.jsx)("h2", { style: { marginTop: 0, color: 'var(--color-text, #333)' }, children: "\u041F\u0440\u0438\u0433\u043B\u0430\u0441\u0438\u0442\u044C \u043D\u043E\u0432\u043E\u0433\u043E \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0430" }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleInviteSubmit, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "Email *" }), (0, jsx_runtime_1.jsx)("input", { type: "email", required: true, value: inviteForm.email, onChange: (e) => setInviteForm({ ...inviteForm, email: e.target.value }), style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '10px', marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0418\u043C\u044F *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", required: true, value: inviteForm.firstName, onChange: (e) => setInviteForm({ ...inviteForm, firstName: e.target.value }), style: {
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--color-border, #ddd)',
                                                        backgroundColor: 'var(--color-bg, #fff)',
                                                        color: 'var(--color-text, #333)'
                                                    } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0424\u0430\u043C\u0438\u043B\u0438\u044F *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", required: true, value: inviteForm.lastName, onChange: (e) => setInviteForm({ ...inviteForm, lastName: e.target.value }), style: {
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--color-border, #ddd)',
                                                        backgroundColor: 'var(--color-bg, #fff)',
                                                        color: 'var(--color-text, #333)'
                                                    } })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0420\u043E\u043B\u044C *" }), (0, jsx_runtime_1.jsxs)("select", { value: inviteForm.role, onChange: (e) => setInviteForm({ ...inviteForm, role: e.target.value }), style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            }, children: [(0, jsx_runtime_1.jsx)("option", { value: "VENDOR", children: "\u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446" }), (0, jsx_runtime_1.jsx)("option", { value: "ADMIN", children: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440" })] })] }), inviteForm.role === 'VENDOR' && ((0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '10px', color: 'var(--color-text, #333)' }, children: "\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u044F \u0434\u043B\u044F \u043F\u0440\u043E\u0434\u0430\u0432\u0446\u0430:" }), (0, jsx_runtime_1.jsx)("div", { style: {
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                                gap: '8px'
                                            }, children: availablePermissions.map(permission => ((0, jsx_runtime_1.jsxs)("label", { style: {
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '8px',
                                                    fontSize: '14px',
                                                    color: 'var(--color-text, #333)'
                                                }, children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: inviteForm.permissions.includes(permission.value), onChange: (e) => {
                                                            if (e.target.checked) {
                                                                setInviteForm({
                                                                    ...inviteForm,
                                                                    permissions: [...inviteForm.permissions, permission.value]
                                                                });
                                                            }
                                                            else {
                                                                setInviteForm({
                                                                    ...inviteForm,
                                                                    permissions: inviteForm.permissions.filter(p => p !== permission.value)
                                                                });
                                                            }
                                                        } }), permission.label] }, permission.value))) })] })), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }), (0, jsx_runtime_1.jsx)("textarea", { value: inviteForm.message, onChange: (e) => setInviteForm({ ...inviteForm, message: e.target.value }), rows: 3, placeholder: "\u0414\u043E\u0431\u0440\u043E \u043F\u043E\u0436\u0430\u043B\u043E\u0432\u0430\u0442\u044C \u0432 \u043D\u0430\u0448\u0443 \u043A\u043E\u043C\u0430\u043D\u0434\u0443!", style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)',
                                                resize: 'vertical'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setShowInviteForm(false), style: {
                                                padding: '10px 20px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)',
                                                cursor: 'pointer'
                                            }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), (0, jsx_runtime_1.jsx)("button", { type: "submit", style: {
                                                padding: '10px 20px',
                                                borderRadius: '4px',
                                                border: 'none',
                                                backgroundColor: 'var(--color-primary, #007bff)',
                                                color: 'white',
                                                cursor: 'pointer'
                                            }, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435" })] })] })] }) }))] }));
};
exports.default = EmployeeManagement;
//# sourceMappingURL=employee-management.js.map