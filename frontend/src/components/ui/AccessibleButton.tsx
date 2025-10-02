import React, { useRef, useState } from 'react'
import { Button, ButtonProps, Tooltip } from '@mui/material'

interface AccessibleButtonProps extends ButtonProps {
  ariaLabel?: string
  tooltip?: string
  keyboardShortcut?: string
  loading?: boolean
  focusRipple?: boolean
}

const AccessibleButton: React.FC<AccessibleButtonProps> = ({
  children,
  ariaLabel,
  tooltip,
  keyboardShortcut,
  loading = false,
  focusRipple = true,
  onKeyDown,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // Enhanced keyboard navigation
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (props.onClick && !loading && !props.disabled) {
        props.onClick(event as any)
      }
    }

    // Handle keyboard shortcuts
    if (keyboardShortcut) {
      const keys = keyboardShortcut.toLowerCase().split('+')
      const isCtrl = keys.includes('ctrl') && (event.ctrlKey || event.metaKey)
      const isAlt = keys.includes('alt') && event.altKey
      const isShift = keys.includes('shift') && event.shiftKey
      const key = keys[keys.length - 1]

      const modifiersMatch = 
        (!keys.includes('ctrl') || isCtrl) &&
        (!keys.includes('alt') || isAlt) &&
        (!keys.includes('shift') || isShift)

      if (modifiersMatch && event.key.toLowerCase() === key) {
        event.preventDefault()
        if (props.onClick && !loading && !props.disabled) {
          props.onClick(event as any)
        }
      }
    }

    if (onKeyDown) {
      onKeyDown(event)
    }
  }

  const button = (
    <Button
      ref={buttonRef}
      {...props}
      aria-label={ariaLabel || (typeof children === 'string' ? children : undefined)}
      disabled={loading || props.disabled}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      sx={{
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: '2px',
          backgroundColor: 'action.focus',
        },
        '&:focus:not(:focus-visible)': {
          outline: 'none',
        },
        '&.Mui-disabled': {
          opacity: 0.6,
          cursor: 'not-allowed',
        },
        ...(isFocused && focusRipple && {
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: 'inherit',
            border: '2px solid',
            borderColor: 'primary.main',
            opacity: 0.3,
            pointerEvents: 'none',
          }
        }),
        ...props.sx,
      }}
    >
      {children}
    </Button>
  )

  if (tooltip) {
    return (
      <Tooltip 
        title={
          keyboardShortcut 
            ? `${tooltip} (${keyboardShortcut})`
            : tooltip
        }
        placement="top"
        arrow
      >
        {button}
      </Tooltip>
    )
  }

  return button
}

export default AccessibleButton
