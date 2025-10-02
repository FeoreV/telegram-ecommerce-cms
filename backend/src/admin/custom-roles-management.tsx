import React, { useState, useEffect } from 'react';

// Типы данных
interface CustomRole {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  color: string;
  icon?: string;
  isActive: boolean;
  usersCount: number;
  creator: {
    firstName: string;
    lastName: string;
    username?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Store {
  id: string;
  name: string;
}

interface Permission {
  value: string;
  label: string;
  category: string;
}

interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  color: string;
}

interface CreateRoleForm {
  name: string;
  description: string;
  permissions: string[];
  color: string;
  icon: string;
}

const CustomRolesManagement: React.FC = () => {
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [availablePermissions, setAvailablePermissions] = useState<Permission[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [createForm, setCreateForm] = useState<CreateRoleForm>({
    name: '',
    description: '',
    permissions: [],
    color: '#6366f1',
    icon: '⚡'
  });

  const roleIcons = ['⚡', '👑', '🛡️', '🔧', '📊', '💼', '🎯', '🚀', '💎', '🔥', '⭐', '🎨', '📈', '🔒', '🎪', '🌟'];
  const roleColors = ['#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#84cc16', '#ec4899', '#f97316', '#14b8a6'];

  useEffect(() => {
    fetchStores();
    fetchAvailablePermissions();
  }, []);

  useEffect(() => {
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
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/custom-roles?storeId=${selectedStore}`);
      const data = await response.json();
      setCustomRoles(data.customRoles || []);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailablePermissions = async () => {
    try {
      const response = await fetch('/api/custom-roles/permissions');
      const data = await response.json();
      setAvailablePermissions(data.permissions || []);
      setPermissionCategories(data.categories || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error saving role:', error);
      alert('Произошла ошибка при сохранении роли');
    }
  };

  const handleEditRole = (role: CustomRole) => {
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

  const handleDeleteRole = async (roleId: string) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting role:', error);
      alert('Произошла ошибка при удалении роли');
    }
  };

  const handleToggleActive = async (roleId: string, isActive: boolean) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
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

  const handlePermissionToggle = (permission: string) => {
    setCreateForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const formatDate = (dateString: string) => {
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

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '20px' 
      }}>
        <h1 style={{ margin: 0, color: 'var(--color-text, #333)' }}>
          🎭 Кастомные роли
        </h1>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            backgroundColor: 'var(--color-primary, #007bff)',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ➕ Создать роль
        </button>
      </div>

      {/* Выбор магазина */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
          Выберите магазин:
        </label>
        <select
          value={selectedStore}
          onChange={(e) => setSelectedStore(e.target.value)}
          style={{
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid var(--color-border, #ddd)',
            backgroundColor: 'var(--color-bg, #fff)',
            color: 'var(--color-text, #333)',
            fontSize: '14px'
          }}
        >
          <option value="">Выберите магазин</option>
          {stores.map(store => (
            <option key={store.id} value={store.id}>
              {store.name}
            </option>
          ))}
        </select>
      </div>

      {/* Список ролей */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <div>Загрузка...</div>
        </div>
      ) : selectedStore ? (
        <div style={{
          backgroundColor: 'var(--color-bg-secondary, #f8f9fa)',
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid var(--color-border, #dee2e6)'
        }}>
          {customRoles.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-text-secondary, #666)' }}>
                Нет кастомных ролей. Создайте первую роль!
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {customRoles.map(role => (
                <div key={role.id} style={{
                  backgroundColor: 'var(--color-bg, #fff)',
                  border: '1px solid var(--color-border, #dee2e6)',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          backgroundColor: role.color + '20',
                          color: role.color,
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}>
                          {role.icon && <span>{role.icon}</span>}
                          {role.name}
                        </span>
                        
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          backgroundColor: role.isActive ? '#d4edda' : '#f8d7da',
                          color: role.isActive ? '#155724' : '#721c24',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {role.isActive ? 'Активна' : 'Неактивна'}
                        </span>

                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          backgroundColor: '#e2e3e5',
                          color: '#383d41',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          👥 {role.usersCount}
                        </span>
                      </div>
                      
                      {role.description && (
                        <div style={{ color: 'var(--color-text, #333)', marginBottom: '12px' }}>
                          {role.description}
                        </div>
                      )}

                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--color-text, #333)' }}>
                          Разрешения ({role.permissions.length}):
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {role.permissions.slice(0, 8).map(permission => (
                            <span key={permission} style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: role.color + '15',
                              color: role.color,
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              {availablePermissions.find(p => p.value === permission)?.label || permission}
                            </span>
                          ))}
                          {role.permissions.length > 8 && (
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: '#e9ecef',
                              color: '#6c757d',
                              fontSize: '10px',
                              fontWeight: 'bold'
                            }}>
                              +{role.permissions.length - 8}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #666)' }}>
                        Создана {formatDate(role.createdAt)} • {role.creator.firstName} {role.creator.lastName}
                        {role.updatedAt !== role.createdAt && (
                          <span> • Обновлена {formatDate(role.updatedAt)}</span>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleEditRole(role)}
                        style={{
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        ✏️ Редактировать
                      </button>
                      <button
                        onClick={() => handleToggleActive(role.id, role.isActive)}
                        style={{
                          backgroundColor: role.isActive ? '#ffc107' : '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {role.isActive ? 'Деактивировать' : 'Активировать'}
                      </button>
                      {role.usersCount === 0 && (
                        <button
                          onClick={() => handleDeleteRole(role.id)}
                          style={{
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          🗑️ Удалить
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: 'var(--color-text-secondary, #666)' 
        }}>
          Выберите магазин для просмотра кастомных ролей
        </div>
      )}

      {/* Форма создания/редактирования */}
      {showCreateForm && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg, #fff)',
            padding: '30px',
            borderRadius: '8px',
            width: '700px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--color-text, #333)' }}>
              {editingRole ? 'Редактировать роль' : 'Создать кастомную роль'}
            </h2>
            
            <form onSubmit={handleCreateRole}>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Название роли *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({...createForm, name: e.target.value})}
                    placeholder="Например: Менеджер продаж"
                    required
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #ddd)',
                      backgroundColor: 'var(--color-bg, #fff)',
                      color: 'var(--color-text, #333)'
                    }}
                  />
                </div>
                
                <div style={{ width: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Иконка
                  </label>
                  <select
                    value={createForm.icon}
                    onChange={(e) => setCreateForm({...createForm, icon: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #ddd)',
                      backgroundColor: 'var(--color-bg, #fff)',
                      color: 'var(--color-text, #333)'
                    }}
                  >
                    {roleIcons.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>

                <div style={{ width: '120px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Цвет
                  </label>
                  <select
                    value={createForm.color}
                    onChange={(e) => setCreateForm({...createForm, color: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #ddd)',
                      backgroundColor: 'var(--color-bg, #fff)',
                      color: 'var(--color-text, #333)'
                    }}
                  >
                    {roleColors.map(color => (
                      <option key={color} value={color} style={{ backgroundColor: color }}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Описание
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  placeholder="Краткое описание роли и её обязанностей"
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border, #ddd)',
                    backgroundColor: 'var(--color-bg, #fff)',
                    color: 'var(--color-text, #333)',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '10px', color: 'var(--color-text, #333)' }}>
                  Разрешения * (выбрано: {createForm.permissions.length})
                </label>
                
                {getPermissionsByCategory().map(category => (
                  <div key={category.key} style={{
                    border: '1px solid var(--color-border, #ddd)',
                    borderRadius: '6px',
                    marginBottom: '12px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      backgroundColor: category.color + '15',
                      padding: '8px 12px',
                      borderBottom: '1px solid var(--color-border, #ddd)',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      color: category.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>{category.icon}</span>
                      {category.label}
                      <span style={{ 
                        marginLeft: 'auto',
                        fontSize: '12px',
                        padding: '2px 6px',
                        borderRadius: '10px',
                        backgroundColor: category.color + '20'
                      }}>
                        {category.permissions.filter(p => createForm.permissions.includes(p.value)).length} / {category.permissions.length}
                      </span>
                    </div>
                    <div style={{ padding: '12px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                        {category.permissions.map(permission => (
                          <label key={permission.value} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            backgroundColor: createForm.permissions.includes(permission.value) 
                              ? category.color + '10' : 'transparent'
                          }}>
                            <input
                              type="checkbox"
                              checked={createForm.permissions.includes(permission.value)}
                              onChange={() => handlePermissionToggle(permission.value)}
                              style={{ margin: 0 }}
                            />
                            <span style={{ fontSize: '12px', color: 'var(--color-text, #333)' }}>
                              {permission.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingRole(null);
                    resetForm();
                  }}
                  style={{
                    padding: '10px 20px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border, #ddd)',
                    backgroundColor: 'var(--color-bg, #fff)',
                    color: 'var(--color-text, #333)',
                    cursor: 'pointer'
                  }}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--color-primary, #007bff)',
                    color: 'white',
                    cursor: 'pointer'
                  }}
                >
                  {editingRole ? 'Сохранить изменения' : 'Создать роль'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomRolesManagement;
