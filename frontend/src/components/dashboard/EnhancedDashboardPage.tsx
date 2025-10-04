import { Box } from '@mui/material'
import React, { useCallback, useEffect, useState } from 'react'

import { toast } from 'react-toastify'
import { useAuth } from '../../contexts/AuthContext'
import { useDashboardRealTime } from '../../hooks/useRealTimeUpdates'
import DashboardLayout, { WidgetConfig } from './DashboardLayout'

const DASHBOARD_LAYOUTS_KEY = 'dashboard-layouts'
const DASHBOARD_WIDGETS_KEY = 'dashboard-widgets'

type StoredWidgetSettings = Record<string, { visible?: boolean }>

const parseJson = <T,>(value: string | null): T | null => {
  if (!value) {
    return null
  }

  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

const defaultWidgets: WidgetConfig[] = []

const EnhancedDashboardPage: React.FC = () => {
  const user = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>(defaultWidgets)

  const loadStoredWidgets = useCallback(() => {
    const stored = parseJson<StoredWidgetSettings>(localStorage.getItem(DASHBOARD_WIDGETS_KEY))
    if (!stored) {
      return defaultWidgets
    }

    return defaultWidgets.map((widget) => ({
      ...widget,
      visible: stored[widget.id]?.visible ?? widget.visible,
    }))
  }, [])

  useEffect(() => {
    setWidgets(loadStoredWidgets())
  }, [loadStoredWidgets])

  const handleLayoutChange = useCallback((layouts: unknown, allLayouts: unknown) => {
    try {
      localStorage.setItem(DASHBOARD_LAYOUTS_KEY, JSON.stringify(allLayouts))
    } catch (error) {
      toast.error('Не удалось сохранить макет панели')
    }
  }, [])

  const handleWidgetToggle = useCallback((widgetId: string, visible: boolean) => {
    setWidgets((prev) => {
      const updated = prev.map((widget) =>
        widget.id === widgetId ? { ...widget, visible } : widget
      )

      const serialized = updated.reduce<StoredWidgetSettings>((acc, widget) => {
        acc[widget.id] = { visible: widget.visible }
        return acc
      }, {})

      try {
        localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(serialized))
      } catch (error) {
        toast.error('Не удалось сохранить настройки виджета')
      }

      return updated
    })
  }, [])

  const handleWidgetAdd = useCallback((widgetId: string) => {
    toast.info(`Добавление виджета "${widgetId}" временно недоступно`)
  }, [])

  const handleWidgetRemove = useCallback((widgetId: string) => {
    setWidgets((prev) => prev.filter((widget) => widget.id !== widgetId))
  }, [])

  const handleResetLayout = useCallback(() => {
    localStorage.removeItem(DASHBOARD_LAYOUTS_KEY)
    localStorage.removeItem(DASHBOARD_WIDGETS_KEY)
    setWidgets(defaultWidgets)
    toast.success('Макет панели управления сброшен')
  }, [])

  useDashboardRealTime(() => {})

  return (
    <Box>
      <DashboardLayout
        widgets={widgets}
        onLayoutChange={handleLayoutChange}
        onWidgetToggle={handleWidgetToggle}
        onWidgetAdd={handleWidgetAdd}
        onWidgetRemove={handleWidgetRemove}
        onResetLayout={handleResetLayout}
        isEditing={isEditing}
        onEditingChange={setIsEditing}
      >
        {/* No widgets rendered - empty dashboard */}
      </DashboardLayout>
    </Box>
  )
}

export default EnhancedDashboardPage
