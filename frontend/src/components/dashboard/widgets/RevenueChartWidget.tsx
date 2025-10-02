import React, { useState } from 'react'
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import {
  TrendingUp,
  ShowChart,
  BarChart as BarChartIcon,
  Timeline,
} from '@mui/icons-material'
import DashboardWidget from '../DashboardWidget'

interface RevenueData {
  date: string
  revenue: number
  orders: number
  target?: number
}

interface RevenueChartWidgetProps {
  data: RevenueData[]
  loading?: boolean
  period: 'today' | 'week' | 'month' | 'quarter'
  onPeriodChange?: (period: string) => void
  onRefresh?: () => void
  onSettings?: () => void
}

type ChartType = 'line' | 'area' | 'bar'

const RevenueChartWidget: React.FC<RevenueChartWidgetProps> = ({
  data = [],
  loading = false,
  period,
  onPeriodChange,
  onRefresh,
  onSettings,
}) => {
  const [chartType, setChartType] = useState<ChartType>('area')
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue')

  const periods = [
    { value: 'today', label: 'Сегодня' },
    { value: 'week', label: 'Неделя' },
    { value: 'month', label: 'Месяц' },
    { value: 'quarter', label: 'Квартал' },
  ]

  const formatValue = (value: number) => {
    if (metric === 'revenue') {
      return `₽${value.toLocaleString()}`
    }
    return value.toString()
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    switch (period) {
      case 'today':
        return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
      case 'week':
        return date.toLocaleDateString('ru-RU', { weekday: 'short' })
      case 'month':
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })
      case 'quarter':
        return date.toLocaleDateString('ru-RU', { month: 'short' })
      default:
        return date.toLocaleDateString('ru-RU')
    }
  }

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0)
  const totalOrders = data.reduce((sum, item) => sum + item.orders, 0)
  const avgValue = data.length > 0 ? (totalRevenue / totalOrders) : 0

  const getChartComponent = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (chartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              labelFormatter={(label) => formatDate(label)}
              formatter={(value: number) => [formatValue(value), metric === 'revenue' ? 'Выручка' : 'Заказы']}
            />
            {data.some(d => d.target) && (
              <ReferenceLine 
                y={data.find(d => d.target)?.target || 0} 
                stroke="red" 
                strokeDasharray="5 5"
                label="Цель"
              />
            )}
            <Line 
              type="monotone" 
              dataKey={metric} 
              stroke="#8884d8" 
              strokeWidth={2}
              dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#8884d8', strokeWidth: 2 }}
            />
          </LineChart>
        )

      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              labelFormatter={(label) => formatDate(label)}
              formatter={(value: number) => [formatValue(value), metric === 'revenue' ? 'Выручка' : 'Заказы']}
            />
            <Area 
              type="monotone" 
              dataKey={metric} 
              stroke="#8884d8" 
              fill="#8884d8" 
              fillOpacity={0.3}
            />
          </AreaChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDate} />
            <YAxis tickFormatter={formatValue} />
            <Tooltip 
              labelFormatter={(label) => formatDate(label)}
              formatter={(value: number) => [formatValue(value), metric === 'revenue' ? 'Выручка' : 'Заказы']}
            />
            <Bar dataKey={metric} fill="#8884d8" />
          </BarChart>
        )

      default:
        return null
    }
  }

  const headerAction = (
    <Box display="flex" alignItems="center" gap={1}>
      <FormControl size="small" sx={{ minWidth: 80 }}>
        <Select
          value={metric}
          onChange={(e) => setMetric(e.target.value as 'revenue' | 'orders')}
          variant="outlined"
        >
          <MenuItem value="revenue">Выручка</MenuItem>
          <MenuItem value="orders">Заказы</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 100 }}>
        <Select
          value={period}
          onChange={(e) => onPeriodChange?.(e.target.value)}
          variant="outlined"
        >
          {periods.map((p) => (
            <MenuItem key={p.value} value={p.value}>
              {p.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <ToggleButtonGroup
        size="small"
        value={chartType}
        exclusive
        onChange={(_, newType) => newType && setChartType(newType)}
      >
        <ToggleButton value="line" title="Линейный график">
          <ShowChart fontSize="small" />
        </ToggleButton>
        <ToggleButton value="area" title="Областной график">
          <Timeline fontSize="small" />
        </ToggleButton>
        <ToggleButton value="bar" title="Столбчатый график">
          <BarChartIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
    </Box>
  )

  return (
    <DashboardWidget
      id="revenue-chart"
      title="Динамика продаж"
      subtitle={`Общая выручка: ${formatValue(totalRevenue)} • ${totalOrders} заказов`}
      icon={<TrendingUp />}
      onRefresh={onRefresh}
      onSettings={onSettings}
      showRefresh
      showSettings
      showFullscreen
      size="large"
      loading={loading}
      headerAction={headerAction}
    >
      <Box height="100%">
        {/* Summary Stats */}
        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <Chip 
            label={`Средний чек: ${formatValue(avgValue)}`}
            variant="outlined" 
            size="small"
          />
          <Chip 
            label={`Всего точек: ${data.length}`}
            variant="outlined" 
            size="small"
          />
          {data.some(d => d.target) && (
            <Chip 
              label={`Цель: ${formatValue(data.find(d => d.target)?.target || 0)}`}
              variant="outlined" 
              size="small"
              color="warning"
            />
          )}
        </Box>

        {/* Chart */}
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="85%">
            {getChartComponent()}
          </ResponsiveContainer>
        ) : (
          <Box 
            display="flex" 
            alignItems="center" 
            justifyContent="center" 
            height="85%"
            color="text.secondary"
          >
            <Typography variant="body2">
              Нет данных за выбранный период
            </Typography>
          </Box>
        )}
      </Box>
    </DashboardWidget>
  )
}

export default RevenueChartWidget
