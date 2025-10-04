import {
    CheckCircle,
    Close,
    ContentCopy,
    Launch,
    QrCode,
    Telegram
} from '@mui/icons-material';
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    IconButton,
    Link,
    Typography
} from '@mui/material';
import QRCode from 'qrcode';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';

interface TelegramStoreCreatorProps {
  botUsername?: string;
  onStoreCreated?: () => void;
}

const TelegramStoreCreator: React.FC<TelegramStoreCreatorProps> = ({
  botUsername = 'your_bot_username', // Замените на реальное имя бота
  onStoreCreated
}) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [botUrl, setBotUrl] = useState<string>('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);

  useEffect(() => {
    const url = `https://t.me/${botUsername}?start=create_store`;
    setBotUrl(url);
  }, [botUsername]);

  const generateQRCode = async () => {
    if (!botUrl) return;

    setIsGeneratingQR(true);
    try {
      const qrUrl = await QRCode.toDataURL(botUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });
      setQrCodeUrl(qrUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast.error('Ошибка при создании QR-кода');
    } finally {
      setIsGeneratingQR(false);
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    generateQRCode();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(botUrl);
      setCopySuccess(true);
      toast.success('Ссылка скопирована!');
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      toast.error('Ошибка при копировании ссылки');
    }
  };

  const handleOpenBot = () => {
    window.open(botUrl, '_blank');
  };

  return (
    <>
      <Card
        sx={{
          background: 'linear-gradient(135deg, #0088cc 0%, #005999 100%)',
          color: 'white',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 100,
            height: 100,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
          }}
        />
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <Telegram sx={{ fontSize: 40, mr: 2 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Создать магазин в Telegram
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Быстрое создание через мессенджер
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" sx={{ mb: 3, opacity: 0.9 }}>
            Создайте магазин прямо в Telegram! Пошаговый мастер поможет настроить все за 2-3 минуты.
          </Typography>

          <Box display="flex" gap={2} flexWrap="wrap">
            <Button
              variant="contained"
              size="large"
              startIcon={<Launch />}
              onClick={handleOpenBot}
              sx={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.3)',
                }
              }}
            >
              Открыть бот
            </Button>
            <Button
              variant="outlined"
              size="large"
              startIcon={<QrCode />}
              onClick={handleOpenDialog}
              sx={{
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: 'white',
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }
              }}
            >
              QR-код
            </Button>
          </Box>

          <Box mt={3}>
            <Typography variant="caption" sx={{ opacity: 0.8 }}>
              Что нужно будет указать:
            </Typography>
            <Box display="flex" gap={1} mt={1} flexWrap="wrap">
              <Chip
                label="Название"
                size="small"
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
              <Chip
                label="Описание"
                size="small"
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
              <Chip
                label="Валюта"
                size="small"
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
              <Chip
                label="Контакты"
                size="small"
                sx={{ backgroundColor: 'rgba(255, 255, 255, 0.2)', color: 'white' }}
              />
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center">
              <Telegram sx={{ mr: 1, color: '#0088cc' }} />
              <Typography variant="h6">
                Создать магазин в Telegram
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Box textAlign="center">
                <Typography variant="h6" gutterBottom color="primary">
                  QR-код для быстрого доступа
                </Typography>

                {isGeneratingQR ? (
                  <Box display="flex" justifyContent="center" alignItems="center" height={256}>
                    <CircularProgress />
                  </Box>
                ) : qrCodeUrl ? (
                  <Box
                    component="img"
                    src={qrCodeUrl}
                    alt="QR Code"
                    sx={{
                      width: 256,
                      height: 256,
                      border: '1px solid #ddd',
                      borderRadius: 2
                    }}
                  />
                ) : (
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    height={256}
                    border="1px dashed #ddd"
                    borderRadius={2}
                  >
                    <Typography color="textSecondary">
                      Не удалось создать QR-код
                    </Typography>
                  </Box>
                )}

                <Typography variant="body2" color="textSecondary" mt={2}>
                  Отсканируйте QR-код камерой телефона
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="h6" gutterBottom color="primary">
                Пошаговая инструкция
              </Typography>

              <Box component="ol" sx={{ pl: 2, '& li': { mb: 1 } }}>
                <li>
                  <Typography variant="body2">
                    Откройте Telegram на телефоне
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Отсканируйте QR-код или перейдите по ссылке
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Нажмите &quot;Начать&quot; в боте
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Следуйте инструкциям бота для создания магазина
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Заполните необходимую информацию
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2">
                    Получите подтверждение о создании магазина
                  </Typography>
                </li>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Alert severity="info" sx={{ mb: 2 }}>
                <Typography variant="body2">
                  <strong>Важно:</strong> У вас должны быть права администратора или владельца для создания магазинов.
                </Typography>
              </Alert>

              <Box>
                <Typography variant="body2" gutterBottom>
                  Или скопируйте ссылку:
                </Typography>
                <Box
                  display="flex"
                  alignItems="center"
                  gap={1}
                  p={1}
                  bgcolor="grey.100"
                  borderRadius={1}
                >
                  <Link
                    href={botUrl}
                    target="_blank"
                    sx={{
                      flexGrow: 1,
                      fontSize: '0.875rem',
                      textDecoration: 'none'
                    }}
                  >
                    {botUrl}
                  </Link>
                  <IconButton
                    size="small"
                    onClick={handleCopyLink}
                    color={copySuccess ? 'success' : 'default'}
                  >
                    {copySuccess ? <CheckCircle /> : <ContentCopy />}
                  </IconButton>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>
            Закрыть
          </Button>
          <Button variant="contained" onClick={handleOpenBot} startIcon={<Launch />}>
            Открыть бот
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default TelegramStoreCreator;
