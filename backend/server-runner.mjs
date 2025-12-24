#!/usr/bin/env node
// Keep process alive and handle graceful shutdown

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nTerminating...');
  process.exit(0);
});

// Import and run the server
import('./server/index.ts').catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Keep process alive
setInterval(() => {}, 1000);
