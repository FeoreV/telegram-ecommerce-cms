import React, { useState } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Container,
  Alert,
} from '@mui/material'
import { useAuth } from '../contexts/AuthContext'
import { Telegram, CheckCircle } from '@mui/icons-material'
import styles from './LoginPage.module.css'

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth()
  const [formData, setFormData] = useState({
    telegramId: '',
    username: '',
    firstName: '',
    lastName: '',
  })
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.telegramId) {
      setError('Telegram ID обязателен')
      return
    }

    try {
      await login(
        formData.telegramId,
        formData.username || undefined,
        formData.firstName || undefined,
        formData.lastName || undefined
      )
    } catch (err: any) {
      setError(err.response?.data?.error || 'Ошибка входа в систему')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    })
  }

  return (
    <div className={`${styles.loginPage} ${loading ? styles['loginPage--loading'] : ''}`}>
      <Container component="main" className={styles.loginPage__container}>
        <Box className={styles.loginPage__wrapper}>
          <Paper elevation={3} className={styles.loginPage__card}>
            <div className={styles.loginPage__logo}>
              <div className={styles.loginPage__logoIcon}>
                <Telegram />
              </div>
              <Typography className={styles.loginPage__logoText}>
                Store Admin
              </Typography>
            </div>

            <div className={styles.loginPage__header}>
              <Typography component="h1" className={styles.loginPage__title}>
                Telegram Store Admin
              </Typography>
              <Typography className={styles.loginPage__subtitle}>
                Войдите в систему используя ваш Telegram ID
              </Typography>
            </div>

            {error && (
              <Alert severity="error" className={styles.loginPage__error}>
                {error}
              </Alert>
            )}

            <Box component="form" onSubmit={handleSubmit} className={styles.loginPage__form}>
              <TextField
                margin="normal"
                required
                fullWidth
                id="telegramId"
                label="Telegram ID"
                name="telegramId"
                type="number"
                autoFocus
                value={formData.telegramId}
                onChange={handleChange}
                className={`${styles.loginPage__field} ${styles.loginPage__input}`}
              />
              <TextField
                margin="normal"
                fullWidth
                id="username"
                label="Username (необязательно)"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className={`${styles.loginPage__field} ${styles.loginPage__input}`}
              />
              <TextField
                margin="normal"
                fullWidth
                id="firstName"
                label="Имя (необязательно)"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                className={`${styles.loginPage__field} ${styles.loginPage__input}`}
              />
              <TextField
                margin="normal"
                fullWidth
                id="lastName"
                label="Фамилия (необязательно)"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                className={`${styles.loginPage__field} ${styles.loginPage__input}`}
              />
              <Button
                type="submit"
                fullWidth
                variant="contained"
                disabled={loading}
                className={styles.loginPage__submit}
              >
                {loading ? 'Вход...' : 'Войти'}
              </Button>
            </Box>

            <div className={styles.loginPage__features}>
              <Typography className={styles.loginPage__featuresTitle}>
                Возможности платформы
              </Typography>
              <ul className={styles.loginPage__featuresList}>
                <li className={styles.loginPage__feature}>
                  <CheckCircle className={styles.loginPage__featureIcon} />
                  Управление множественными магазинами
                </li>
                <li className={styles.loginPage__feature}>
                  <CheckCircle className={styles.loginPage__featureIcon} />
                  Автоматическая обработка заказов
                </li>
                <li className={styles.loginPage__feature}>
                  <CheckCircle className={styles.loginPage__featureIcon} />
                  Аналитика и отчеты
                </li>
                <li className={styles.loginPage__feature}>
                  <CheckCircle className={styles.loginPage__featureIcon} />
                  Telegram бот интеграция
                </li>
              </ul>
            </div>

            <Typography className={styles.loginPage__help}>
              Для получения Telegram ID отправьте сообщение боту{' '}
              <a href="https://t.me/userinfobot" className={styles.loginPage__helpLink} target="_blank" rel="noopener noreferrer">
                @userinfobot
              </a>
            </Typography>

            <div className={styles.loginPage__securityNote}>
              🔒 Безопасное подключение через Telegram API
            </div>
          </Paper>
        </Box>
      </Container>
    </div>
  )
}

export default LoginPage
