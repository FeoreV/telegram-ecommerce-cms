import React, { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Button,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  Fade,
  Collapse,
} from '@mui/material'
import {
  NavigateNext,
  NavigateBefore,
  Check,
  Error as ErrorIcon,
} from '@mui/icons-material'
import AnimatedButton from '../ui/AnimatedButton'

export interface WizardStep {
  id: string
  label: string
  description?: string
  content: React.ReactNode
  validation?: () => boolean | Promise<boolean>
  isValid?: boolean
  isOptional?: boolean
  onEnter?: () => void | Promise<void>
  onExit?: () => void | Promise<void>
}

interface FormWizardProps {
  steps: WizardStep[]
  onComplete: () => void | Promise<void>
  onCancel?: () => void
  title?: string
  allowStepNavigation?: boolean
  showProgress?: boolean
  persistProgress?: boolean
  variant?: 'horizontal' | 'vertical'
  loading?: boolean
}

const FormWizard: React.FC<FormWizardProps> = ({
  steps,
  onComplete,
  onCancel,
  title,
  allowStepNavigation = false,
  showProgress = true,
  persistProgress = false,
  variant = 'horizontal',
  loading = false,
}) => {
  const [activeStep, setActiveStep] = useState(0)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isValidating, setIsValidating] = useState(false)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const currentStep = steps[activeStep]
  const isLastStep = activeStep === steps.length - 1
  const isFirstStep = activeStep === 0

  const progress = useMemo(() => {
    return ((activeStep + 1) / steps.length) * 100
  }, [activeStep, steps.length])

  const validateStep = useCallback(async (stepIndex: number): Promise<boolean> => {
    const step = steps[stepIndex]
    if (!step.validation) return true

    setIsValidating(true)
    try {
      const isValid = await step.validation()
      if (isValid) {
        setValidationErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors[step.id]
          return newErrors
        })
        setCompletedSteps(prev => new Set([...prev, stepIndex]))
      } else {
        setValidationErrors(prev => ({
          ...prev,
          [step.id]: 'Пожалуйста, заполните все обязательные поля корректно'
        }))
      }
      return isValid
    } catch (error) {
      setValidationErrors(prev => ({
        ...prev,
        [step.id]: error instanceof Error ? error.message : 'Ошибка валидации'
      }))
      return false
    } finally {
      setIsValidating(false)
    }
  }, [steps])

  const handleNext = useCallback(async () => {
    const isValid = await validateStep(activeStep)
    if (!isValid) return

    await currentStep.onExit?.()

    if (isLastStep) {
      await onComplete()
    } else {
      const nextStep = activeStep + 1
      setActiveStep(nextStep)
      await steps[nextStep].onEnter?.()
    }
  }, [activeStep, currentStep, isLastStep, onComplete, steps, validateStep])

  const handleBack = useCallback(async () => {
    if (isFirstStep) return

    await currentStep.onExit?.()
    
    const prevStep = activeStep - 1
    setActiveStep(prevStep)
    await steps[prevStep].onEnter?.()
  }, [activeStep, currentStep, isFirstStep, steps])

  const handleStepClick = useCallback(async (stepIndex: number) => {
    if (!allowStepNavigation || stepIndex === activeStep) return
    
    // Validate all steps up to the target step
    let canNavigate = true
    for (let i = 0; i < stepIndex; i++) {
      if (!completedSteps.has(i)) {
        const isValid = await validateStep(i)
        if (!isValid) {
          canNavigate = false
          break
        }
      }
    }

    if (canNavigate) {
      await currentStep.onExit?.()
      setActiveStep(stepIndex)
      await steps[stepIndex].onEnter?.()
    }
  }, [allowStepNavigation, activeStep, completedSteps, currentStep, steps, validateStep])

  const getStepIcon = (stepIndex: number) => {
    if (completedSteps.has(stepIndex)) {
      return <Check />
    }
    if (validationErrors[steps[stepIndex].id]) {
      return <ErrorIcon />
    }
    return stepIndex + 1
  }

  const getStepColor = (stepIndex: number) => {
    if (validationErrors[steps[stepIndex].id]) return 'error'
    if (completedSteps.has(stepIndex)) return 'success'
    if (stepIndex === activeStep) return 'primary'
    return 'inherit'
  }

  if (variant === 'vertical') {
    return (
      <Box>
        {title && (
          <Typography variant="h5" gutterBottom>
            {title}
          </Typography>
        )}
        
        {showProgress && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="body2">
                Шаг {activeStep + 1} из {steps.length}
              </Typography>
              <Typography variant="body2">
                {Math.round(progress)}%
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} />
          </Box>
        )}

        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((step, index) => (
            <Step key={step.id}>
              <StepLabel
                error={!!validationErrors[step.id]}
                icon={getStepIcon(index)}
                onClick={() => handleStepClick(index)}
                sx={{
                  cursor: allowStepNavigation ? 'pointer' : 'default',
                  '& .MuiStepLabel-label': {
                    fontWeight: index === activeStep ? 600 : 400,
                  }
                }}
              >
                <Box>
                  <Typography variant="subtitle1">{step.label}</Typography>
                  {step.description && (
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                  )}
                </Box>
              </StepLabel>
              <StepContent>
                <Fade in={index === activeStep} timeout={300}>
                  <Box>
                    <Card sx={{ mb: 2 }}>
                      <CardContent>
                        {step.content}
                      </CardContent>
                    </Card>

                    <Collapse in={!!validationErrors[step.id]}>
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {validationErrors[step.id]}
                      </Alert>
                    </Collapse>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button
                        disabled={isFirstStep}
                        onClick={handleBack}
                        startIcon={<NavigateBefore />}
                        variant="outlined"
                      >
                        Назад
                      </Button>
                      
                      <AnimatedButton
                        variant="contained"
                        onClick={handleNext}
                        loading={isValidating || loading}
                        endIcon={isLastStep ? <Check /> : <NavigateNext />}
                      >
                        {isLastStep ? 'Завершить' : 'Далее'}
                      </AnimatedButton>
                      
                      {onCancel && (
                        <Button onClick={onCancel} color="inherit">
                          Отмена
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Fade>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </Box>
    )
  }

  // Horizontal variant
  return (
    <Box>
      {title && (
        <Typography variant="h5" gutterBottom>
          {title}
        </Typography>
      )}
      
      {showProgress && (
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2">
              Шаг {activeStep + 1} из {steps.length}: {currentStep.label}
            </Typography>
            <Typography variant="body2">
              {Math.round(progress)}%
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress} />
        </Box>
      )}

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((step, index) => (
          <Step key={step.id}>
            <StepLabel
              error={!!validationErrors[step.id]}
              icon={getStepIcon(index)}
              onClick={() => handleStepClick(index)}
              sx={{
                cursor: allowStepNavigation ? 'pointer' : 'default',
                '& .MuiStepLabel-label': {
                  fontWeight: index === activeStep ? 600 : 400,
                }
              }}
            >
              {step.label}
              {step.isOptional && (
                <Typography variant="caption" color="text.secondary">
                  (необязательно)
                </Typography>
              )}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Fade in timeout={300} key={activeStep}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {currentStep.label}
            </Typography>
            {currentStep.description && (
              <Typography variant="body2" color="text.secondary" paragraph>
                {currentStep.description}
              </Typography>
            )}
            
            {currentStep.content}
          </CardContent>
        </Card>
      </Fade>

      <Collapse in={!!validationErrors[currentStep.id]}>
        <Alert severity="error" sx={{ mt: 2 }}>
          {validationErrors[currentStep.id]}
        </Alert>
      </Collapse>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
        <Button
          disabled={isFirstStep}
          onClick={handleBack}
          startIcon={<NavigateBefore />}
          variant="outlined"
        >
          Назад
        </Button>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          {onCancel && (
            <Button onClick={onCancel} color="inherit">
              Отмена
            </Button>
          )}
          
          <AnimatedButton
            variant="contained"
            onClick={handleNext}
            loading={isValidating || loading}
            endIcon={isLastStep ? <Check /> : <NavigateNext />}
          >
            {isLastStep ? 'Завершить' : 'Далее'}
          </AnimatedButton>
        </Box>
      </Box>
    </Box>
  )
}

export default FormWizard
