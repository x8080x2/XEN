
const fs = require('fs');
const path = require('path');

const filesToSync = [
  {
    src: '../client/src/index.css',
    dest: './client/src/index.css'
  },
  {
    src: '../client/src/components/ui',
    dest: './client/src/components/ui',
    isDir: true
  }
];

function hasFileChanged(srcPath, destPath) {
  if (!fs.existsSync(destPath)) return true;
  
  const srcStats = fs.statSync(srcPath);
  const destStats = fs.statSync(destPath);
  
  return srcStats.mtimeMs > destStats.mtimeMs;
}

function syncFile(src, dest) {
  const srcPath = path.resolve(__dirname, src);
  const destPath = path.resolve(__dirname, dest);
  
  if (!hasFileChanged(srcPath, destPath)) {
    console.log(`⏭️  Skipped (unchanged): ${src}`);
    return;
  }
  
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.copyFileSync(srcPath, destPath);
  console.log(`✅ Synced: ${src} → ${dest}`);
}

function syncDirectory(src, dest) {
  const srcPath = path.resolve(__dirname, src);
  const destPath = path.resolve(__dirname, dest);
  
  if (!fs.existsSync(srcPath)) {
    console.log(`❌ Source not found: ${src}`);
    return;
  }
  
  fs.mkdirSync(destPath, { recursive: true });
  
  const files = fs.readdirSync(srcPath);
  let changed = 0;
  
  files.forEach(file => {
    const srcFile = path.join(srcPath, file);
    const destFile = path.join(destPath, file);
    
    if (fs.statSync(srcFile).isDirectory()) {
      syncDirectory(path.join(src, file), path.join(dest, file));
    } else if (hasFileChanged(srcFile, destFile)) {
      fs.copyFileSync(srcFile, destFile);
      changed++;
    }
  });
  
  console.log(`📁 Synced ${changed} files in: ${src}`);
}

console.log('🔄 Starting sync...\n');

filesToSync.forEach(({ src, dest, isDir }) => {
  if (isDir) {
    syncDirectory(src, dest);
  } else {
    syncFile(src, dest);
  }
});

console.log('\n✨ Sync complete!');
