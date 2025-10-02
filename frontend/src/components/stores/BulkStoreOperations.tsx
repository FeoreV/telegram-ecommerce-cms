import React, { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Chip,
  LinearProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import {
  SelectAll,
  MoreVert,
  CheckCircle,
  Block,
  Delete,
  GetApp,
  AttachMoney,
} from '@mui/icons-material'
import { Store } from '../../types'
import { storeService } from '../../services/storeService'
import { toast } from 'react-toastify'

interface BulkStoreOperationsProps {
  stores: Store[]
  selectedStores: string[]
  onSelectionChange: (storeIds: string[]) => void
  onRefresh: () => void
}

type BulkOperation = 'activate' | 'deactivate' | 'delete' | 'export' | 'change-currency'

const BulkStoreOperations: React.FC<BulkStoreOperationsProps> = ({
  stores,
  selectedStores,
  onSelectionChange,
  onRefresh,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<BulkOperation | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [newCurrency, setNewCurrency] = useState('')

  const currencies = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'RUB', label: 'RUB (₽)' },
    { value: 'UAH', label: 'UAH (₴)' },
    { value: 'KZT', label: 'KZT (₸)' },
  ]

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(stores.map(store => store.id))
    } else {
      onSelectionChange([])
    }
  }

  const handleBulkOperation = (operation: BulkOperation) => {
    setCurrentOperation(operation)
    setDialogOpen(true)
    handleMenuClose()
  }

  const executeOperation = async () => {
    if (!currentOperation || selectedStores.length === 0) return

    setLoading(true)
    setProgress(0)
    
    try {
      const selectedStoreObjects = stores.filter(store => selectedStores.includes(store.id))
      
      for (let i = 0; i < selectedStoreObjects.length; i++) {
        const store = selectedStoreObjects[i]
        
        switch (currentOperation) {
          case 'activate':
            await storeService.updateStore(store.id, { status: 'ACTIVE' })
            break
          case 'deactivate':
            await storeService.updateStore(store.id, { status: 'INACTIVE' })
            break
          case 'delete':
            await storeService.deleteStore(store.id)
            break
          case 'change-currency':
            if (newCurrency) {
              await storeService.updateStore(store.id, { currency: newCurrency })
            }
            break
          case 'export':
            // Экспорт будет реализован в следующем задании
            break
        }
        
        setProgress(((i + 1) / selectedStoreObjects.length) * 100)
      }

      const operationMessages = {
        activate: `Активировано ${selectedStores.length} магазинов`,
        deactivate: `Деактивировано ${selectedStores.length} магазинов`,
        delete: `Удалено ${selectedStores.length} магазинов`,
        'change-currency': `Изменена валюта у ${selectedStores.length} магазинов`,
        export: `Экспортировано ${selectedStores.length} магазинов`,
      }

      toast.success(operationMessages[currentOperation])
      onSelectionChange([])
      onRefresh()
      setDialogOpen(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при выполнении операции')
    } finally {
      setLoading(false)
      setProgress(0)
      setNewCurrency('')
    }
  }

  const getOperationTitle = () => {
    const titles = {
      activate: 'Активация магазинов',
      deactivate: 'Деактивация магазинов',
      delete: 'Удаление магазинов',
      'change-currency': 'Изменение валюты',
      export: 'Экспорт магазинов',
    }
    return currentOperation ? titles[currentOperation] : ''
  }

  const getOperationDescription = () => {
    const descriptions = {
      activate: 'Все выбранные магазины будут активированы и станут доступными для покупателей.',
      deactivate: 'Все выбранные магазины будут деактивированы и станут недоступными для покупателей.',
      delete: 'Все выбранные магазины будут удалены безвозвратно. Это действие необратимо!',
      'change-currency': 'У всех выбранных магазинов будет изменена валюта.',
      export: 'Данные выбранных магазинов будут экспортированы в файл.',
    }
    return currentOperation ? descriptions[currentOperation] : ''
  }

  const selectedStoreObjects = stores.filter(store => selectedStores.includes(store.id))
  const allSelected = stores.length > 0 && selectedStores.length === stores.length
  const someSelected = selectedStores.length > 0 && selectedStores.length < stores.length

  if (stores.length === 0) {
    return null
  }

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} p={2} sx={{ bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControlLabel
            control={
              <Checkbox
                checked={allSelected}
                indeterminate={someSelected}
                onChange={(e) => handleSelectAll(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                {selectedStores.length > 0 
                  ? `Выбрано ${selectedStores.length} из ${stores.length}` 
                  : 'Выбрать все'
                }
              </Typography>
            }
          />
          
          {selectedStores.length > 0 && (
            <Chip 
              label={`${selectedStores.length} выбрано`}
              color="primary"
              size="small"
            />
          )}
        </Box>

        {selectedStores.length > 0 && (
          <Button
            startIcon={<MoreVert />}
            onClick={handleMenuOpen}
            variant="outlined"
            size="small"
          >
            Действия
          </Button>
        )}
      </Box>

      {/* Bulk Operations Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => handleBulkOperation('activate')}>
          <CheckCircle sx={{ mr: 1 }} color="success" />
          Активировать выбранные
        </MenuItem>
        <MenuItem onClick={() => handleBulkOperation('deactivate')}>
          <Block sx={{ mr: 1 }} color="warning" />
          Деактивировать выбранные
        </MenuItem>
        <MenuItem onClick={() => handleBulkOperation('change-currency')}>
          <AttachMoney sx={{ mr: 1 }} color="info" />
          Изменить валюту
        </MenuItem>
        <MenuItem onClick={() => handleBulkOperation('export')}>
          <GetApp sx={{ mr: 1 }} color="info" />
          Экспортировать
        </MenuItem>
        <MenuItem 
          onClick={() => handleBulkOperation('delete')}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Удалить выбранные
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{getOperationTitle()}</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            {getOperationDescription()}
          </Typography>

          {currentOperation === 'change-currency' && (
            <FormControl fullWidth sx={{ mt: 2 }}>
              <InputLabel>Новая валюта</InputLabel>
              <Select
                value={newCurrency}
                onChange={(e) => setNewCurrency(e.target.value)}
                label="Новая валюта"
              >
                {currencies.map((currency) => (
                  <MenuItem key={currency.value} value={currency.value}>
                    {currency.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
            Выбранные магазины ({selectedStoreObjects.length}):
          </Typography>
          <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
            {selectedStoreObjects.map((store) => (
              <ListItem key={store.id} divider>
                <ListItemText
                  primary={store.name}
                  secondary={`${store.slug} • ${store.currency}`}
                />
                <Chip 
                  label={store.status} 
                  color={store.status === 'ACTIVE' ? 'success' : 'default'}
                  size="small" 
                />
              </ListItem>
            ))}
          </List>

          {currentOperation === 'delete' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>Внимание!</strong> Удаление магазинов приведет к удалению всех связанных данных:
                товаров, заказов, администраторов. Это действие необратимо!
              </Typography>
            </Alert>
          )}

          {loading && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" gutterBottom>
                Выполнение операции... {progress.toFixed(0)}%
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={executeOperation}
            variant="contained"
            disabled={loading || (currentOperation === 'change-currency' && !newCurrency)}
            color={currentOperation === 'delete' ? 'error' : 'primary'}
          >
            {loading ? 'Выполнение...' : 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BulkStoreOperations
