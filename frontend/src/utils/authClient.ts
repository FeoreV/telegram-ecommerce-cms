/**
 * Enhanced Authentication Client with Auto-Refresh
 * Solves the "постоянно выкидывает с аккаунта" problem
 */

import React from 'react';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
}

interface User {
  id: string;
  email?: string;
  telegramId?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
}

interface AuthResponse {
  success: boolean;
  user?: User;
  tokens?: AuthTokens;
  message?: string;
  error?: string;
  code?: string;
}

class AuthClient {
  private baseURL: string;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Use Vite env variable and ensure /api prefix
    const rawBase = (import.meta.env.VITE_API_URL as string | undefined) || '82.147.84.78';
    const normalized = rawBase.replace(/\/$/, '');
    const apiBase = normalized.endsWith('/api') ? normalized : `${normalized}/api`;
    const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
    if (isHttpsPage && apiBase.startsWith('http://')) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const safeBase = `${origin}/api`;
      console.warn('[authClient] Mixed content prevented: overriding baseURL', { original: apiBase, safeBase });
      this.baseURL = safeBase;
    } else {
      this.baseURL = apiBase;
    }
    console.info('[authClient] Base URL resolved', {
      rawBase,
      apiBase,
      baseURL: this.baseURL,
      location: typeof window !== 'undefined' ? window.location.origin : 'n/a',
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'n/a'
    });
    
    this.setupAutoRefresh();
  }

  // Get tokens from storage
  private getTokens(): AuthTokens | null {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!accessToken || !refreshToken) return null;
    
    return { accessToken, refreshToken };
  }

  // Store tokens
  private setTokens(tokens: AuthTokens): void {
    localStorage.setItem('accessToken', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
  }

  // Clear tokens
  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  // Setup automatic token refresh
  private setupAutoRefresh(): void {
    // Check for refresh every 2 minutes
    this.refreshTimer = setInterval(() => {
      this.checkAndRefreshToken();
    }, 2 * 60 * 1000);

    // Also check on page focus
    window.addEventListener('focus', () => {
      this.checkAndRefreshToken();
    });
  }

  // Check if token needs refresh and refresh if needed
  private async checkAndRefreshToken(): Promise<void> {
    const tokens = this.getTokens();
    if (!tokens) return;

    try {
      const response = await fetch(`${this.baseURL}/auth/auto-refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(tokens)
      });

      const data = await response.json();

      if (data.success && data.refreshed && data.tokens) {
        this.setTokens(data.tokens);
        console.log('🔄 Tokens auto-refreshed successfully');
        
        // Emit event for components to update
        window.dispatchEvent(new CustomEvent('tokensRefreshed', { 
          detail: { tokens: data.tokens, user: data.user } 
        }));
      }
    } catch (error) {
      console.warn('Auto-refresh failed:', error);
    }
  }

  // Login with email
  async loginWithEmail(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/auth/login/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success && data.tokens) {
        this.setTokens(data.tokens);
      }

      return data;
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error', 
        code: 'NETWORK_ERROR' 
      };
    }
  }

  // Login with Telegram
  async loginWithTelegram(telegramData: {
    telegramId: string;
    username?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<AuthResponse> {
    try {
      const response = await fetch(`${this.baseURL}/auth/login/telegram`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(telegramData)
      });

      const data = await response.json();

      if (data.success && data.tokens) {
        this.setTokens(data.tokens);
      }

      return data;
    } catch (error) {
      return { 
        success: false, 
        error: 'Network error', 
        code: 'NETWORK_ERROR' 
      };
    }
  }

  // Logout
  async logout(): Promise<void> {
    const tokens = this.getTokens();
    
    try {
      await fetch(`${this.baseURL}/auth/logout`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokens?.accessToken}`
        },
        credentials: 'include',
        body: JSON.stringify({ refreshToken: tokens?.refreshToken })
      });
    } catch (error) {
      console.warn('Logout request failed:', error);
    }

    this.clearTokens();
    
    // Clear refresh timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Emit logout event
    window.dispatchEvent(new CustomEvent('userLoggedOut'));
  }

  // Make authenticated request with auto-retry on token expiry
  async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const tokens = this.getTokens();
    
    if (!tokens) {
      throw new Error('No authentication tokens available');
    }

    // First attempt with current token
    let response = await this.makeRequest(endpoint, tokens.accessToken, options);

    // If unauthorized, try to refresh and retry
    if (response.status === 401) {
      try {
        // Prevent multiple concurrent refresh requests
        if (!this.refreshPromise) {
          this.refreshPromise = this.refreshTokens(tokens.refreshToken);
        }

        const newTokens = await this.refreshPromise;
        this.refreshPromise = null;
        
        // Retry with new token
        response = await this.makeRequest(endpoint, newTokens.accessToken, options);
      } catch (refreshError) {
        this.refreshPromise = null;
        // If refresh fails, clear tokens and throw
        this.clearTokens();
        throw new Error('Authentication failed - please log in again');
      }
    }

    return response;
  }

  // Make HTTP request with token
  private async makeRequest(endpoint: string, accessToken: string, options: RequestInit): Promise<Response> {
    return fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        ...options.headers
      },
      credentials: 'include'
    });
  }

  // Refresh tokens
  private async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const response = await fetch(`${this.baseURL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken })
    });

    if (!response.ok) {
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    
    if (!data.success || !data.tokens) {
      throw new Error('Invalid refresh response');
    }

    this.setTokens(data.tokens);
    
    // Emit tokens refreshed event
    window.dispatchEvent(new CustomEvent('tokensRefreshed', { 
      detail: { tokens: data.tokens, user: data.user } 
    }));

    return data.tokens;
  }

  // Get current user
  async getCurrentUser(): Promise<User | null> {
    try {
      const response = await this.request('/auth/profile');
      const data = await response.json();
      
      return data.success ? data.user : null;
    } catch (error) {
      console.warn('Failed to get current user:', error);
      return null;
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return !!this.getTokens();
  }

  // Get current access token (for direct usage)
  getAccessToken(): string | null {
    return localStorage.getItem('accessToken');
  }

  // Cleanup on app unmount
  destroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    this.refreshPromise = null;
  }
}

// Export singleton instance
export const authClient = new AuthClient();
export default authClient;

// React Hook for auth state
export function useAuthClient() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(authClient.isAuthenticated());
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const handleTokensRefreshed = (event: CustomEvent) => {
      setIsAuthenticated(true);
      if (event.detail.user) {
        setUser(event.detail.user);
      }
    };

    const handleLoggedOut = () => {
      setIsAuthenticated(false);
      setUser(null);
    };

    window.addEventListener('tokensRefreshed', handleTokensRefreshed as any);
    window.addEventListener('userLoggedOut', handleLoggedOut);

    // Load initial user
    if (authClient.isAuthenticated()) {
      authClient.getCurrentUser().then(setUser);
    }

    return () => {
      window.removeEventListener('tokensRefreshed', handleTokensRefreshed as any);
      window.removeEventListener('userLoggedOut', handleLoggedOut);
    };
  }, []);

  return {
    isAuthenticated,
    user,
    login: authClient.loginWithEmail.bind(authClient),
    loginWithTelegram: authClient.loginWithTelegram.bind(authClient),
    logout: authClient.logout.bind(authClient),
    request: authClient.request.bind(authClient)
  };
}
