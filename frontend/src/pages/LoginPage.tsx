import { Telegram } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  TextField,
  Typography,
} from '@mui/material'
import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import styles from './LoginPage.module.css'

const LoginPage: React.FC = () => {
  const { login, loading } = useAuth()
  const [formData, setFormData] = useState({
    telegramId: '',
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
        formData.telegramId
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

            <Typography className={styles.loginPage__help}>
              Для получения Telegram ID отправьте сообщение боту{' '}
              <a href="https://t.me/userinfobot" className={styles.loginPage__helpLink} target="_blank" rel="noopener noreferrer">
                @userinfobot
              </a>
            </Typography>


          </Paper>
        </Box>
      </Container>
    </div>
  )
}

export default LoginPage
