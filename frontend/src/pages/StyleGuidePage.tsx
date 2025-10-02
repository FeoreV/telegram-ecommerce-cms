import React, { useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Button,
  TextField,
  Card,
  CardContent,
  Chip,
  Avatar,
  Switch,
  Slider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  LinearProgress,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Favorite,
  Star,
  Settings,
  Home,
  Person,
  Email,
  Phone,
  Add,
  Edit,
  Delete,
  Visibility,
} from '@mui/icons-material'
import PageHeader from '../components/ui/PageHeader'
import SectionCard from '../components/ui/SectionCard'
import StatCard from '../components/ui/StatCard'
import StatusChip from '../components/ui/StatusChip'
import EmptyState from '../components/ui/EmptyState'
import LoadingSkeleton from '../components/ui/LoadingSkeleton'
import AnimatedButton from '../components/ui/AnimatedButton'
import AccessibleButton from '../components/ui/AccessibleButton'
import FadeInView from '../components/ui/FadeInView'
import LoadingOverlay from '../components/ui/LoadingOverlay'
import { useThemeMode } from '../contexts/ThemeModeContext'
import { colorTokens } from '../theme/tokens'

const StyleGuidePage: React.FC = () => {
  const { mode } = useThemeMode()
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(false)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const colors = colorTokens[mode]

  const toggleLoading = () => {
    setLoading(!loading)
    setTimeout(() => setLoading(false), 3000)
  }

  const sections = [
    { label: 'Цвета', value: 0 },
    { label: 'Типографика', value: 1 },
    { label: 'Компоненты', value: 2 },
    { label: 'Формы', value: 3 },
    { label: 'Анимации', value: 4 },
    { label: 'Макеты', value: 5 },
  ]

  const renderColors = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>Основная палитра</Typography>
      </Grid>
      {Object.entries(colors).map(([name, color]) => (
        <Grid item xs={6} sm={4} md={3} key={name}>
          <Card>
            <Box
              sx={{
                height: 80,
                backgroundColor: color,
                borderRadius: '12px 12px 0 0',
              }}
            />
            <CardContent sx={{ pt: 2 }}>
              <Typography variant="body2" fontWeight={600}>
                {name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {color}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )

  const renderTypography = () => (
    <Box>
      <Typography variant="h1" gutterBottom>H1 Заголовок</Typography>
      <Typography variant="h2" gutterBottom>H2 Заголовок</Typography>
      <Typography variant="h3" gutterBottom>H3 Заголовок</Typography>
      <Typography variant="h4" gutterBottom>H4 Заголовок</Typography>
      <Typography variant="h5" gutterBottom>H5 Заголовок</Typography>
      <Typography variant="h6" gutterBottom>H6 Заголовок</Typography>
      <Typography variant="body1" gutterBottom>
        Body 1: Основной текст для чтения. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Typography>
      <Typography variant="body2" gutterBottom>
        Body 2: Вторичный текст меньшего размера. Используется для подписей и дополнительной информации.
      </Typography>
      <Typography variant="caption" display="block" gutterBottom>
        Caption: Мелкий текст для меток и вспомогательной информации
      </Typography>
      <Typography variant="overline" display="block">
        OVERLINE: ТЕКСТ В ВЕРХНЕМ РЕГИСТРЕ
      </Typography>
    </Box>
  )

  const renderComponents = () => (
    <Grid container spacing={4}>
      <Grid item xs={12} md={6}>
        <SectionCard title="Кнопки">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Button variant="contained">Contained</Button>
              <Button variant="outlined">Outlined</Button>
              <Button variant="text">Text</Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <AnimatedButton variant="contained" loading={loading} onClick={toggleLoading}>
                Анимированная
              </AnimatedButton>
              <AccessibleButton 
                variant="outlined" 
                tooltip="Доступная кнопка"
                keyboardShortcut="Ctrl+A"
                ariaLabel="Доступная кнопка с горячими клавишами"
              >
                Доступная
              </AccessibleButton>
            </Box>
          </Box>
        </SectionCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <SectionCard title="Статистические карточки">
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <StatCard
                title="Заказы"
                value="1,234"
                icon={<Star />}
                color="primary"
                trend={{ value: 12.5, isPositive: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <StatCard
                title="Выручка"
                value="₽85,450"
                icon={<Favorite />}
                color="success"
                trend={{ value: -2.3, isPositive: false }}
              />
            </Grid>
          </Grid>
        </SectionCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <SectionCard title="Статусы и чипы">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <StatusChip label="Успех" variant="success" />
              <StatusChip label="Предупреждение" variant="warning" />
              <StatusChip label="Ошибка" variant="error" />
              <StatusChip label="Информация" variant="info" />
              <StatusChip label="Нейтральный" variant="neutral" />
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label="Активен" color="success" variant="filled" />
              <Chip label="Неактивен" color="default" variant="outlined" />
              <Chip label="Удалить" color="error" onDelete={() => {}} />
            </Box>
          </Box>
        </SectionCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <SectionCard title="Пустые состояния">
          <EmptyState
            title="Нет данных"
            description="Это пример пустого состояния с иконкой и действием"
            actionLabel="Добавить элемент"
            onAction={() => alert('Действие выполнено!')}
            icon="📋"
          />
        </SectionCard>
      </Grid>

      <Grid item xs={12}>
        <SectionCard title="Скелетоны загрузки">
          <Tabs value={0} sx={{ mb: 2 }}>
            <Tab label="Карточки" />
            <Tab label="Таблица" />
            <Tab label="Статистика" />
          </Tabs>
          <LoadingSkeleton variant="card" count={3} />
        </SectionCard>
      </Grid>
    </Grid>
  )

  const renderForms = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <SectionCard title="Поля ввода">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="Обычное поле" placeholder="Введите текст" />
            <TextField label="Обязательное поле" required error helperText="Поле обязательно для заполнения" />
            <TextField label="Отключенное поле" disabled value="Отключено" />
            <TextField label="Многострочное" multiline rows={3} />
          </Box>
        </SectionCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <SectionCard title="Селекты и переключатели">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl>
              <InputLabel>Выберите опцию</InputLabel>
              <Select label="Выберите опцию" value="">
                <MenuItem value="1">Опция 1</MenuItem>
                <MenuItem value="2">Опция 2</MenuItem>
                <MenuItem value="3">Опция 3</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography>Переключатель</Typography>
              <Switch defaultChecked />
            </Box>
            <Box>
              <Typography gutterBottom>Слайдер</Typography>
              <Slider defaultValue={30} />
            </Box>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  )

  const renderAnimations = () => (
    <Grid container spacing={3}>
      <Grid item xs={12} md={6}>
        <SectionCard title="Анимации появления">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FadeInView direction="up" delay={0}>
              <Alert severity="info">Анимация снизу вверх</Alert>
            </FadeInView>
            <FadeInView direction="left" delay={200}>
              <Alert severity="success">Анимация справа налево</Alert>
            </FadeInView>
            <FadeInView direction="fade" delay={400}>
              <Alert severity="warning">Плавное появление</Alert>
            </FadeInView>
          </Box>
        </SectionCard>
      </Grid>

      <Grid item xs={12} md={6}>
        <SectionCard title="Загрузочные анимации">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
            <CircularProgress />
            <LinearProgress sx={{ width: '100%' }} />
            <Button onClick={() => setOverlayOpen(true)}>
              Показать overlay
            </Button>
          </Box>
        </SectionCard>
      </Grid>
    </Grid>
  )

  const renderLayouts = () => (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <SectionCard title="Пример таблицы">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Название</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Дата</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {[1, 2, 3].map((row) => (
                  <TableRow key={row}>
                    <TableCell>Элемент {row}</TableCell>
                    <TableCell>
                      <StatusChip 
                        label={row % 2 === 0 ? "Активен" : "Неактивен"} 
                        variant={row % 2 === 0 ? "success" : "neutral"} 
                      />
                    </TableCell>
                    <TableCell>2024-01-0{row}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small"><Visibility /></IconButton>
                      <IconButton size="small"><Edit /></IconButton>
                      <IconButton size="small"><Delete /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SectionCard>
      </Grid>
    </Grid>
  )

  const tabContent = [
    renderColors(),
    renderTypography(),
    renderComponents(),
    renderForms(),
    renderAnimations(),
    renderLayouts(),
  ]

  return (
    <Box>
      <PageHeader
        title="Руководство по стилю"
        subtitle="Документация дизайн-системы и компонентов"
      />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(_, newValue) => setActiveTab(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {sections.map((section) => (
            <Tab key={section.value} label={section.label} />
          ))}
        </Tabs>
      </Paper>

      <Box sx={{ mb: 3 }}>
        {tabContent[activeTab]}
      </Box>

      <LoadingOverlay
        open={overlayOpen}
        message="Демонстрация загрузочного экрана"
        variant="dots"
      />

      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button variant="outlined" onClick={() => setOverlayOpen(false)}>
          Закрыть overlay
        </Button>
      </Box>
    </Box>
  )
}

export default StyleGuidePage
