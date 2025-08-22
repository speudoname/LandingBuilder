require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { put, del, list } = require('@vercel/blob');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Check if we have Blob Storage configured
const hasBlob = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;

// Generate a new landing page and publish instantly to Blob
app.post('/api/generate-page', async (req, res) => {
  try {
    const { instructions, pageName } = req.body;
    
    if (!instructions || !pageName) {
      return res.status(400).json({ error: 'Instructions and page name are required' });
    }

    console.log('Generating page with instructions:', instructions);

    const prompt = `You are an expert web developer. Create a complete, modern, responsive landing page based on these instructions: ${instructions}
    
    Requirements:
    - Create a single HTML file with embedded CSS and JavaScript
    - Make it fully responsive and mobile-friendly
    - Use modern CSS (flexbox, grid, animations)
    - Include semantic HTML5 elements
    - Add smooth scrolling and interactive elements where appropriate
    - Use a professional color scheme and typography
    - Include all necessary meta tags for SEO
    - Add viewport meta tag for mobile responsiveness
    
    Return ONLY the complete HTML code, nothing else. Start with <!DOCTYPE html> and end with </html>.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const htmlContent = message.content[0].text;
    const sanitizedPageName = pageName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const fileName = `${sanitizedPageName}.html`;
    
    let pageUrl;
    let blobUrl;
    
    if (hasBlob) {
      // Production: Save to Vercel Blob Storage
      console.log('Saving to Vercel Blob Storage...');
      
      const { url } = await put(`pages/${fileName}`, htmlContent, {
        access: 'public',
        contentType: 'text/html',
        addRandomSuffix: false,
      });
      
      blobUrl = url;
      pageUrl = url; // Direct blob URL is instantly accessible!
      
      // Also save metadata
      await put(`metadata/${sanitizedPageName}.json`, JSON.stringify({
        name: sanitizedPageName,
        title: pageName,
        instructions: instructions,
        createdAt: new Date().toISOString(),
        pageUrl: url,
        fileName: fileName
      }), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
      
      console.log('Page published to:', url);
      
    } else {
      // Local development: Save to memory/local storage
      console.log('Running locally - page stored in memory');
      // In production, this would fail gracefully
      pageUrl = `/api/preview/${sanitizedPageName}`;
      
      // Store in memory for local testing
      if (!global.pages) global.pages = {};
      global.pages[sanitizedPageName] = {
        html: htmlContent,
        metadata: {
          name: sanitizedPageName,
          title: pageName,
          instructions: instructions,
          createdAt: new Date().toISOString(),
          fileName: fileName
        }
      };
    }
    
    res.json({ 
      success: true, 
      fileName: fileName,
      pageName: sanitizedPageName,
      pageUrl: pageUrl,
      blobUrl: blobUrl,
      message: hasBlob ? 
        '🎉 Page published instantly! It\'s live right now!' : 
        '✅ Page generated! (Local mode - install Vercel Blob for instant publishing)'
    });

  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).json({ 
      error: 'Failed to generate page', 
      details: error.message 
    });
  }
});

// List all pages
app.get('/api/list-pages', async (req, res) => {
  try {
    const pages = [];
    
    if (hasBlob) {
      // Production: List from Blob Storage
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
            url: metadata.pageUrl,
            liveUrl: metadata.pageUrl // It's already live!
          });
        } catch (error) {
          console.error('Error reading metadata:', error);
        }
      }
    } else {
      // Local development: List from memory
      if (global.pages) {
        Object.values(global.pages).forEach(page => {
          pages.push({
            ...page.metadata,
            url: `/api/preview/${page.metadata.name}`,
            liveUrl: null
          });
        });
      }
    }
    
    // Sort by creation date (newest first)
    pages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    res.json({ 
      pages,
      mode: hasBlob ? 'production' : 'local'
    });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

// Preview page (for local development)
app.get('/api/preview/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    if (hasBlob) {
      // In production, redirect to blob URL
      const blobUrl = `https://blob.vercel-storage.com/pages/${pageName}.html`;
      res.redirect(blobUrl);
    } else {
      // Local development: Serve from memory
      if (global.pages && global.pages[pageName]) {
        res.send(global.pages[pageName].html);
      } else {
        res.status(404).send('Page not found');
      }
    }
    
  } catch (error) {
    console.error('Error previewing page:', error);
    res.status(500).send('Error loading preview');
  }
});

// Delete a page
app.delete('/api/delete-page/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    if (hasBlob) {
      // Delete from Blob Storage
      await del([
        `https://blob.vercel-storage.com/pages/${pageName}.html`,
        `https://blob.vercel-storage.com/metadata/${pageName}.json`
      ]);
    } else {
      // Delete from local memory
      if (global.pages) {
        delete global.pages[pageName];
      }
    }
    
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: hasBlob ? 'production' : 'local',
    blobConfigured: hasBlob,
    message: hasBlob ? 
      'Vercel Blob Storage is configured - pages publish instantly!' :
      'Running in local mode - configure Blob Storage for instant publishing'
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server is running on http://localhost:${PORT}`);
  
  if (hasBlob) {
    console.log('✅ Vercel Blob Storage is configured');
    console.log('📡 Pages will be published instantly to the cloud!');
  } else {
    console.log('⚠️  Running in local mode (no Blob Storage token found)');
    console.log('💡 Set up Vercel Blob Storage for instant cloud publishing');
  }
  
  console.log('\n📝 Workflow: Generate → Instant Publish → Live URL');
  console.log('🌍 Every page gets its own public URL immediately!\n');
});