module.exports = async (req, res) => {
  // Get the page name from query parameter
  const { page } = req.query;
  
  if (!page) {
    return res.status(404).send('Page parameter required. Use: /api/view?page=your-page-name');
  }
  
  try {
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(503).send('Blob Storage not configured');
    }
    
    // Construct the blob URL
    const blobUrl = `https://nvldrzv6kcjoahys.public.blob.vercel-storage.com/pages/${page}.html`;
    
    // Fetch the HTML content from Blob Storage
    const response = await fetch(blobUrl);
    
    if (!response.ok) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page Not Found</title>
          <style>
            body { 
              font-family: -apple-system, system-ui, sans-serif; 
              text-align: center; 
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              color: #333;
              padding: 40px;
              border-radius: 20px;
              box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            h1 { color: #333; margin-bottom: 20px; }
            a { 
              color: #667eea; 
              text-decoration: none;
              font-weight: 600;
            }
            a:hover { text-decoration: underline; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Page Not Found</h1>
            <p>The page "${page}" does not exist.</p>
            <p style="margin-top: 30px;">
              <a href="/">← Back to Builder</a> | 
              <a href="/api/pages">View All Pages</a>
            </p>
          </div>
        </body>
        </html>
      `);
    }
    
    const htmlContent = await response.text();
    
    // Serve the HTML content directly as a webpage
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.status(200).send(htmlContent);
    
  } catch (error) {
    console.error('Error serving page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body { 
            font-family: system-ui; 
            text-align: center; 
            padding: 50px;
            background: #f5f5f5;
          }
          h1 { color: #e74c3c; }
        </style>
      </head>
      <body>
        <h1>Error Loading Page</h1>
        <p>${error.message}</p>
        <p><a href="/">← Back to Builder</a></p>
      </body>
      </html>
    `);
  }
};