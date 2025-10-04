import {
    Edit,
    Error,
    Inventory,
    NotificationsActive,
    Refresh,
    Settings,
    ShoppingCart,
    Store as StoreIcon,
    TrendingDown,
    Warning
} from '@mui/icons-material'
import {
    Alert,
    Avatar,
    Badge,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemSecondaryAction,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material'
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { useSocket } from '../../contexts/SocketContext'

interface InventoryAlert {
  type: 'LOW_STOCK' | 'OUT_OF_STOCK'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  product: {
    id: string
    name: string
    sku?: string
    stock: number
    images?: string[]
    trackStock: boolean
  }
  store: {
    id: string
    name: string
    slug: string
  }
  variants?: Array<{
    id: string
    name: string
    value: string
    stock: number
    sku?: string
  }>
  recentSales?: number
  message: string
  recommendedAction: string
  createdAt: string
}

interface AlertsSummary {
  total: number
  critical: number
  high: number
  medium: number
  outOfStock: number
  lowStock: number
}

import { inventoryService } from '../../services/inventoryService'

interface InventoryAlertsPanelProps {
  storeId?: string
  showSettings?: boolean
}

const InventoryAlertsPanel: React.FC<InventoryAlertsPanelProps> = ({
  storeId,
  showSettings = true
}) => {
  const { socket } = useSocket()
  const [alerts, setAlerts] = useState<InventoryAlert[]>([])
  const [summary, setSummary] = useState<AlertsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [stockUpdateDialog, setStockUpdateDialog] = useState<{
    open: boolean
    alert?: InventoryAlert
    variantId?: string
  }>({ open: false })
  const [settingsDialog, setSettingsDialog] = useState(false)
  const [newStock, setNewStock] = useState('')
  const [updateReason, setUpdateReason] = useState('')
  const [filters, setFilters] = useState({
    severity: 'all',
    type: 'all'
  })

  const loadAlerts = useCallback(async () => {
    try {
      const filterParams: any = {}
      if (storeId) filterParams.storeId = storeId
      if (filters.severity !== 'all') filterParams.severity = filters.severity.toUpperCase()

      const response = await inventoryService.getInventoryAlerts(filterParams)

      let filteredAlerts = response.alerts
      if (filters.type !== 'all') {
        filteredAlerts = response.alerts.filter(alert => alert.type === filters.type)
      }

      setAlerts(filteredAlerts)
      setSummary(response.summary)
    } catch (error: any) {
      toast.error('Ошибка при загрузке предупреждений')
    } finally {
      setLoading(false)
    }
  }, [storeId, filters])

  useEffect(() => {
    loadAlerts()
  }, [storeId, filters, loadAlerts])

  // Listen for real-time inventory updates
  useEffect(() => {
    if (!socket) return

    const handleStockUpdate = (data: any) => {
      toast.info(`Запасы обновлены: ${data.productName}`)
      loadAlerts() // Refresh alerts
    }

    const handleInventoryAlert = (data: any) => {
      const alertMessage = data.type === 'out_of_stock'
        ? `🚨 Товар "${data.productName}" закончился`
        : `⚠️ Низкий остаток: ${data.productName} (${data.stock} шт.)`

      toast.warning(alertMessage, {
        autoClose: data.severity === 'critical' ? false : 8000
      })

      loadAlerts() // Refresh alerts
    }

    socket.on('inventory:stock_updated', handleStockUpdate)
    socket.on('inventory:alert', handleInventoryAlert)

    return () => {
      socket.off('inventory:stock_updated', handleStockUpdate)
      socket.off('inventory:alert', handleInventoryAlert)
    }
  }, [socket, loadAlerts])

  const handleStockUpdate = async () => {
    if (!stockUpdateDialog.alert || !newStock) return

    try {
      const stockValue = parseInt(newStock)
      if (isNaN(stockValue) || stockValue < 0) {
        toast.error('Введите корректное количество')
        return
      }

      await inventoryService.updateStock({
        productId: stockUpdateDialog.alert.product.id,
        variantId: stockUpdateDialog.variantId,
        stock: stockValue,
        reason: updateReason || 'Manual update'
      })

      toast.success('Запасы обновлены')
      setStockUpdateDialog({ open: false })
      setNewStock('')
      setUpdateReason('')
      loadAlerts()
    } catch (error: any) {
      toast.error('Ошибка при обновлении запасов')
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'error'
      case 'HIGH': return 'warning'
      case 'MEDIUM': return 'info'
      case 'LOW': return 'success'
      default: return 'default'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <Error color="error" />
      case 'HIGH': return <Warning color="warning" />
      default: return <Inventory color="action" />
    }
  }

  const getStockLevel = (current: number, max: number = 100) => {
    return Math.min((current / max) * 100, 100)
  }

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          <Inventory />
          <Typography variant="h6">Загрузка предупреждений...</Typography>
        </Box>
        <LinearProgress />
      </Paper>
    )
  }

  return (
    <Box>
      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'error.main' }}>
                    <Error />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{summary.critical}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Критичные
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'warning.main' }}>
                    <Warning />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{summary.high}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Важные
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'error.dark' }}>
                    <TrendingDown />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{summary.outOfStock}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Нет в наличии
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2}>
                  <Avatar sx={{ bgcolor: 'info.main' }}>
                    <Inventory />
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{summary.lowStock}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Низкий остаток
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Main Panel */}
      <Paper sx={{ p: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Box display="flex" alignItems="center" gap={2}>
            <Badge badgeContent={summary?.total || 0} color="error">
              <NotificationsActive />
            </Badge>
            <Typography variant="h6">
              Предупреждения о запасах
            </Typography>
          </Box>
          <Box display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Важность</InputLabel>
              <Select
                value={filters.severity}
                onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                label="Важность"
              >
                <MenuItem value="all">Все</MenuItem>
                <MenuItem value="critical">Критичные</MenuItem>
                <MenuItem value="high">Важные</MenuItem>
                <MenuItem value="medium">Средние</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadAlerts}
              size="small"
            >
              Обновить
            </Button>

            {showSettings && (
              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setSettingsDialog(true)}
                size="small"
              >
                Настройки
              </Button>
            )}
          </Box>
        </Box>

        {alerts.length === 0 ? (
          <Alert severity="success">
            <Typography variant="h6">Отлично!</Typography>
            <Typography>Все товары в наличии. Критичных предупреждений нет.</Typography>
          </Alert>
        ) : (
          <List>
            {alerts.map((alert, index) => (
              <React.Fragment key={`${alert.product.id}-${index}`}>
                <ListItem>
                  <ListItemIcon>
                    {getSeverityIcon(alert.severity)}
                  </ListItemIcon>

                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1} mb={1}>
                        <Typography variant="subtitle1" fontWeight="medium">
                          {alert.product.name}
                        </Typography>
                        <Chip
                          label={alert.severity}
                          color={getSeverityColor(alert.severity) as any}
                          size="small"
                        />
                        <Chip
                          label={alert.store.name}
                          icon={<StoreIcon />}
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {alert.message}
                        </Typography>
                        <Typography variant="caption" color="primary">
                          💡 {alert.recommendedAction}
                        </Typography>

                        {alert.variants && alert.variants.length > 0 && (
                          <Box mt={1}>
                            <Typography variant="caption" color="text.secondary">
                              Варианты с низким остатком:
                            </Typography>
                            <Box display="flex" gap={0.5} mt={0.5} flexWrap="wrap">
                              {alert.variants.map(variant => (
                                <Chip
                                  key={variant.id}
                                  label={`${variant.name}: ${variant.value} (${variant.stock} шт.)`}
                                  size="small"
                                  variant="outlined"
                                  color={variant.stock === 0 ? 'error' : 'warning'}
                                  onClick={() => setStockUpdateDialog({
                                    open: true,
                                    alert,
                                    variantId: variant.id
                                  })}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {alert.recentSales !== undefined && (
                          <Box display="flex" alignItems="center" gap={1} mt={1}>
                            <ShoppingCart fontSize="small" />
                            <Typography variant="caption">
                              Продано за неделю: {alert.recentSales} шт.
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />

                  <ListItemSecondaryAction>
                    <Tooltip title="Обновить запасы">
                      <IconButton
                        onClick={() => setStockUpdateDialog({
                          open: true,
                          alert
                        })}
                        color="primary"
                        size="small"
                      >
                        <Edit />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>

                {index < alerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </List>
        )}
      </Paper>

      {/* Stock Update Dialog */}
      <Dialog
        open={stockUpdateDialog.open}
        onClose={() => setStockUpdateDialog({ open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Обновить запасы: {stockUpdateDialog.alert?.product.name}
          {stockUpdateDialog.variantId && (
            <Typography variant="body2" color="text.secondary">
              Вариант: {stockUpdateDialog.alert?.variants?.find(v => v.id === stockUpdateDialog.variantId)?.name}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <Box mt={2}>
            <TextField
              fullWidth
              label="Новое количество"
              type="number"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              inputProps={{ min: 0 }}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Причина изменения (необязательно)"
              value={updateReason}
              onChange={(e) => setUpdateReason(e.target.value)}
              placeholder="Поступление товара, корректировка и т.д."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockUpdateDialog({ open: false })}>
            Отмена
          </Button>
          <Button
            onClick={handleStockUpdate}
            variant="contained"
            disabled={!newStock}
          >
            Обновить
          </Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={settingsDialog}
        onClose={() => setSettingsDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Настройки уведомлений о запасах</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Настройте пороги для автоматических уведомлений о низких запасах
          </Alert>
          {/* Settings form would go here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialog(false)}>
            Отмена
          </Button>
          <Button variant="contained">
            Сохранить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default InventoryAlertsPanel
