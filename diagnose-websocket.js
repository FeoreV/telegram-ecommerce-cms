// WebSocket Connection Diagnostic Script
// Run this in browser console (F12) to diagnose connection issues

console.log('=== WebSocket Diagnostic Tool ===\n');

// 1. Check environment variables
console.log('1. Environment Variables:');
console.log('   VITE_API_URL:', import.meta?.env?.VITE_API_URL || 'NOT DEFINED');
console.log('   VITE_SOCKET_URL:', import.meta?.env?.VITE_SOCKET_URL || 'NOT DEFINED');
console.log('   VITE_NODE_ENV:', import.meta?.env?.VITE_NODE_ENV || 'NOT DEFINED');

// 2. Check current URL
console.log('\n2. Current Page:');
console.log('   Location:', window.location.href);
console.log('   Protocol:', window.location.protocol);
console.log('   Host:', window.location.host);

// 3. Check network status
console.log('\n3. Network Status:');
console.log('   Online:', navigator.onLine);
console.log('   User Agent:', navigator.userAgent);

// 4. Test backend health
console.log('\n4. Testing Backend Connection...');
const apiUrl = import.meta?.env?.VITE_API_URL || 'http://82.147.84.78:3001';
fetch(`${apiUrl}/health`)
  .then(res => res.json())
  .then(data => {
    console.log('   ✅ Backend is reachable:', data);
  })
  .catch(err => {
    console.error('   ❌ Backend connection failed:', err.message);
  });

// 5. Test Socket.IO connection manually
console.log('\n5. Testing Socket.IO Connection...');
const socketUrl = import.meta?.env?.VITE_SOCKET_URL || import.meta?.env?.VITE_API_URL || 'http://82.147.84.78:3001';
console.log('   Attempting to connect to:', socketUrl);

// Check if socket.io-client is available
if (typeof io !== 'undefined') {
  const testSocket = io(socketUrl, {
    transports: ['polling', 'websocket'],
    reconnection: false,
    timeout: 5000
  });

  testSocket.on('connect', () => {
    console.log('   ✅ Socket.IO connected successfully!');
    console.log('   Socket ID:', testSocket.id);
    console.log('   Transport:', testSocket.io.engine.transport.name);
    testSocket.disconnect();
  });

  testSocket.on('connect_error', (error) => {
    console.error('   ❌ Socket.IO connection error:', error.message);
    console.error('   Error details:', error);
  });

  testSocket.on('error', (error) => {
    console.error('   ❌ Socket.IO error:', error);
  });
} else {
  console.log('   ⚠️  socket.io-client not loaded in global scope');
  console.log('   This is normal for module-based apps');
}

// 6. Check localStorage
console.log('\n6. LocalStorage:');
console.log('   Auth Token:', localStorage.getItem('token') ? 'EXISTS' : 'NOT FOUND');
console.log('   Notifications Enabled:', localStorage.getItem('notifications_enabled'));
console.log('   Sound Enabled:', localStorage.getItem('notification_sound'));

console.log('\n=== Diagnostic Complete ===');
console.log('Copy this output and share with developer for analysis');
