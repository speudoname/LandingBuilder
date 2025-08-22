const { del } = require('@vercel/blob');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pageName = req.query.name || req.url.split('/').pop();
    
    if (!pageName) {
      return res.status(400).json({ error: 'Page name is required' });
    }
    
    // Delete from Blob Storage
    await del([
      `https://blob.vercel-storage.com/pages/${pageName}.html`,
      `https://blob.vercel-storage.com/metadata/${pageName}.json`
    ]);
    
    res.status(200).json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
};