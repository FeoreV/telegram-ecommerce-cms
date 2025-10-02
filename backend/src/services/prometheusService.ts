import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';
import { logger } from '../utils/logger';

/**
 * Prometheus Metrics Service
 * Collects and exposes application metrics in Prometheus format
 */
class PrometheusService {
  private static instance: PrometheusService;
  public registry: Registry;

  // HTTP Metrics
  public httpRequestsTotal: Counter<string>;
  public httpRequestDuration: Histogram<string>;
  public httpRequestsInProgress: Gauge<string>;

  // Business Metrics
  public ordersTotal: Counter<string>;
  public ordersValue: Counter<string>;
  public activeStores: Gauge<string>;
  public activeProducts: Gauge<string>;
  public activeUsers: Gauge<string>;

  // Bot Metrics
  public botCommandsTotal: Counter<string>;
  public botMessagesTotal: Counter<string>;
  public botErrorsTotal: Counter<string>;

  // Security Metrics
  public authAttemptsTotal: Counter<string>;
  public rateLimitHits: Counter<string>;
  public invalidTokenAttempts: Counter<string>;

  // System Metrics
  public systemMemoryUsage: Gauge<string>;
  public systemCpuUsage: Gauge<string>;
  public databaseConnectionsActive: Gauge<string>;
  public redisConnectionsActive: Gauge<string>;

  // Payment Metrics
  public paymentsTotal: Counter<string>;
  public paymentVerificationDuration: Histogram<string>;

  // Inventory Metrics
  public stockLevels: Gauge<string>;
  public lowStockAlerts: Counter<string>;

  // Notification Metrics
  public notificationsTotal: Counter<string>;
  public notificationDeliveryDuration: Histogram<string>;

  private constructor() {
    this.registry = new Registry();

    // Collect default metrics (CPU, memory, etc.)
    collectDefaultMetrics({ 
      register: this.registry,
      prefix: 'botrt_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    // Initialize HTTP metrics
    this.httpRequestsTotal = new Counter({
      name: 'botrt_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry]
    });

    this.httpRequestDuration = new Histogram({
      name: 'botrt_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry]
    });

    this.httpRequestsInProgress = new Gauge({
      name: 'botrt_http_requests_in_progress',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.registry]
    });

    // Business metrics
    this.ordersTotal = new Counter({
      name: 'botrt_orders_total',
      help: 'Total number of orders',
      labelNames: ['status', 'store_id', 'payment_method'],
      registers: [this.registry]
    });

    this.ordersValue = new Counter({
      name: 'botrt_orders_value_total',
      help: 'Total value of orders in base currency',
      labelNames: ['currency', 'store_id'],
      registers: [this.registry]
    });

    this.activeStores = new Gauge({
      name: 'botrt_active_stores',
      help: 'Number of active stores',
      registers: [this.registry]
    });

    this.activeProducts = new Gauge({
      name: 'botrt_active_products',
      help: 'Number of active products',
      labelNames: ['store_id'],
      registers: [this.registry]
    });

    this.activeUsers = new Gauge({
      name: 'botrt_active_users',
      help: 'Number of active users',
      labelNames: ['role'],
      registers: [this.registry]
    });

    // Bot metrics
    this.botCommandsTotal = new Counter({
      name: 'botrt_bot_commands_total',
      help: 'Total number of bot commands received',
      labelNames: ['command', 'store_id'],
      registers: [this.registry]
    });

    this.botMessagesTotal = new Counter({
      name: 'botrt_bot_messages_total',
      help: 'Total number of bot messages',
      labelNames: ['type', 'store_id'],
      registers: [this.registry]
    });

    this.botErrorsTotal = new Counter({
      name: 'botrt_bot_errors_total',
      help: 'Total number of bot errors',
      labelNames: ['error_type', 'store_id'],
      registers: [this.registry]
    });

    // Security metrics
    this.authAttemptsTotal = new Counter({
      name: 'botrt_auth_attempts_total',
      help: 'Total authentication attempts',
      labelNames: ['result', 'method'],
      registers: [this.registry]
    });

    this.rateLimitHits = new Counter({
      name: 'botrt_rate_limit_hits_total',
      help: 'Total rate limit hits',
      labelNames: ['endpoint', 'user_id'],
      registers: [this.registry]
    });

    this.invalidTokenAttempts = new Counter({
      name: 'botrt_invalid_token_attempts_total',
      help: 'Total invalid token attempts',
      registers: [this.registry]
    });

    // System metrics
    this.systemMemoryUsage = new Gauge({
      name: 'botrt_system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry]
    });

    this.systemCpuUsage = new Gauge({
      name: 'botrt_system_cpu_usage_percent',
      help: 'System CPU usage percentage',
      registers: [this.registry]
    });

    this.databaseConnectionsActive = new Gauge({
      name: 'botrt_database_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry]
    });

    this.redisConnectionsActive = new Gauge({
      name: 'botrt_redis_connections_active',
      help: 'Number of active Redis connections',
      registers: [this.registry]
    });

    // Payment metrics
    this.paymentsTotal = new Counter({
      name: 'botrt_payments_total',
      help: 'Total number of payments',
      labelNames: ['status', 'method', 'store_id'],
      registers: [this.registry]
    });

    this.paymentVerificationDuration = new Histogram({
      name: 'botrt_payment_verification_duration_seconds',
      help: 'Payment verification duration in seconds',
      labelNames: ['method', 'store_id'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
      registers: [this.registry]
    });

    // Inventory metrics
    this.stockLevels = new Gauge({
      name: 'botrt_stock_levels',
      help: 'Current stock levels for products',
      labelNames: ['product_id', 'store_id', 'product_name'],
      registers: [this.registry]
    });

    this.lowStockAlerts = new Counter({
      name: 'botrt_low_stock_alerts_total',
      help: 'Total number of low stock alerts',
      labelNames: ['product_id', 'store_id'],
      registers: [this.registry]
    });

    // Notification metrics
    this.notificationsTotal = new Counter({
      name: 'botrt_notifications_total',
      help: 'Total number of notifications sent',
      labelNames: ['type', 'channel', 'priority', 'status'],
      registers: [this.registry]
    });

    this.notificationDeliveryDuration = new Histogram({
      name: 'botrt_notification_delivery_duration_seconds',
      help: 'Notification delivery duration in seconds',
      labelNames: ['channel', 'priority'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry]
    });

    logger.info('✅ PrometheusService initialized with custom metrics');
  }

  public static getInstance(): PrometheusService {
    if (!PrometheusService.instance) {
      PrometheusService.instance = new PrometheusService();
    }
    return PrometheusService.instance;
  }

  /**
   * Get metrics in Prometheus format
   */
  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get metrics as JSON
   */
  public async getMetricsJSON() {
    return this.registry.getMetricsAsJSON();
  }

  /**
   * Update system metrics (called periodically)
   */
  public updateSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    this.systemMemoryUsage.set({ type: 'heapUsed' }, memUsage.heapUsed);
    this.systemMemoryUsage.set({ type: 'heapTotal' }, memUsage.heapTotal);
    this.systemMemoryUsage.set({ type: 'rss' }, memUsage.rss);
    this.systemMemoryUsage.set({ type: 'external' }, memUsage.external);

    const cpuUsage = process.cpuUsage();
    const totalUsage = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    this.systemCpuUsage.set(totalUsage);
  }

  /**
   * Record HTTP request
   */
  public recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.httpRequestsTotal.inc({ 
      method, 
      route, 
      status_code: statusCode.toString() 
    });
    
    this.httpRequestDuration.observe({ 
      method, 
      route, 
      status_code: statusCode.toString() 
    }, duration / 1000); // Convert to seconds
  }

  /**
   * Record order creation
   */
  public recordOrder(status: string, storeId: string, paymentMethod: string, value: number, currency: string): void {
    this.ordersTotal.inc({ status, store_id: storeId, payment_method: paymentMethod });
    this.ordersValue.inc({ currency, store_id: storeId }, value);
  }

  /**
   * Record bot command
   */
  public recordBotCommand(command: string, storeId: string): void {
    this.botCommandsTotal.inc({ command, store_id: storeId });
  }

  /**
   * Record authentication attempt
   */
  public recordAuthAttempt(result: 'success' | 'failure', method: string): void {
    this.authAttemptsTotal.inc({ result, method });
  }

  /**
   * Record payment
   */
  public recordPayment(status: string, method: string, storeId: string): void {
    this.paymentsTotal.inc({ status, method, store_id: storeId });
  }

  /**
   * Record notification
   */
  public recordNotification(type: string, channel: string, priority: string, status: string): void {
    this.notificationsTotal.inc({ type, channel, priority, status });
  }

  /**
   * Start periodic system metrics collection
   */
  public startPeriodicCollection(intervalMs: number = 10000): void {
    setInterval(() => {
      this.updateSystemMetrics();
    }, intervalMs);

    logger.info(`✅ Started periodic metrics collection every ${intervalMs}ms`);
  }
}

export default PrometheusService;
