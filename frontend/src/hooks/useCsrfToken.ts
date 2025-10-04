/**
 * CSRF Token Hook
 * SECURITY: Provides CSRF protection for state-changing requests (CWE-352)
 */

import { useEffect, useState } from 'react';
import { apiClient } from '../services/apiClient';

interface UseCsrfTokenReturn {
  token: string | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to manage CSRF token
 *
 * Usage:
 *   const { token, loading, error } = useCsrfToken();
 *
 *   // Use token in requests
 *   await fetch('/api/endpoint', {
 *     method: 'POST',
 *     headers: {
 *       'X-CSRF-Token': token,
 *       'Content-Type': 'application/json'
 *     },
 *     body: JSON.stringify(data)
 *   });
 */
export function useCsrfToken(): UseCsrfTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchToken = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get('/api/csrf-token');

      if (response.data && response.data.csrfToken) {
        setToken(response.data.csrfToken);
      } else {
        throw new Error('CSRF token not found in response');
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch CSRF token'));
      console.error('Failed to fetch CSRF token:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchToken();
  }, []);

  return {
    token,
    loading,
    error,
    refresh: fetchToken
  };
}

/**
 * Alternative: Get CSRF token from meta tag
 * (if you set it in your HTML template)
 */
export function getCsrfTokenFromMeta(): string | null {
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  return metaTag ? metaTag.getAttribute('content') : null;
}

/**
 * Alternative: Get CSRF token from cookie
 */
export function getCsrfTokenFromCookie(): string | null {
  const name = 'XSRF-TOKEN';
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }

  return null;
}

