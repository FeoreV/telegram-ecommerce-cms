import {
    Add,
    Category as CategoryIcon,
    Delete,
    Edit,
    MoreVert
} from '@mui/icons-material'
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemSecondaryAction,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Select,
    TextField,
    Typography
} from '@mui/material'
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { productService } from '../../services/productService'
import { Category } from '../../types'

interface CategoryManagerProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  currentCategories: Category[]
}

interface CategoryFormData {
  name: string
  slug: string
  parentId?: string
}

const CategoryManager: React.FC<CategoryManagerProps> = ({
  open,
  onClose,
  onSuccess,
  currentCategories,
}) => {
  const [categories, setCategories] = useState<Category[]>([])
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    slug: '',
    parentId: '',
  })
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  useEffect(() => {
    if (open) {
      setCategories(currentCategories)
      resetForm()
    }
  }, [open, currentCategories])

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      parentId: '',
    })
    setEditingCategory(null)
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\u0430-\u044f\u0451]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  }

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: editingCategory ? prev.slug : generateSlug(name),
    }))
  }

  const handleCreateCategory = async () => {
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error('Заполните название и slug категории')
      return
    }

    setLoading(true)
    try {
      const categoryData = {
        name: formData.name.trim(),
        slug: formData.slug.trim(),
        parentId: formData.parentId || undefined,
      }

      let newCategory: Category
      if (editingCategory) {
        // Здесь должен быть метод обновления категории
        // newCategory = await productService.updateCategory(editingCategory.id, categoryData)
        toast.info('Функция обновления категории в разработке')
        return
      } else {
        newCategory = await productService.createCategory(categoryData)
      }

      // Обновляем список категорий
      if (editingCategory) {
        setCategories(prev => prev.map(cat =>
          cat.id === editingCategory.id ? newCategory : cat
        ))
      } else {
        setCategories(prev => [...prev, newCategory])
      }

      toast.success(editingCategory ? 'Категория обновлена!' : 'Категория создана!')
      resetForm()
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при сохранении категории')
    } finally {
      setLoading(false)
    }
  }

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      slug: category.slug,
      parentId: category.parentId || '',
    })
    setAnchorEl(null)
  }

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return

    setLoading(true)
    try {
      // Здесь должен быть метод удаления категории
      // await productService.deleteCategory(categoryToDelete.id)

      setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id))
      toast.success('Категория удалена!')
      setDeleteDialogOpen(false)
      setCategoryToDelete(null)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Ошибка при удалении категории')
    } finally {
      setLoading(false)
    }
  }

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, category: Category) => {
    setAnchorEl(event.currentTarget)
    setSelectedCategory(category)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
    setSelectedCategory(null)
  }

  const handleDeleteClick = (category: Category) => {
    setCategoryToDelete(category)
    setDeleteDialogOpen(true)
    handleMenuClose()
  }

  const getParentCategories = () => {
    return categories.filter(cat => !cat.parentId)
  }

  const getChildCategories = (parentId: string) => {
    return categories.filter(cat => cat.parentId === parentId)
  }

  const getCategoryHierarchy = () => {
    const parentCategories = getParentCategories()
    const hierarchy: Array<{
      parent: Category
      children: Category[]
    }> = []

    parentCategories.forEach(parent => {
      hierarchy.push({
        parent,
        children: getChildCategories(parent.id),
      })
    })

    return hierarchy
  }

  const renderCategoryItem = (category: Category, isChild = false) => (
    <ListItem
      key={category.id}
      sx={{
        pl: isChild ? 4 : 2,
        bgcolor: isChild ? 'action.hover' : 'transparent',
      }}
    >
      <CategoryIcon sx={{ mr: 2, color: isChild ? 'text.secondary' : 'primary.main' }} />
      <ListItemText
        primary={category.name}
        secondary={`slug: ${category.slug}`}
      />
      <ListItemSecondaryAction>
        <IconButton
          edge="end"
          onClick={(e) => handleMenuClick(e, category)}
          size="small"
        >
          <MoreVert />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
  )

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { height: '80vh' } }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <CategoryIcon color="primary" />
            Управление категориями
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {/* Форма создания/редактирования */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom color="primary">
              {editingCategory ? 'Редактировать категорию' : 'Создать новую категорию'}
            </Typography>

            <Box display="flex" gap={2} mb={2}>
              <TextField
                label="Название категории"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                fullWidth
                required
                placeholder="Электроника, Одежда, Книги..."
              />

              <TextField
                label="URL slug"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                fullWidth
                required
                placeholder="electronics, clothing, books..."
                helperText="Используется в URL и должен быть уникальным"
              />
            </Box>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Родительская категория</InputLabel>
              <Select
                value={formData.parentId || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value }))}
                label="Родительская категория"
              >
                <MenuItem value="">Без родительской категории</MenuItem>
                {getParentCategories().map(cat => (
                  <MenuItem key={cat.id} value={cat.id} disabled={cat.id === editingCategory?.id}>
                    {cat.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                onClick={handleCreateCategory}
                disabled={loading || !formData.name.trim() || !formData.slug.trim()}
                startIcon={editingCategory ? <Edit /> : <Add />}
              >
                {loading ? 'Сохранение...' : editingCategory ? 'Обновить' : 'Создать'}
              </Button>

              {editingCategory && (
                <Button
                  variant="outlined"
                  onClick={resetForm}
                  disabled={loading}
                >
                  Отмена
                </Button>
              )}
            </Box>
          </Paper>

          {/* Список существующих категорий */}
          <Typography variant="h6" gutterBottom color="primary">
            Существующие категории ({categories.length})
          </Typography>

          {categories.length === 0 ? (
            <Alert severity="info">
              Пока нет созданных категорий. Создайте первую категорию для организации товаров.
            </Alert>
          ) : (
            <Paper>
              <List>
                {getCategoryHierarchy().map(({ parent, children }, index) => (
                  <React.Fragment key={parent.id}>
                    {renderCategoryItem(parent)}
                    {children.map(child => renderCategoryItem(child, true))}
                    {index < getCategoryHierarchy().length - 1 && <Divider />}
                  </React.Fragment>
                ))}

                {/* Категории без родителя, которые не попали в иерархию */}
                {categories.filter(cat => !cat.parentId).length === 0 && (
                  categories.map(cat => renderCategoryItem(cat))
                )}
              </List>
            </Paper>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Закрыть
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              onSuccess()
              onClose()
            }}
            disabled={loading}
          >
            Применить изменения
          </Button>
        </DialogActions>
      </Dialog>

      {/* Контекстное меню */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => selectedCategory && handleEditCategory(selectedCategory)}>
          <Edit fontSize="small" sx={{ mr: 1 }} />
          Редактировать
        </MenuItem>
        <MenuItem
          onClick={() => selectedCategory && handleDeleteClick(selectedCategory)}
          sx={{ color: 'error.main' }}
        >
          <Delete fontSize="small" sx={{ mr: 1 }} />
          Удалить
        </MenuItem>
      </Menu>

      {/* Диалог подтверждения удаления */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Подтвердите удаление</DialogTitle>
        <DialogContent>
          <Typography>
            Вы уверены, что хотите удалить категорию
            &quot;<strong>{categoryToDelete?.name}</strong>&quot;?
          </Typography>
          <Alert severity="warning" sx={{ mt: 2 }}>
            Все товары в этой категории станут без категории.
            Это действие необратимо.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading}>
            Отмена
          </Button>
          <Button
            onClick={handleDeleteCategory}
            color="error"
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default CategoryManager
