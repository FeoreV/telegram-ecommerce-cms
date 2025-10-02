import React, { useState } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Avatar,
  Tooltip,
  Fade,
  Zoom,
} from '@mui/material'
import {
  Palette,
  Check,
  Close,
  Brightness4,
  Brightness7,
  ColorLens,
  Business,
  Minimize,
  AutoAwesome,
} from '@mui/icons-material'
import { ThemeVariant, getAvailableVariants, createVariantTheme } from '../../theme/variants'
import { useThemeMode } from '../../contexts/ThemeModeContext'

interface ThemeVariantSelectorProps {
  open: boolean
  onClose: () => void
  currentVariant?: ThemeVariant
  onVariantChange: (variant: ThemeVariant) => void
  allowCustomization?: boolean
}

const ThemeVariantSelector: React.FC<ThemeVariantSelectorProps> = ({
  open,
  onClose,
  currentVariant = 'default',
  onVariantChange,
  allowCustomization = false,
}) => {
  const { mode, toggleMode } = useThemeMode()
  const [selectedVariant, setSelectedVariant] = useState<ThemeVariant>(currentVariant)
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>(mode)
  
  const variants = getAvailableVariants()

  const handleApply = () => {
    onVariantChange(selectedVariant)
    onClose()
  }

  const getVariantIcon = (variant: ThemeVariant) => {
    switch (variant) {
      case 'vibrant':
        return <AutoAwesome />
      case 'minimal':
        return <Minimize />
      case 'corporate':
        return <Business />
      case 'custom':
        return <ColorLens />
      default:
        return <Palette />
    }
  }

  const getVariantPreviewColors = (variant: ThemeVariant) => {
    const theme = createVariantTheme(variant, previewMode)
    return {
      primary: theme.palette.primary.main,
      secondary: theme.palette.secondary.main,
      background: theme.palette.background.default,
      paper: theme.palette.background.paper,
      text: theme.palette.text.primary,
    }
  }

  const VariantPreviewCard: React.FC<{ variant: ThemeVariant; config: any }> = ({ variant, config }) => {
    const colors = getVariantPreviewColors(variant)
    const isSelected = selectedVariant === variant
    const isCurrent = currentVariant === variant

    return (
      <Zoom in timeout={300}>
        <Card
          sx={{
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: isSelected ? 'scale(1.02)' : 'scale(1)',
            border: isSelected ? 2 : 1,
            borderColor: isSelected ? 'primary.main' : 'divider',
            '&:hover': {
              transform: 'scale(1.02)',
              boxShadow: 4,
            }
          }}
          onClick={() => setSelectedVariant(variant)}
        >
          {isCurrent && (
            <Chip
              label="Текущая"
              color="primary"
              size="small"
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                zIndex: 1,
              }}
            />
          )}
          
          {isSelected && (
            <Box
              sx={{
                position: 'absolute',
                top: 8,
                left: 8,
                zIndex: 1,
                bgcolor: theme => theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main',
                borderRadius: '50%',
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme => theme.palette.primary.contrastText,
                boxShadow: theme => `0 0 0 2px ${theme.palette.background.paper}`,
              }}
            >
              <Check sx={{ fontSize: 16 }} />
            </Box>
          )}

          <CardContent sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Avatar 
                sx={{ 
                  bgcolor: colors.primary, 
                  color: '#fff',
                  width: 32, 
                  height: 32,
                  border: theme => `1px solid ${theme.palette.primary.main}`,
                }}
              >
                {getVariantIcon(variant)}
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {config.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {config.description}
                </Typography>
              </Box>
            </Box>

            {/* Color Preview */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 1,
                  bgcolor: colors.primary,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 1,
                  bgcolor: colors.secondary,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 1,
                  bgcolor: colors.background,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: 1,
                  bgcolor: colors.paper,
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              />
            </Box>

            {/* Mini UI Preview */}
            <Box
              sx={{
                bgcolor: colors.background,
                color: colors.text,
                p: 1.5,
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Box
                sx={{
                  bgcolor: colors.paper,
                  p: 1,
                  borderRadius: 0.5,
                  mb: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <Typography variant="caption" sx={{ color: colors.text }}>
                  Sample Card
                </Typography>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    bgcolor: colors.primary,
                  }}
                />
              </Box>
              <Box
                sx={{
                  bgcolor: colors.primary,
                  color: 'white',
                  py: 0.5,
                  px: 1,
                  borderRadius: 0.5,
                  fontSize: 10,
                  textAlign: 'center',
                }}
              >
                Button
              </Box>
            </Box>
          </CardContent>
        </Card>
      </Zoom>
    )
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Palette />
            <Typography variant="h6">Выбор темы оформления</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Предпросмотр в светлой теме">
              <IconButton
                onClick={() => setPreviewMode('light')}
                color={previewMode === 'light' ? 'primary' : 'default'}
              >
                <Brightness7 />
              </IconButton>
            </Tooltip>
            <Tooltip title="Предпросмотр в тёмной теме">
              <IconButton
                onClick={() => setPreviewMode('dark')}
                color={previewMode === 'dark' ? 'primary' : 'default'}
              >
                <Brightness4 />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" paragraph>
          Выберите тему оформления, которая лучше всего подходит для вашего бренда и предпочтений.
          Предпросмотр показан в {previewMode === 'light' ? 'светлом' : 'тёмном'} режиме.
        </Typography>

        <Grid container spacing={2}>
          {variants.map(({ key, config }) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <VariantPreviewCard variant={key} config={config} />
            </Grid>
          ))}
        </Grid>

        {allowCustomization && selectedVariant === 'custom' && (
          <Fade in>
            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Настройка пользовательской темы
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Пользовательские настройки темы будут доступны в настройках магазина.
                Свяжитесь с администратором для настройки брендинга.
              </Typography>
            </Box>
          </Fade>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined">
          Отмена
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={selectedVariant === currentVariant}
          startIcon={<Check />}
        >
          Применить тему
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ThemeVariantSelector
