import React, { useState, useEffect } from 'react';

// Типы данных
interface Employee {
  id: string;
  role: 'ADMIN' | 'VENDOR';
  assignmentId: string;
  customRole?: {
    id: string;
    name: string;
    color: string;
    icon?: string;
  };
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username?: string;
    email?: string;
    isActive: boolean;
    lastLoginAt?: string;
    profilePhoto?: string;
  };
  assignedBy?: {
    firstName: string;
    lastName: string;
    username?: string;
  };
  assignedAt: string;
  isActive: boolean;
  permissions: string[];
}

interface Store {
  id: string;
  name: string;
  slug: string;
}

interface CustomRole {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
}

interface InviteFormData {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'ADMIN' | 'VENDOR';
  customRoleId?: string;
  storeId: string;
  permissions: string[];
  message: string;
}

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteFormData>({
    email: '',
    firstName: '',
    lastName: '',
    role: 'VENDOR',
    storeId: '',
    permissions: [],
    message: ''
  });

  // Доступные разрешения для продавцов
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

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
    if (selectedStore) {
      fetchEmployees(selectedStore);
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

  const fetchEmployees = async (storeId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/stores/${storeId}`);
      const data = await response.json();
      setEmployees(data.employees || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const response = await fetch(`/api/custom-roles?storeId=${selectedStore}&isActive=true`);
      const data = await response.json();
      setCustomRoles(data.customRoles || []);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
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
          customRoleId: undefined,
          storeId: '',
          permissions: [],
          message: ''
        });
        if (selectedStore) {
          fetchEmployees(selectedStore);
        }
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('Произошла ошибка при отправке приглашения');
    }
  };

  const handleRemoveEmployee = async (employeeId: string) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error removing employee:', error);
      alert('Произошла ошибка при удалении сотрудника');
    }
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

  const getRoleDisplay = (employee: Employee) => {
    // Если есть кастомная роль, показываем её
    if (employee.customRole) {
      return (
        <span style={{
          padding: '4px 8px',
          borderRadius: '12px',
          backgroundColor: employee.customRole.color + '15',
          color: employee.customRole.color,
          fontSize: '12px',
          fontWeight: 'bold',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          {employee.customRole.icon && <span>{employee.customRole.icon}</span>}
          {employee.customRole.name}
        </span>
      );
    }

    // Иначе показываем стандартную роль
    const roleConfig = {
      ADMIN: { label: 'Администратор', color: '#dc3545', icon: '👑' },
      VENDOR: { label: 'Продавец', color: '#28a745', icon: '🛍️' }
    };
    
    const config = roleConfig[employee.role] || { label: employee.role, color: '#6c757d', icon: '👤' };
    
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '12px',
        backgroundColor: config.color + '15',
        color: config.color,
        fontSize: '12px',
        fontWeight: 'bold',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <span>{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? '#28a745' : '#dc3545';
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
          👥 Управление сотрудниками
        </h1>
        <button
          onClick={() => setShowInviteForm(true)}
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
          ➕ Пригласить сотрудника
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

      {/* Список сотрудников */}
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
          {employees.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-text-secondary, #666)' }}>
                В этом магазине пока нет сотрудников
              </div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg, #fff)' }}>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Сотрудник
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Роль
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Статус
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Добавлен
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Последний вход
                  </th>
                  <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map(employee => (
                  <tr key={employee.id} style={{ borderBottom: '1px solid var(--color-border, #dee2e6)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
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
                        }}>
                          {employee.user.firstName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'var(--color-text, #333)' }}>
                            {employee.user.firstName} {employee.user.lastName}
                          </div>
                          {employee.user.email && (
                            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #666)' }}>
                              {employee.user.email}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text, #333)' }}>
                      {getRoleDisplay(employee)}
                    </td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        backgroundColor: getStatusColor(employee.isActive),
                        marginRight: '8px'
                      }}></span>
                      {employee.isActive ? 'Активен' : 'Неактивен'}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text, #333)' }}>
                      {formatDate(employee.assignedAt)}
                      {employee.assignedBy && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #666)' }}>
                          от {employee.assignedBy.firstName} {employee.assignedBy.lastName}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--color-text, #333)' }}>
                      {employee.user.lastLoginAt 
                        ? formatDate(employee.user.lastLoginAt)
                        : 'Никогда'
                      }
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => handleRemoveEmployee(employee.user.id)}
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
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : (
        <div style={{ 
          textAlign: 'center', 
          padding: '40px',
          color: 'var(--color-text-secondary, #666)' 
        }}>
          Выберите магазин для просмотра сотрудников
        </div>
      )}

      {/* Форма приглашения */}
      {showInviteForm && (
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
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--color-text, #333)' }}>
              Пригласить нового сотрудника
            </h2>
            
            <form onSubmit={handleInviteSubmit}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
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

              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Имя *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({...inviteForm, firstName: e.target.value})}
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
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Фамилия *
                  </label>
                  <input
                    type="text"
                    required
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({...inviteForm, lastName: e.target.value})}
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
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Тип роли *
                </label>
                <select
                  value={inviteForm.customRoleId ? 'custom' : inviteForm.role}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setInviteForm({...inviteForm, role: undefined, customRoleId: customRoles[0]?.id || ''});
                    } else {
                      setInviteForm({...inviteForm, role: e.target.value as 'ADMIN' | 'VENDOR', customRoleId: undefined});
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    borderRadius: '4px',
                    border: '1px solid var(--color-border, #ddd)',
                    backgroundColor: 'var(--color-bg, #fff)',
                    color: 'var(--color-text, #333)'
                  }}
                >
                  <option value="VENDOR">Продавец</option>
                  <option value="ADMIN">Администратор</option>
                  {customRoles.length > 0 && <option value="custom">Кастомная роль</option>}
                </select>
              </div>

              {inviteForm.customRoleId !== undefined && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Кастомная роль *
                  </label>
                  <select
                    value={inviteForm.customRoleId}
                    onChange={(e) => setInviteForm({...inviteForm, customRoleId: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '8px',
                      borderRadius: '4px',
                      border: '1px solid var(--color-border, #ddd)',
                      backgroundColor: 'var(--color-bg, #fff)',
                      color: 'var(--color-text, #333)'
                    }}
                  >
                    {customRoles.map(role => (
                      <option key={role.id} value={role.id}>
                        {role.icon} {role.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(inviteForm.role === 'VENDOR' && !inviteForm.customRoleId) && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: 'var(--color-text, #333)' }}>
                    Разрешения для продавца:
                  </label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '8px' 
                  }}>
                    {availablePermissions.map(permission => (
                      <label key={permission.value} style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        fontSize: '14px',
                        color: 'var(--color-text, #333)'
                      }}>
                        <input
                          type="checkbox"
                          checked={inviteForm.permissions.includes(permission.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setInviteForm({
                                ...inviteForm,
                                permissions: [...inviteForm.permissions, permission.value]
                              });
                            } else {
                              setInviteForm({
                                ...inviteForm,
                                permissions: inviteForm.permissions.filter(p => p !== permission.value)
                              });
                            }
                          }}
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Сообщение (необязательно)
                </label>
                <textarea
                  value={inviteForm.message}
                  onChange={(e) => setInviteForm({...inviteForm, message: e.target.value})}
                  rows={3}
                  placeholder="Добро пожаловать в нашу команду!"
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

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
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
                  Отправить приглашение
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeManagement;
