"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const InviteLinksManagement = () => {
    const [inviteLinks, setInviteLinks] = (0, react_1.useState)([]);
    const [stores, setStores] = (0, react_1.useState)([]);
    const [customRoles, setCustomRoles] = (0, react_1.useState)([]);
    const [selectedStore, setSelectedStore] = (0, react_1.useState)('');
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [showCreateForm, setShowCreateForm] = (0, react_1.useState)(false);
    const [createForm, setCreateForm] = (0, react_1.useState)({
        storeId: '',
        role: 'VENDOR',
        maxUses: 1,
        description: ''
    });
    (0, react_1.useEffect)(() => {
        fetchStores();
    }, []);
    (0, react_1.useEffect)(() => {
        if (selectedStore) {
            fetchInviteLinks();
            fetchCustomRoles();
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
    const fetchInviteLinks = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/invite-links?storeId=${selectedStore}&isActive=true`);
            const data = await response.json();
            setInviteLinks(data.inviteLinks || []);
        }
        catch (error) {
            console.error('Error fetching invite links:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchCustomRoles = async () => {
        try {
            const response = await fetch(`/api/custom-roles?storeId=${selectedStore}`);
            const data = await response.json();
            setCustomRoles(data.customRoles || []);
        }
        catch (error) {
            console.error('Error fetching custom roles:', error);
        }
    };
    const handleCreateInviteLink = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/invite-links', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...createForm,
                    storeId: selectedStore,
                    expiresAt: createForm.expiresAt || undefined
                })
            });
            if (response.ok) {
                alert('Инвайт ссылка создана!');
                setShowCreateForm(false);
                setCreateForm({
                    storeId: '',
                    role: 'VENDOR',
                    maxUses: 1,
                    description: ''
                });
                fetchInviteLinks();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error creating invite link:', error);
            alert('Произошла ошибка при создании ссылки');
        }
    };
    const handleToggleActive = async (linkId, isActive) => {
        try {
            const response = await fetch(`/api/invite-links/${linkId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: linkId, isActive: !isActive })
            });
            if (response.ok) {
                fetchInviteLinks();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error updating invite link:', error);
        }
    };
    const handleDeleteLink = async (linkId) => {
        if (!confirm('Вы уверены, что хотите удалить эту ссылку?')) {
            return;
        }
        try {
            const response = await fetch(`/api/invite-links/${linkId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('Ссылка удалена');
                fetchInviteLinks();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error deleting invite link:', error);
            alert('Произошла ошибка при удалении ссылки');
        }
    };
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Ссылка скопирована в буфер обмена!');
        });
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
    const getRoleDisplay = (link) => {
        if (link.customRole) {
            return ((0, jsx_runtime_1.jsxs)("span", { style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: link.customRole.color + '20',
                    color: link.customRole.color,
                    fontSize: '12px',
                    fontWeight: 'bold'
                }, children: [link.customRole.icon && (0, jsx_runtime_1.jsx)("span", { children: link.customRole.icon }), link.customRole.name] }));
        }
        return ((0, jsx_runtime_1.jsx)("span", { style: {
                padding: '4px 8px',
                borderRadius: '12px',
                backgroundColor: link.role === 'ADMIN' ? '#e3f2fd' : '#f3e5f5',
                color: link.role === 'ADMIN' ? '#1976d2' : '#7b1fa2',
                fontSize: '12px',
                fontWeight: 'bold'
            }, children: link.role === 'ADMIN' ? '👑 Администратор' : '🛍️ Продавец' }));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: '20px', fontFamily: 'Arial, sans-serif' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: 'var(--color-text, #333)' }, children: "\uD83D\uDD17 \u0418\u043D\u0432\u0430\u0439\u0442 \u0441\u0441\u044B\u043B\u043A\u0438" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setShowCreateForm(true), style: {
                            backgroundColor: 'var(--color-primary, #007bff)',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }, children: "\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443" })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D:" }), (0, jsx_runtime_1.jsxs)("select", { value: selectedStore, onChange: (e) => setSelectedStore(e.target.value), style: {
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
                }, children: inviteLinks.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { padding: '40px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)("div", { style: { color: 'var(--color-text-secondary, #666)' }, children: "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0438\u043D\u0432\u0430\u0439\u0442 \u0441\u0441\u044B\u043B\u043E\u043A" }) })) : ((0, jsx_runtime_1.jsx)("div", { style: { padding: '20px' }, children: inviteLinks.map(link => ((0, jsx_runtime_1.jsxs)("div", { style: {
                            backgroundColor: 'var(--color-bg, #fff)',
                            border: '1px solid var(--color-border, #dee2e6)',
                            borderRadius: '8px',
                            padding: '20px',
                            marginBottom: '16px'
                        }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }, children: [getRoleDisplay(link), (0, jsx_runtime_1.jsx)("span", { style: {
                                                            padding: '2px 6px',
                                                            borderRadius: '8px',
                                                            backgroundColor: link.isActive ? '#d4edda' : '#f8d7da',
                                                            color: link.isActive ? '#155724' : '#721c24',
                                                            fontSize: '11px',
                                                            fontWeight: 'bold'
                                                        }, children: link.isActive ? 'Активна' : 'Неактивна' }), link.isExpired && ((0, jsx_runtime_1.jsx)("span", { style: {
                                                            padding: '2px 6px',
                                                            borderRadius: '8px',
                                                            backgroundColor: '#fff3cd',
                                                            color: '#856404',
                                                            fontSize: '11px',
                                                            fontWeight: 'bold'
                                                        }, children: "\u0418\u0441\u0442\u0435\u043A\u043B\u0430" }))] }), link.description && ((0, jsx_runtime_1.jsx)("div", { style: { color: 'var(--color-text, #333)', marginBottom: '8px' }, children: link.description })), (0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '12px', color: 'var(--color-text-secondary, #666)' }, children: ["\u0421\u043E\u0437\u0434\u0430\u043D\u0430 ", formatDate(link.createdAt), " \u2022 ", link.creator.firstName, " ", link.creator.lastName] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '8px' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => copyToClipboard(link.url), style: {
                                                    backgroundColor: '#17a2b8',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }, children: "\uD83D\uDCCB \u041A\u043E\u043F\u0438\u0440\u043E\u0432\u0430\u0442\u044C" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => handleToggleActive(link.id, link.isActive), style: {
                                                    backgroundColor: link.isActive ? '#ffc107' : '#28a745',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }, children: link.isActive ? 'Деактивировать' : 'Активировать' }), (0, jsx_runtime_1.jsx)("button", { onClick: () => handleDeleteLink(link.id), style: {
                                                    backgroundColor: '#dc3545',
                                                    color: 'white',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    fontSize: '12px'
                                                }, children: "\uD83D\uDDD1\uFE0F \u0423\u0434\u0430\u043B\u0438\u0442\u044C" })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: {
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    backgroundColor: 'var(--color-bg-secondary, #f8f9fa)',
                                    padding: '12px',
                                    borderRadius: '4px',
                                    fontSize: '12px'
                                }, children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u0418\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u043E:" }), " ", link.usageStats.used, " \u0438\u0437 ", link.usageStats.max, link.expiresAt && ((0, jsx_runtime_1.jsxs)("span", { style: { marginLeft: '16px' }, children: [(0, jsx_runtime_1.jsx)("strong", { children: "\u0418\u0441\u0442\u0435\u043A\u0430\u0435\u0442:" }), " ", formatDate(link.expiresAt)] }))] }), (0, jsx_runtime_1.jsx)("div", { style: {
                                            width: '100px',
                                            height: '8px',
                                            backgroundColor: '#e9ecef',
                                            borderRadius: '4px',
                                            overflow: 'hidden'
                                        }, children: (0, jsx_runtime_1.jsx)("div", { style: {
                                                width: `${(link.usageStats.used / link.usageStats.max) * 100}%`,
                                                height: '100%',
                                                backgroundColor: link.usageStats.used >= link.usageStats.max ? '#dc3545' : '#28a745',
                                                transition: 'width 0.3s ease'
                                            } }) })] })] }, link.id))) })) })) : ((0, jsx_runtime_1.jsx)("div", { style: {
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--color-text-secondary, #666)'
                }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u0438\u043D\u0432\u0430\u0439\u0442 \u0441\u0441\u044B\u043B\u043E\u043A" })), showCreateForm && ((0, jsx_runtime_1.jsx)("div", { style: {
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
                    }, children: [(0, jsx_runtime_1.jsx)("h2", { style: { marginTop: 0, color: 'var(--color-text, #333)' }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438\u043D\u0432\u0430\u0439\u0442 \u0441\u0441\u044B\u043B\u043A\u0443" }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleCreateInviteLink, children: [(0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0422\u0438\u043F \u0440\u043E\u043B\u0438 *" }), (0, jsx_runtime_1.jsxs)("select", { value: createForm.customRoleId ? 'custom' : createForm.role, onChange: (e) => {
                                                if (e.target.value === 'custom') {
                                                    setCreateForm({ ...createForm, role: undefined, customRoleId: customRoles[0]?.id || '' });
                                                }
                                                else {
                                                    setCreateForm({ ...createForm, role: e.target.value, customRoleId: undefined });
                                                }
                                            }, style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            }, children: [(0, jsx_runtime_1.jsx)("option", { value: "VENDOR", children: "\u041F\u0440\u043E\u0434\u0430\u0432\u0435\u0446" }), (0, jsx_runtime_1.jsx)("option", { value: "ADMIN", children: "\u0410\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440" }), customRoles.length > 0 && (0, jsx_runtime_1.jsx)("option", { value: "custom", children: "\u041A\u0430\u0441\u0442\u043E\u043C\u043D\u0430\u044F \u0440\u043E\u043B\u044C" })] })] }), createForm.customRoleId !== undefined && ((0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u041A\u0430\u0441\u0442\u043E\u043C\u043D\u0430\u044F \u0440\u043E\u043B\u044C *" }), (0, jsx_runtime_1.jsx)("select", { value: createForm.customRoleId, onChange: (e) => setCreateForm({ ...createForm, customRoleId: e.target.value }), style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            }, children: customRoles.map(role => ((0, jsx_runtime_1.jsxs)("option", { value: role.id, children: [role.icon, " ", role.name] }, role.id))) })] })), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u041C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0439 *" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: "1", max: "1000", value: createForm.maxUses, onChange: (e) => setCreateForm({ ...createForm, maxUses: Number(e.target.value) }), style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0421\u0440\u043E\u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }), (0, jsx_runtime_1.jsx)("input", { type: "datetime-local", value: createForm.expiresAt, onChange: (e) => setCreateForm({ ...createForm, expiresAt: e.target.value }), style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)" }), (0, jsx_runtime_1.jsx)("textarea", { value: createForm.description, onChange: (e) => setCreateForm({ ...createForm, description: e.target.value }), rows: 3, placeholder: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u0447\u0435\u0433\u043E \u044D\u0442\u0430 \u0441\u0441\u044B\u043B\u043A\u0430...", style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)',
                                                resize: 'vertical'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setShowCreateForm(false), style: {
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
                                            }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443" })] })] })] }) }))] }));
};
exports.default = InviteLinksManagement;
//# sourceMappingURL=invite-links-management.js.map