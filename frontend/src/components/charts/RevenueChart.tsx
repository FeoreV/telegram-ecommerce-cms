import React, { useMemo } from 'react'
import { Box, Typography, Card, CardContent, Skeleton, useTheme } from '@mui/material'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts'
import { useChartColors } from '../../utils/chartTheme'
import { format, parseISO } from 'date-fns'
import { ru } from 'date-fns/locale'

interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
  target?: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  loading?: boolean
  height?: number
  showTarget?: boolean
  showOrders?: boolean
  title?: string
  currency?: string
  period?: 'day' | 'week' | 'month' | 'year'
}

const RevenueChart: React.FC<RevenueChartProps> = ({
  data,
  loading = false,
  height = 400,
  showTarget = false,
  showOrders = true,
  title = 'Динамика выручки',
  currency = '₽',
  period = 'day',
}) => {
  const theme = useTheme()
  const chartColors = useChartColors()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currency === '₽' ? 'RUB' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString)
      switch (period) {
        case 'day':
          return format(date, 'dd MMM', { locale: ru })
        case 'week':
          return format(date, 'dd.MM', { locale: ru })
        case 'month':
          return format(date, 'MMM yyyy', { locale: ru })
        case 'year':
          return format(date, 'yyyy', { locale: ru })
        default:
          return format(date, 'dd.MM', { locale: ru })
      }
    } catch {
      return dateString
    }
  }

  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      formattedDate: formatDate(item.date),
    }))
  }, [data, period])

  const averageRevenue = useMemo(() => {
    if (data.length === 0) return 0
    return data.reduce((sum, item) => sum + item.revenue, 0) / data.length
  }, [data])

  const maxRevenue = useMemo(() => {
    return Math.max(...data.map(item => item.revenue), 0)
  }, [data])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <Card elevation={4} sx={{ p: 2, minWidth: 200 }}>
          <Typography variant="subtitle2" gutterBottom>
            {label}
          </Typography>
          {payload.map((entry: any, index: number) => (
            <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  backgroundColor: entry.color,
                  borderRadius: '50%',
                }}
              />
              <Typography variant="body2">
                {entry.name}: {
                  entry.dataKey === 'revenue' 
                    ? formatCurrency(entry.value)
                    : entry.value
                }
              </Typography>
            </Box>
          ))}
        </Card>
      )
    }
    return null
  }

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Skeleton variant="text" width="40%" height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={height} />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Макс. выручка
              </Typography>
              <Typography variant="h6" color="success.main">
                {formatCurrency(maxRevenue)}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">
                Среднее
              </Typography>
              <Typography variant="h6" color="primary.main">
                {formatCurrency(averageRevenue)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={processedData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColors.chartPalette[0]} stopOpacity={0.8} />
                <stop offset="95%" stopColor={chartColors.chartPalette[0]} stopOpacity={0.1} />
              </linearGradient>
              {showOrders && (
                <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColors.chartPalette[1]} stopOpacity={0.8} />
                  <stop offset="95%" stopColor={chartColors.chartPalette[1]} stopOpacity={0.1} />
                </linearGradient>
              )}
            </defs>
            
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={chartColors.gridColor} 
            />
            
            <XAxis 
              dataKey="formattedDate"
              tick={{ fill: chartColors.textColor, fontSize: 12 }}
              axisLine={{ stroke: chartColors.gridColor }}
            />
            
            <YAxis 
              yAxisId="revenue"
              orientation="left"
              tick={{ fill: chartColors.textColor, fontSize: 12 }}
              axisLine={{ stroke: chartColors.gridColor }}
              tickFormatter={formatCurrency}
            />
            
            {showOrders && (
              <YAxis 
                yAxisId="orders"
                orientation="right"
                tick={{ fill: chartColors.textColor, fontSize: 12 }}
                axisLine={{ stroke: chartColors.gridColor }}
              />
            )}
            
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            
            {showTarget && (
              <ReferenceLine
                y={averageRevenue}
                stroke={chartColors.warning}
                strokeDasharray="5 5"
                label="Среднее"
              />
            )}
            
            <Area
              yAxisId="revenue"
              type="monotone"
              dataKey="revenue"
              stroke={chartColors.chartPalette[0]}
              strokeWidth={3}
              fill="url(#revenueGradient)"
              name="Выручка"
              connectNulls
            />
            
            {showOrders && (
              <Area
                yAxisId="orders"
                type="monotone"
                dataKey="orders"
                stroke={chartColors.chartPalette[1]}
                strokeWidth={2}
                fill="url(#ordersGradient)"
                name="Заказы"
                connectNulls
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export default RevenueChart
