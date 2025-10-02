import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  TextField,
  TextFieldProps,
  InputAdornment,
  IconButton,
  Tooltip,
  Box,
  Typography,
  Fade,
} from '@mui/material'
import {
  Visibility,
  VisibilityOff,
  Check,
  Clear,
  Info,
  Warning,
} from '@mui/icons-material'

interface ValidationRule {
  validate: (value: string) => boolean | Promise<boolean>
  message: string
  level?: 'error' | 'warning'
}

interface ValidatedTextFieldProps extends Omit<TextFieldProps, 'error'> {
  validationRules?: ValidationRule[]
  showValidationIcon?: boolean
  validateOnBlur?: boolean
  validateOnChange?: boolean
  debounceMs?: number
  asyncValidation?: (value: string) => Promise<boolean>
  asyncValidationMessage?: string
  strengthMeter?: boolean // For password fields
  suggestions?: string[] // For autocomplete-like behavior
  onValidationChange?: (isValid: boolean, errors: string[]) => void
}

const ValidatedTextField: React.FC<ValidatedTextFieldProps> = ({
  validationRules = [],
  showValidationIcon = true,
  validateOnBlur = true,
  validateOnChange = false,
  debounceMs = 300,
  asyncValidation,
  asyncValidationMessage = 'Проверка...',
  strengthMeter = false,
  suggestions = [],
  onValidationChange,
  type,
  ...textFieldProps
}) => {
  const [value, setValue] = useState(textFieldProps.value || '')
  const [errors, setErrors] = useState<string[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState(false)
  const [touched, setTouched] = useState(false)

  const isPasswordField = type === 'password'
  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0
  const isValid = !hasErrors && !isValidating

  // Debounced validation
  const debouncedValidate = useCallback(
    debounce(async (val: string) => {
      if (!touched && !validateOnChange) return

      setIsValidating(true)
      const newErrors: string[] = []
      const newWarnings: string[] = []

      // Run synchronous validations
      for (const rule of validationRules) {
        try {
          const result = await rule.validate(val)
          if (!result) {
            if (rule.level === 'warning') {
              newWarnings.push(rule.message)
            } else {
              newErrors.push(rule.message)
            }
          }
        } catch (error) {
          newErrors.push(rule.message)
        }
      }

      // Run async validation
      if (asyncValidation && val.trim() !== '') {
        try {
          const isAsyncValid = await asyncValidation(val)
          if (!isAsyncValid) {
            newErrors.push(asyncValidationMessage)
          }
        } catch (error) {
          newErrors.push('Ошибка валидации')
        }
      }

      setErrors(newErrors)
      setWarnings(newWarnings)
      setIsValidating(false)

      onValidationChange?.(newErrors.length === 0, newErrors)
    }, debounceMs),
    [validationRules, asyncValidation, asyncValidationMessage, onValidationChange, touched, validateOnChange]
  )

  // Password strength calculation
  const passwordStrength = useMemo(() => {
    if (!strengthMeter || !isPasswordField) return null

    const val = value as string
    let score = 0
    const checks = {
      length: val.length >= 8,
      lowercase: /[a-z]/.test(val),
      uppercase: /[A-Z]/.test(val),
      numbers: /\d/.test(val),
      symbols: /[!@#$%^&*(),.?":{}|<>]/.test(val),
    }

    score = Object.values(checks).filter(Boolean).length

    const strength = score <= 1 ? 'weak' : score <= 3 ? 'medium' : 'strong'
    const color = strength === 'weak' ? 'error' : strength === 'medium' ? 'warning' : 'success'

    return { score, checks, strength, color }
  }, [value, strengthMeter, isPasswordField])

  useEffect(() => {
    setValue(textFieldProps.value || '')
  }, [textFieldProps.value])

  useEffect(() => {
    if (validateOnChange || touched) {
      debouncedValidate(value as string)
    }
  }, [value, debouncedValidate, validateOnChange, touched])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = event.target.value
    setValue(newValue)
    textFieldProps.onChange?.(event)
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    setTouched(true)
    setFocused(false)
    if (validateOnBlur) {
      debouncedValidate(value as string)
    }
    textFieldProps.onBlur?.(event)
  }

  const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true)
    textFieldProps.onFocus?.(event)
  }

  const getValidationIcon = () => {
    if (!showValidationIcon || !touched) return null
    if (isValidating) return <Info color="action" />
    if (hasErrors) return <Clear color="error" />
    if (value && isValid) return <Check color="success" />
    return null
  }

  const getHelperText = () => {
    if (hasErrors) return errors[0]
    if (hasWarnings) return warnings[0]
    if (isValidating) return asyncValidationMessage
    return textFieldProps.helperText || ''
  }

  const endAdornment = (
    <>
      {getValidationIcon()}
      {isPasswordField && (
        <IconButton
          onClick={() => setShowPassword(!showPassword)}
          edge="end"
          size="small"
        >
          {showPassword ? <VisibilityOff /> : <Visibility />}
        </IconButton>
      )}
      {textFieldProps.InputProps?.endAdornment}
    </>
  )

  return (
    <Box>
      <TextField
        {...textFieldProps}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        type={isPasswordField ? (showPassword ? 'text' : 'password') : type}
        error={hasErrors}
        helperText={getHelperText()}
        InputProps={{
          ...textFieldProps.InputProps,
          endAdornment: endAdornment,
        }}
      />

      {/* Password Strength Meter */}
      {strengthMeter && isPasswordField && passwordStrength && focused && (
        <Fade in>
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              {[1, 2, 3, 4, 5].map((level) => (
                <Box
                  key={level}
                  sx={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    bgcolor: level <= passwordStrength.score 
                      ? `${passwordStrength.color}.main`
                      : 'grey.300',
                    transition: 'all 0.3s ease',
                  }}
                />
              ))}
            </Box>
            <Typography variant="caption" color={`${passwordStrength.color}.main`}>
              Надёжность: {
                passwordStrength.strength === 'weak' ? 'Слабая' :
                passwordStrength.strength === 'medium' ? 'Средняя' : 'Сильная'
              }
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              {Object.entries(passwordStrength.checks).map(([check, passed]) => (
                <Typography
                  key={check}
                  variant="caption"
                  sx={{
                    display: 'block',
                    color: passed ? 'success.main' : 'text.secondary',
                  }}
                >
                  {passed ? '✓' : '○'} {
                    check === 'length' ? 'Минимум 8 символов' :
                    check === 'lowercase' ? 'Строчные буквы' :
                    check === 'uppercase' ? 'Заглавные буквы' :
                    check === 'numbers' ? 'Цифры' :
                    'Специальные символы'
                  }
                </Typography>
              ))}
            </Box>
          </Box>
        </Fade>
      )}

      {/* Validation Messages */}
      {touched && (warnings.length > 0 || errors.length > 1) && (
        <Box sx={{ mt: 1 }}>
          {errors.slice(1).map((error, index) => (
            <Typography key={index} variant="caption" color="error" display="block">
              • {error}
            </Typography>
          ))}
          {warnings.map((warning, index) => (
            <Typography key={index} variant="caption" color="warning.main" display="block">
              <Warning sx={{ fontSize: 12, mr: 0.5 }} />
              {warning}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  )
}

// Utility function for debouncing
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export default ValidatedTextField
