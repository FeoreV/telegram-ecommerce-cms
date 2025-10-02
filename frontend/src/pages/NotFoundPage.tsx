import React from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Grid,
  useTheme,
  alpha
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { 
  Home as HomeIcon,
  Dashboard as DashboardIcon,
  ArrowBack as ArrowBackIcon,
  SearchOff as SearchOffIcon
} from '@mui/icons-material'

import { useAuth } from '../contexts/AuthContext'
import { getPrimaryRedirect, getRoutesForRole } from '../routes/config'

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate()
  const theme = useTheme()
  const { user } = useAuth()
  const availableRoutes = getRoutesForRole(user?.role)
  const smartHomePath = getPrimaryRedirect(user?.role)

  const handleGoHome = () => {
    navigate(smartHomePath)
  }

  const handleGoBack = () => {
    navigate(-1)
  }

  const getRoutesWithLabels = () =>
    availableRoutes.map((route) => ({
      path: route.path,
      label: route.label ?? route.path,
      icon: route.icon ?? HomeIcon,
    }))

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, ${alpha(theme.palette.secondary.main, 0.1)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 600,
          width: '100%',
          p: 4,
          textAlign: 'center',
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* 404 Icon and Number */}
        <Box sx={{ mb: 3 }}>
          <SearchOffIcon 
            sx={{ 
              fontSize: 80, 
              color: theme.palette.primary.main,
              mb: 2
            }} 
          />
          <Typography 
            variant="h1" 
            sx={{ 
              fontSize: { xs: '4rem', sm: '6rem' },
              fontWeight: 'bold',
              color: theme.palette.primary.main,
              lineHeight: 1,
              mb: 1
            }}
          >
            404
          </Typography>
        </Box>

        {/* Error Message */}
        <Typography 
          variant="h4" 
          sx={{ 
            mb: 2,
            fontWeight: 500,
            color: theme.palette.text.primary
          }}
        >
          Page Not Found
        </Typography>
        
        <Typography 
          variant="body1" 
          sx={{ 
            mb: 4,
            color: theme.palette.text.secondary,
            maxWidth: 400,
            mx: 'auto'
          }}
        >
          The page you're looking for doesn't exist or may have been moved. 
          Let's get you back to where you need to be.
        </Typography>

        {/* Navigation Buttons */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              size="large"
              fullWidth
              startIcon={<DashboardIcon />}
              onClick={handleGoHome}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1.1rem'
              }}
            >
              Go to Dashboard
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<ArrowBackIcon />}
              onClick={handleGoBack}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1.1rem'
              }}
            >
              Go Back
            </Button>
          </Grid>
        </Grid>

        {/* Available Routes */}
        <Box sx={{ textAlign: 'left' }}>
          <Typography 
            variant="h6" 
            sx={{ 
              mb: 2,
              textAlign: 'center',
              color: theme.palette.text.primary
            }}
          >
            Available Pages
          </Typography>
          
          <Grid container spacing={1}>
            {getRoutesWithLabels().map((route) => (
              <Grid item xs={12} sm={6} key={route.path}>
                <Button
                  variant="text"
                  size="small"
                  fullWidth
                  startIcon={<route.icon />}
                  onClick={() => navigate(route.path)}
                  sx={{
                    justifyContent: 'flex-start',
                    py: 1,
                    px: 2,
                    borderRadius: 1,
                    textTransform: 'none',
                    color: theme.palette.text.secondary,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main
                    }
                  }}
                >
                  {route.label}
                </Button>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Help Text */}
        <Typography 
          variant="caption" 
          sx={{ 
            mt: 4,
            display: 'block',
            color: theme.palette.text.disabled
          }}
        >
          If you believe this is an error, please contact your system administrator.
          <br />
          Error Code: 404 | Timestamp: {new Date().toLocaleString()}
        </Typography>
      </Paper>
    </Box>
  )
}

export default NotFoundPage
