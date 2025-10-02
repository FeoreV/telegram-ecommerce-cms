export const colorTokens = {
  light: {
    primary: '#0088cc',
    primarySoft: '#e6f3fb',
    secondary: '#ff6b35',
    success: '#2e7d32',
    warning: '#ed6c02',
    error: '#d32f2f',
    info: '#0288d1',
    neutral: '#64748b',
    textPrimary: '#101828',
    textSecondary: '#475467',
    bgDefault: '#f7f8fb',
    bgPaper: '#ffffff',
    border: 'rgba(0,0,0,0.12)'
  },
  dark: {
    primary: '#61a8ff',
    primarySoft: '#0f2338',
    secondary: '#ff8a5b',
    success: '#66bb6a',
    warning: '#ffa726',
    error: '#ef5350',
    info: '#29b6f6',
    neutral: '#98a2b3',
    textPrimary: '#e6eaf1',
    textSecondary: '#b9c0cc',
    bgDefault: '#0b1320',
    bgPaper: '#111a2b',
    border: 'rgba(255,255,255,0.12)'
  }
}

export const spacing = (factor: number) => factor * 8

export const shape = {
  radiusSm: 8,
  radiusMd: 12,
  radiusLg: 16,
}

export const shadows = {
  sm: '0 1px 2px rgba(0,0,0,0.06)',
  md: '0 4px 12px rgba(0,0,0,0.08)',
  lg: '0 12px 24px rgba(0,0,0,0.12)'
}

export const typography = {
  fontFamily: 'Roboto, Inter, system-ui, -apple-system, Segoe UI, Arial, sans-serif',
  h1: { fontWeight: 600 },
  h2: { fontWeight: 600 },
  h3: { fontWeight: 600 },
  h4: { fontWeight: 600 },
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
}


