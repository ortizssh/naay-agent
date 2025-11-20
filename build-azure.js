// Azure build script for Naay Agent
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Starting Azure build process...');

try {
  // Ensure we're in the right directory
  const projectRoot = __dirname;
  console.log(`📂 Project root: ${projectRoot}`);

  // Install root dependencies
  console.log('📦 Installing root dependencies...');
  execSync('npm install --only=production', { 
    stdio: 'inherit', 
    cwd: projectRoot 
  });

  // Install and build backend
  const backendDir = path.join(projectRoot, 'backend');
  if (fs.existsSync(backendDir)) {
    console.log('📦 Installing backend dependencies...');
    execSync('npm install --only=production', { 
      stdio: 'inherit', 
      cwd: backendDir 
    });

    console.log('🔨 Building backend...');
    execSync('npm run build', { 
      stdio: 'inherit', 
      cwd: backendDir 
    });

    // Verify build output
    const distPath = path.join(backendDir, 'dist', 'index.js');
    if (fs.existsSync(distPath)) {
      console.log('✅ Backend build successful');
    } else {
      throw new Error('❌ Backend build failed - dist/index.js not found');
    }
  }

  // Verify all necessary files exist
  const requiredFiles = [
    'index.js',
    'startup.js', 
    'package.json',
    'backend/dist/index.js',
    'backend/package.json'
  ];

  console.log('🔍 Verifying build artifacts...');
  for (const file of requiredFiles) {
    const filePath = path.join(projectRoot, file);
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${file} exists`);
    } else {
      console.warn(`⚠️ ${file} missing`);
    }
  }

  console.log('🎉 Azure build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}