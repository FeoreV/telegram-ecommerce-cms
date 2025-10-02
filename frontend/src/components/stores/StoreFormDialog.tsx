import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
} from '@mui/material'
import { Store as StoreType } from '../../types'
import { storeService } from '../../services/storeService'
import { toast } from 'react-toastify'

interface StoreFormDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  store?: StoreType | null
}

const StoreFormDialog: React.FC<StoreFormDialogProps> = ({
  open,
  onClose,
  onSuccess,
  store,
}) => {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    slug: '',
    currency: 'USD',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  })

  useEffect(() => {
    if (store) {
      setFormData({
        name: store.name,
        description: store.description || '',
        slug: store.slug,
        currency: store.currency,
        status: store.status,
      })
    } else {
      setFormData({
        name: '',
        description: '',
        slug: '',
        currency: 'USD',
        status: 'ACTIVE',
      })
    }
  }, [store, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Название магазина обязательно')
      return
    }
    if (!formData.description.trim()) {
      toast.error('Описание магазина обязательно')
      return
    }
    if (!formData.slug.trim()) {
      toast.error('Slug магазина обязателен')
      return
    }
    
    setLoading(true)

    try {
      const submissionData = {
        ...formData,
        name: formData.name.trim(),
        description: formData.description.trim(),
        slug: formData.slug.trim()
      }
      
      if (store) {
        await storeService.updateStore(store.id, submissionData)
        toast.success('Магазин обновлен')
      } else {
        await storeService.createStore(submissionData)
        toast.success('Магазин создан')
      }
      onSuccess()
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Ошибка при сохранении магазина')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string) => (e: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
    }))
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>
          {store ? 'Редактировать магазин' : 'Создать магазин'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Название"
                value={formData.name}
                onChange={handleChange('name')}
              autoFocus
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Адрес (slug)"
                value={formData.slug}
                onChange={handleChange('slug')}
                required
                helperText="Используется в URL магазина"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Описание"
                value={formData.description}
                onChange={handleChange('description')}
                multiline
                rows={3}
                required
                helperText="Краткое описание магазина"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Валюта</InputLabel>
                <Select
                  value={formData.currency}
                  label="Валюта"
                  onChange={handleChange('currency')}
                >
                  <MenuItem value="USD">USD</MenuItem>
                  <MenuItem value="EUR">EUR</MenuItem>
                  <MenuItem value="RUB">RUB</MenuItem>
                  <MenuItem value="UAH">UAH</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Статус</InputLabel>
                <Select
                  value={formData.status}
                  label="Статус"
                  onChange={handleChange('status')}
                >
                  <MenuItem value="ACTIVE">Активный</MenuItem>
                  <MenuItem value="INACTIVE">Неактивный</MenuItem>
                  <MenuItem value="SUSPENDED">Заблокирован</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Отмена</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default StoreFormDialog
