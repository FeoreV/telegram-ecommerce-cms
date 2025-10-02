import React, { useMemo } from 'react'
import { Box, Typography, Card, CardContent, Skeleton } from '@mui/material'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
} from 'recharts'
import { useChartColors } from '../../utils/chartTheme'

interface ProductData {
  id: string
  name: string
  sales: number
  revenue: number
  stock: number
  category: string
}

interface ProductPerformanceChartProps {
  data: ProductData[]
  loading?: boolean
  height?: number
  maxItems?: number
  sortBy?: 'sales' | 'revenue'
  title?: string
}

const ProductPerformanceChart: React.FC<ProductPerformanceChartProps> = ({
  data,
  loading = false,
  height = 300,
  maxItems = 10,
  sortBy = 'revenue',
  title = 'Топ товары',
}) => {
  const chartColors = useChartColors()

  const processedData = useMemo(() => {
    const sorted = [...data]
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, maxItems)
      .map((item, index) => ({
        ...item,
        shortName: item.name.length > 20 ? `${item.name.substring(0, 20)}...` : item.name,
        rank: index + 1,
      }))
    
    return sorted
  }, [data, sortBy, maxItems])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  const getBarColor = (index: number) => {
    if (index === 0) return chartColors.success // Top performer
    if (index === 1) return chartColors.warning // Second place
    if (index === 2) return chartColors.info // Third place
    return chartColors.chartPalette[index % chartColors.chartPalette.length]
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <Card elevation={4} sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" gutterBottom>
            #{data.rank} {data.name}
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography variant="body2">
              Продажи: {data.sales} шт.
            </Typography>
            <Typography variant="body2">
              Выручка: {formatCurrency(data.revenue)}
            </Typography>
            <Typography variant="body2">
              Остаток: {data.stock} шт.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Категория: {data.category}
            </Typography>
          </Box>
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

  if (processedData.length === 0) {
    return (
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>{title}</Typography>
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: height,
            color: 'text.secondary' 
          }}>
            <Typography>Нет данных для отображения</Typography>
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{title}</Typography>
          <Typography variant="body2" color="text.secondary">
            Сортировка по {sortBy === 'revenue' ? 'выручке' : 'продажам'}
          </Typography>
        </Box>

        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={processedData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            layout="horizontal"
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke={chartColors.gridColor} 
            />
            
            <XAxis 
              type="number"
              tick={{ fill: chartColors.textColor, fontSize: 12 }}
              axisLine={{ stroke: chartColors.gridColor }}
              tickFormatter={sortBy === 'revenue' ? formatCurrency : (value) => `${value}`}
            />
            
            <YAxis 
              type="category"
              dataKey="shortName"
              tick={{ fill: chartColors.textColor, fontSize: 11 }}
              axisLine={{ stroke: chartColors.gridColor }}
              width={120}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Bar
              dataKey={sortBy}
              radius={[0, 4, 4, 0]}
              name={sortBy === 'revenue' ? 'Выручка' : 'Продажи'}
            >
              {processedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Top 3 highlights */}
        <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
          {processedData.slice(0, 3).map((item, index) => (
            <Box
              key={item.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                flex: '1 1 auto',
                minWidth: 120,
              }}
            >
              <Box
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: getBarColor(index),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 'bold',
                }}
              >
                {index + 1}
              </Box>
              <Box>
                <Typography variant="caption" display="block" noWrap>
                  {item.shortName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {sortBy === 'revenue' ? formatCurrency(item.revenue) : `${item.sales} шт.`}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  )
}

export default ProductPerformanceChart
