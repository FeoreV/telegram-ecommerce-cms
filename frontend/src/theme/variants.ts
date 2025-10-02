import { createTheme, Theme, ThemeOptions } from '@mui/material/styles'
import { colorTokens, typography, shape } from './tokens'

export type ThemeVariant = 'default' | 'vibrant' | 'minimal' | 'corporate' | 'custom'

interface ThemeVariantConfig {
  name: string
  description: string
  colors: {
    light: typeof colorTokens.light
    dark: typeof colorTokens.dark
  }
  customizations: {
    typography?: Partial<typeof typography>
    shape?: Partial<typeof shape>
    components?: ThemeOptions['components']
  }
}

const themeVariants: Record<ThemeVariant, ThemeVariantConfig> = {
  default: {
    name: 'Default',
    description: 'Telegram-inspired blue theme with balanced contrast',
    colors: colorTokens,
    customizations: {},
  },
  
  vibrant: {
    name: 'Vibrant',
    description: 'High-energy theme with bold colors and gradients',
    colors: {
      light: {
        ...colorTokens.light,
        primary: '#1976d2',
        secondary: '#f50057',
        success: '#00c853',
        warning: '#ff9800',
        error: '#f44336',
        info: '#2196f3',
        primarySoft: '#e3f2fd',
      },
      dark: {
        ...colorTokens.dark,
        primary: '#2196f3',
        secondary: '#ff4081',
        success: '#4caf50',
        warning: '#ffc107',
        error: '#f44336',
        info: '#00bcd4',
        primarySoft: '#0d47a1',
        bgDefault: '#121212',
        bgPaper: '#1e1e1e',
      }
    },
    customizations: {
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              fontWeight: 600,
              textTransform: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
              '&:hover': {
                boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                transform: 'translateY(-1px)',
              }
            }
          }
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 16,
              background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(10px)',
            }
          }
        }
      }
    }
  },

  minimal: {
    name: 'Minimal',
    description: 'Clean, minimal design with subtle colors',
    colors: {
      light: {
        ...colorTokens.light,
        primary: '#37474f',
        secondary: '#546e7a',
        neutral: '#90a4ae',
        bgDefault: '#fafafa',
        bgPaper: '#ffffff',
        border: 'rgba(0,0,0,0.06)',
      },
      dark: {
        ...colorTokens.dark,
        primary: '#90a4ae',
        secondary: '#78909c',
        neutral: '#607d8b',
        bgDefault: '#181818',
        bgPaper: '#242424',
        border: 'rgba(255,255,255,0.06)',
      }
    },
    customizations: {
      typography: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      },
      shape: {
        radiusSm: 4,
        radiusMd: 8,
        radiusLg: 12,
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 4,
              fontWeight: 500,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              }
            }
          }
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              border: '1px solid rgba(0,0,0,0.06)',
            }
          }
        }
      }
    }
  },

  corporate: {
    name: 'Corporate',
    description: 'Professional theme suitable for enterprise applications',
    colors: {
      light: {
        ...colorTokens.light,
        primary: '#1565c0',
        secondary: '#424242',
        success: '#2e7d32',
        warning: '#f57c00',
        error: '#c62828',
        info: '#0277bd',
        neutral: '#616161',
        bgDefault: '#f5f5f5',
        bgPaper: '#ffffff',
        textPrimary: '#212121',
        textSecondary: '#757575',
      },
      dark: {
        ...colorTokens.dark,
        primary: '#42a5f5',
        secondary: '#757575',
        success: '#66bb6a',
        warning: '#ffb74d',
        error: '#ef5350',
        info: '#29b6f6',
        neutral: '#9e9e9e',
        bgDefault: '#303030',
        bgPaper: '#424242',
      }
    },
    customizations: {
      typography: {
        fontFamily: 'Roboto, Arial, sans-serif',
        h1: { fontWeight: 300 },
        h2: { fontWeight: 300 },
        h3: { fontWeight: 400 },
        h4: { fontWeight: 400 },
        h5: { fontWeight: 500 },
        h6: { fontWeight: 500 },
      },
      components: {
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: 4,
              fontWeight: 500,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }
          }
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }
          }
        }
      }
    }
  },

  custom: {
    name: 'Custom',
    description: 'Customizable theme for brand-specific requirements',
    colors: colorTokens,
    customizations: {
      // Will be overridden by store-specific settings
    },
  }
}

export const createVariantTheme = (
  variant: ThemeVariant,
  mode: 'light' | 'dark',
  customOverrides?: ThemeOptions
): Theme => {
  const variantConfig = themeVariants[variant]
  const colors = variantConfig.colors[mode]
  const customizations = variantConfig.customizations

  const baseTheme = createTheme({
    palette: {
      mode,
      primary: { main: colors.primary },
      secondary: { main: colors.secondary },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      info: { main: colors.info },
      text: { 
        primary: colors.textPrimary, 
        secondary: colors.textSecondary 
      },
      background: { 
        default: colors.bgDefault as any, 
        paper: colors.bgPaper as any 
      },
      divider: colors.border as any,
    },
    typography: {
      ...typography,
      ...customizations.typography,
    },
    shape: {
      borderRadius: customizations.shape?.radiusMd || shape.radiusMd,
    },
    components: {
      // Base components
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { 
          root: { 
            textTransform: 'none',
            fontWeight: 500,
            borderRadius: customizations.shape?.radiusSm || shape.radiusSm,
            transition: 'all 0.2s ease-in-out',
          } 
        },
      },
      MuiTextField: {
        defaultProps: { size: 'small' as const },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: customizations.shape?.radiusSm || shape.radiusSm,
              transition: 'all 0.2s ease-in-out',
            }
          }
        }
      },
      MuiCard: { 
        styleOverrides: { 
          root: { 
            borderRadius: customizations.shape?.radiusMd || shape.radiusMd,
            transition: 'all 0.2s ease-in-out',
          } 
        } 
      },
      MuiPaper: { 
        styleOverrides: { 
          root: { 
            borderRadius: customizations.shape?.radiusMd || shape.radiusMd,
          } 
        } 
      },
      // Merge custom component overrides
      ...customizations.components,
    },
    // Apply custom overrides
    ...customOverrides,
  })

  return baseTheme
}

export const getAvailableVariants = (): Array<{ key: ThemeVariant; config: ThemeVariantConfig }> => {
  return Object.entries(themeVariants).map(([key, config]) => ({
    key: key as ThemeVariant,
    config,
  }))
}

export { themeVariants }
export default themeVariants
