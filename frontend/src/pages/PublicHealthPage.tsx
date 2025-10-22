import { useEffect, useMemo, useState } from 'react'

import styles from './PublicHealthPage.module.css'

type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

type HealthCheck = {
  name: string
  status: HealthStatus
  message: string
  responseTime?: number
}

type PerformanceMetrics = {
  averageResponseTime: number
  requestsPerSecond: number
  errorRate: number
}

type SystemMetrics = {
  cpu: {
    usage: number
    loadAverage: number[]
  }
  memory: {
    usagePercentage: number
    used: number
    total: number
  }
  disk: {
    usagePercentage: number
    free: number
    total: number
  }
  uptime: number
}

type PublicHealthResponse = {
  status: HealthStatus
  version: string
  uptime: number
  timestamp: string
  checks: HealthCheck[]
  metrics: {
    performance: PerformanceMetrics
    system: SystemMetrics
  }
  recommendations: string[]
}

const formatDuration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  const remainingMinutes = minutes % 60
  const remainingSeconds = seconds % 60

  const parts = []
  if (days) parts.push(`${days}д`)
  if (remainingHours) parts.push(`${remainingHours}ч`)
  if (remainingMinutes) parts.push(`${remainingMinutes}м`)
  parts.push(`${remainingSeconds}с`)

  return parts.join(' ')
}

const formatBytes = (bytes: number) => {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  let value = bytes
  let unitIndex = 0

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(1)} ${units[unitIndex]}`
}

const statusClassName = {
  healthy: styles.statusHealthy,
  degraded: styles.statusDegraded,
  unhealthy: styles.statusUnhealthy,
}

const statusLabel = {
  healthy: 'Здоров',
  degraded: 'Деградация',
  unhealthy: 'Проблемы',
}

const checkLabel: Record<string, string> = {
  database: 'База данных',
  redis: 'Redis',
  filesystem: 'Файловая система',
  external_services: 'Внешние сервисы',
  memory: 'Память',
  cpu: 'CPU',
}

const getReadableCheckName = (technicalName: string) => checkLabel[technicalName] ?? technicalName

const getHealthEndpoint = () => {
  const rawApiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? 'localhost/api'
  const normalizedBase = rawApiBase.replace(/\/$/, '')
  const rootApi = normalizedBase.endsWith('/api') ? normalizedBase.slice(0, -4) : normalizedBase
  return `${rootApi}/health/diagnostics/public`
}

const PublicHealthPage = () => {
  const [data, setData] = useState<PublicHealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHealth = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(getHealthEndpoint(), {
        credentials: 'omit',
        headers: { Accept: 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Не удалось загрузить диагностику (${response.status})`)
      }

      const body = (await response.json()) as PublicHealthResponse
      setData(body)
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : 'Неожиданная ошибка при загрузке диагностики'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchHealth()
  }, [])

  const lastUpdated = useMemo(() => {
    if (!data) {
      return ''
    }

    try {
      const timestamp = new Date(data.timestamp)
      return timestamp.toLocaleString()
    } catch {
      return data.timestamp
    }
  }, [data])

  const uptime = useMemo(() => (data ? formatDuration(data.uptime) : ''), [data])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Состояние сервиса</h1>
          <p className={styles.subtitle}>Диагностика доступна без авторизации</p>
        </div>
        <button className={styles.refreshButton} onClick={() => void fetchHealth()} disabled={loading}>
          Обновить
        </button>
      </header>

      {loading && (
        <section className={styles.stateCard}>
          <p>Загрузка данных о состоянии системы...</p>
        </section>
      )}

      {error && (
        <section className={styles.stateCard}>
          <p className={styles.errorText}>{error}</p>
        </section>
      )}

      {!loading && !error && data && (
        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <h2>Общий статус</h2>
            <p className={statusClassName[data.status]}>{statusLabel[data.status]}</p>
            <div className={styles.summaryMeta}>
              <span>Версия: {data.version}</span>
              <span>Аптайм: {uptime}</span>
              <span>Обновлено: {lastUpdated}</span>
            </div>
          </article>

          <article className={styles.summaryCard}>
            <h3>Производительность</h3>
            <ul className={styles.statList}>
              <li>
                <span>Средний отклик</span>
                <strong>{Math.round(data.metrics.performance.averageResponseTime)} мс</strong>
              </li>
              <li>
                <span>Запросов в секунду</span>
                <strong>{data.metrics.performance.requestsPerSecond.toFixed(2)}</strong>
              </li>
              <li>
                <span>Ошибка</span>
                <strong>{data.metrics.performance.errorRate.toFixed(2)}%</strong>
              </li>
            </ul>
          </article>

          <article className={styles.summaryCard}>
            <h3>Системные ресурсы</h3>
            <ul className={styles.statList}>
              <li>
                <span>CPU</span>
                <strong>{data.metrics.system.cpu.usage.toFixed(1)}%</strong>
              </li>
              <li>
                <span>Память</span>
                <strong>{data.metrics.system.memory.usagePercentage.toFixed(1)}%</strong>
              </li>
              <li>
                <span>Память использована</span>
                <strong>
                  {formatBytes(data.metrics.system.memory.used)} из {formatBytes(data.metrics.system.memory.total)}
                </strong>
              </li>
              <li>
                <span>Диск</span>
                <strong>{data.metrics.system.disk.usagePercentage.toFixed(1)}%</strong>
              </li>
              <li>
                <span>Свободно</span>
                <strong>{formatBytes(data.metrics.system.disk.free)} из {formatBytes(data.metrics.system.disk.total)}</strong>
              </li>
            </ul>
          </article>
        </section>
      )}

      {!loading && !error && data && (
        <section>
          <h2 className={styles.sectionTitle}>Проверки</h2>
          <div className={styles.checkGrid}>
            {data.checks.map((check) => (
              <article key={check.name} className={styles.checkCard}>
                <header className={styles.checkHeader}>
                  <span>{getReadableCheckName(check.name)}</span>
                  <span className={`${styles.badge} ${statusClassName[check.status]}`}>
                    {statusLabel[check.status]}
                  </span>
                </header>
                <p className={styles.checkMessage}>{check.message}</p>
                {typeof check.responseTime === 'number' && (
                  <p className={styles.checkMeta}>Время отклика: {Math.round(check.responseTime)} мс</p>
                )}
              </article>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && data && data.recommendations.length > 0 && (
        <section>
          <h2 className={styles.sectionTitle}>Рекомендации</h2>
          <ul className={styles.recommendationsList}>
            {data.recommendations.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <footer className={styles.footer}>
        <p>
          Для доступа к расширенной диагностике и управлению системой войдите в панель администратора.
        </p>
      </footer>
    </div>
  )
}

export default PublicHealthPage
