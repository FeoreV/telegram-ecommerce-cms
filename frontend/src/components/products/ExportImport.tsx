import {
    CheckCircle,
    Close,
    CloudDownload,
    CloudUpload,
    Error,
    InsertDriveFile,
    TableChart,
    Warning
} from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    MenuItem,
    Paper,
    Select,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    Typography
} from '@mui/material'
import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import { productService } from '../../services/productService'
import { Category, Product, Store } from '../../types'

interface ExportImportProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  products: Product[]
  stores: Store[]
  categories: Category[]
}

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

interface ImportRow {
  name: string
  description?: string
  sku?: string
  price: number
  stock: number
  storeId?: string
  categoryId?: string
  isActive: boolean
  images?: string[]
  errors: string[]
  isValid: boolean
}

interface ExportOptions {
  format: 'csv' | 'excel'
  includeVariants: boolean
  includeImages: boolean
  includeStats: boolean
  selectedStores: string[]
  selectedCategories: string[]
  activeOnly: boolean
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index, ...other }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`export-import-tabpanel-${index}`}
      aria-labelledby={`export-import-tab-${index}`}
      {...other}
    >
      {value === index && children}
    </div>
  )
}

const ExportImport: React.FC<ExportImportProps> = ({
  open,
  onClose,
  onSuccess,
  products = [],
  stores = [],
  categories = [],
}) => {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [importData, setImportData] = useState<ImportRow[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importPreviewOpen, setImportPreviewOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    includeVariants: false,
    includeImages: false,
    includeStats: false,
    selectedStores: [],
    selectedCategories: [],
    activeOnly: false,
  })

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const handleExport = async () => {
    setLoading(true)
    try {
      let filteredProducts = products || []

      // Применяем фильтры
      if (exportOptions.activeOnly) {
        filteredProducts = filteredProducts.filter(p => p.isActive)
      }
      if (exportOptions.selectedStores.length > 0) {
        filteredProducts = filteredProducts.filter(p =>
          p.store && exportOptions.selectedStores.includes(p.store.id)
        )
      }
      if (exportOptions.selectedCategories.length > 0) {
        filteredProducts = filteredProducts.filter(p =>
          p.category && exportOptions.selectedCategories.includes(p.category.id)
        )
      }

      // Подготавливаем данные для экспорта
      const exportData = filteredProducts.map(product => {
        const baseData = {
          'ID': product.id,
          'Название': product.name,
          'Описание': product.description || '',
          'SKU': product.sku || '',
          'Цена': product.price,
          'Остаток': product.stock,
          'Магазин': product.store.name,
          'Категория': product.category?.name || '',
          'Активен': product.isActive ? 'Да' : 'Нет',
          'Дата создания': new Date(product.createdAt).toLocaleDateString('ru'),
          'Дата обновления': new Date(product.updatedAt).toLocaleDateString('ru'),
        }

        // Добавляем дополнительные поля по опциям
        if (exportOptions.includeImages) {
          baseData['Изображения'] = Array.isArray(product.images)
            ? product.images.join('; ')
            : ''
        }

        if (exportOptions.includeStats) {
          baseData['Количество заказов'] = product._count?.orderItems || 0
        }

        if (exportOptions.includeVariants && product.variants && Array.isArray(product.variants) && product.variants.length > 0) {
          baseData['Варианты'] = product.variants.map(v =>
            `${v.name}:${v.value}${v.price ? ` (${v.price}₽)` : ''}`
          ).join('; ')
        }

        return baseData
      })

      // Создаем и скачиваем файл
      if (exportOptions.format === 'csv') {
        downloadCSV(exportData, 'products.csv')
      } else {
        downloadExcel(exportData, 'products.xlsx')
      }

      toast.success(`Экспортировано ${exportData.length} товаров`)
      onClose()
    } catch (error: any) {
      toast.error('Ошибка при экспорте: ' + error.message)
    } finally {
      setLoading(false)
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
          // Экранируем значения с запятыми и кавычками
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`
          }
          return value
        }).join(',')
      )
    ].join('\n')

    // SECURITY FIX: Sanitize filename to prevent XSS (CWE-79)
    const sanitizedFilename = filename.replace(/[<>:"\/\\|?*\x00-\x1F]/g, '_')

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = sanitizedFilename
    link.click()

    // Cleanup
    URL.revokeObjectURL(link.href)
  }

  const downloadExcel = (data: any[], filename: string) => {
    // В реальном проекте здесь должна быть интеграция с библиотекой типа xlsx
    // Пока используем CSV с другим расширением
    downloadCSV(data, filename.replace('.xlsx', '.csv'))
    toast.info('Excel экспорт в разработке. Используется CSV формат.')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setImportFile(file)
      parseImportFile(file)
    }
  }

  const parseImportFile = async (file: File) => {
    setLoading(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())

      if (lines.length < 2) {
        toast.error('Файл должен содержать заголовки и хотя бы одну строку данных')
        return
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
      const rows: ImportRow[] = []

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
        const row: ImportRow = {
          name: '',
          price: 0,
          stock: 0,
          isActive: true,
          errors: [],
          isValid: true,
        }

        // Маппинг полей
        headers.forEach((header, index) => {
          const value = values[index] || ''

          switch (header.toLowerCase()) {
            case 'название':
            case 'name':
              row.name = value
              break
            case 'описание':
            case 'description':
              row.description = value
              break
            case 'sku':
              row.sku = value
              break
            case 'цена':
            case 'price':
              row.price = parseFloat(value) || 0
              break
            case 'остаток':
            case 'stock':
              row.stock = parseInt(value) || 0
              break
            case 'магазин':
            case 'store': {
              const store = (stores || []).find(s => s.name === value || s.id === value)
              row.storeId = store?.id
              break
            }
            case 'категория':
            case 'category': {
              const category = (categories || []).find(c => c.name === value || c.id === value)
              row.categoryId = category?.id
              break
            }
            case 'активен':
            case 'active':
              row.isActive = value.toLowerCase() === 'да' || value.toLowerCase() === 'yes' || value === '1'
              break
          }
        })

        // Валидация
        if (!row.name.trim()) {
          row.errors.push('Не указано название товара')
        }
        if (row.price < 0) {
          row.errors.push('Цена не может быть отрицательной')
        }
        if (row.stock < 0) {
          row.errors.push('Остаток не может быть отрицательным')
        }
        if (!row.storeId) {
          row.errors.push('Не найден указанный магазин')
        }

        row.isValid = row.errors.length === 0
        rows.push(row)
      }

      setImportData(rows)
      setImportPreviewOpen(true)

      const validRows = rows.filter(r => r.isValid).length
      const invalidRows = rows.length - validRows

      toast.info(`Обработано ${rows.length} строк. Валидных: ${validRows}, с ошибками: ${invalidRows}`)
    } catch (error: any) {
      toast.error('Ошибка при обработке файла: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleImportConfirm = async () => {
    const validRows = importData.filter(row => row.isValid)
    if (validRows.length === 0) {
      toast.error('Нет валидных товаров для импорта')
      return
    }

    setLoading(true)
    let successCount = 0
    let errorCount = 0

    try {
      for (const row of validRows) {
        try {
          await productService.createProduct({
            name: row.name,
            description: row.description,
            sku: row.sku,
            price: row.price,
            stock: row.stock,
            storeId: row.storeId!,
            categoryId: row.categoryId,
            isActive: row.isActive,
            images: row.images || [],
          })
          successCount++
        } catch (error) {
          errorCount++
          console.error('Ошибка импорта товара:', row.name, error)
        }
      }

      toast.success(`Импортировано ${successCount} товаров${errorCount > 0 ? `, ошибок: ${errorCount}` : ''}`)

      if (successCount > 0) {
        onSuccess()
        onClose()
      }
    } catch (error: any) {
      toast.error('Ошибка при импорте: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getImportStats = () => {
    const total = importData.length
    const valid = importData.filter(r => r.isValid).length
    const invalid = total - valid
    return { total, valid, invalid }
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CloudDownload color="primary" />
            Экспорт и импорт товаров
          </Box>
        </DialogTitle>

        <DialogContent>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label="📤 Экспорт товаров" />
              <Tab label="📥 Импорт товаров" />
            </Tabs>
          </Box>

          {/* Экспорт товаров */}
          <TabPanel value={activeTab} index={0}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Параметры экспорта
                    </Typography>

                    <FormControl fullWidth margin="normal">
                      <InputLabel>Формат файла</InputLabel>
                      <Select
                        value={exportOptions.format}
                        onChange={(e) => setExportOptions(prev => ({
                          ...prev,
                          format: e.target.value as 'csv' | 'excel'
                        }))}
                        label="Формат файла"
                      >
                        <MenuItem value="csv">CSV (.csv)</MenuItem>
                        <MenuItem value="excel">Excel (.xlsx)</MenuItem>
                      </Select>
                    </FormControl>

                    <Box mt={2}>
                      <Typography variant="subtitle2" gutterBottom>
                        Дополнительные данные
                      </Typography>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportOptions.includeVariants}
                            onChange={(e) => setExportOptions(prev => ({
                              ...prev,
                              includeVariants: e.target.checked
                            }))}
                          />
                        }
                        label="Включить варианты товаров"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportOptions.includeImages}
                            onChange={(e) => setExportOptions(prev => ({
                              ...prev,
                              includeImages: e.target.checked
                            }))}
                          />
                        }
                        label="Включить изображения"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportOptions.includeStats}
                            onChange={(e) => setExportOptions(prev => ({
                              ...prev,
                              includeStats: e.target.checked
                            }))}
                          />
                        }
                        label="Включить статистику продаж"
                      />
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={exportOptions.activeOnly}
                            onChange={(e) => setExportOptions(prev => ({
                              ...prev,
                              activeOnly: e.target.checked
                            }))}
                          />
                        }
                        label="Только активные товары"
                      />
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Статистика экспорта
                    </Typography>

                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <TableChart color="primary" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Всего товаров: ${(products || []).length}`}
                          secondary="Общее количество товаров в системе"
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Активных: ${(products || []).filter(p => p.isActive).length}`}
                          secondary="Товары доступные для покупки"
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <InsertDriveFile color="info" />
                        </ListItemIcon>
                        <ListItemText
                          primary={`Магазинов: ${(stores || []).length}`}
                          secondary="Количество магазинов в системе"
                        />
                      </ListItem>
                    </List>

                    <Alert severity="info" sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        Экспортированный файл будет содержать все основные данные товаров
                        и может быть использован для создания резервных копий или анализа.
                      </Typography>
                    </Alert>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>

          {/* Импорт товаров */}
          <TabPanel value={activeTab} index={1}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  <Typography variant="body2">
                    <strong>Формат CSV файла:</strong> Название, Описание, SKU, Цена, Остаток, Магазин, Категория, Активен
                  </Typography>
                </Alert>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Выбор файла
                    </Typography>

                    <Box
                      display="flex"
                      flexDirection="column"
                      alignItems="center"
                      gap={2}
                      sx={{
                        border: '2px dashed',
                        borderColor: 'primary.main',
                        borderRadius: 2,
                        p: 3,
                        bgcolor: 'action.hover',
                      }}
                    >
                      <CloudUpload sx={{ fontSize: 48, color: 'primary.main' }} />

                      <Button
                        variant="contained"
                        component="label"
                        startIcon={<CloudUpload />}
                      >
                        Выбрать CSV файл
                        <input
                          type="file"
                          hidden
                          accept=".csv,.txt"
                          ref={fileInputRef}
                          onChange={handleFileSelect}
                        />
                      </Button>

                      {importFile && (
                        <Chip
                          label={`Выбран: ${importFile.name}`}
                          color="primary"
                          onDelete={() => {
                            setImportFile(null)
                            setImportData([])
                          }}
                        />
                      )}
                    </Box>

                    {loading && (
                      <Box mt={2}>
                        <LinearProgress />
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                          Обработка файла...
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom color="primary">
                      Требования к файлу
                    </Typography>

                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="CSV формат с запятыми"
                          secondary="Разделитель: запятая (,)"
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <CheckCircle color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="UTF-8 кодировка"
                          secondary="Для корректного отображения русских символов"
                        />
                      </ListItem>

                      <ListItem>
                        <ListItemIcon>
                          <Warning color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary="Обязательные поля"
                          secondary="Название, Цена, Остаток, Магазин"
                        />
                      </ListItem>
                    </List>

                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        const template = `Название,Описание,SKU,Цена,Остаток,Магазин,Категория,Активен
Пример товара 1,Описание товара 1,SKU001,1000,50,Название магазина,Категория 1,Да
Пример товара 2,Описание товара 2,SKU002,2000,25,Название магазина,Категория 2,Нет`

                        const blob = new Blob(['\uFEFF' + template], { type: 'text/csv;charset=utf-8;' })
                        const link = document.createElement('a')
                        const url = URL.createObjectURL(blob)
                        link.href = url
                        link.download = 'products_template.csv'
                        link.click()
                        // SECURITY FIX: Cleanup object URL to prevent memory leak
                        URL.revokeObjectURL(url)
                      }}
                    >
                      Скачать шаблон
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </TabPanel>
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Отмена
          </Button>

          {activeTab === 0 && (
            <Button
              variant="contained"
              onClick={handleExport}
              disabled={loading}
              startIcon={<CloudDownload />}
            >
              {loading ? 'Экспорт...' : 'Экспортировать товары'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Диалог предварительного просмотра импорта */}
      <Dialog
        open={importPreviewOpen}
        onClose={() => setImportPreviewOpen(false)}
        maxWidth="xl"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">
              Предварительный просмотр импорта
            </Typography>
            <Box display="flex" gap={1}>
              {(() => {
                const stats = getImportStats()
                return (
                  <>
                    <Chip label={`Всего: ${stats.total}`} color="default" size="small" />
                    <Chip label={`Валидных: ${stats.valid}`} color="success" size="small" />
                    {stats.invalid > 0 && (
                      <Chip label={`Ошибок: ${stats.invalid}`} color="error" size="small" />
                    )}
                  </>
                )
              })()}
              <IconButton size="small" onClick={() => setImportPreviewOpen(false)}>
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Статус</TableCell>
                  <TableCell>Название</TableCell>
                  <TableCell>Цена</TableCell>
                  <TableCell>Остаток</TableCell>
                  <TableCell>Магазин</TableCell>
                  <TableCell>Категория</TableCell>
                  <TableCell>Ошибки</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {importData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {row.isValid ? (
                        <CheckCircle color="success" fontSize="small" />
                      ) : (
                        <Error color="error" fontSize="small" />
                      )}
                    </TableCell>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.price}</TableCell>
                    <TableCell>{row.stock}</TableCell>
                    <TableCell>
                      {(stores || []).find(s => s.id === row.storeId)?.name || 'Не найден'}
                    </TableCell>
                    <TableCell>
                      {row.categoryId ?
                        (categories || []).find(c => c.id === row.categoryId)?.name :
                        'Без категории'
                      }
                    </TableCell>
                    <TableCell>
                      {row.errors.length > 0 ? (
                        <Typography variant="caption" color="error">
                          {row.errors.join(', ')}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="success.main">
                          ОК
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setImportPreviewOpen(false)}>
            Отмена
          </Button>
          <Button
            variant="contained"
            onClick={handleImportConfirm}
            disabled={loading || getImportStats().valid === 0}
            color="primary"
          >
            {loading ? 'Импорт...' : `Импортировать ${getImportStats().valid} товаров`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ExportImport
