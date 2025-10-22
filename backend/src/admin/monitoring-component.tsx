import React, { useState, useEffect } from 'react';

// Simple component wrappers
const Box: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>;
const H1: React.FC<any> = ({ children, ...props }) => <h1 style={{ marginBottom: '20px', fontSize: '28px', fontWeight: 'bold', color: 'var(--color-text, #333)' }} {...props}>{children}</h1>;
const H2: React.FC<any> = ({ children, ...props }) => <h2 style={{ marginBottom: '15px', fontSize: '20px', fontWeight: '600', color: 'var(--color-text, #333)' }} {...props}>{children}</h2>;
const Text: React.FC<any> = ({ children, ...props }) => <p style={{ color: 'var(--color-text, #555)', lineHeight: '1.6' }} {...props}>{children}</p>;
const Button: React.FC<any> = ({ children, onClick, variant, ...props }) => {
  const baseStyle = {
    padding: '8px 16px',
    marginRight: '10px',
    marginBottom: '10px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s ease'
  };

  const variantStyles = {
    primary: { backgroundColor: '#0088cc', color: 'white' },
    secondary: { backgroundColor: '#6c757d', color: 'white' },
    success: { backgroundColor: '#28a745', color: 'white' }
  };

  return (
    <button 
      style={{ ...baseStyle, ...(variantStyles[variant as keyof typeof variantStyles] || variantStyles.primary) }} 
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
};

interface MonitoringDashboard {
  id: string;
  title: string;
  description: string;
  uid: string;
}

const MonitoringComponent: React.FC = () => {
  const [selectedDashboard, setSelectedDashboard] = useState<string>('backend-overview');
  const [grafanaUrl, setGrafanaUrl] = useState<string>('http://localhost:3030');
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [customUrl, setCustomUrl] = useState<string>('');

  // Load Grafana URL from localStorage
  useEffect(() => {
    const savedUrl = localStorage.getItem('grafana_url');
    if (savedUrl) {
      setGrafanaUrl(savedUrl);
    }
  }, []);

  const dashboards: MonitoringDashboard[] = [
    {
      id: 'backend-overview',
      title: '📊 Backend Overview',
      description: 'Общий обзор производительности backend API',
      uid: 'botrt-backend-overview'
    },
    {
      id: 'business-metrics',
      title: '💼 Business Metrics',
      description: 'Бизнес-метрики: заказы, продажи, запасы',
      uid: 'botrt-business-metrics'
    },
    {
      id: 'prometheus',
      title: '🔥 Prometheus',
      description: 'Прямой доступ к Prometheus',
      uid: 'prometheus'
    }
  ];

  const handleSaveUrl = () => {
    if (customUrl) {
      setGrafanaUrl(customUrl);
      localStorage.setItem('grafana_url', customUrl);
      setShowSettings(false);
    }
  };

  const getIframeUrl = () => {
    const dashboard = dashboards.find(d => d.id === selectedDashboard);
    
    if (selectedDashboard === 'prometheus') {
      return 'http://localhost:9090/graph'; // Prometheus URL
    }
    
    if (dashboard) {
      // Grafana embed URL with auto-refresh and dark theme
      return `${grafanaUrl}/d/${dashboard.uid}?orgId=1&refresh=10s&kiosk=tv&theme=dark`;
    }
    
    return `${grafanaUrl}`;
  };

  const styles = `
    .monitoring-container {
      padding: 20px;
      background: var(--color-bg, #f8f9fa);
      min-height: 100vh;
    }

    .dashboard-selector {
      margin-bottom: 20px;
      padding: 20px;
      background: var(--color-bg-secondary, white);
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .dashboard-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 15px;
    }

    .iframe-container {
      background: var(--color-bg-secondary, white);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
      height: calc(100vh - 250px);
      min-height: 600px;
    }

    .iframe-container iframe {
      width: 100%;
      height: 100%;
      border: none;
    }

    .settings-panel {
      margin-bottom: 20px;
      padding: 20px;
      background: var(--color-bg-secondary, white);
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .settings-panel input {
      width: 100%;
      max-width: 500px;
      padding: 10px;
      margin: 10px 0;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .info-box {
      padding: 15px;
      margin-bottom: 20px;
      background: #e7f3ff;
      border-left: 4px solid #0088cc;
      border-radius: 4px;
      color: #004085;
    }

    .theme--dark .info-box {
      background: rgba(0, 136, 204, 0.2);
      border-left-color: #0088cc;
      color: #cce5ff;
    }

    .theme--dark .dashboard-selector,
    .theme--dark .settings-panel,
    .theme--dark .iframe-container {
      background: var(--color-bg-secondary, #2c2c2c);
    }

    .theme--dark .settings-panel input {
      background: var(--color-bg, #1e1e1e);
      border-color: var(--color-border, #444);
      color: var(--color-text, #e0e0e0);
    }
  `;

  return (
    <>
      <style>{styles}</style>
      <Box className="monitoring-container">
        <H1>📈 Система Мониторинга</H1>
        
        <div className="info-box">
          <Text>
            <strong>Важно:</strong> Перед использованием убедитесь, что Prometheus и Grafana запущены.
            Запустите: <code>docker-compose -f docker-compose.monitoring.yml up -d</code>
          </Text>
        </div>

        <div className="dashboard-selector">
          <H2>Выберите дашборд</H2>
          <Text style={{ marginBottom: '15px' }}>
            Выберите один из доступных дашбордов для мониторинга системы
          </Text>
          
          <div className="dashboard-buttons">
            {dashboards.map((dashboard) => (
              <Button
                key={dashboard.id}
                variant={selectedDashboard === dashboard.id ? 'primary' : 'secondary'}
                onClick={() => setSelectedDashboard(dashboard.id)}
              >
                {dashboard.title}
              </Button>
            ))}
            <Button
              variant="success"
              onClick={() => setShowSettings(!showSettings)}
            >
              ⚙️ Настройки
            </Button>
          </div>

          <Box style={{ marginTop: '15px' }}>
            <Text>
              {dashboards.find(d => d.id === selectedDashboard)?.description}
            </Text>
          </Box>
        </div>

        {showSettings && (
          <div className="settings-panel">
            <H2>⚙️ Настройки Grafana</H2>
            <Text>Укажите URL вашего Grafana сервера:</Text>
            <input
              type="text"
              placeholder="http://localhost:3030"
              value={customUrl}
              onChange={(e) => setCustomUrl(e.target.value)}
            />
            <Box style={{ marginTop: '10px' }}>
              <Button variant="primary" onClick={handleSaveUrl}>
                Сохранить
              </Button>
              <Button variant="secondary" onClick={() => setShowSettings(false)}>
                Отмена
              </Button>
            </Box>
            <Text style={{ marginTop: '10px', fontSize: '12px', color: 'var(--color-text-secondary, #888)' }}>
              Текущий URL: {grafanaUrl}
            </Text>
          </div>
        )}

        <div className="iframe-container">
          <iframe
            src={getIframeUrl()}
            title={`Monitoring Dashboard - ${selectedDashboard}`}
            allow="fullscreen"
          />
        </div>

        <Box style={{ marginTop: '20px', padding: '15px', background: 'var(--color-bg-secondary, white)', borderRadius: '8px' }}>
          <H2>📌 Быстрые ссылки</H2>
          <ul style={{ color: 'var(--color-text, #333)', lineHeight: '2' }}>
            <li>
              <a href="http://localhost:3030" target="_blank" rel="noopener noreferrer" style={{ color: '#0088cc' }}>
                Grafana Dashboard
              </a>
            </li>
            <li>
              <a href="http://localhost:9090" target="_blank" rel="noopener noreferrer" style={{ color: '#0088cc' }}>
                Prometheus
              </a>
            </li>
            <li>
              <a href="/metrics" target="_blank" rel="noopener noreferrer" style={{ color: '#0088cc' }}>
                Raw Metrics Endpoint
              </a>
            </li>
            <li>
              <a href="/api/metrics" target="_blank" rel="noopener noreferrer" style={{ color: '#0088cc' }}>
                JSON Metrics API
              </a>
            </li>
          </ul>
        </Box>
      </Box>
    </>
  );
};

export default MonitoringComponent;
