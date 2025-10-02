"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const CustomRolesManagement = () => {
    const [customRoles, setCustomRoles] = (0, react_1.useState)([]);
    const [stores, setStores] = (0, react_1.useState)([]);
    const [selectedStore, setSelectedStore] = (0, react_1.useState)('');
    const [availablePermissions, setAvailablePermissions] = (0, react_1.useState)([]);
    const [permissionCategories, setPermissionCategories] = (0, react_1.useState)([]);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const [showCreateForm, setShowCreateForm] = (0, react_1.useState)(false);
    const [editingRole, setEditingRole] = (0, react_1.useState)(null);
    const [createForm, setCreateForm] = (0, react_1.useState)({
        name: '',
        description: '',
        permissions: [],
        color: '#6366f1',
        icon: '⚡'
    });
    const roleIcons = ['⚡', '👑', '🛡️', '🔧', '📊', '💼', '🎯', '🚀', '💎', '🔥', '⭐', '🎨', '📈', '🔒', '🎪', '🌟'];
    const roleColors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899', '#f97316', '#14b8a6'];
    (0, react_1.useEffect)(() => {
        fetchStores();
        fetchAvailablePermissions();
    }, []);
    (0, react_1.useEffect)(() => {
        if (selectedStore) {
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
    const fetchCustomRoles = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/custom-roles?storeId=${selectedStore}`);
            const data = await response.json();
            setCustomRoles(data.customRoles || []);
        }
        catch (error) {
            console.error('Error fetching custom roles:', error);
        }
        finally {
            setLoading(false);
        }
    };
    const fetchAvailablePermissions = async () => {
        try {
            const response = await fetch('/api/custom-roles/permissions');
            const data = await response.json();
            setAvailablePermissions(data.permissions || []);
            setPermissionCategories(data.categories || []);
        }
        catch (error) {
            console.error('Error fetching permissions:', error);
        }
    };
    const handleCreateRole = async (e) => {
        e.preventDefault();
        if (!selectedStore) {
            alert('Выберите магазин');
            return;
        }
        if (createForm.permissions.length === 0) {
            alert('Выберите хотя бы одно разрешение');
            return;
        }
        try {
            const url = editingRole ? `/api/custom-roles/${editingRole.id}` : '/api/custom-roles';
            const method = editingRole ? 'PUT' : 'POST';
            const payload = editingRole
                ? { ...createForm, id: editingRole.id }
                : { ...createForm, storeId: selectedStore };
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                alert(editingRole ? 'Роль обновлена!' : 'Роль создана!');
                setShowCreateForm(false);
                setEditingRole(null);
                resetForm();
                fetchCustomRoles();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error saving role:', error);
            alert('Произошла ошибка при сохранении роли');
        }
    };
    const handleEditRole = (role) => {
        setEditingRole(role);
        setCreateForm({
            name: role.name,
            description: role.description || '',
            permissions: role.permissions,
            color: role.color,
            icon: role.icon || '⚡'
        });
        setShowCreateForm(true);
    };
    const handleDeleteRole = async (roleId) => {
        if (!confirm('Вы уверены, что хотите удалить эту роль?')) {
            return;
        }
        try {
            const response = await fetch(`/api/custom-roles/${roleId}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                alert('Роль удалена');
                fetchCustomRoles();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error deleting role:', error);
            alert('Произошла ошибка при удалении роли');
        }
    };
    const handleToggleActive = async (roleId, isActive) => {
        try {
            const response = await fetch(`/api/custom-roles/${roleId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id: roleId, isActive: !isActive })
            });
            if (response.ok) {
                fetchCustomRoles();
            }
            else {
                const error = await response.json();
                alert(`Ошибка: ${error.message}`);
            }
        }
        catch (error) {
            console.error('Error updating role:', error);
        }
    };
    const resetForm = () => {
        setCreateForm({
            name: '',
            description: '',
            permissions: [],
            color: '#6366f1',
            icon: '⚡'
        });
    };
    const handlePermissionToggle = (permission) => {
        setCreateForm(prev => ({
            ...prev,
            permissions: prev.permissions.includes(permission)
                ? prev.permissions.filter(p => p !== permission)
                : [...prev.permissions, permission]
        }));
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
    const getPermissionsByCategory = () => {
        return permissionCategories.map(category => ({
            ...category,
            permissions: availablePermissions.filter(p => p.category === category.key)
        }));
    };
    return ((0, jsx_runtime_1.jsxs)("div", { style: { padding: '20px', fontFamily: 'Arial, sans-serif' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '20px'
                }, children: [(0, jsx_runtime_1.jsx)("h1", { style: { margin: 0, color: 'var(--color-text, #333)' }, children: "\uD83C\uDFAD \u041A\u0430\u0441\u0442\u043E\u043C\u043D\u044B\u0435 \u0440\u043E\u043B\u0438" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => setShowCreateForm(true), style: {
                            backgroundColor: 'var(--color-primary, #007bff)',
                            color: 'white',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }, children: "\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0440\u043E\u043B\u044C" })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D:" }), (0, jsx_runtime_1.jsxs)("select", { value: selectedStore, onChange: (e) => setSelectedStore(e.target.value), style: {
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
                }, children: customRoles.length === 0 ? ((0, jsx_runtime_1.jsx)("div", { style: { padding: '40px', textAlign: 'center' }, children: (0, jsx_runtime_1.jsx)("div", { style: { color: 'var(--color-text-secondary, #666)' }, children: "\u041D\u0435\u0442 \u043A\u0430\u0441\u0442\u043E\u043C\u043D\u044B\u0445 \u0440\u043E\u043B\u0435\u0439. \u0421\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043F\u0435\u0440\u0432\u0443\u044E \u0440\u043E\u043B\u044C!" }) })) : ((0, jsx_runtime_1.jsx)("div", { style: { padding: '20px' }, children: customRoles.map(role => ((0, jsx_runtime_1.jsx)("div", { style: {
                            backgroundColor: 'var(--color-bg, #fff)',
                            border: '1px solid var(--color-border, #dee2e6)',
                            borderRadius: '8px',
                            padding: '20px',
                            marginBottom: '16px'
                        }, children: (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }, children: [(0, jsx_runtime_1.jsxs)("span", { style: {
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '6px',
                                                        padding: '6px 12px',
                                                        borderRadius: '20px',
                                                        backgroundColor: role.color + '20',
                                                        color: role.color,
                                                        fontSize: '16px',
                                                        fontWeight: 'bold'
                                                    }, children: [role.icon && (0, jsx_runtime_1.jsx)("span", { children: role.icon }), role.name] }), (0, jsx_runtime_1.jsx)("span", { style: {
                                                        padding: '2px 6px',
                                                        borderRadius: '8px',
                                                        backgroundColor: role.isActive ? '#d4edda' : '#f8d7da',
                                                        color: role.isActive ? '#155724' : '#721c24',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }, children: role.isActive ? 'Активна' : 'Неактивна' }), (0, jsx_runtime_1.jsxs)("span", { style: {
                                                        padding: '2px 6px',
                                                        borderRadius: '8px',
                                                        backgroundColor: '#e2e3e5',
                                                        color: '#383d41',
                                                        fontSize: '11px',
                                                        fontWeight: 'bold'
                                                    }, children: ["\uD83D\uDC65 ", role.usersCount] })] }), role.description && ((0, jsx_runtime_1.jsx)("div", { style: { color: 'var(--color-text, #333)', marginBottom: '12px' }, children: role.description })), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '12px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--color-text, #333)' }, children: ["\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u044F (", role.permissions.length, "):"] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', flexWrap: 'wrap', gap: '4px' }, children: [role.permissions.slice(0, 8).map(permission => ((0, jsx_runtime_1.jsx)("span", { style: {
                                                                padding: '2px 6px',
                                                                borderRadius: '10px',
                                                                backgroundColor: role.color + '15',
                                                                color: role.color,
                                                                fontSize: '10px',
                                                                fontWeight: 'bold'
                                                            }, children: availablePermissions.find(p => p.value === permission)?.label || permission }, permission))), role.permissions.length > 8 && ((0, jsx_runtime_1.jsxs)("span", { style: {
                                                                padding: '2px 6px',
                                                                borderRadius: '10px',
                                                                backgroundColor: '#e9ecef',
                                                                color: '#6c757d',
                                                                fontSize: '10px',
                                                                fontWeight: 'bold'
                                                            }, children: ["+", role.permissions.length - 8] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { fontSize: '12px', color: 'var(--color-text-secondary, #666)' }, children: ["\u0421\u043E\u0437\u0434\u0430\u043D\u0430 ", formatDate(role.createdAt), " \u2022 ", role.creator.firstName, " ", role.creator.lastName, role.updatedAt !== role.createdAt && ((0, jsx_runtime_1.jsxs)("span", { children: [" \u2022 \u041E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0430 ", formatDate(role.updatedAt)] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '8px' }, children: [(0, jsx_runtime_1.jsx)("button", { onClick: () => handleEditRole(role), style: {
                                                backgroundColor: '#17a2b8',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }, children: "\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => handleToggleActive(role.id, role.isActive), style: {
                                                backgroundColor: role.isActive ? '#ffc107' : '#28a745',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }, children: role.isActive ? 'Деактивировать' : 'Активировать' }), role.usersCount === 0 && ((0, jsx_runtime_1.jsx)("button", { onClick: () => handleDeleteRole(role.id), style: {
                                                backgroundColor: '#dc3545',
                                                color: 'white',
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }, children: "\uD83D\uDDD1\uFE0F \u0423\u0434\u0430\u043B\u0438\u0442\u044C" }))] })] }) }, role.id))) })) })) : ((0, jsx_runtime_1.jsx)("div", { style: {
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--color-text-secondary, #666)'
                }, children: "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u0434\u043B\u044F \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430 \u043A\u0430\u0441\u0442\u043E\u043C\u043D\u044B\u0445 \u0440\u043E\u043B\u0435\u0439" })), showCreateForm && ((0, jsx_runtime_1.jsx)("div", { style: {
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
                        width: '700px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        overflow: 'auto'
                    }, children: [(0, jsx_runtime_1.jsx)("h2", { style: { marginTop: 0, color: 'var(--color-text, #333)' }, children: editingRole ? 'Редактировать роль' : 'Создать кастомную роль' }), (0, jsx_runtime_1.jsxs)("form", { onSubmit: handleCreateRole, children: [(0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '20px', marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsxs)("div", { style: { flex: 1 }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0440\u043E\u043B\u0438 *" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: createForm.name, onChange: (e) => setCreateForm({ ...createForm, name: e.target.value }), placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u043F\u0440\u043E\u0434\u0430\u0436", required: true, style: {
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--color-border, #ddd)',
                                                        backgroundColor: 'var(--color-bg, #fff)',
                                                        color: 'var(--color-text, #333)'
                                                    } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { width: '120px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0418\u043A\u043E\u043D\u043A\u0430" }), (0, jsx_runtime_1.jsx)("select", { value: createForm.icon, onChange: (e) => setCreateForm({ ...createForm, icon: e.target.value }), style: {
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--color-border, #ddd)',
                                                        backgroundColor: 'var(--color-bg, #fff)',
                                                        color: 'var(--color-text, #333)'
                                                    }, children: roleIcons.map(icon => ((0, jsx_runtime_1.jsx)("option", { value: icon, children: icon }, icon))) })] }), (0, jsx_runtime_1.jsxs)("div", { style: { width: '120px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u0426\u0432\u0435\u0442" }), (0, jsx_runtime_1.jsx)("select", { value: createForm.color, onChange: (e) => setCreateForm({ ...createForm, color: e.target.value }), style: {
                                                        width: '100%',
                                                        padding: '8px',
                                                        borderRadius: '4px',
                                                        border: '1px solid var(--color-border, #ddd)',
                                                        backgroundColor: 'var(--color-bg, #fff)',
                                                        color: 'var(--color-text, #333)'
                                                    }, children: roleColors.map(color => ((0, jsx_runtime_1.jsx)("option", { value: color, style: { backgroundColor: color }, children: color }, color))) })] })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsx)("label", { style: { display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }, children: "\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435" }), (0, jsx_runtime_1.jsx)("textarea", { value: createForm.description, onChange: (e) => setCreateForm({ ...createForm, description: e.target.value }), placeholder: "\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0440\u043E\u043B\u0438 \u0438 \u0435\u0451 \u043E\u0431\u044F\u0437\u0430\u043D\u043D\u043E\u0441\u0442\u0435\u0439", rows: 2, style: {
                                                width: '100%',
                                                padding: '8px',
                                                borderRadius: '4px',
                                                border: '1px solid var(--color-border, #ddd)',
                                                backgroundColor: 'var(--color-bg, #fff)',
                                                color: 'var(--color-text, #333)',
                                                resize: 'vertical'
                                            } })] }), (0, jsx_runtime_1.jsxs)("div", { style: { marginBottom: '20px' }, children: [(0, jsx_runtime_1.jsxs)("label", { style: { display: 'block', marginBottom: '10px', color: 'var(--color-text, #333)' }, children: ["\u0420\u0430\u0437\u0440\u0435\u0448\u0435\u043D\u0438\u044F * (\u0432\u044B\u0431\u0440\u0430\u043D\u043E: ", createForm.permissions.length, ")"] }), getPermissionsByCategory().map(category => ((0, jsx_runtime_1.jsxs)("div", { style: {
                                                border: '1px solid var(--color-border, #ddd)',
                                                borderRadius: '6px',
                                                marginBottom: '12px',
                                                overflow: 'hidden'
                                            }, children: [(0, jsx_runtime_1.jsxs)("div", { style: {
                                                        backgroundColor: category.color + '15',
                                                        padding: '8px 12px',
                                                        borderBottom: '1px solid var(--color-border, #ddd)',
                                                        fontWeight: 'bold',
                                                        fontSize: '14px',
                                                        color: category.color,
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '8px'
                                                    }, children: [(0, jsx_runtime_1.jsx)("span", { children: category.icon }), category.label, (0, jsx_runtime_1.jsxs)("span", { style: {
                                                                marginLeft: 'auto',
                                                                fontSize: '12px',
                                                                padding: '2px 6px',
                                                                borderRadius: '10px',
                                                                backgroundColor: category.color + '20'
                                                            }, children: [category.permissions.filter(p => createForm.permissions.includes(p.value)).length, " / ", category.permissions.length] })] }), (0, jsx_runtime_1.jsx)("div", { style: { padding: '12px' }, children: (0, jsx_runtime_1.jsx)("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }, children: category.permissions.map(permission => ((0, jsx_runtime_1.jsxs)("label", { style: {
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: '8px',
                                                                padding: '6px',
                                                                borderRadius: '4px',
                                                                cursor: 'pointer',
                                                                backgroundColor: createForm.permissions.includes(permission.value)
                                                                    ? category.color + '10' : 'transparent'
                                                            }, children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: createForm.permissions.includes(permission.value), onChange: () => handlePermissionToggle(permission.value), style: { margin: 0 } }), (0, jsx_runtime_1.jsx)("span", { style: { fontSize: '12px', color: 'var(--color-text, #333)' }, children: permission.label })] }, permission.value))) }) })] }, category.key)))] }), (0, jsx_runtime_1.jsxs)("div", { style: { display: 'flex', gap: '10px', justifyContent: 'flex-end' }, children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => {
                                                setShowCreateForm(false);
                                                setEditingRole(null);
                                                resetForm();
                                            }, style: {
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
                                            }, children: editingRole ? 'Сохранить изменения' : 'Создать роль' })] })] })] }) }))] }));
};
exports.default = CustomRolesManagement;
//# sourceMappingURL=custom-roles-management.js.map