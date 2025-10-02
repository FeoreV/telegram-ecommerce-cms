import React, { useState, useRef } from 'react'
import {
  Box,
  TextField,
  Button,
  IconButton,
  Fab,
  Paper,
  Slide,
  Backdrop,
  useTheme,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Avatar,
  Typography,
  Alert,
  LinearProgress,
} from '@mui/material'
import {
  Close,
  Check,
  Add,
  Remove,
  CameraAlt,
  AttachFile,
  Send,
  KeyboardArrowDown,
  Clear,
} from '@mui/icons-material'
import { useResponsive } from '../../theme/responsive'

interface MobileFormField {
  name: string
  label: string
  type: 'text' | 'email' | 'tel' | 'number' | 'select' | 'multiselect' | 'textarea' | 'file' | 'image'
  required?: boolean
  options?: Array<{ value: string; label: string }>
  placeholder?: string
  helperText?: string
  validation?: (value: any) => string | null
  autoComplete?: string
  multiline?: boolean
  rows?: number
}

interface MobileFormProps {
  title: string
  fields: MobileFormField[]
  initialValues?: Record<string, any>
  onSubmit: (values: Record<string, any>) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
  fullScreen?: boolean
  showProgress?: boolean
  loading?: boolean
}

const MobileForm: React.FC<MobileFormProps> = ({
  title,
  fields,
  initialValues = {},
  onSubmit,
  onCancel,
  submitLabel = 'Сохранить',
  fullScreen = false,
  showProgress = true,
  loading = false,
}) => {
  const theme = useTheme()
  const { isMobile } = useResponsive()
  const [values, setValues] = useState<Record<string, any>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [currentStep, setCurrentStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement>>({})

  const totalSteps = Math.ceil(fields.length / 3) // 3 fields per step on mobile
  const currentFields = fields.slice(currentStep * 3, (currentStep + 1) * 3)

  const handleChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }))
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  const handleBlur = (name: string) => {
    setTouched(prev => ({ ...prev, [name]: true }))
    validateField(name)
  }

  const validateField = (name: string) => {
    const field = fields.find(f => f.name === name)
    if (!field) return

    const value = values[name]
    
    // Required validation
    if (field.required && (!value || (Array.isArray(value) && value.length === 0))) {
      setErrors(prev => ({ ...prev, [name]: 'Это поле обязательно' }))
      return false
    }

    // Custom validation
    if (field.validation && value) {
      const error = field.validation(value)
      if (error) {
        setErrors(prev => ({ ...prev, [name]: error }))
        return false
      }
    }

    return true
  }

  const validateCurrentStep = () => {
    let isValid = true
    currentFields.forEach(field => {
      if (!validateField(field.name)) {
        isValid = false
      }
    })
    return isValid
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0))
  }

  const handleSubmit = async () => {
    // Validate all fields
    let isValid = true
    fields.forEach(field => {
      if (!validateField(field.name)) {
        isValid = false
      }
    })

    if (!isValid) return

    try {
      setSubmitting(true)
      await onSubmit(values)
    } finally {
      setSubmitting(false)
    }
  }

  const handleFileChange = (name: string, files: FileList | null) => {
    if (files && files.length > 0) {
      const field = fields.find(f => f.name === name)
      if (field?.type === 'image') {
        const file = files[0]
        const reader = new FileReader()
        reader.onload = (e) => {
          handleChange(name, {
            file,
            preview: e.target?.result as string
          })
        }
        reader.readAsDataURL(file)
      } else {
        handleChange(name, Array.from(files))
      }
    }
  }

  const renderField = (field: MobileFormField) => {
    const value = values[field.name] || ''
    const error = errors[field.name]
    const isTouched = touched[field.name]

    switch (field.type) {
      case 'select':
        return (
          <FormControl 
            fullWidth 
            error={!!error && isTouched}
            sx={{ mb: 2 }}
          >
            <InputLabel>{field.label}</InputLabel>
            <Select
              value={value}
              onChange={(e) => handleChange(field.name, e.target.value)}
              onBlur={() => handleBlur(field.name)}
              label={field.label}
              size="medium" // Larger for mobile
              MenuProps={{
                PaperProps: {
                  sx: { maxHeight: 300 }
                }
              }}
            >
              {field.options?.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
            {error && isTouched && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, px: 1 }}>
                {error}
              </Typography>
            )}
          </FormControl>
        )

      case 'multiselect':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {field.label} {field.required && '*'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              {field.options?.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  variant={value.includes(option.value) ? 'filled' : 'outlined'}
                  onClick={() => {
                    const newValue = value.includes(option.value)
                      ? value.filter((v: string) => v !== option.value)
                      : [...value, option.value]
                    handleChange(field.name, newValue)
                  }}
                  sx={{ 
                    minHeight: 40, // Larger for touch
                    fontSize: '0.9rem',
                  }}
                />
              ))}
            </Box>
            {error && isTouched && (
              <Typography variant="caption" color="error">
                {error}
              </Typography>
            )}
          </Box>
        )

      case 'file':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {field.label} {field.required && '*'}
            </Typography>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<AttachFile />}
              onClick={() => fileInputRefs.current[field.name]?.click()}
              sx={{ 
                height: 56, // Larger for touch
                justifyContent: 'flex-start',
                textTransform: 'none',
              }}
            >
              {value.length > 0 ? `Выбрано файлов: ${value.length}` : 'Выберите файлы'}
            </Button>
            <input
              ref={(ref) => {
                if (ref) fileInputRefs.current[field.name] = ref
              }}
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(field.name, e.target.files)}
            />
            {error && isTouched && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>
        )

      case 'image':
        return (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              {field.label} {field.required && '*'}
            </Typography>
            {value.preview ? (
              <Box sx={{ position: 'relative', display: 'inline-block' }}>
                <Avatar
                  src={value.preview}
                  sx={{ width: 120, height: 120, mb: 1 }}
                  variant="rounded"
                />
                <IconButton
                  size="small"
                  onClick={() => handleChange(field.name, null)}
                  sx={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    bgcolor: 'background.paper',
                    boxShadow: 1,
                  }}
                >
                  <Clear />
                </IconButton>
              </Box>
            ) : (
              <Button
                variant="outlined"
                fullWidth
                startIcon={<CameraAlt />}
                onClick={() => fileInputRefs.current[field.name]?.click()}
                sx={{ 
                  height: 120,
                  flexDirection: 'column',
                  gap: 1,
                  textTransform: 'none',
                }}
              >
                Загрузить изображение
              </Button>
            )}
            <input
              ref={(ref) => {
                if (ref) fileInputRefs.current[field.name] = ref
              }}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleFileChange(field.name, e.target.files)}
            />
            {error && isTouched && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                {error}
              </Typography>
            )}
          </Box>
        )

      default:
        return (
          <TextField
            fullWidth
            label={field.label}
            type={field.type}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            onBlur={() => handleBlur(field.name)}
            error={!!error && isTouched}
            helperText={(error && isTouched) ? error : field.helperText}
            placeholder={field.placeholder}
            required={field.required}
            multiline={field.multiline || field.type === 'textarea'}
            rows={field.rows || (field.type === 'textarea' ? 4 : 1)}
            autoComplete={field.autoComplete}
            sx={{ 
              mb: 2,
              '& .MuiInputBase-root': {
                fontSize: '1rem', // Larger font for mobile
                minHeight: field.multiline ? 'auto' : 56, // Larger touch targets
              }
            }}
            InputProps={{
              sx: { borderRadius: 2 }
            }}
          />
        )
    }
  }

  if (!isMobile) {
    // Regular form for desktop
    return (
      <Paper sx={{ p: 3, maxWidth: 600, mx: 'auto' }}>
        <Typography variant="h5" gutterBottom>{title}</Typography>
        {fields.map(renderField)}
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          {onCancel && (
            <Button variant="outlined" onClick={onCancel}>
              Отмена
            </Button>
          )}
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={submitting || loading}
            fullWidth={!onCancel}
          >
            {submitting ? 'Сохранение...' : submitLabel}
          </Button>
        </Box>
      </Paper>
    )
  }

  // Mobile form with steps
  return (
    <Slide direction="up" in mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: fullScreen ? 'fixed' : 'relative',
          top: fullScreen ? 0 : 'auto',
          left: fullScreen ? 0 : 'auto',
          right: fullScreen ? 0 : 'auto',
          bottom: fullScreen ? 0 : 'auto',
          zIndex: fullScreen ? theme.zIndex.modal : 'auto',
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          height: fullScreen ? '100vh' : 'auto',
        }}
      >
        {/* Header */}
        <Paper
          sx={{
            p: 2,
            borderRadius: fullScreen ? 0 : 2,
            borderBottom: 1,
            borderColor: 'divider',
            position: 'sticky',
            top: 0,
            zIndex: 1,
          }}
          elevation={fullScreen ? 1 : 0}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6" fontWeight={600}>
              {title}
            </Typography>
            {onCancel && (
              <IconButton onClick={onCancel} edge="end">
                <Close />
              </IconButton>
            )}
          </Box>
          
          {showProgress && totalSteps > 1 && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption">
                  Шаг {currentStep + 1} из {totalSteps}
                </Typography>
                <Typography variant="caption">
                  {Math.round(((currentStep + 1) / totalSteps) * 100)}%
                </Typography>
              </Box>
              <LinearProgress 
                variant="determinate" 
                value={((currentStep + 1) / totalSteps) * 100}
                sx={{ borderRadius: 1, height: 6 }}
              />
            </Box>
          )}
        </Paper>

        {/* Form Content */}
        <Box
          sx={{
            flex: 1,
            p: 2,
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {currentFields.map(renderField)}

          {Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mb: 2 }}>
              Пожалуйста, исправьте ошибки в форме
            </Alert>
          )}
        </Box>

        {/* Footer Actions */}
        <Paper
          sx={{
            p: 2,
            borderRadius: fullScreen ? 0 : 2,
            borderTop: 1,
            borderColor: 'divider',
            position: 'sticky',
            bottom: 0,
          }}
          elevation={fullScreen ? 1 : 0}
        >
          <Box sx={{ display: 'flex', gap: 1 }}>
            {currentStep > 0 && (
              <Button
                variant="outlined"
                onClick={handlePrevious}
                sx={{ minWidth: 80 }}
              >
                Назад
              </Button>
            )}
            
            <Button
              variant="contained"
              fullWidth
              onClick={currentStep === totalSteps - 1 ? handleSubmit : handleNext}
              disabled={submitting || loading}
              endIcon={currentStep === totalSteps - 1 ? <Send /> : <KeyboardArrowDown />}
              sx={{ height: 48 }}
            >
              {submitting 
                ? 'Сохранение...' 
                : currentStep === totalSteps - 1 
                  ? submitLabel 
                  : 'Далее'
              }
            </Button>
          </Box>
        </Paper>
      </Box>
    </Slide>
  )
}

export default MobileForm
