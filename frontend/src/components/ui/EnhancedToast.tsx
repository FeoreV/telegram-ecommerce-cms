import React from 'react'
import { Alert, AlertTitle, Box, IconButton, Slide, SlideProps } from '@mui/material'
import { Close, CheckCircle, Error, Warning, Info } from '@mui/icons-material'
import { toast, type ToastContent, ToastOptions, TypeOptions } from 'react-toastify'

interface ToastContentProps {
  type: TypeOptions
  title?: string
  message: string
  action?: React.ReactNode
  closeToast?: () => void
}

const ToastContent: React.FC<ToastContentProps> = ({
  type,
  title,
  message,
  action,
  closeToast,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle />
      case 'error': return <Error />
      case 'warning': return <Warning />
      case 'info': return <Info />
      default: return <Info />
    }
  }

  const getSeverity = () => {
    switch (type) {
      case 'success': return 'success' as const
      case 'error': return 'error' as const
      case 'warning': return 'warning' as const
      case 'info': return 'info' as const
      default: return 'info' as const
    }
  }

  return (
    <Alert
      severity={getSeverity()}
      icon={getIcon()}
      sx={{
        alignItems: 'flex-start',
        '& .MuiAlert-icon': {
          fontSize: '1.25rem',
          mt: 0.5,
        },
        '& .MuiAlert-action': {
          pt: 0,
        },
      }}
      action={
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {action}
          <IconButton
            size="small"
            onClick={closeToast}
            sx={{ color: 'inherit' }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Box>
      }
    >
      {title && <AlertTitle>{title}</AlertTitle>}
      {message}
    </Alert>
  )
}

function SlideTransition(props: SlideProps) {
  return <Slide {...props} direction="left" />;
}

export const showToast = (
  message: string,
  type: TypeOptions = 'info',
  title?: string,
  action?: React.ReactNode,
  options?: ToastOptions
) => {
  const content: ToastContent = ({ closeToast }) => (
    <ToastContent
      type={type}
      title={title}
      message={message}
      action={action}
      closeToast={closeToast}
    />
  )

  return toast(content, {
    type: 'default', // Use default to show our custom Alert component
    hideProgressBar: true,
    closeButton: false,
    ...options,
  })
}

export const toastActions = {
  success: (message: string, title?: string, action?: React.ReactNode, options?: ToastOptions) =>
    showToast(message, 'success', title, action, options),
  
  error: (message: string, title?: string, action?: React.ReactNode, options?: ToastOptions) =>
    showToast(message, 'error', title, action, options),
  
  warning: (message: string, title?: string, action?: React.ReactNode, options?: ToastOptions) =>
    showToast(message, 'warning', title, action, options),
  
  info: (message: string, title?: string, action?: React.ReactNode, options?: ToastOptions) =>
    showToast(message, 'info', title, action, options),
}

export default ToastContent
