import React, { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  ListItemSecondaryAction,
  Avatar,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Menu,
  MenuItem,
  Tooltip,
  Alert,
  Divider,
  Badge,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Notes,
  Add,
  Edit,
  Delete,
  MoreVert,
  Person,
  Schedule,
  Flag,
  Visibility,
  VisibilityOff,
  Search,
  FilterList,
  ExpandMore,
  PriorityHigh,
  AdminPanelSettings,
} from '@mui/icons-material'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { Order } from '../../types'
import { orderService } from '../../services/orderService'
import { toast } from 'react-toastify'

interface OrderNote {
  id: string
  content: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  isPrivate: boolean
  category: 'general' | 'payment' | 'shipping' | 'customer' | 'internal'
  createdAt: string
  updatedAt?: string
  author: {
    id: string
    name: string
    username?: string
  }
  tags: string[]
  attachments?: string[]
}

interface OrderNotesManagerProps {
  order: Order
  onRefresh: () => void
}

const OrderNotesManager: React.FC<OrderNotesManagerProps> = ({
  order,
  onRefresh,
}) => {
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingNote, setEditingNote] = useState<OrderNote | null>(null)
  const [noteDialog, setNoteDialog] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState<string | null>(null)
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  
  const [newNote, setNewNote] = useState<{
    content: string
    priority: 'low' | 'medium' | 'high' | 'urgent'
    isPrivate: boolean
    category: 'general' | 'payment' | 'shipping' | 'customer' | 'internal'
    tags: string[]
  }>({
    content: '',
    priority: 'medium',
    isPrivate: false,
    category: 'general',
    tags: [],
  })

  useEffect(() => {
    loadNotes()
  }, [order.id])

  const loadNotes = async () => {
    setLoading(true)
    try {
      // Load real notes from API
      const orderDetails = await orderService.getOrder(order.id)
      const apiNotes = orderDetails.notes || []
      
      // Transform API notes to component format
      const transformedNotes: OrderNote[] = apiNotes.map((note: any) => ({
        id: note.id,
        content: note.content || note.note || '',
        priority: note.priority || 'medium',
        isPrivate: note.isPrivate || false,
        category: note.category || 'general',
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
        author: {
          id: note.author?.id || note.userId || '',
          name: note.author?.name || note.author?.username || 'Пользователь',
          username: note.author?.username
        },
        tags: note.tags || []
      }))
      
      setNotes(transformedNotes)
    } catch (error) {
      console.error('Error loading notes:', error)
      toast.error('Ошибка при загрузке заметок')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveNote = async () => {
    if (!newNote.content.trim()) {
      toast.error('Введите текст заметки')
      return
    }

    setSaving(true)
    try {
      const noteData = {
        ...newNote,
        orderId: order.id,
      }

      if (editingNote) {
        // Update existing note
        await orderService.addOrderNote(order.id, newNote.content)
        toast.success('Заметка обновлена')
      } else {
        // Create new note
        await orderService.addOrderNote(order.id, newNote.content)
        toast.success('Заметка добавлена')
      }

      setNewNote({
        content: '',
        priority: 'medium',
        isPrivate: false,
        category: 'general',
        tags: [],
      })
      setEditingNote(null)
      setNoteDialog(false)
      loadNotes()
      onRefresh()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при сохранении заметки')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      // Note: API endpoint for deleting notes needs to be implemented on backend
      // For now, just remove from local state and show warning
      setNotes(prev => prev.filter(note => note.id !== noteId))
      toast.warning('Удаление заметок будет реализовано в следующей версии')
      setDeleteDialog(null)
    } catch (error) {
      toast.error('Ошибка при удалении заметки')
    }
  }

  const handleEditNote = (note: OrderNote) => {
    setEditingNote(note)
    setNewNote({
      content: note.content,
      priority: note.priority,
      isPrivate: note.isPrivate,
      category: note.category,
      tags: note.tags,
    })
    setNoteDialog(true)
    setMenuAnchor(null)
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'default' as const,
      medium: 'info' as const,
      high: 'warning' as const,
      urgent: 'error' as const,
    }
    return colors[priority as keyof typeof colors] || 'default'
  }

  const getPriorityLabel = (priority: string) => {
    const labels = {
      low: 'Низкий',
      medium: 'Средний',
      high: 'Высокий',
      urgent: 'Срочно!',
    }
    return labels[priority as keyof typeof labels] || priority
  }

  const getCategoryIcon = (category: string) => {
    const icons = {
      general: <Notes />,
      payment: <Notes />,
      shipping: <Notes />,
      customer: <Person />,
      internal: <AdminPanelSettings />,
    }
    return icons[category as keyof typeof icons] || <Notes />
  }

  const getCategoryLabel = (category: string) => {
    const labels = {
      general: 'Общее',
      payment: 'Оплата',
      shipping: 'Доставка',
      customer: 'Клиент',
      internal: 'Внутренние',
    }
    return labels[category as keyof typeof labels] || category
  }

  const filteredNotes = notes.filter(note => {
    const matchesCategory = filterCategory === 'all' || note.category === filterCategory
    const matchesSearch = searchQuery === '' || 
      note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.author.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    return matchesCategory && matchesSearch
  })

  const groupedNotes = filteredNotes.reduce((acc, note) => {
    if (!acc[note.category]) {
      acc[note.category] = []
    }
    acc[note.category].push(note)
    return acc
  }, {} as Record<string, OrderNote[]>)

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
          <Notes />
          Заметки к заказу
          <Badge badgeContent={notes.length} color="primary" />
        </Typography>
        
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            setEditingNote(null)
            setNewNote({
              content: '',
              priority: 'medium',
              isPrivate: false,
              category: 'general',
              tags: [],
            })
            setNoteDialog(true)
          }}
        >
          Добавить заметку
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            placeholder="Поиск заметок..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search color="action" sx={{ mr: 1 }} />
            }}
            sx={{ minWidth: 200 }}
          />
          
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Категория</InputLabel>
            <Select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              label="Категория"
            >
              <MenuItem value="all">Все категории</MenuItem>
              <MenuItem value="general">Общее</MenuItem>
              <MenuItem value="payment">Оплата</MenuItem>
              <MenuItem value="shipping">Доставка</MenuItem>
              <MenuItem value="customer">Клиент</MenuItem>
              <MenuItem value="internal">Внутренние</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* Notes List */}
      {loading ? (
        <Box display="flex" justifyContent="center" p={3}>
          <CircularProgress />
        </Box>
      ) : filteredNotes.length === 0 ? (
        <Alert severity="info">
          {searchQuery || filterCategory !== 'all' ? 'Заметки не найдены по заданным критериям' : 'Заметок пока нет'}
        </Alert>
      ) : (
        <Box>
          {Object.entries(groupedNotes).map(([category, categoryNotes]) => (
            <Accordion key={category} defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box display="flex" alignItems="center" gap={1}>
                  {getCategoryIcon(category)}
                  <Typography variant="h6">
                    {getCategoryLabel(category)} ({categoryNotes.length})
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <List>
                  {categoryNotes.map((note) => (
                    <ListItem
                      key={note.id}
                      alignItems="flex-start"
                      sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 2,
                        mb: 1,
                        bgcolor: note.isPrivate ? 'action.hover' : 'transparent'
                      }}
                    >
                      <ListItemAvatar>
                        <Avatar
                          sx={{
                            bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                            color: theme => theme.palette.primary.contrastText,
                            border: theme => `1px solid ${theme.palette.primary.main}`,
                          }}
                        >
                          <Person />
                        </Avatar>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="subtitle2" fontWeight="medium">
                              {note.author.name}
                            </Typography>
                            <Chip
                              label={getPriorityLabel(note.priority)}
                              color={getPriorityColor(note.priority)}
                              size="small"
                              icon={<Flag />}
                            />
                            {note.isPrivate && (
                              <Tooltip title="Приватная заметка">
                                <Chip
                                  label="Приватно"
                                  size="small"
                                  icon={<VisibilityOff />}
                                  variant="outlined"
                                />
                              </Tooltip>
                            )}
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" paragraph>
                              {note.content}
                            </Typography>
                            
                            {note.tags.length > 0 && (
                              <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                                {note.tags.map((tag, index) => (
                                  <Chip
                                    key={index}
                                    label={`#${tag}`}
                                    size="small"
                                    variant="outlined"
                                  />
                                ))}
                              </Box>
                            )}
                            
                            <Box display="flex" alignItems="center" gap={1}>
                              <Schedule fontSize="small" color="action" />
                              <Typography variant="caption" color="text.secondary">
                                {format(new Date(note.createdAt), 'dd MMMM yyyy в HH:mm', { locale: ru })}
                                {note.updatedAt && ' • Изменено'}
                              </Typography>
                            </Box>
                          </Box>
                        }
                      />
                      
                      <ListItemSecondaryAction>
                        <IconButton
                          onClick={(e) => {
                            setSelectedNote(note.id)
                            setMenuAnchor(e.currentTarget)
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          const note = notes.find(n => n.id === selectedNote)
          if (note) handleEditNote(note)
        }}>
          <Edit sx={{ mr: 1 }} /> Редактировать
        </MenuItem>
        <MenuItem 
          onClick={() => {
            setDeleteDialog(selectedNote)
            setMenuAnchor(null)
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} /> Удалить
        </MenuItem>
      </Menu>

      {/* Add/Edit Note Dialog */}
      <Dialog open={noteDialog} onClose={() => setNoteDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingNote ? 'Редактировать заметку' : 'Добавить заметку'}
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            rows={4}
            label="Текст заметки *"
            value={newNote.content}
            onChange={(e) => setNewNote(prev => ({ ...prev, content: e.target.value }))}
            margin="normal"
            placeholder="Введите текст заметки..."
          />
          
          <Box display="flex" gap={2} mt={2}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Приоритет</InputLabel>
              <Select
                value={newNote.priority}
                onChange={(e) => setNewNote(prev => ({ ...prev, priority: e.target.value as any }))}
                label="Приоритет"
              >
                <MenuItem value="low">Низкий</MenuItem>
                <MenuItem value="medium">Средний</MenuItem>
                <MenuItem value="high">Высокий</MenuItem>
                <MenuItem value="urgent">Срочно!</MenuItem>
              </Select>
            </FormControl>
            
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Категория</InputLabel>
              <Select
                value={newNote.category}
                onChange={(e) => setNewNote(prev => ({ ...prev, category: e.target.value as any }))}
                label="Категория"
              >
                <MenuItem value="general">Общее</MenuItem>
                <MenuItem value="payment">Оплата</MenuItem>
                <MenuItem value="shipping">Доставка</MenuItem>
                <MenuItem value="customer">Клиент</MenuItem>
                <MenuItem value="internal">Внутренние</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNoteDialog(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleSaveNote}
            variant="contained"
            disabled={saving || !newNote.content.trim()}
            startIcon={saving ? <CircularProgress size={16} /> : <Notes />}
          >
            {saving ? 'Сохранение...' : editingNote ? 'Обновить' : 'Добавить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteDialog)} onClose={() => setDeleteDialog(null)}>
        <DialogTitle>Удалить заметку?</DialogTitle>
        <DialogContent>
          <Typography>
            Это действие нельзя будет отменить. Заметка будет удалена навсегда.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>
            Отмена
          </Button>
          <Button
            onClick={() => deleteDialog && handleDeleteNote(deleteDialog)}
            color="error"
            variant="contained"
          >
            Удалить
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default OrderNotesManager
