import { useTheme } from '@mui/material/styles'

export const useChartColors = () => {
  const theme = useTheme()
  
  const isDark = theme.palette.mode === 'dark'
  
  return {
    primary: theme.palette.primary.main,
    secondary: theme.palette.secondary.main,
    success: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error: theme.palette.error.main,
    info: theme.palette.info.main,
    
    // Chart-specific colors that work well together
    chartPalette: isDark ? [
      '#61a8ff', // primary
      '#ff8a5b', // secondary 
      '#66bb6a', // success
      '#ffa726', // warning
      '#ef5350', // error
      '#29b6f6', // info
      '#ab47bc', // purple
      '#26a69a', // teal
    ] : [
      '#0088cc', // primary
      '#ff6b35', // secondary
      '#2e7d32', // success
      '#ed6c02', // warning
      '#d32f2f', // error
      '#0288d1', // info
      '#7b1fa2', // purple
      '#00695c', // teal
    ],
    
    // Background colors for charts
    gridColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    textColor: theme.palette.text.primary,
    backgroundColor: theme.palette.background.paper,
    
    // Tooltip styling
    tooltipProps: {
      contentStyle: {
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: theme.shape.borderRadius,
        color: theme.palette.text.primary,
      },
    },
  }
}

export const getChartThemeProps = (theme: any) => ({
  cartesianGrid: {
    strokeDasharray: '3 3',
    stroke: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
  },
  xAxis: {
    tick: { fill: theme.palette.text.secondary },
    axisLine: { stroke: theme.palette.divider },
  },
  yAxis: {
    tick: { fill: theme.palette.text.secondary },
    axisLine: { stroke: theme.palette.divider },
  },
  tooltip: {
    contentStyle: {
      backgroundColor: theme.palette.background.paper,
      border: `1px solid ${theme.palette.divider}`,
      borderRadius: theme.shape.borderRadius,
      color: theme.palette.text.primary,
      boxShadow: theme.shadows[4],
    },
  },
})
