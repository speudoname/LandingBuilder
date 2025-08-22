const { execSync } = require('child_process');

// Get the project details
const projectInfo = JSON.parse(execSync('npx vercel project ls --json 2>/dev/null || echo "{}"').toString());
console.log('Project info retrieved');

// List available blob stores
try {
  console.log('\nAvailable Blob Stores:');
  execSync('npx vercel blob store ls', { stdio: 'inherit' });
  
  // Get the store ID for landinger-pages store
  const storeId = 'store_M6hrFJBTs52cVjOn'; // landinger-pages store ID
  
  console.log('\nConnecting blob store to project...');
  
  // Note: The Vercel CLI doesn't have a direct command to link stores
  // We need to use the dashboard or create a new store with auto-link
  
  console.log('\nTo complete the connection:');
  console.log('1. Visit: https://vercel.com/levans-projects-84ff839c/landinger/stores');
  console.log('2. Click "Connect Database or Store"');
  console.log('3. Select "Blob" and choose "landinger-pages" store');
  console.log('4. Connect to all environments');
  
} catch (error) {
  console.error('Error:', error.message);
}
