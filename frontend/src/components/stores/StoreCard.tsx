import React from 'react'
import {
  Card,
  CardContent,
  Typography,
  Chip,
  IconButton,
  Box,
  Avatar,
  Tooltip,
} from '@mui/material'
import {
  Edit,
  Delete,
  MoreVert,
  Store,
} from '@mui/icons-material'
import { Store as StoreType } from '../../types'
import styles from './StoreCard.module.css'

interface StoreCardProps {
  store: StoreType
  selected?: boolean
  onSelect?: () => void
  onEdit: () => void
  onDelete: () => void
}

const StoreCard: React.FC<StoreCardProps> = ({ store, selected = false, onSelect, onEdit, onDelete }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'success'
      case 'INACTIVE':
        return 'default'
      case 'SUSPENDED':
        return 'error'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Активный'
      case 'INACTIVE':
        return 'Неактивный'
      case 'SUSPENDED':
        return 'Заблокирован'
      default:
        return status
    }
  }

  return (
    <Card className={styles.storeCard} onClick={onSelect}>
      <CardContent className={styles.storeCard__content}>
        <Box className={styles.storeCard__header}>
          <Box className={styles.storeCard__headerLeft}>
            <Avatar className={styles.storeCard__avatar}>
              <Store />
            </Avatar>
            <Box className={styles.storeCard__titleBlock}>
              <Typography variant="h6" component="h3" className={styles.storeCard__title}>
                {store.name}
              </Typography>
              <Typography variant="body2" className={styles.storeCard__subtitle}>
                {store.slug}
              </Typography>
            </Box>
          </Box>
          <Box className={styles.storeCard__headerRight}>
            <Chip
              className={styles.storeCard__statusChip}
              label={getStatusLabel(store.status)}
              color={getStatusColor(store.status) as any}
              size="small"
            />
            <IconButton size="small" onClick={onEdit}>
              <Edit />
            </IconButton>
            <IconButton size="small" onClick={onDelete} color="error">
              <Delete />
            </IconButton>
          </Box>
        </Box>

        {store.description && (
          <Typography variant="body2" className={styles.storeCard__description}>
            {store.description.length > 100 
              ? `${store.description.substring(0, 100)}...` 
              : store.description}
          </Typography>
        )}

        <Box className={styles.storeCard__metaRow}>
          <Typography variant="body2">💰 {store.currency}</Typography>
          <Typography variant="body2">📦 Товары: {store._count?.products || 0}</Typography>
          <Typography variant="body2">📋 Заказы: {store._count?.orders || 0}</Typography>
        </Box>

        {(store.contactInfo?.email || store.contactInfo?.phone) && (
          <Box className={styles.storeCard__separator}>
            <Typography variant="caption" className={styles.storeCard__subtitle}>
              {store.contactInfo?.email && `📧 ${store.contactInfo.email}`}
              {store.contactInfo?.email && store.contactInfo?.phone && ' • '}
              {store.contactInfo?.phone && `📞 ${store.contactInfo.phone}`}
            </Typography>
          </Box>
        )}

        {store.domain && (
          <Box>
            <Typography variant="caption" className={styles.storeCard__domain}>
              🌐 {store.domain}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default StoreCard