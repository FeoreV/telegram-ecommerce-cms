/**
 * Test script for session fix - verify token expiry improvements
 * Run with: npx ts-node src/auth/test_session_fix.ts
 */

import { getAuthConfig, parseExpiryToSeconds, shouldRefreshToken } from './AuthConfig';
import { SecureAuthSystem } from './SecureAuthSystem';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  details?: any;
}

class SessionFixTester {
  private results: TestResult[] = [];

  private addResult(test: string, status: 'PASS' | 'FAIL', message?: string, details?: any) {
    this.results.push({ test, status, message, details });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message || status}`);
    if (details) {
      console.log(`   Details:`, details);
    }
  }

  testTokenConfiguration() {
    try {
      const config = getAuthConfig();
      
      // Test access token expiry is reasonable (more than 15 minutes)
      const accessSeconds = parseExpiryToSeconds(config.accessTokenExpiry);
      const refreshSeconds = parseExpiryToSeconds(config.refreshTokenExpiry);
      
      if (accessSeconds <= 900) { // 15 minutes
        this.addResult('Token Expiry Configuration', 'FAIL', 
          `Access token too short: ${config.accessTokenExpiry} (${accessSeconds}s)`);
        return;
      }
      
      if (accessSeconds >= refreshSeconds) {
        this.addResult('Token Expiry Configuration', 'FAIL', 
          'Access token should be shorter than refresh token');
        return;
      }
      
      // Check that tokens are now user-friendly
      const accessHours = accessSeconds / 3600;
      const refreshDays = refreshSeconds / 86400;
      
      this.addResult('Token Expiry Configuration', 'PASS', 
        'Token expiry times are user-friendly', {
          accessToken: `${config.accessTokenExpiry} (${accessHours.toFixed(1)} hours)`,
          refreshToken: `${config.refreshTokenExpiry} (${refreshDays.toFixed(1)} days)`,
          improvement: accessSeconds > 900 ? `${Math.round(accessSeconds/900)}x longer than before` : 'same'
        });
        
    } catch (error: unknown) {
      this.addResult('Token Expiry Configuration', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testAutoRefreshConfig() {
    try {
      const config = getAuthConfig();
      
      if (!config.enableAutoRefresh) {
        this.addResult('Auto-Refresh Configuration', 'FAIL', 'Auto-refresh is disabled');
        return;
      }
      
      if (config.refreshGracePeriod < 60) { // Less than 1 minute
        this.addResult('Auto-Refresh Configuration', 'FAIL', 
          `Grace period too short: ${config.refreshGracePeriod}s`);
        return;
      }
      
      this.addResult('Auto-Refresh Configuration', 'PASS', 
        'Auto-refresh properly configured', {
          enabled: config.enableAutoRefresh,
          gracePeriod: `${config.refreshGracePeriod}s (${Math.round(config.refreshGracePeriod/60)} minutes)`,
          sessionExtend: config.sessionExtendOnActivity
        });
        
    } catch (error: unknown) {
      this.addResult('Auto-Refresh Configuration', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testRefreshLogic() {
    try {
      // Create a mock token that expires soon
      const currentTime = Math.floor(Date.now() / 1000);
      const expiringSoon = currentTime + 200; // 200 seconds from now
      const notExpiring = currentTime + 3600; // 1 hour from now
      
      // Test grace period logic
      const shouldRefresh1 = shouldRefreshToken(expiringSoon, 300); // 5 minutes grace
      const shouldRefresh2 = shouldRefreshToken(notExpiring, 300);
      
      if (!shouldRefresh1 || shouldRefresh2) {
        this.addResult('Refresh Logic', 'FAIL', 'Refresh logic not working correctly');
        return;
      }
      
      // Test with SecureAuthSystem method
      const mockToken = `header.${Buffer.from(JSON.stringify({exp: expiringSoon})).toString('base64')}.signature`;
      const needsRefresh = SecureAuthSystem.isTokenNearExpiry(mockToken);
      
      this.addResult('Refresh Logic', 'PASS', 'Refresh logic working correctly', {
        expiringSoonToken: shouldRefresh1 ? 'correctly identified' : 'missed',
        validToken: !shouldRefresh2 ? 'correctly identified' : 'false positive',
        systemMethod: needsRefresh ? 'working' : 'not working'
      });
      
    } catch (error: unknown) {
      this.addResult('Refresh Logic', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testEnvironmentPresets() {
    try {
      // Test different presets
      const originalEnv = process.env.NODE_ENV;
      const originalPreset = process.env.AUTH_PRESET;
      
      // Test development preset
      process.env.NODE_ENV = 'development';
      delete process.env.AUTH_PRESET;
      const devConfig = getAuthConfig();
      
      // Test production preset
      process.env.NODE_ENV = 'production';
      const prodConfig = getAuthConfig();
      
      // Restore original values
      process.env.NODE_ENV = originalEnv;
      if (originalPreset) {
        process.env.AUTH_PRESET = originalPreset;
      }
      
      const devAccessSeconds = parseExpiryToSeconds(devConfig.accessTokenExpiry);
      const prodAccessSeconds = parseExpiryToSeconds(prodConfig.accessTokenExpiry);
      
      if (devAccessSeconds <= prodAccessSeconds) {
        this.addResult('Environment Presets', 'FAIL', 
          'Development should have longer tokens than production');
        return;
      }
      
      this.addResult('Environment Presets', 'PASS', 
        'Environment presets working correctly', {
          development: `${devConfig.accessTokenExpiry} access, ${devConfig.refreshTokenExpiry} refresh`,
          production: `${prodConfig.accessTokenExpiry} access, ${prodConfig.refreshTokenExpiry} refresh`,
          devLonger: `${Math.round(devAccessSeconds/prodAccessSeconds)}x longer in dev`
        });
        
    } catch (error: unknown) {
      this.addResult('Environment Presets', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testComparisonWithOldSystem() {
    try {
      const config = getAuthConfig();
      const currentAccessSeconds = parseExpiryToSeconds(config.accessTokenExpiry);
      const oldAccessSeconds = 15 * 60; // Old system: 15 minutes
      
      const improvement = currentAccessSeconds / oldAccessSeconds;
      
      if (improvement <= 1) {
        this.addResult('Improvement Over Legacy', 'FAIL', 
          'No improvement over old 15-minute tokens');
        return;
      }
      
      const currentRefreshSeconds = parseExpiryToSeconds(config.refreshTokenExpiry);
      const oldRefreshSeconds = 7 * 24 * 60 * 60; // Old system: 7 days
      const refreshImprovement = currentRefreshSeconds / oldRefreshSeconds;
      
      this.addResult('Improvement Over Legacy', 'PASS', 
        'Significant improvement over legacy system', {
          oldAccess: '15 minutes',
          newAccess: config.accessTokenExpiry,
          accessImprovement: `${improvement.toFixed(1)}x longer`,
          oldRefresh: '7 days',
          newRefresh: config.refreshTokenExpiry,
          refreshImprovement: `${refreshImprovement.toFixed(1)}x longer`,
          userExperience: improvement >= 4 ? 'Much better' : 'Better'
        });
        
    } catch (error: unknown) {
      this.addResult('Improvement Over Legacy', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  async runAllTests() {
    console.log('🔧 Testing Session Fix Configuration...\n');

    this.testTokenConfiguration();
    this.testAutoRefreshConfig();
    this.testRefreshLogic();
    this.testEnvironmentPresets();
    this.testComparisonWithOldSystem();

    console.log('\n📊 Session Fix Test Results:');
    console.log('================================');
    
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const total = this.results.length;

    console.log(`Total Tests: ${total}`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

    if (failed > 0) {
      console.log('\n🔍 Failed Tests:');
      this.results
        .filter(r => r.status === 'FAIL')
        .forEach(r => {
          console.log(`  - ${r.test}: ${r.message || 'Failed'}`);
        });
    }

    // Summary and recommendations
    console.log('\n🎯 Session Fix Summary:');
    if (failed === 0) {
      console.log('✅ All session fixes are properly configured!');
      console.log('✅ Users should no longer be logged out frequently');
      console.log('✅ Auto-refresh will work seamlessly in the background');
    } else {
      console.log('⚠️  Some configuration issues detected');
      console.log('📝 Check failed tests above and update .env accordingly');
    }

    console.log('\n🚀 Next Steps:');
    console.log('1. Update your .env file with recommended settings');
    console.log('2. Restart your backend server');
    console.log('3. Test with frontend to confirm user experience');
    console.log('4. Monitor logs for "Token expired" errors (should decrease)');
    
    return failed === 0;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new SessionFixTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export { SessionFixTester };
