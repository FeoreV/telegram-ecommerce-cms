import React, { useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
  Alert,
  Chip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material'
import {
  CheckCircle,
  Cancel,
  LocalShipping,
  Download,
  MoreVert,
  SelectAll,
  Clear,
} from '@mui/icons-material'
import { Order } from '../../types'
import { orderService } from '../../services/orderService'
import { toast } from 'react-toastify'

interface BulkOrderActionsProps {
  selectedOrders: Order[]
  allOrders: Order[]
  onSelectionChange: (orderIds: string[]) => void
  onRefresh: () => void
}

const BulkOrderActions: React.FC<BulkOrderActionsProps> = ({
  selectedOrders,
  allOrders,
  onSelectionChange,
  onRefresh,
}) => {
  const [confirmDialog, setConfirmDialog] = useState(false)
  const [rejectDialog, setRejectDialog] = useState(false)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null)
  const [loading, setLoading] = useState(false)
  const [currentAction, setCurrentAction] = useState<'confirm' | 'reject' | 'ship' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  const selectedIds = selectedOrders.map(o => o.id)

  const handleSelectAll = () => {
    if (selectedIds.length === allOrders.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(allOrders.map(o => o.id))
    }
  }

  const handleBulkAction = async (action: 'confirm' | 'reject' | 'ship') => {
    const eligibleOrders = getEligibleOrders(action)
    
    if (eligibleOrders.length === 0) {
      toast.error('Нет заказов подходящих для данного действия')
      return
    }

    setCurrentAction(action)
    if (action === 'reject') {
      setRejectDialog(true)
    } else {
      setConfirmDialog(true)
    }
    setActionMenuAnchor(null)
  }

  const getEligibleOrders = (action: 'confirm' | 'reject' | 'ship') => {
    switch (action) {
      case 'confirm':
      case 'reject':
        return selectedOrders.filter(order => order.status === 'PENDING_ADMIN')
      case 'ship':
        return selectedOrders.filter(order => order.status === 'PAID')
      default:
        return []
    }
  }

  const executeAction = async () => {
    if (!currentAction) return

    const eligibleOrders = getEligibleOrders(currentAction)
    
    setLoading(true)
    let successCount = 0
    let failureCount = 0

    try {
      for (const order of eligibleOrders) {
        try {
          switch (currentAction) {
            case 'confirm':
              await orderService.confirmPayment(order.id)
              break
            case 'reject':
              await orderService.rejectOrder(order.id, { reason: rejectionReason })
              break
            case 'ship':
              await orderService.markAsShipped(order.id, {})
              break
          }
          successCount++
        } catch (error) {
          failureCount++
          console.error(`Failed to process order ${order.orderNumber}:`, error)
        }
      }

      if (successCount > 0) {
        const actionName = 
          currentAction === 'confirm' ? 'подтверждены' :
          currentAction === 'reject' ? 'отклонены' :
          'отправлены'
        
        toast.success(`${successCount} заказов ${actionName}`)
        onRefresh()
        onSelectionChange([])
      }

      if (failureCount > 0) {
        toast.error(`Ошибка при обработке ${failureCount} заказов`)
      }

    } catch (error) {
      toast.error('Произошла ошибка при выполнении массовой операции')
    } finally {
      setLoading(false)
      setConfirmDialog(false)
      setRejectDialog(false)
      setCurrentAction(null)
      setRejectionReason('')
    }
  }

  const handleBulkExport = async () => {
    try {
      setLoading(true)
      // Create a custom export with only selected orders
      const orderIds = selectedIds.join(',')
      const blob = await orderService.exportOrders({ 
        // Note: This would require backend modification to support orderIds filter
        search: orderIds, // Temporary solution
      })
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `selected-orders-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      toast.success('Экспорт выбранных заказов завершен')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при экспорте')
    } finally {
      setLoading(false)
      setActionMenuAnchor(null)
    }
  }

  if (selectedOrders.length === 0) {
    return (
      <Box display="flex" alignItems="center" gap={2} mb={2}>
        <Checkbox
          indeterminate={selectedIds.length > 0 && selectedIds.length < allOrders.length}
          checked={selectedIds.length === allOrders.length && allOrders.length > 0}
          onChange={handleSelectAll}
        />
        <Typography variant="body2" color="text.secondary">
          Выберите заказы для массовых действий
        </Typography>
      </Box>
    )
  }

  const pendingCount = selectedOrders.filter(o => o.status === 'PENDING_ADMIN').length
  const paidCount = selectedOrders.filter(o => o.status === 'PAID').length

  return (
    <>
      <Paper sx={{ p: 2, mb: 2, bgcolor: 'action.hover' }}>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Checkbox
              indeterminate={selectedIds.length > 0 && selectedIds.length < allOrders.length}
              checked={selectedIds.length === allOrders.length && allOrders.length > 0}
              onChange={handleSelectAll}
            />
            
            <Typography variant="body1" fontWeight="medium">
              Выбрано: {selectedOrders.length} заказов
            </Typography>

            {pendingCount > 0 && (
              <Chip 
                label={`${pendingCount} ожидают подтверждения`}
                size="small"
                color="warning"
                variant="outlined"
              />
            )}
            
            {paidCount > 0 && (
              <Chip 
                label={`${paidCount} готовы к отправке`}
                size="small"
                color="success"
                variant="outlined"
              />
            )}
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Button
              size="small"
              onClick={() => onSelectionChange([])}
              startIcon={<Clear />}
            >
              Сбросить
            </Button>

            <Button
              size="small"
              variant="outlined"
              onClick={handleBulkExport}
              startIcon={<Download />}
              disabled={loading}
            >
              Экспорт
            </Button>

            <Button
              size="small"
              variant="contained"
              onClick={(e) => setActionMenuAnchor(e.currentTarget)}
              endIcon={<MoreVert />}
              disabled={loading}
            >
              Действия
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Actions Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem 
          onClick={() => handleBulkAction('confirm')}
          disabled={pendingCount === 0}
        >
          <ListItemIcon>
            <CheckCircle color="success" />
          </ListItemIcon>
          <ListItemText>
            Подтвердить оплату ({pendingCount})
          </ListItemText>
        </MenuItem>

        <MenuItem 
          onClick={() => handleBulkAction('reject')}
          disabled={pendingCount === 0}
        >
          <ListItemIcon>
            <Cancel color="error" />
          </ListItemIcon>
          <ListItemText>
            Отклонить заказы ({pendingCount})
          </ListItemText>
        </MenuItem>

        <MenuItem 
          onClick={() => handleBulkAction('ship')}
          disabled={paidCount === 0}
        >
          <ListItemIcon>
            <LocalShipping color="info" />
          </ListItemIcon>
          <ListItemText>
            Отправить заказы ({paidCount})
          </ListItemText>
        </MenuItem>
      </Menu>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog} onClose={() => setConfirmDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Подтверждение массового действия
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            {currentAction === 'confirm' && `Подтвердить оплату для ${getEligibleOrders('confirm').length} заказов?`}
            {currentAction === 'ship' && `Отметить как отправленные ${getEligibleOrders('ship').length} заказов?`}
          </Alert>
          
          <Typography variant="body2" color="text.secondary">
            Это действие нельзя будет отменить. Клиенты получат уведомления об изменении статуса.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={executeAction}
            variant="contained"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Выполнение...' : 'Подтвердить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={rejectDialog} onClose={() => setRejectDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Массовое отклонение заказов
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Отклонить {getEligibleOrders('reject').length} заказов? Клиенты получат уведомления.
          </Alert>
          
          <TextField
            fullWidth
            label="Причина отклонения *"
            multiline
            rows={3}
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Общая причина отклонения для всех выбранных заказов..."
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialog(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={executeAction}
            variant="contained"
            color="error"
            disabled={loading || !rejectionReason.trim()}
            startIcon={loading ? <CircularProgress size={16} /> : undefined}
          >
            {loading ? 'Отклонение...' : 'Отклонить заказы'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BulkOrderActions
