import React from 'react'
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Grid,
  useTheme,
  alpha,
  Alert
} from '@mui/material'
import { 
  Block as BlockIcon,
  ContactSupport as SupportIcon,
  ExitToApp as LogoutIcon
} from '@mui/icons-material'
import { tokenManager } from '../services/apiClient'

interface AccessDeniedPageProps {
  userRole: string
}

const AccessDeniedPage: React.FC<AccessDeniedPageProps> = ({ userRole }) => {
  const theme = useTheme()

  const handleLogout = () => {
    tokenManager.clearTokens()
    window.location.href = '/login'
  }

  const handleContactSupport = () => {
    // This could open a support ticket modal or redirect to support
    console.log('Contact support requested')
  }

  const getRoleDescription = (role: string) => {
    const descriptions: Record<string, string> = {
      'USER': 'Regular User - Limited platform access',
      'CUSTOMER': 'Customer - Shopping and order access only', 
      'GUEST': 'Guest User - View-only access',
    }
    return descriptions[role] || `${role} - Contact administrator for access details`
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: `linear-gradient(135deg, ${alpha(theme.palette.error.main, 0.1)} 0%, ${alpha(theme.palette.warning.main, 0.1)} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2
      }}
    >
      <Paper
        elevation={8}
        sx={{
          maxWidth: 500,
          width: '100%',
          p: 4,
          textAlign: 'center',
          borderRadius: 3,
          bgcolor: alpha(theme.palette.background.paper, 0.95),
          backdropFilter: 'blur(10px)'
        }}
      >
        {/* Access Denied Icon */}
        <Box sx={{ mb: 3 }}>
          <BlockIcon 
            sx={{ 
              fontSize: 80, 
              color: theme.palette.error.main,
              mb: 2
            }} 
          />
          <Typography 
            variant="h3" 
            sx={{ 
              fontWeight: 'bold',
              color: theme.palette.error.main,
              mb: 1
            }}
          >
            Access Denied
          </Typography>
        </Box>

        {/* Error Message */}
        <Alert 
          severity="error" 
          sx={{ 
            mb: 3,
            textAlign: 'left',
            '& .MuiAlert-message': {
              width: '100%'
            }
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 500 }}>
            Admin Panel Access Restricted
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Your current role <strong>"{userRole}"</strong> does not have permission to access the admin panel.
          </Typography>
        </Alert>

        {/* Role Information */}
        <Box sx={{ mb: 4, p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1, color: theme.palette.info.main }}>
            Current Role: {userRole}
          </Typography>
          <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
            {getRoleDescription(userRole)}
          </Typography>
        </Box>

        {/* Required Roles */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="body1" sx={{ mb: 2, color: theme.palette.text.primary }}>
            <strong>Required Roles for Admin Panel:</strong>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
            {['OWNER', 'ADMIN', 'VENDOR'].map((role) => (
              <Box
                key={role}
                sx={{
                  px: 2,
                  py: 0.5,
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  color: theme.palette.success.main,
                  borderRadius: 1,
                  fontSize: '0.875rem',
                  fontWeight: 500
                }}
              >
                {role}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Action Buttons */}
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Button
              variant="outlined"
              size="large"
              fullWidth
              startIcon={<SupportIcon />}
              onClick={handleContactSupport}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              Contact Support
            </Button>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Button
              variant="contained"
              color="error"
              size="large"
              fullWidth
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
              sx={{ 
                py: 1.5,
                borderRadius: 2,
                textTransform: 'none',
                fontSize: '1rem'
              }}
            >
              Sign Out
            </Button>
          </Grid>
        </Grid>

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
          Error Code: ACCESS_DENIED | Role: {userRole} | Timestamp: {new Date().toLocaleString()}
        </Typography>
      </Paper>
    </Box>
  )
}

export default AccessDeniedPage