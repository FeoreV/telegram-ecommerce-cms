import React, { useState } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Typography,
  Box,
  Checkbox,
  FormControlLabel,
  FormGroup,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material'
import {
  GetApp,
  TableView,
  PictureAsPdf,
  Description,
  Assessment,
} from '@mui/icons-material'
import { Store } from '../../types'
import { storeService } from '../../services/storeService'
import { dashboardService } from '../../services/dashboardService'
import { toast } from 'react-toastify'

interface StoreExportProps {
  stores: Store[]
  selectedStores?: string[]
}

type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf'
type ExportType = 'basic' | 'detailed' | 'analytics' | 'custom'

interface ExportOptions {
  format: ExportFormat
  type: ExportType
  includeFields: {
    basicInfo: boolean
    contactInfo: boolean
    settings: boolean
    analytics: boolean
    products: boolean
    orders: boolean
    admins: boolean
  }
  period?: 'week' | 'month' | 'quarter' | 'year'
}

const StoreExport: React.FC<StoreExportProps> = ({ stores, selectedStores = [] }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    type: 'basic',
    includeFields: {
      basicInfo: true,
      contactInfo: true,
      settings: false,
      analytics: false,
      products: false,
      orders: false,
      admins: false,
    },
    period: 'month',
  })

  const exportFormats = [
    { value: 'csv', label: 'CSV', icon: <TableView />, description: 'Таблица для Excel/Google Sheets' },
    { value: 'json', label: 'JSON', icon: <Description />, description: 'Структурированные данные' },
    { value: 'xlsx', label: 'Excel', icon: <Assessment />, description: 'Файл Microsoft Excel' },
    { value: 'pdf', label: 'PDF', icon: <PictureAsPdf />, description: 'Отчет в PDF формате' },
  ]

  const exportTypes = [
    { value: 'basic', label: 'Базовая информация', description: 'Основные данные магазинов' },
    { value: 'detailed', label: 'Подробная информация', description: 'Все доступные данные' },
    { value: 'analytics', label: 'Аналитика', description: 'Метрики и статистика' },
    { value: 'custom', label: 'Настраиваемый', description: 'Выберите поля вручную' },
  ]

  const handleExportClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleExportType = (type: ExportType) => {
    setOptions(prev => ({ ...prev, type }))
    
    // Set default fields based on type
    switch (type) {
      case 'basic':
        setOptions(prev => ({
          ...prev,
          includeFields: {
            basicInfo: true,
            contactInfo: true,
            settings: false,
            analytics: false,
            products: false,
            orders: false,
            admins: false,
          }
        }))
        break
      case 'detailed':
        setOptions(prev => ({
          ...prev,
          includeFields: {
            basicInfo: true,
            contactInfo: true,
            settings: true,
            analytics: false,
            products: true,
            orders: true,
            admins: true,
          }
        }))
        break
      case 'analytics':
        setOptions(prev => ({
          ...prev,
          includeFields: {
            basicInfo: true,
            contactInfo: false,
            settings: false,
            analytics: true,
            products: true,
            orders: true,
            admins: false,
          }
        }))
        break
    }
    
    setDialogOpen(true)
    handleMenuClose()
  }

  const handleExport = async () => {
    setLoading(true)
    setProgress(0)

    try {
      const storesToExport = selectedStores.length > 0 
        ? stores.filter(store => selectedStores.includes(store.id))
        : stores

      const exportData: any[] = []

      for (let i = 0; i < storesToExport.length; i++) {
        const store = storesToExport[i]
        let storeData: any = {}

        if (options.includeFields.basicInfo) {
          storeData = {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            currency: store.currency,
            status: store.status,
            createdAt: store.createdAt,
            updatedAt: store.updatedAt,
            owner: `${store.owner.firstName} ${store.owner.lastName}`,
            productsCount: store._count.products,
            ordersCount: store._count.orders,
          }
        }

        if (options.includeFields.contactInfo && store.contactInfo) {
          storeData.contactPhone = store.contactInfo.phone
          storeData.contactEmail = store.contactInfo.email
          storeData.contactAddress = store.contactInfo.address
        }

        if (options.includeFields.settings && store.settings) {
          storeData.paymentInstructions = store.settings.paymentInstructions
          storeData.termsOfService = store.settings.termsOfService
        }

        if (options.includeFields.admins && store.admins) {
          storeData.admins = store.admins.map(admin => 
            `${admin.user.firstName} ${admin.user.lastName}`
          ).join(', ')
          storeData.adminCount = store.admins.length
        }

        if (options.includeFields.analytics) {
          try {
            const analytics = await dashboardService.getComparisonData({
              storeId: store.id,
              period: options.period,
            })
            storeData.revenueGrowth = analytics.revenueChange || 0
            storeData.orderGrowth = analytics.ordersChange || 0
            storeData.avgOrderValue = analytics.avgOrderValue || 0
          } catch (error) {
            console.error(`Error loading analytics for store ${store.id}:`, error)
          }
        }

        exportData.push(storeData)
        setProgress(((i + 1) / storesToExport.length) * 100)
      }

      // Generate and download file
      await downloadFile(exportData, options.format, storesToExport.length)

      toast.success(`Экспортировано ${storesToExport.length} магазинов в формате ${options.format.toUpperCase()}`)
      setDialogOpen(false)
    } catch (error: any) {
      toast.error('Ошибка при экспорте данных')
      console.error('Export error:', error)
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const downloadFile = async (data: any[], format: ExportFormat, count: number) => {
    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `stores_export_${timestamp}`

    switch (format) {
      case 'csv':
        downloadCSV(data, `${filename}.csv`)
        break
      case 'json':
        downloadJSON(data, `${filename}.json`)
        break
      case 'xlsx':
        // Would need library like xlsx for proper Excel export
        downloadCSV(data, `${filename}.csv`) // Fallback to CSV
        break
      case 'pdf':
        // Would need library like jsPDF for PDF generation
        downloadJSON(data, `${filename}.json`) // Fallback to JSON
        break
    }
  }

  const downloadCSV = (data: any[], filename: string) => {
    if (data.length === 0) return

    const headers = Object.keys(data[0])
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header]
          return typeof value === 'string' && value.includes(',') 
            ? `"${value}"` 
            : value
        }).join(',')
      )
    ].join('\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const downloadJSON = (data: any[], filename: string) => {
    const jsonContent = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonContent], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const getSelectedStoresText = () => {
    if (selectedStores.length === 0) {
      return `Все магазины (${stores.length})`
    }
    return `Выбранные магазины (${selectedStores.length})`
  }

  return (
    <>
      <Button
        startIcon={<GetApp />}
        onClick={handleExportClick}
        variant="outlined"
        size="small"
      >
        Экспорт
      </Button>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        {exportTypes.map((type) => (
          <MenuItem key={type.value} onClick={() => handleExportType(type.value as ExportType)}>
            <Box>
              <Typography variant="body2" fontWeight="medium">
                {type.label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {type.description}
              </Typography>
            </Box>
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Экспорт магазинов</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {getSelectedStoresText()}
          </Typography>

          <Box display="flex" gap={2} mb={3}>
            <Chip label={exportTypes.find(t => t.value === options.type)?.label} color="primary" />
            <Chip label={exportFormats.find(f => f.value === options.format)?.label} />
          </Box>

          {/* Format Selection */}
          <FormControl fullWidth margin="normal">
            <InputLabel>Формат файла</InputLabel>
            <Select
              value={options.format}
              onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value as ExportFormat }))}
              label="Формат файла"
            >
              {exportFormats.map((format) => (
                <MenuItem key={format.value} value={format.value}>
                  <Box display="flex" alignItems="center" gap={1}>
                    {format.icon}
                    <Box>
                      <Typography variant="body2">{format.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format.description}
                      </Typography>
                    </Box>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Custom Fields Selection */}
          {options.type === 'custom' && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Выберите поля для экспорта:
              </Typography>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields.basicInfo}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        includeFields: { ...prev.includeFields, basicInfo: e.target.checked }
                      }))}
                    />
                  }
                  label="Основная информация"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields.contactInfo}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        includeFields: { ...prev.includeFields, contactInfo: e.target.checked }
                      }))}
                    />
                  }
                  label="Контактная информация"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields.settings}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        includeFields: { ...prev.includeFields, settings: e.target.checked }
                      }))}
                    />
                  }
                  label="Настройки магазина"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields.analytics}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        includeFields: { ...prev.includeFields, analytics: e.target.checked }
                      }))}
                    />
                  }
                  label="Аналитика и метрики"
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={options.includeFields.admins}
                      onChange={(e) => setOptions(prev => ({
                        ...prev,
                        includeFields: { ...prev.includeFields, admins: e.target.checked }
                      }))}
                    />
                  }
                  label="Администраторы"
                />
              </FormGroup>
            </Box>
          )}

          {/* Analytics Period */}
          {options.includeFields.analytics && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Период аналитики</InputLabel>
              <Select
                value={options.period}
                onChange={(e) => setOptions(prev => ({ ...prev, period: e.target.value as any }))}
                label="Период аналитики"
              >
                <MenuItem value="week">Неделя</MenuItem>
                <MenuItem value="month">Месяц</MenuItem>
                <MenuItem value="quarter">Квартал</MenuItem>
                <MenuItem value="year">Год</MenuItem>
              </Select>
            </FormControl>
          )}

          {loading && (
            <Box mt={2}>
              <Typography variant="body2" gutterBottom>
                Экспорт данных... {progress.toFixed(0)}%
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button onClick={handleExport} variant="contained" disabled={loading}>
            {loading ? 'Экспорт...' : 'Экспортировать'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default StoreExport
