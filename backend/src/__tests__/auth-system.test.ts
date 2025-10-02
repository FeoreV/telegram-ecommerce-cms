/**
 * Quick Test Script for Secure Authentication System
 * 
 * This script tests basic functionality without requiring external dependencies
 * Run with: npx ts-node src/auth/test_auth_system.ts
 */

import { SecureAuthSystem, UserRole } from './SecureAuthSystem';
import { RolePermissionManager, Permission } from './RolePermissionManager';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message?: string;
  error?: string;
}

class AuthSystemTester {
  private results: TestResult[] = [];

  private addResult(test: string, status: 'PASS' | 'FAIL', message?: string, error?: string) {
    this.results.push({ test, status, message, error });
    const icon = status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test}: ${message || status}`);
    if (error) {
      console.log(`   Error: ${error}`);
    }
  }

  async testPasswordHashing() {
    try {
      const password = 'testPassword123!';
      const hashedPassword = await SecureAuthSystem.hashPassword(password);
      
      if (!hashedPassword || hashedPassword === password) {
        this.addResult('Password Hashing', 'FAIL', 'Password not properly hashed');
        return;
      }

      const isValid = await SecureAuthSystem.verifyPassword(password, hashedPassword);
      if (!isValid) {
        this.addResult('Password Verification', 'FAIL', 'Valid password not verified');
        return;
      }

      const isInvalid = await SecureAuthSystem.verifyPassword('wrongPassword', hashedPassword);
      if (isInvalid) {
        this.addResult('Password Verification', 'FAIL', 'Invalid password incorrectly verified');
        return;
      }

      this.addResult('Password Hashing & Verification', 'PASS', 'All password operations working correctly');
    } catch (error: unknown) {
      this.addResult('Password Hashing', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testTokenGeneration() {
    try {
      const sessionId = SecureAuthSystem.generateSessionId();
      if (!sessionId || sessionId.length < 32) {
        this.addResult('Session ID Generation', 'FAIL', 'Session ID too short or empty');
        return;
      }

      const tokenFamily = SecureAuthSystem.generateTokenFamily();
      if (!tokenFamily || tokenFamily.length < 16) {
        this.addResult('Token Family Generation', 'FAIL', 'Token family too short or empty');
        return;
      }

      // Test access token generation
      const accessToken = SecureAuthSystem.generateAccessToken({
        userId: 'test-user-id',
        role: UserRole.ADMIN,
        sessionId: sessionId,
        telegramId: '123456789'
      });

      if (!accessToken || !accessToken.includes('.')) {
        this.addResult('Access Token Generation', 'FAIL', 'Invalid token format');
        return;
      }

      // Test refresh token generation
      const refreshToken = SecureAuthSystem.generateRefreshToken({
        userId: 'test-user-id',
        tokenFamily: tokenFamily,
        version: 1
      });

      if (!refreshToken || !refreshToken.includes('.')) {
        this.addResult('Refresh Token Generation', 'FAIL', 'Invalid refresh token format');
        return;
      }

      this.addResult('Token Generation', 'PASS', 'All token generation working correctly');
    } catch (error: unknown) {
      this.addResult('Token Generation', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  async testTokenVerification() {
    try {
      const sessionId = SecureAuthSystem.generateSessionId();
      
      // Generate a token
      const accessToken = SecureAuthSystem.generateAccessToken({
        userId: 'test-user-id',
        role: UserRole.ADMIN,
        sessionId: sessionId,
        telegramId: '123456789'
      });

      // Verify the token
      const decoded = await SecureAuthSystem.verifyAccessToken(accessToken);
      
      if (!decoded || decoded.userId !== 'test-user-id') {
        this.addResult('Token Verification', 'FAIL', 'Token not properly decoded');
        return;
      }

      if (decoded.role !== UserRole.ADMIN) {
        this.addResult('Token Verification', 'FAIL', 'Role not properly preserved');
        return;
      }

      this.addResult('Token Verification', 'PASS', 'Token verification working correctly');
    } catch (error: unknown) {
      this.addResult('Token Verification', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testPermissionSystem() {
    try {
      // Test OWNER permissions
      const owner = {
        id: 'owner-id',
        role: UserRole.OWNER,
        telegramId: '123456789'
      };

      const ownerChecker = new RolePermissionManager(owner);
      
      if (!ownerChecker.hasPermission(Permission.STORE_CREATE)) {
        this.addResult('Owner Permissions', 'FAIL', 'Owner missing STORE_CREATE permission');
        return;
      }

      if (!ownerChecker.hasPermission(Permission.SYSTEM_MANAGE)) {
        this.addResult('Owner Permissions', 'FAIL', 'Owner missing SYSTEM_MANAGE permission');
        return;
      }

      // Test CUSTOMER permissions
      const customer = {
        id: 'customer-id',
        role: UserRole.CUSTOMER,
        telegramId: '987654321'
      };

      const customerChecker = new RolePermissionManager(customer);
      
      if (customerChecker.hasPermission(Permission.STORE_CREATE)) {
        this.addResult('Customer Permissions', 'FAIL', 'Customer has STORE_CREATE permission (should not)');
        return;
      }

      if (!customerChecker.hasPermission(Permission.ORDER_VIEW)) {
        this.addResult('Customer Permissions', 'FAIL', 'Customer missing ORDER_VIEW permission');
        return;
      }

      // Test ADMIN permissions
      const admin = {
        id: 'admin-id',
        role: UserRole.ADMIN,
        telegramId: '555666777'
      };

      const adminChecker = new RolePermissionManager(admin);
      
      if (!adminChecker.hasPermission(Permission.PRODUCT_CREATE)) {
        this.addResult('Admin Permissions', 'FAIL', 'Admin missing PRODUCT_CREATE permission');
        return;
      }

      if (adminChecker.hasPermission(Permission.SYSTEM_MANAGE)) {
        this.addResult('Admin Permissions', 'FAIL', 'Admin has SYSTEM_MANAGE permission (should not)');
        return;
      }

      this.addResult('Permission System', 'PASS', 'All role permissions working correctly');
    } catch (error: unknown) {
      this.addResult('Permission System', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testConfigurationValidation() {
    try {
      // Save original env vars
      const originalSecret = process.env.JWT_SECRET;
      const originalRefreshSecret = process.env.JWT_REFRESH_SECRET;

      // Test missing secrets
      delete process.env.JWT_SECRET;
      delete process.env.JWT_REFRESH_SECRET;

      const { validateAuthConfig } = await import('./index');
      let validation = validateAuthConfig();
      
      if (validation.isValid) {
        this.addResult('Config Validation', 'FAIL', 'Validation passed with missing secrets');
        return;
      }

      // Test same secrets
      process.env.JWT_SECRET = 'same-secret';
      process.env.JWT_REFRESH_SECRET = 'same-secret';
      
      validation = validateAuthConfig();
      if (validation.isValid) {
        this.addResult('Config Validation', 'FAIL', 'Validation passed with same secrets');
        return;
      }

      // Test short secrets
      process.env.JWT_SECRET = 'short';
      process.env.JWT_REFRESH_SECRET = 'different-short';
      
      validation = validateAuthConfig();
      if (validation.isValid) {
        this.addResult('Config Validation', 'FAIL', 'Validation passed with short secrets');
        return;
      }

      // Restore original values
      if (originalSecret) process.env.JWT_SECRET = originalSecret;
      if (originalRefreshSecret) process.env.JWT_REFRESH_SECRET = originalRefreshSecret;

      this.addResult('Configuration Validation', 'PASS', 'All validation rules working correctly');
    } catch (error: unknown) {
      this.addResult('Configuration Validation', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  testTokenExtraction() {
    try {
      // Test valid Bearer token
      const validToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.signature';
      const extracted = SecureAuthSystem.extractTokenFromHeader(`Bearer ${validToken}`);
      
      if (extracted !== validToken) {
        this.addResult('Token Extraction', 'FAIL', 'Valid Bearer token not extracted correctly');
        return;
      }

      // Test invalid header
      const invalid = SecureAuthSystem.extractTokenFromHeader('Invalid header');
      if (invalid !== null) {
        this.addResult('Token Extraction', 'FAIL', 'Invalid header should return null');
        return;
      }

      // Test missing header
      const missing = SecureAuthSystem.extractTokenFromHeader(undefined);
      if (missing !== null) {
        this.addResult('Token Extraction', 'FAIL', 'Missing header should return null');
        return;
      }

      this.addResult('Token Extraction', 'PASS', 'Token extraction working correctly');
    } catch (error: unknown) {
      this.addResult('Token Extraction', 'FAIL', 'Exception occurred', error instanceof Error ? error.message : String(error));
    }
  }

  async runAllTests() {
    console.log('🔐 Starting Secure Authentication System Tests...\n');

    await this.testPasswordHashing();
    this.testTokenGeneration();
    await this.testTokenVerification();
    this.testPermissionSystem();
    this.testConfigurationValidation();
    this.testTokenExtraction();

    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
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
          if (r.error) {
            console.log(`    Error: ${r.error}`);
          }
        });
    }

    console.log('\n' + (failed === 0 ? '🎉 All tests passed!' : '⚠️  Some tests failed - check implementation'));
    
    return failed === 0;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new AuthSystemTester();
  tester.runAllTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test runner failed:', error);
      process.exit(1);
    });
}

export { AuthSystemTester };
