
const fs = require('fs');
const path = require('path');

// Copy frontend package.json
if (fs.existsSync('package.frontend.json')) {
  fs.copyFileSync('package.frontend.json', 'package.json');
  console.log('✅ Frontend package.json configured');
}

// Remove server-only directories
const dirsToRemove = ['server', 'shared', 'config', 'uploads'];
dirsToRemove.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
    console.log(`✅ Removed ${dir} directory`);
  }
});

// Remove server-only files
const filesToRemove = [
  '.env',
  'drizzle.config.json',
  'setup-frontend.js',
  'package.frontend.json'
];
filesToRemove.forEach(file => {
  if (fs.existsSync(file)) {
    fs.unlinkSync(file);
    console.log(`✅ Removed ${file}`);
  }
});

// Update .gitignore for frontend-only
const frontendGitignore = `# Dependencies
node_modules/

# Build outputs
dist/
build/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;

fs.writeFileSync('.gitignore', frontendGitignore);
console.log('✅ Updated .gitignore for frontend');

console.log('\n🎉 Frontend setup complete!');
console.log('Run: npm install && npm run dev');
