import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Grid,
} from '@mui/material'
import { Keyboard, Close } from '@mui/icons-material'

interface KeyboardShortcut {
  displayKeys: string
  description: string
}

interface KeyboardShortcutsHelpProps {
  open: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  open,
  onClose,
  shortcuts,
}) => {
  // Группируем горячие клавиши по категориям
  const groupedShortcuts = {
    navigation: [
      { displayKeys: 'Ctrl + N', description: 'Создать новый товар' },
      { displayKeys: 'Ctrl + F', description: 'Поиск товаров' },
      { displayKeys: 'Ctrl + R', description: 'Обновить список' },
      { displayKeys: 'Alt + F', description: 'Расширенные фильтры' },
      { displayKeys: 'Alt + C', description: 'Управление категориями' },
    ],
    selection: [
      { displayKeys: 'Ctrl + A', description: 'Выделить все товары' },
      { displayKeys: 'Escape', description: 'Отменить выделение' },
      { displayKeys: 'Delete', description: 'Удалить выделенные товары' },
    ],
    view: [
      { displayKeys: 'G', description: 'Переключить в режим сетки' },
      { displayKeys: 'L', description: 'Переключить в режим списка' },
      { displayKeys: 'Alt + A', description: 'Показать/скрыть аналитику' },
    ],
    help: [
      { displayKeys: '?', description: 'Показать эту справку' },
    ]
  }

  const renderShortcutGroup = (title: string, shortcuts: KeyboardShortcut[]) => (
    <Box key={title} mb={3}>
      <Typography variant="h6" gutterBottom color="primary">
        {title}
      </Typography>
      <List dense>
        {shortcuts.map((shortcut, index) => (
          <ListItem key={index} sx={{ py: 0.5 }}>
            <ListItemText
              primary={
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    {shortcut.description}
                  </Typography>
                  <Chip
                    label={shortcut.displayKeys}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontFamily: 'monospace', 
                      fontSize: '0.75rem',
                      minWidth: 'auto',
                    }}
                  />
                </Box>
              }
              primaryTypographyProps={{ component: 'div' }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  )

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <Keyboard color="primary" />
          Горячие клавиши
        </Box>
      </DialogTitle>
      
      <DialogContent>
        <Paper sx={{ p: 3, mb: 2, bgcolor: 'info.light', color: 'info.contrastText' }}>
          <Typography variant="body2">
            💡 <strong>Совет:</strong> Используйте горячие клавиши для быстрой работы с товарами. 
            Горячие клавиши работают только когда не активно поле ввода.
          </Typography>
        </Paper>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            {renderShortcutGroup('🧭 Навигация', groupedShortcuts.navigation)}
            {renderShortcutGroup('🎯 Выделение', groupedShortcuts.selection)}
          </Grid>
          <Grid item xs={12} md={6}>
            {renderShortcutGroup('👁️ Просмотр', groupedShortcuts.view)}
            {renderShortcutGroup('❓ Справка', groupedShortcuts.help)}
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box>
          <Typography variant="h6" gutterBottom color="primary">
            Дополнительные возможности
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Клик по товару открывает предварительный просмотр"
                secondary="Для быстрого ознакомления с информацией о товаре"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Drag & Drop для изображений товаров"
                secondary="Перетащите изображения прямо в диалог создания товара"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Bulk операции для выделенных товаров"
                secondary="Массово изменяйте цены, категории, статус активности"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Real-time обновления"
                secondary="Изменения отображаются мгновенно без перезагрузки страницы"
              />
            </ListItem>
          </List>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} startIcon={<Close />}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default KeyboardShortcutsHelp
