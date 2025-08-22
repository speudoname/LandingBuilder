require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const Anthropic = require('@anthropic-ai/sdk');
// Conditionally import Vercel Blob if we have the token
const hasBlob = process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
let blobStorage = null;
if (hasBlob) {
  blobStorage = require('@vercel/blob');
}

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));
app.use('/pages', express.static('generated-pages'));

// Generate a new landing page and save to Blob Storage
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
    
    // Save to Vercel Blob Storage (for preview and cloud access)
    const blob = await put(`pages/${fileName}`, htmlContent, {
      access: 'public',
      contentType: 'text/html',
      addRandomSuffix: false,
    });

    // Also save metadata
    const metadataBlob = await put(`metadata/${sanitizedPageName}.json`, JSON.stringify({
      name: sanitizedPageName,
      title: pageName,
      instructions: instructions,
      createdAt: new Date().toISOString(),
      published: false,
      blobUrl: blob.url
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
    });
    
    res.json({ 
      success: true, 
      fileName: fileName,
      previewUrl: blob.url,
      pageName: sanitizedPageName,
      message: 'Page generated successfully! You can preview it now.'
    });

  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).json({ 
      error: 'Failed to generate page', 
      details: error.message 
    });
  }
});

// List all pages from Blob Storage
app.get('/api/list-pages', async (req, res) => {
  try {
    // List all metadata files
    const { blobs } = await list({
      prefix: 'metadata/',
      limit: 100
    });

    const pages = await Promise.all(blobs.map(async (blob) => {
      try {
        const response = await fetch(blob.url);
        const metadata = await response.json();
        return {
          name: metadata.name,
          title: metadata.title,
          fileName: `${metadata.name}.html`,
          previewUrl: metadata.blobUrl,
          created: metadata.createdAt,
          published: metadata.published || false
        };
      } catch (error) {
        console.error('Error reading metadata:', error);
        return null;
      }
    }));

    // Filter out any null values from errors
    const validPages = pages.filter(page => page !== null);
    
    res.json({ pages: validPages });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

// Publish a page (from Blob to GitHub)
app.post('/api/publish-page/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    // Get the HTML from Blob Storage
    const htmlBlobUrl = `https://blob.vercel-storage.com/pages/${pageName}.html`;
    const response = await fetch(htmlBlobUrl);
    
    if (!response.ok) {
      throw new Error('Page not found in blob storage');
    }
    
    const htmlContent = await response.text();
    
    // Save to local generated-pages folder
    const filePath = path.join(__dirname, 'generated-pages', `${pageName}.html`);
    await fs.writeFile(filePath, htmlContent, 'utf-8');
    
    // Git operations to publish
    try {
      await execAsync('git add generated-pages/*');
      await execAsync(`git commit -m "Publish landing page: ${pageName}"`);
      await execAsync('git push origin main');
      
      // Update metadata to mark as published
      const metadataUrl = `https://blob.vercel-storage.com/metadata/${pageName}.json`;
      const metaResponse = await fetch(metadataUrl);
      const metadata = await metaResponse.json();
      
      metadata.published = true;
      metadata.publishedAt = new Date().toISOString();
      
      await put(`metadata/${pageName}.json`, JSON.stringify(metadata), {
        access: 'public',
        contentType: 'application/json',
        addRandomSuffix: false,
      });
      
      res.json({ 
        success: true, 
        message: 'Page published successfully! It will be live in 1-2 minutes.',
        liveUrl: `/pages/${pageName}.html`
      });
      
    } catch (gitError) {
      console.error('Git error:', gitError);
      res.status(500).json({ 
        error: 'Failed to publish page', 
        details: 'Git operation failed. Make sure you have git configured.'
      });
    }
    
  } catch (error) {
    console.error('Error publishing page:', error);
    res.status(500).json({ 
      error: 'Failed to publish page', 
      details: error.message 
    });
  }
});

// Delete a page from Blob Storage
app.delete('/api/delete-page/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    // Delete HTML from blob
    await del(`https://blob.vercel-storage.com/pages/${pageName}.html`);
    
    // Delete metadata from blob
    await del(`https://blob.vercel-storage.com/metadata/${pageName}.json`);
    
    // If published, also delete from git
    const metadataUrl = `https://blob.vercel-storage.com/metadata/${pageName}.json`;
    try {
      const response = await fetch(metadataUrl);
      const metadata = await response.json();
      
      if (metadata.published) {
        const filePath = path.join(__dirname, 'generated-pages', `${pageName}.html`);
        await fs.unlink(filePath).catch(() => {}); // Ignore if file doesn't exist
        
        await execAsync('git add generated-pages/*');
        await execAsync(`git commit -m "Delete landing page: ${pageName}"`);
        await execAsync('git push origin main');
      }
    } catch (error) {
      // Page might not be published, that's ok
    }
    
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Preview a page directly from Blob Storage
app.get('/api/preview/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    const blobUrl = `https://blob.vercel-storage.com/pages/${pageName}.html`;
    
    const response = await fetch(blobUrl);
    if (!response.ok) {
      return res.status(404).send('Page not found');
    }
    
    const htmlContent = await response.text();
    res.send(htmlContent);
    
  } catch (error) {
    console.error('Error previewing page:', error);
    res.status(500).send('Error loading preview');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Blob Storage enabled - pages accessible from any device!`);
  console.log(`Preview pages before publishing to production.`);
});