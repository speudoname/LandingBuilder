module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const pages = [];
    
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (hasBlob) {
      const { list } = require('@vercel/blob');
      
      // List from Blob Storage
      const { blobs } = await list({
        prefix: 'metadata/',
        limit: 1000
      });

      for (const blob of blobs) {
        try {
          const response = await fetch(blob.url);
          const metadata = await response.json();
          pages.push({
            ...metadata,
            url: `/api/view?page=${metadata.name}`,  // Serve from your domain
            liveUrl: `https://landinger.vercel.app/api/view?page=${metadata.name}`,  // Full URL on your domain
            blobUrl: metadata.pageUrl  // Keep original blob URL
          });
        } catch (error) {
          console.error('Error reading metadata:', error);
        }
      }
      
      // Sort by creation date (newest first)
      pages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    
    res.status(200).json({ 
      pages,
      mode: hasBlob ? 'production' : 'no-blob-storage',
      message: hasBlob ? null : 'Blob Storage not configured. Connect it in Vercel Dashboard > Storage.'
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(200).json({ 
      pages: [],
      mode: 'error',
      message: 'Blob Storage needs to be connected. Visit Vercel Dashboard > Storage to set it up.'
    });
  }
};