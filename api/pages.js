const { list } = require('@vercel/blob');

module.exports = async (req, res) => {
  try {
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Pages - Landinger</title>
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; }
            h1 { color: #333; }
          </style>
        </head>
        <body>
          <h1>No Pages Yet</h1>
          <p>Blob Storage needs to be configured.</p>
        </body>
        </html>
      `);
    }
    
    // List all pages from metadata
    const { blobs } = await list({
      prefix: 'metadata/',
      limit: 1000
    });

    const pages = [];
    for (const blob of blobs) {
      try {
        const response = await fetch(blob.url);
        const metadata = await response.json();
        pages.push({
          name: metadata.name,
          title: metadata.title,
          url: `/api/view?page=${metadata.name}`,
          created: metadata.createdAt
        });
      } catch (error) {
        console.error('Error reading metadata:', error);
      }
    }
    
    // Sort by date
    pages.sort((a, b) => new Date(b.created) - new Date(a.created));
    
    // Generate HTML page listing
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>All Pages - Landinger</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          h1 {
            color: white;
            text-align: center;
            margin-bottom: 30px;
            font-size: 2.5rem;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
          }
          .pages-grid {
            display: grid;
            gap: 20px;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          }
          .page-card {
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.1);
            transition: transform 0.3s, box-shadow 0.3s;
            text-decoration: none;
            color: inherit;
          }
          .page-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 40px rgba(0,0,0,0.15);
          }
          .page-title {
            font-size: 1.3rem;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
          }
          .page-url {
            color: #667eea;
            font-size: 0.9rem;
            margin-bottom: 10px;
          }
          .page-date {
            color: #999;
            font-size: 0.85rem;
          }
          .empty {
            background: white;
            padding: 60px 20px;
            border-radius: 20px;
            text-align: center;
          }
          .empty h2 {
            color: #666;
            margin-bottom: 20px;
          }
          .create-btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 30px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            transition: transform 0.3s;
          }
          .create-btn:hover {
            transform: translateY(-2px);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚀 Published Pages</h1>
          ${pages.length > 0 ? `
            <div class="pages-grid">
              ${pages.map(page => `
                <a href="${page.url}" class="page-card">
                  <div class="page-title">${page.title}</div>
                  <div class="page-url">/${page.name}</div>
                  <div class="page-date">${new Date(page.created).toLocaleDateString()}</div>
                </a>
              `).join('')}
            </div>
          ` : `
            <div class="empty">
              <h2>No pages published yet</h2>
              <p style="margin-bottom: 20px; color: #666;">Create your first AI-generated landing page!</p>
              <a href="/" class="create-btn">Create Your First Page</a>
            </div>
          `}
        </div>
      </body>
      </html>
    `;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
    
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).send('Error loading pages');
  }
};