import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { ThemeProvider, createTheme, Theme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { colorTokens, typography, shape } from '../theme/tokens'

type ThemeMode = 'light' | 'dark'

interface ThemeModeContextValue {
  mode: ThemeMode
  toggleMode: () => void
  setMode: (mode: ThemeMode) => void
  theme: Theme
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(undefined)

function getInitialMode(): ThemeMode {
  const stored = localStorage.getItem('ui-theme-mode') as ThemeMode | null
  if (stored === 'light' || stored === 'dark') return stored
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  return prefersDark ? 'dark' : 'light'
}

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setModeState] = useState<ThemeMode>(getInitialMode)

  useEffect(() => {
    localStorage.setItem('ui-theme-mode', mode)
  }, [mode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      const stored = localStorage.getItem('ui-theme-mode')
      if (!stored) setModeState(media.matches ? 'dark' : 'light')
    }
    media.addEventListener?.('change', handler)
    return () => media.removeEventListener?.('change', handler)
  }, [])

  const setMode = useCallback((m: ThemeMode) => setModeState(m), [])
  const toggleMode = useCallback(() => setModeState(prev => (prev === 'light' ? 'dark' : 'light')), [])

  const theme = useMemo(() => {
    const c = colorTokens[mode]
    return createTheme({
      palette: {
        mode,
        primary: { main: c.primary },
        secondary: { main: c.secondary },
        success: { main: c.success },
        warning: { main: c.warning },
        error: { main: c.error },
        info: { main: c.info },
        text: { primary: c.textPrimary, secondary: c.textSecondary },
        background: { default: c.bgDefault as any, paper: c.bgPaper as any },
        divider: c.border as any,
      },
      typography: { ...typography },
      shape: { borderRadius: shape.radiusMd },
      components: {
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: { 
            root: { 
              textTransform: 'none',
              fontWeight: 500,
              borderRadius: shape.radiusSm,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-1px)',
              }
            } 
          },
        },
        MuiTextField: {
          defaultProps: { size: 'small' as const },
          styleOverrides: {
            root: {
              '& .MuiOutlinedInput-root': {
                borderRadius: shape.radiusSm,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: c.primary,
                  }
                }
              }
            }
          }
        },
        MuiSelect: {
          defaultProps: { size: 'small' as const },
        },
        MuiFormControl: {
          defaultProps: { size: 'small' as const },
        },
        MuiTable: { defaultProps: { size: 'small' as const } },
        MuiListItem: { 
          styleOverrides: { 
            root: { 
              paddingTop: 6, 
              paddingBottom: 6,
              borderRadius: shape.radiusSm,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              }
            } 
          } 
        },
        MuiAppBar: { defaultProps: { color: 'primary' as const } },
        MuiPaper: { 
          styleOverrides: { 
            root: { 
              borderRadius: shape.radiusMd,
              transition: 'box-shadow 0.2s ease-in-out',
            } 
          } 
        },
        MuiCard: { 
          styleOverrides: { 
            root: { 
              borderRadius: shape.radiusMd,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: mode === 'dark' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,0,0,0.12)',
              }
            } 
          } 
        },
        MuiCardContent: {
          styleOverrides: {
            root: {
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              padding: '24px',
              overflow: 'hidden',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              '&:last-child': {
                paddingBottom: '24px',
              },
            },
          },
        },
        MuiTableHead: { 
          styleOverrides: { 
            root: { 
              '& th': { 
                fontWeight: 600,
                backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              } 
            } 
          } 
        },
        MuiChip: {
          styleOverrides: {
            root: {
              borderRadius: shape.radiusSm,
              fontWeight: 500,
            }
          }
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: shape.radiusLg,
            }
          }
        },
      },
    })
  }, [mode])

  useEffect(() => {
    const c = colorTokens[mode]
    const root = document.documentElement

    const derived = mode === 'dark'
      ? {
          bgSecondary: '#101a33',
          bgTertiary: '#0c1525',
          sidebar: '#16233a',
          textInverse: '#0b1320',
        }
      : {
          bgSecondary: '#f8f9fa',
          bgTertiary: '#e9ecef',
          sidebar: '#ffffff',
          textInverse: '#ffffff',
        }

    const cssVariables: Record<string, string> = {
      '--color-primary': c.primary,
      '--color-secondary': c.secondary,
      '--color-success': c.success,
      '--color-warning': c.warning,
      '--color-error': c.error,
      '--color-info': c.info,
      '--color-text': c.textPrimary,
      '--color-text-secondary': c.textSecondary,
      '--color-text-inverse': derived.textInverse,
      '--color-bg': c.bgDefault,
      '--color-bg-secondary': derived.bgSecondary,
      '--color-bg-tertiary': derived.bgTertiary,
      '--color-sidebar-bg': derived.sidebar,
      '--color-border': c.border,
      '--color-border-light': mode === 'dark' ? 'rgba(255,255,255,0.08)' : '#f1f3f4',
      '--color-border-dark': mode === 'dark' ? 'rgba(0,0,0,0.6)' : '#adb5bd',
    }

    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })

    document.body.style.backgroundColor = c.bgDefault
    document.body.style.color = c.textPrimary
  }, [mode])

  const value = useMemo(() => ({ mode, toggleMode, setMode, theme }), [mode, toggleMode, setMode, theme])

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  )
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext)
  if (!ctx) throw new Error('useThemeMode must be used within ThemeModeProvider')
  return ctx
}


