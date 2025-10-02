import React, { useState, useRef, useCallback } from 'react'
import { Responsive, WidthProvider } from 'react-grid-layout'
import {
  Box,
  IconButton,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Checkbox,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  Tooltip,
  Fab,
} from '@mui/material'
import {
  Settings,
  Add,
  Restore,
  Save,
  Visibility,
  VisibilityOff,
  GridView,
  Lock,
  LockOpen,
} from '@mui/icons-material'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const ResponsiveGridLayout = WidthProvider(Responsive)

interface DashboardLayoutProps {
  children?: React.ReactNode
  widgets: WidgetConfig[]
  onLayoutChange?: (layouts: any, allLayouts: any) => void
  onWidgetToggle?: (widgetId: string, visible: boolean) => void
  onWidgetAdd?: (widgetId: string) => void
  onWidgetRemove?: (widgetId: string) => void
  onResetLayout?: () => void
  isEditing?: boolean
  onEditingChange?: (editing: boolean) => void
}

export interface WidgetConfig {
  id: string
  type: string
  title: string
  description: string
  icon: React.ReactNode
  defaultSize: { w: number; h: number; minW?: number; minH?: number; maxW?: number; maxH?: number }
  visible: boolean
  removable: boolean
  resizable: boolean
  draggable: boolean
  settings?: any
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  widgets,
  onLayoutChange,
  onWidgetToggle,
  onWidgetAdd,
  onWidgetRemove,
  onResetLayout,
  isEditing = false,
  onEditingChange,
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [addWidgetOpen, setAddWidgetOpen] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const layoutRef = useRef<any>(null)

  // Default layouts for different screen sizes
  const generateLayout = useCallback(() => {
    return widgets
      .filter(w => w.visible)
      .map((widget, index) => ({
        i: widget.id,
        x: (index * widget.defaultSize.w) % 12,
        y: Math.floor((index * widget.defaultSize.w) / 12) * widget.defaultSize.h,
        w: widget.defaultSize.w,
        h: widget.defaultSize.h,
        minW: widget.defaultSize.minW || 2,
        minH: widget.defaultSize.minH || 2,
        maxW: widget.defaultSize.maxW || 12,
        maxH: widget.defaultSize.maxH || 8,
        static: !widget.draggable,
        resizeHandles: widget.resizable ? ['s', 'w', 'e', 'n', 'sw', 'nw', 'se', 'ne'] as any : [],
      }))
  }, [widgets])

  const layouts = {
    lg: generateLayout(),
    md: generateLayout(),
    sm: generateLayout().map(item => ({ ...item, w: Math.min(item.w * 2, 12) })),
    xs: generateLayout().map(item => ({ ...item, w: 12, h: Math.max(item.h, 3) })),
  }

  const handleLayoutChange = (layout: any, allLayouts: any) => {
    onLayoutChange?.(layout, allLayouts)
  }

  const handleDragStart = () => {
    setIsDragging(true)
  }

  const handleDragStop = () => {
    setIsDragging(false)
  }

  const availableWidgets = [
    {
      id: 'quick-actions',
      title: 'Быстрые действия',
      description: 'Часто используемые операции и ярлыки',
      icon: <Add />
    },
    {
      id: 'revenue-chart',
      title: 'График выручки',
      description: 'Динамика продаж и доходов',
      icon: <GridView />
    },
    {
      id: 'notifications',
      title: 'Уведомления',
      description: 'Важные события и оповещения',
      icon: <Settings />
    },
    {
      id: 'top-performers',
      title: 'Топ исполнители',
      description: 'Лучшие магазины, товары и пользователи',
      icon: <Visibility />
    },
  ].filter(w => !widgets.some(widget => widget.id === w.id))

  const visibleWidgets = widgets.filter(w => w.visible)

  return (
    <Box>
      {/* Dashboard Controls */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Панель управления
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Обзор производительности вашего бизнеса
          </Typography>
        </Box>

        <Box display="flex" gap={1}>
          <FormControlLabel
            control={
              <Switch
                checked={isEditing}
                onChange={(e) => onEditingChange?.(e.target.checked)}
              />
            }
            label={
              <Box display="flex" alignItems="center" gap={1}>
                {isEditing ? <LockOpen fontSize="small" /> : <Lock fontSize="small" />}
                {isEditing ? 'Редактирование' : 'Просмотр'}
              </Box>
            }
          />

          <Button
            startIcon={<Add />}
            onClick={() => setAddWidgetOpen(true)}
            size="small"
            disabled={availableWidgets.length === 0}
          >
            Добавить виджет
          </Button>

          <IconButton onClick={() => setSettingsOpen(true)} size="small">
            <Settings />
          </IconButton>
        </Box>
      </Box>

      {/* Layout Warning */}
      {isEditing && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Режим редактирования активен. Вы можете перетаскивать и изменять размеры виджетов.
        </Alert>
      )}

      {/* Responsive Grid Layout */}
      <ResponsiveGridLayout
        ref={layoutRef}
        className="dashboard__layout"
        layouts={layouts}
        onLayoutChange={handleLayoutChange}
        onDragStart={handleDragStart}
        onDragStop={handleDragStop}
        onResizeStart={handleDragStart}
        onResizeStop={handleDragStop}
        isDraggable={isEditing}
        isResizable={isEditing}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        rowHeight={60}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
      >
        {children && React.Children.toArray(children).map((child, index) => {
          const widget = visibleWidgets[index]
          if (!widget) return null

          return React.cloneElement(child as React.ReactElement, {
            key: widget.id,
            'data-grid': layouts.lg.find(l => l.i === widget.id),
            isDragging: isDragging,
            onRemove: widget.removable ? () => onWidgetRemove?.(widget.id) : undefined,
          })
        })}
      </ResponsiveGridLayout>

      {/* No Widgets Message */}
      {visibleWidgets.length === 0 && (
        <Box 
          display="flex" 
          flexDirection="column"
          alignItems="center" 
          justifyContent="center" 
          minHeight={400}
          color="text.secondary"
        >
          <Typography variant="h6" gutterBottom>
            Нет активных виджетов
          </Typography>
          <Typography variant="body2" gutterBottom>
            Добавьте виджеты для отображения информации на панели
          </Typography>
          <Button
            startIcon={<Add />}
            onClick={() => setAddWidgetOpen(true)}
            variant="outlined"
            sx={{ mt: 2 }}
          >
            Добавить виджет
          </Button>
        </Box>
      )}

      {/* Floating Action Button */}
      {isEditing && (
        <Fab
          color="primary"
          sx={{ position: 'fixed', bottom: 16, right: 16 }}
          onClick={() => setAddWidgetOpen(true)}
        >
          <Add />
        </Fab>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Настройки панели управления</DialogTitle>
        <DialogContent>
          <Typography variant="subtitle2" gutterBottom>
            Видимость виджетов
          </Typography>
          
          <List>
            {widgets.map((widget) => (
              <ListItem key={widget.id}>
                <ListItemIcon>
                  {widget.icon}
                </ListItemIcon>
                <ListItemText
                  primary={widget.title}
                  secondary={widget.description}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={widget.visible}
                      onChange={(e) => onWidgetToggle?.(widget.id, e.target.checked)}
                    />
                  }
                  label=""
                />
              </ListItem>
            ))}
          </List>

          <Divider sx={{ my: 2 }} />

          <Box display="flex" gap={1}>
            <Button
              startIcon={<Save />}
              variant="outlined"
              onClick={() => {
                // Save layout to localStorage
                const currentLayouts = layoutRef.current?.state?.layouts
                if (currentLayouts) {
                  localStorage.setItem('dashboard-layouts', JSON.stringify(currentLayouts))
                }
                setSettingsOpen(false)
              }}
            >
              Сохранить расположение
            </Button>

            <Button
              startIcon={<Restore />}
              variant="outlined"
              color="warning"
              onClick={() => {
                onResetLayout?.()
                setSettingsOpen(false)
              }}
            >
              Сбросить
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Add Widget Dialog */}
      <Dialog open={addWidgetOpen} onClose={() => setAddWidgetOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Добавить виджет</DialogTitle>
        <DialogContent>
          {availableWidgets.length === 0 ? (
            <Alert severity="info">
              Все доступные виджеты уже добавлены на панель управления.
            </Alert>
          ) : (
            <List>
              {availableWidgets.map((widget) => (
                <ListItemButton
                  key={widget.id}
                  onClick={() => {
                    onWidgetAdd?.(widget.id)
                    setAddWidgetOpen(false)
                  }}
                >
                  <ListItemIcon>
                    {widget.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={widget.title}
                    secondary={widget.description}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  )
}

export default DashboardLayout
