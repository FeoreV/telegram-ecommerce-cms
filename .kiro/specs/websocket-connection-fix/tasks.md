# Implementation Plan

- [ ] 1. Fix frontend environment configuration
  - Update `frontend/.env` to include correct port in `VITE_SOCKET_URL`
  - Ensure `VITE_API_URL` has the correct format
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_

- [ ] 2. Enhance socket URL normalization in SocketContext
  - [ ] 2.1 Improve URL fallback logic with explicit port handling
    - Modify `socketUrl` useMemo to prioritize VITE_SOCKET_URL over VITE_API_URL
    - Add fallback to 'http://82.147.84.78:3001' with warning log
    - _Requirements: 1.1, 1.2, 1.3, 3.3_

  - [ ] 2.2 Add URL validation using URL constructor
    - Wrap URL normalization in try-catch block
    - Log validation errors to console
    - Return safe fallback on validation failure
    - _Requirements: 1.4, 3.3, 4.1, 4.3_

  - [ ] 2.3 Add detailed connection logging
    - Log the final socketUrl being used
    - Log connection attempts with timestamp
    - Log transport type (polling/websocket)
    - _Requirements: 3.4, 4.1, 4.2, 4.4_

- [ ] 3. Update backend CORS configuration
  - [ ] 3.1 Enhance allowed origins list in backend/src/index.ts
    - Add protocol validation for origins
    - Include 82.147.84.78:3001 for testing
    - Filter out empty/invalid origins
    - _Requirements: 2.1, 2.2, 2.3, 3.2_

  - [ ] 3.2 Improve initSocket function in backend/src/lib/socket.ts
    - Accept array of origins instead of comma-separated string
    - Add origin validation and logging
    - Log each connection attempt with origin details
    - _Requirements: 2.1, 2.2, 2.4, 4.2, 4.4_

- [ ] 4. Enhance error handling and logging
  - [ ] 4.1 Add detailed error logging in SocketContext
    - Create handleConnectError function with detailed error info
    - Log socketUrl, timestamp, userAgent, and online status
    - Include connection attempt count in error logs
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ] 4.2 Add backend connection error logging
    - Log connection attempts with origin and transport
    - Add engine.on('connection_error') handler
    - Include user agent and socket ID in logs
    - _Requirements: 4.2, 4.4_

- [ ] 5. Validate backend environment configuration
  - [ ] 5.1 Check backend/.env CORS_WHITELIST
    - Ensure all frontend origins are included
    - Verify format includes protocol and port
    - Add 82.147.84.78:3000 and 82.147.84.78:5173 for dev
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 5.2 Verify FRONTEND_URL configuration
    - Ensure it matches actual frontend origin
    - Include protocol and port number
    - _Requirements: 2.3, 3.2, 5.4_

- [ ] 6. Add environment variable validation
  - [ ] 6.1 Create frontend environment validator
    - Check VITE_SOCKET_URL and VITE_API_URL are defined
    - Validate URL format using URL constructor
    - Log warnings for missing or invalid variables
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.4_

  - [ ] 6.2 Enhance backend environment validator
    - Validate CORS_WHITELIST format
    - Check FRONTEND_URL includes protocol
    - Verify PORT is a valid number
    - _Requirements: 3.1, 3.2, 3.3, 5.4_

- [ ] 7. Improve connection status visibility
  - [ ] 7.1 Add connection status indicator to UI
    - Display current connection state (connecting/connected/error)
    - Show connection error messages
    - Add manual reconnect button
    - _Requirements: 4.3, 5.1, 5.2, 5.3_

  - [ ] 7.2 Implement graceful degradation messaging
    - Notify user when real-time updates are unavailable
    - Provide manual refresh option
    - Show "degraded mode" indicator
    - _Requirements: 4.3, 5.1, 5.2_

- [ ]* 8. Write unit tests for URL normalization
  - Test VITE_SOCKET_URL priority over VITE_API_URL
  - Test fallback to default URL
  - Test /api suffix removal
  - Test URL validation with invalid inputs
  - _Requirements: 1.1, 1.2, 1.3, 3.3_

- [ ]* 9. Write integration tests for connection flow
  - Test successful connection with valid token
  - Test connection error handling
  - Test reconnection after disconnect
  - Test CORS rejection scenarios
  - _Requirements: 1.1, 2.1, 2.2, 4.1, 4.2_

- [ ] 10. Perform manual testing and validation
  - [ ] 10.1 Test development environment connection
    - Start backend on port 3001
    - Start frontend on port 3000 or 5173
    - Verify WebSocket connection establishes
    - Check browser console for connection logs
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2_

  - [ ] 10.2 Test connection error scenarios
    - Test with backend stopped (should show error)
    - Test with wrong port (should fail gracefully)
    - Test with invalid CORS origin (should log rejection)
    - Verify error messages are clear
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 10.3 Test reconnection behavior
    - Establish connection, then stop backend
    - Restart backend and verify auto-reconnect
    - Check reconnection attempt logs
    - Verify exponential backoff works
    - _Requirements: 4.1, 5.1, 5.2, 5.3_

  - [ ] 10.4 Verify production configuration
    - Review production environment variables
    - Ensure HTTPS URLs are used
    - Verify CORS whitelist includes production domain
    - Test connection in production-like environment
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 5.1, 5.4_
