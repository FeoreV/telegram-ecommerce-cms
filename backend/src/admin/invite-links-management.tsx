import React, { useState, useEffect } from 'react';

// Типы данных
interface InviteLink {
  id: string;
  token: string;
  role?: string;
  customRole?: {
    id: string;
    name: string;
    color: string;
    icon?: string;
  };
  maxUses: number;
  usedCount: number;
  expiresAt?: string;
  isActive: boolean;
  description?: string;
  url: string;
  usageStats: {
    used: number;
    max: number;
    remaining: number;
  };
  isExpired: boolean;
  store: {
    id: string;
    name: string;
  };
  creator: {
    firstName: string;
    lastName: string;
    username?: string;
  };
  createdAt: string;
}

interface Store {
  id: string;
  name: string;
}

interface CustomRole {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

interface CreateInviteLinkForm {
  storeId: string;
  role?: string;
  customRoleId?: string;
  maxUses: number;
  expiresAt?: string;
  description: string;
}

const InviteLinksManagement: React.FC = () => {
  const [inviteLinks, setInviteLinks] = useState<InviteLink[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState<CreateInviteLinkForm>({
    storeId: '',
    role: 'VENDOR',
    maxUses: 1,
    description: ''
  });

  useEffect(() => {
    fetchStores();
  }, []);

  useEffect(() => {
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
    } catch (error) {
      console.error('Error fetching stores:', error);
    }
  };

  const fetchInviteLinks = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/invite-links?storeId=${selectedStore}&isActive=true`);
      const data = await response.json();
      setInviteLinks(data.inviteLinks || []);
    } catch (error) {
      console.error('Error fetching invite links:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomRoles = async () => {
    try {
      const response = await fetch(`/api/custom-roles?storeId=${selectedStore}`);
      const data = await response.json();
      setCustomRoles(data.customRoles || []);
    } catch (error) {
      console.error('Error fetching custom roles:', error);
    }
  };

  const handleCreateInviteLink = async (e: React.FormEvent) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error creating invite link:', error);
      alert('Произошла ошибка при создании ссылки');
    }
  };

  const handleToggleActive = async (linkId: string, isActive: boolean) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error updating invite link:', error);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
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
      } else {
        const error = await response.json();
        alert(`Ошибка: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting invite link:', error);
      alert('Произошла ошибка при удалении ссылки');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Ссылка скопирована в буфер обмена!');
    });
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

  const getRoleDisplay = (link: InviteLink) => {
    if (link.customRole) {
      return (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 8px',
          borderRadius: '12px',
          backgroundColor: link.customRole.color + '20',
          color: link.customRole.color,
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {link.customRole.icon && <span>{link.customRole.icon}</span>}
          {link.customRole.name}
        </span>
      );
    }
    
    return (
      <span style={{
        padding: '4px 8px',
        borderRadius: '12px',
        backgroundColor: link.role === 'ADMIN' ? '#e3f2fd' : '#f3e5f5',
        color: link.role === 'ADMIN' ? '#1976d2' : '#7b1fa2',
        fontSize: '12px',
        fontWeight: 'bold'
      }}>
        {link.role === 'ADMIN' ? '👑 Администратор' : '🛍️ Продавец'}
      </span>
    );
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
          🔗 Инвайт ссылки
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
          ➕ Создать ссылку
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

      {/* Список инвайт ссылок */}
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
          {inviteLinks.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center' }}>
              <div style={{ color: 'var(--color-text-secondary, #666)' }}>
                Нет активных инвайт ссылок
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px' }}>
              {inviteLinks.map(link => (
                <div key={link.id} style={{
                  backgroundColor: 'var(--color-bg, #fff)',
                  border: '1px solid var(--color-border, #dee2e6)',
                  borderRadius: '8px',
                  padding: '20px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                        {getRoleDisplay(link)}
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '8px',
                          backgroundColor: link.isActive ? '#d4edda' : '#f8d7da',
                          color: link.isActive ? '#155724' : '#721c24',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {link.isActive ? 'Активна' : 'Неактивна'}
                        </span>
                        {link.isExpired && (
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '8px',
                            backgroundColor: '#fff3cd',
                            color: '#856404',
                            fontSize: '11px',
                            fontWeight: 'bold'
                          }}>
                            Истекла
                          </span>
                        )}
                      </div>
                      
                      {link.description && (
                        <div style={{ color: 'var(--color-text, #333)', marginBottom: '8px' }}>
                          {link.description}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary, #666)' }}>
                        Создана {formatDate(link.createdAt)} • {link.creator.firstName} {link.creator.lastName}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => copyToClipboard(link.url)}
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
                        📋 Копировать
                      </button>
                      <button
                        onClick={() => handleToggleActive(link.id, link.isActive)}
                        style={{
                          backgroundColor: link.isActive ? '#ffc107' : '#28a745',
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        {link.isActive ? 'Деактивировать' : 'Активировать'}
                      </button>
                      <button
                        onClick={() => handleDeleteLink(link.id)}
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
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    backgroundColor: 'var(--color-bg-secondary, #f8f9fa)',
                    padding: '12px',
                    borderRadius: '4px',
                    fontSize: '12px'
                  }}>
                    <div>
                      <strong>Использовано:</strong> {link.usageStats.used} из {link.usageStats.max}
                      {link.expiresAt && (
                        <span style={{ marginLeft: '16px' }}>
                          <strong>Истекает:</strong> {formatDate(link.expiresAt)}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ 
                      width: '100px', 
                      height: '8px', 
                      backgroundColor: '#e9ecef',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${(link.usageStats.used / link.usageStats.max) * 100}%`,
                        height: '100%',
                        backgroundColor: link.usageStats.used >= link.usageStats.max ? '#dc3545' : '#28a745',
                        transition: 'width 0.3s ease'
                      }}></div>
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
          Выберите магазин для просмотра инвайт ссылок
        </div>
      )}

      {/* Форма создания */}
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
            width: '500px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h2 style={{ marginTop: 0, color: 'var(--color-text, #333)' }}>
              Создать инвайт ссылку
            </h2>
            
            <form onSubmit={handleCreateInviteLink}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Тип роли *
                </label>
                <select
                  value={createForm.customRoleId ? 'custom' : createForm.role}
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setCreateForm({...createForm, role: undefined, customRoleId: customRoles[0]?.id || ''});
                    } else {
                      setCreateForm({...createForm, role: e.target.value, customRoleId: undefined});
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

              {createForm.customRoleId !== undefined && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                    Кастомная роль *
                  </label>
                  <select
                    value={createForm.customRoleId}
                    onChange={(e) => setCreateForm({...createForm, customRoleId: e.target.value})}
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Максимальное количество использований *
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={createForm.maxUses}
                  onChange={(e) => setCreateForm({...createForm, maxUses: Number(e.target.value)})}
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Срок действия (необязательно)
                </label>
                <input
                  type="datetime-local"
                  value={createForm.expiresAt}
                  onChange={(e) => setCreateForm({...createForm, expiresAt: e.target.value})}
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

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: 'var(--color-text, #333)' }}>
                  Описание (необязательно)
                </label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({...createForm, description: e.target.value})}
                  rows={3}
                  placeholder="Описание для чего эта ссылка..."
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
                  onClick={() => setShowCreateForm(false)}
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
                  Создать ссылку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InviteLinksManagement;
