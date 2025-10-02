# 404 Handling Test Plan

## Overview
Comprehensive test plan for the 404 redirect strategy implemented across the e-commerce platform with Telegram integration.

## Architecture Components

### 1. Frontend (React Router)
- **Custom 404 Page**: `NotFoundPage.tsx` with role-based navigation
- **Route Guards**: `useRouteGuard.ts` hook for permission checking
- **Smart Redirects**: Intelligent routing based on user roles

### 2. Backend (Express.js)
- **API 404 Middleware**: `notFoundHandler.ts` with security features
- **Role-based Responses**: Different responses based on user permissions
- **Security Monitoring**: Logging and threat detection for suspicious requests

### 3. Nginx Configuration
- **SPA Routing**: Proper fallback for React Router
- **API Error Handling**: JSON responses for API endpoints
- **Static Asset 404s**: Direct 404 for missing assets
- **Custom Error Pages**: Branded error responses

## Test Scenarios

### Frontend Tests

#### 1. Anonymous User (Not Logged In)
**Test Cases:**
- `GET /nonexistent-page` → Should redirect to login
- `GET /admin/anything` → Should redirect to login  
- `GET /dashboard` → Should redirect to login

**Expected Behavior:**
- All routes should redirect to LoginPage
- No 404 page should be shown to anonymous users

#### 2. VENDOR Role User
**Test Cases:**
- `GET /dashboard` → ✅ Allow (redirect if needed)
- `GET /stores` → ✅ Allow  
- `GET /products` → ✅ Allow
- `GET /orders` → ✅ Allow
- `GET /payments` → ✅ Allow
- `GET /reports` → ✅ Allow
- `GET /bots` → ❌ Show 404 page with available routes
- `GET /users` → ❌ Show 404 page with available routes
- `GET /random-page` → ❌ Show 404 page with available routes

**Expected Behavior:**
- 404 page shows only routes vendor can access
- Smart home button redirects to `/dashboard`
- Available routes list shows: Dashboard, Stores, Products, Orders, Payments, Reports

#### 3. ADMIN Role User  
**Test Cases:**
- `GET /dashboard` → ✅ Allow
- `GET /stores` → ✅ Allow
- `GET /products` → ✅ Allow  
- `GET /orders` → ✅ Allow
- `GET /payments` → ✅ Allow
- `GET /reports` → ✅ Allow
- `GET /bots` → ✅ Allow
- `GET /users` → ❌ Show 404 page with available routes
- `GET /random-page` → ❌ Show 404 page

**Expected Behavior:**
- 404 page shows all routes except `/users`
- Available routes include Bot Management

#### 4. OWNER Role User
**Test Cases:**
- `GET /dashboard` → ✅ Allow
- `GET /stores` → ✅ Allow  
- `GET /products` → ✅ Allow
- `GET /orders` → ✅ Allow
- `GET /payments` → ✅ Allow
- `GET /reports` → ✅ Allow
- `GET /bots` → ✅ Allow
- `GET /users` → ✅ Allow
- `GET /random-page` → ❌ Show 404 page

**Expected Behavior:**
- 404 page shows all available routes
- Available routes include User Management
- Full platform access

### Backend API Tests

#### 1. API Endpoint 404s
**Test Cases:**
- `GET /api/nonexistent` → JSON 404 response
- `POST /api/invalid/endpoint` → JSON 404 response  
- `PUT /api/fake/route` → JSON 404 response

**Expected Response Format:**
```json
{
  "error": "Endpoint not found",
  "message": "The requested endpoint GET /api/nonexistent was not found",
  "statusCode": 404,
  "timestamp": "2025-01-XX...",
  "path": "/api/nonexistent",
  "availableEndpoints": {
    "authenticated": [...],
    "admin": [...],
    "owner": [...]
  }
}
```

#### 2. Security Threat Detection
**Test Cases:**
- `GET /api/.env` → Generic 404 (no detailed info)
- `GET /api/wp-admin` → Logged as suspicious  
- `GET /api/phpmyadmin` → Logged as suspicious
- `GET /api/backup.sql` → Logged as suspicious

**Expected Behavior:**
- Suspicious requests logged with threat indicators
- Generic response (no endpoint hints)
- Enhanced monitoring for repeated attempts

#### 3. Role-based API Access
**Test Cases:**
- **VENDOR** accessing `GET /api/admin/users` → 404 (not endpoint info leak)
- **ADMIN** accessing `GET /api/owner/system` → 404 (role-appropriate)
- **No Auth** accessing `GET /api/protected` → 401 (not 404)

**Expected Behavior:**
- Role-appropriate 404 responses
- No information leakage about restricted endpoints
- Proper distinction between 401 (auth required) and 404 (not found)

### Nginx Tests

#### 1. Static Asset 404s  
**Test Cases:**
- `GET /static/missing-file.js` → 404 immediately
- `GET /images/nonexistent.png` → 404 immediately
- `GET /favicon.ico` (if missing) → 404

**Expected Behavior:**
- Direct 404 response (no SPA fallback)
- Proper caching headers
- No backend involvement

#### 2. SPA Route Handling
**Test Cases:**
- `GET /dashboard/nested/route` → Forward to React app
- `GET /stores/123/edit` → Forward to React app  
- `GET /unknown-spa-route` → Forward to React app (shows NotFoundPage)

**Expected Behavior:**
- All non-API, non-static routes forwarded to React app
- React Router handles internal routing
- 404 page rendered by React for unknown routes

#### 3. API vs Frontend Route Distinction
**Test Cases:**
- `GET /api/missing` → JSON 404 response
- `GET /missing-page` → HTML response (React app)
- `GET /socket.io/invalid` → Proper WebSocket error

**Expected Behavior:**
- Clear distinction between API and frontend handling
- Proper Content-Type headers
- No cross-contamination of error formats

## Manual Testing Checklist

### Pre-Test Setup
- [ ] Ensure all services are running (frontend, backend, nginx)
- [ ] Have test accounts for each role (VENDOR, ADMIN, OWNER)
- [ ] Browser dev tools open for network inspection

### Frontend Testing
- [ ] Test anonymous user redirects
- [ ] Test each role's available routes on 404 page
- [ ] Verify "Go Back" button functionality
- [ ] Verify "Go to Dashboard" smart routing
- [ ] Check error page styling and responsiveness

### Backend Testing  
- [ ] Use curl/Postman to test API 404s
- [ ] Verify JSON response format
- [ ] Test security threat detection
- [ ] Check logging output for suspicious requests
- [ ] Verify role-based endpoint availability lists

### Nginx Testing
- [ ] Test static asset 404s
- [ ] Verify SPA routing works correctly  
- [ ] Check API vs frontend route handling
- [ ] Test with different Accept headers
- [ ] Verify custom error page serving

## Automated Testing

### Frontend Unit Tests
```typescript
// Example test structure
describe('NotFoundPage', () => {
  it('shows role-appropriate routes for VENDOR')
  it('shows all routes for OWNER')  
  it('redirects correctly based on permissions')
})

describe('useRouteGuard', () => {
  it('blocks unauthorized access')
  it('redirects to appropriate route')
  it('logs security events')
})
```

### Backend Integration Tests
```typescript
describe('404 Handling', () => {
  it('returns JSON for API endpoints')
  it('detects suspicious patterns')
  it('provides role-appropriate responses')
  it('logs security events correctly')
})
```

### End-to-End Tests
```typescript  
describe('404 Flow E2E', () => {
  it('handles complete user journey')
  it('preserves user session through 404s')
  it('maintains security posture')
})
```

## Success Criteria

### User Experience
- ✅ Clear, helpful 404 pages with navigation options
- ✅ Role-appropriate route suggestions
- ✅ No broken user flows
- ✅ Consistent branding and styling

### Security
- ✅ No information leakage about restricted endpoints
- ✅ Suspicious request detection and logging  
- ✅ Proper role-based access control
- ✅ No error-based enumeration attacks

### Performance  
- ✅ Fast 404 responses (< 100ms for static, < 500ms for dynamic)
- ✅ No unnecessary backend calls for static assets
- ✅ Efficient route matching and permission checks

### Maintainability
- ✅ Clear, documented code structure
- ✅ Easy to add new routes and permissions
- ✅ Comprehensive logging for debugging
- ✅ Testable components and functions

## Rollback Plan

If issues are discovered:

1. **Frontend**: Revert to simple redirect (`<Route path="*" element={<Navigate to="/dashboard" replace />} />`)
2. **Backend**: Remove `notFoundMiddleware`, rely on `errorHandler`  
3. **Nginx**: Remove custom error pages, use default nginx 404s

## Implementation Notes

### Key Files Modified:
- `frontend/src/pages/NotFoundPage.tsx` - Custom 404 page
- `frontend/src/hooks/useRouteGuard.ts` - Role-based routing
- `frontend/src/App.tsx` - Updated routing  
- `backend/src/middleware/notFoundHandler.ts` - API 404 handling
- `backend/src/index.ts` - Integrated middleware
- `config/nginx/nginx.conf` - Enhanced nginx config

### Security Considerations:
- All 404 responses avoid information leakage
- Suspicious activity monitoring and logging
- Role-based response filtering
- Rate limiting on 404-generating requests

### Performance Optimizations:
- Static asset 404s handled at nginx level
- Cached permission lookups where possible
- Efficient route matching algorithms
- Minimal database queries for permission checks
