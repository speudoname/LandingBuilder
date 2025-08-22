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
    const { page } = req.query;
    
    if (!page) {
      return res.status(400).json({ error: 'Page parameter required' });
    }
    
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(503).json({ error: 'Blob Storage not configured' });
    }
    
    // Fetch the HTML content from Blob Storage
    const blobUrl = `https://nvldrzv6kcjoahys.public.blob.vercel-storage.com/pages/${page}.html`;
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const htmlContent = await response.text();
    
    // Also try to get metadata
    let metadata = {};
    try {
      const metaUrl = `https://nvldrzv6kcjoahys.public.blob.vercel-storage.com/metadata/${page}.json`;
      const metaResponse = await fetch(metaUrl);
      if (metaResponse.ok) {
        metadata = await metaResponse.json();
      }
    } catch (e) {
      // Metadata is optional
    }
    
    res.status(200).json({ 
      success: true,
      htmlContent: htmlContent,
      metadata: metadata,
      pageUrl: `/${page}.html`,
      liveUrl: `https://landinger.vercel.app/${page}.html`
    });
    
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ 
      error: 'Failed to fetch page', 
      details: error.message 
    });
  }
};