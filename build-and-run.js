const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Define paths
const rootDir = __dirname;
const frontendDir = path.join(rootDir, 'frontend');
const backendDir = path.join(rootDir, 'backend');

console.log('🔨 Building the frontend...');
try {
  // Navigate to frontend directory and run build
  process.chdir(frontendDir);
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Frontend build completed successfully!');
} catch (error) {
  console.error('❌ Frontend build failed:', error);
  process.exit(1);
}

console.log('\n🚀 Starting the backend server...');
try {
  // Navigate to backend directory and start server
  process.chdir(backendDir);
  execSync('node index.js', { stdio: 'inherit' });
} catch (error) {
  console.error('❌ Backend server failed to start:', error);
  process.exit(1);
}
