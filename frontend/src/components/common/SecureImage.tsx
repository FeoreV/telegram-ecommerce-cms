import { useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { apiClient } from '../../services/apiClient';

interface SecureImageProps {
  src: string;
  alt: string;
  style?: React.CSSProperties;
  sx?: any;
  onClick?: () => void;
  onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Component for displaying images that require authentication
 * Downloads image with Authorization header and converts to blob URL
 */
export const SecureImage: React.FC<SecureImageProps> = ({ 
  src, 
  alt, 
  style, 
  sx, 
  onClick, 
  onError 
}) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        // Download image with authentication
        const response = await apiClient.get(src, {
          responseType: 'blob'
        });

        // Create blob URL
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
        setLoading(false);
      } catch (err) {
        console.error('Failed to load secure image:', err);
        setError(true);
        setLoading(false);
        
        if (onError) {
          onError(err as any);
        }
      }
    };

    if (src) {
      loadImage();
    }

    // Cleanup blob URL on unmount
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [src, onError]);

  if (loading) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 200,
          ...sx 
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error || !blobUrl) {
    return (
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: 200,
          color: 'error.main',
          ...sx 
        }}
      >
        ❌ Не удалось загрузить изображение
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={blobUrl}
      alt={alt}
      style={style}
      sx={sx}
      onClick={onClick}
      onError={(e) => {
        setError(true);
        if (onError) {
          onError(e);
        }
      }}
    />
  );
};

