import React from 'react'
import {
  Box,
  Typography,
  Switch,
  FormControlLabel,
  FormControl,
  FormLabel,
  RadioGroup,
  Radio,
  Paper,
  Divider,
  Button,
  Alert,
  Chip,
} from '@mui/material'
import {
  Visibility,
  VolumeUp,
  Keyboard,
  AccessibilityNew,
  TextIncrease,
  Contrast,
  MotionPhotosOff,
} from '@mui/icons-material'
import { useAccessibility, useKeyboardNavigation, useAriaAnnouncements } from '../../hooks/useAccessibility'

const AccessibilitySettings: React.FC = () => {
  const {
    isHighContrast,
    isReducedMotion,
    fontSize,
    screenReader,
    toggleHighContrast,
    toggleReducedMotion,
    setFontSize,
    announceToScreenReader,
  } = useAccessibility()

  const { announceSuccess } = useAriaAnnouncements()
  
  // Initialize keyboard navigation
  useKeyboardNavigation()

  const handleHighContrastChange = () => {
    toggleHighContrast()
    announceSuccess(isHighContrast ? 'Высокая контрастность отключена' : 'Высокая контрастность включена')
  }

  const handleReducedMotionChange = () => {
    toggleReducedMotion()
    announceSuccess(isReducedMotion ? 'Анимации включены' : 'Анимации отключены')
  }

  const handleFontSizeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSize = event.target.value as 'small' | 'medium' | 'large'
    setFontSize(newSize)
    announceSuccess(`Размер шрифта изменен на ${getFontSizeLabel(newSize)}`)
  }

  const testScreenReader = () => {
    announceToScreenReader('Это тестовое сообщение для проверки работы программы чтения с экрана.')
  }

  const resetSettings = () => {
    setFontSize('medium')
    if (isHighContrast) toggleHighContrast()
    if (isReducedMotion) toggleReducedMotion()
    announceSuccess('Настройки доступности сброшены')
  }

  return (
    <Box>
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="accessibility__skip-link">
        Перейти к основному содержимому
      </a>

      <Typography variant="h4" component="h1" gutterBottom>
        <AccessibilityNew sx={{ mr: 1, verticalAlign: 'middle' }} />
        Настройки доступности
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        Настройте интерфейс под свои потребности для более комфортного использования системы.
      </Typography>

      {screenReader && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            Обнаружена программа чтения с экрана. Все элементы интерфейса оптимизированы для навигации с клавиатуры.
          </Typography>
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={3}>
        {/* Visual Settings */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            <Visibility sx={{ mr: 1, verticalAlign: 'middle' }} />
            Визуальные настройки
          </Typography>

          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={isHighContrast}
                  onChange={handleHighContrastChange}
                  aria-describedby="high-contrast-help"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">
                    <Contrast sx={{ mr: 1, verticalAlign: 'middle', fontSize: '1rem' }} />
                    Высокая контрастность
                  </Typography>
                  <Typography variant="caption" color="text.secondary" id="high-contrast-help">
                    Увеличивает контрастность текста и элементов интерфейса
                  </Typography>
                </Box>
              }
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <FormControl component="fieldset">
            <FormLabel component="legend">
              <TextIncrease sx={{ mr: 1, verticalAlign: 'middle' }} />
              Размер шрифта
            </FormLabel>
            <RadioGroup
              value={fontSize}
              onChange={handleFontSizeChange}
              sx={{ mt: 1 }}
              aria-describedby="font-size-help"
            >
              <FormControlLabel 
                value="small" 
                control={<Radio />} 
                label="Маленький (14px)" 
              />
              <FormControlLabel 
                value="medium" 
                control={<Radio />} 
                label="Обычный (16px)" 
              />
              <FormControlLabel 
                value="large" 
                control={<Radio />} 
                label="Большой (18px)" 
              />
            </RadioGroup>
            <Typography variant="caption" color="text.secondary" id="font-size-help">
              Выберите комфортный размер текста для чтения
            </Typography>
          </FormControl>
        </Paper>

        {/* Motion Settings */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            <MotionPhotosOff sx={{ mr: 1, verticalAlign: 'middle' }} />
            Настройки анимации
          </Typography>

          <FormControlLabel
            control={
              <Switch
                checked={isReducedMotion}
                onChange={handleReducedMotionChange}
                aria-describedby="reduced-motion-help"
              />
            }
            label={
              <Box>
                <Typography variant="body1">Уменьшить анимации</Typography>
                <Typography variant="caption" color="text.secondary" id="reduced-motion-help">
                  Отключает или уменьшает анимации и переходы в интерфейсе
                </Typography>
              </Box>
            }
          />
        </Paper>

        {/* Keyboard Navigation */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            <Keyboard sx={{ mr: 1, verticalAlign: 'middle' }} />
            Навигация с клавиатуры
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" component="div">
              <strong>Горячие клавиши:</strong>
              <Box component="ul" sx={{ mt: 1, mb: 0 }}>
                <li><Chip size="small" label="Tab" /> - переход между элементами</li>
                <li><Chip size="small" label="Enter/Space" /> - активация кнопок</li>
                <li><Chip size="small" label="Escape" /> - закрытие модальных окон</li>
                <li><Chip size="small" label="↑↓" /> - навигация в меню</li>
              </Box>
            </Typography>
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Все элементы интерфейса доступны для навигации с клавиатуры. 
            При использовании клавиатуры активные элементы будут выделены видимой рамкой.
          </Typography>
        </Paper>

        {/* Screen Reader Support */}
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            <VolumeUp sx={{ mr: 1, verticalAlign: 'middle' }} />
            Поддержка программ чтения с экрана
          </Typography>

          <Typography variant="body2" color="text.secondary" paragraph>
            Система поддерживает популярные программы чтения с экрана (NVDA, JAWS, VoiceOver).
            Все элементы интерфейса имеют подходящие ARIA-метки и описания.
          </Typography>

          <Button variant="outlined" onClick={testScreenReader} sx={{ mr: 2 }}>
            Тестировать объявления
          </Button>

          {screenReader && (
            <Chip 
              label="Программа чтения обнаружена" 
              color="success" 
              variant="outlined" 
            />
          )}
        </Paper>

        {/* Reset Settings */}
        <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Сброс настроек
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Вернуть все настройки доступности к значениям по умолчанию.
          </Typography>

          <Button 
            variant="outlined" 
            color="warning" 
            onClick={resetSettings}
            aria-describedby="reset-help"
          >
            Сбросить настройки
          </Button>
          <Typography variant="caption" color="text.secondary" id="reset-help" sx={{ ml: 2 }}>
            Это действие нельзя отменить
          </Typography>
        </Paper>
      </Box>

      {/* Hidden announcer for screen readers */}
      <div id="screen-reader-announcer" aria-live="polite" aria-atomic="true" className="accessibility__sr-only" />
    </Box>
  )
}

function getFontSizeLabel(size: string): string {
  switch (size) {
    case 'small': return 'маленький'
    case 'medium': return 'обычный'
    case 'large': return 'большой'
    default: return size
  }
}

export default AccessibilitySettings
