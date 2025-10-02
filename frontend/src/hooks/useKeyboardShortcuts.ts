import { useEffect, useCallback } from 'react'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  callback: () => void
  description: string
  preventDefault?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enabled?: boolean
}

export const useKeyboardShortcuts = ({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) => {
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    // Игнорируем клавиши, если фокус в полях ввода
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement ||
      (event.target as HTMLElement)?.contentEditable === 'true'
    ) {
      return
    }

    const matchingShortcut = shortcuts.find(shortcut => {
      return (
        shortcut.key.toLowerCase() === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.altKey === event.altKey &&
        !!shortcut.shiftKey === event.shiftKey
      )
    })

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault()
        event.stopPropagation()
      }
      matchingShortcut.callback()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyPress)
      return () => {
        document.removeEventListener('keydown', handleKeyPress)
      }
    }
  }, [handleKeyPress, enabled])

  return {
    shortcuts: shortcuts.map(shortcut => ({
      ...shortcut,
      displayKeys: [
        shortcut.ctrlKey && 'Ctrl',
        shortcut.altKey && 'Alt', 
        shortcut.shiftKey && 'Shift',
        shortcut.key.toUpperCase()
      ].filter(Boolean).join(' + ')
    }))
  }
}

// Готовые наборы горячих клавиш для разных страниц
export const productPageShortcuts = {
  createProduct: { key: 'n', ctrlKey: true, description: 'Создать новый товар' },
  search: { key: 'f', ctrlKey: true, description: 'Поиск товаров' },
  refresh: { key: 'r', ctrlKey: true, description: 'Обновить список' },
  selectAll: { key: 'a', ctrlKey: true, description: 'Выделить все товары' },
  delete: { key: 'Delete', description: 'Удалить выделенные товары' },
  escape: { key: 'Escape', description: 'Отменить выделение' },
  filters: { key: 'f', altKey: true, description: 'Открыть фильтры' },
  categories: { key: 'c', altKey: true, description: 'Управление категориями' },
  analytics: { key: 'a', altKey: true, description: 'Показать/скрыть аналитику' },
  gridView: { key: 'g', description: 'Сетка' },
  listView: { key: 'l', description: 'Список' },
  help: { key: '?', description: 'Показать помощь по клавишам' },
}

export default useKeyboardShortcuts
