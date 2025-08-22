module.exports = async (req, res) => {
  // Get the page name from the URL
  const { name } = req.query;
  
  if (!name) {
    return res.status(404).send('Page not found');
  }
  
  try {
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(503).send('Blob Storage not configured');
    }
    
    // Fetch the HTML content from Blob Storage
    const blobUrl = `https://blob.vercel-storage.com/pages/${name}.html`;
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Not Found</title>
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; }
            h1 { color: #333; }
            a { color: #667eea; text-decoration: none; }
          </style>
        </head>
        <body>
          <h1>Page Not Found</h1>
          <p>The page "${name}" does not exist.</p>
          <a href="/">← Back to Builder</a>
        </body>
        </html>
      `);
    }
    
    const htmlContent = await response.text();
    
    // Serve the HTML content directly (not as download)
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.status(200).send(htmlContent);
    
  } catch (error) {
    console.error('Error serving page:', error);
    res.status(500).send('Error loading page');
  }
};