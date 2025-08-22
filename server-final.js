require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const Anthropic = require('@anthropic-ai/sdk');

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

// Ensure generated-pages directory exists
async function ensureGeneratedPagesDir() {
  const dir = path.join(__dirname, 'generated-pages');
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

// Generate a new landing page
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
    
    // Save to drafts folder (not published yet)
    await ensureGeneratedPagesDir();
    const draftPath = path.join(__dirname, 'drafts', fileName);
    
    // Ensure drafts directory exists
    await fs.mkdir(path.join(__dirname, 'drafts'), { recursive: true });
    await fs.writeFile(draftPath, htmlContent, 'utf-8');
    
    // Save metadata
    const metadataPath = path.join(__dirname, 'drafts', `${sanitizedPageName}.json`);
    await fs.writeFile(metadataPath, JSON.stringify({
      name: sanitizedPageName,
      title: pageName,
      instructions: instructions,
      createdAt: new Date().toISOString(),
      published: false,
      fileName: fileName
    }), 'utf-8');
    
    res.json({ 
      success: true, 
      fileName: fileName,
      pageName: sanitizedPageName,
      message: 'Page generated successfully! Preview it before publishing.'
    });

  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).json({ 
      error: 'Failed to generate page', 
      details: error.message 
    });
  }
});

// List all pages (drafts and published)
app.get('/api/list-pages', async (req, res) => {
  try {
    const pages = [];
    
    // List drafts
    try {
      const draftFiles = await fs.readdir(path.join(__dirname, 'drafts'));
      const jsonFiles = draftFiles.filter(f => f.endsWith('.json'));
      
      for (const file of jsonFiles) {
        const metadataPath = path.join(__dirname, 'drafts', file);
        const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
        pages.push({
          ...metadata,
          isDraft: true
        });
      }
    } catch (error) {
      // Drafts folder might not exist yet
    }
    
    // List published pages
    await ensureGeneratedPagesDir();
    const publishedFiles = await fs.readdir(path.join(__dirname, 'generated-pages'));
    const publishedHtmlFiles = publishedFiles.filter(f => f.endsWith('.html'));
    
    for (const file of publishedHtmlFiles) {
      const name = file.replace('.html', '');
      // Check if already in drafts
      const isDraft = pages.find(p => p.fileName === file);
      if (!isDraft) {
        const filePath = path.join(__dirname, 'generated-pages', file);
        const stats = await fs.stat(filePath);
        pages.push({
          name: name,
          title: name,
          fileName: file,
          createdAt: stats.birthtime.toISOString(),
          published: true,
          isDraft: false
        });
      } else {
        // Mark as published in the draft metadata
        const draftIndex = pages.findIndex(p => p.fileName === file);
        if (draftIndex !== -1) {
          pages[draftIndex].published = true;
        }
      }
    }
    
    res.json({ pages });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

// Preview a draft page
app.get('/api/preview/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    const draftPath = path.join(__dirname, 'drafts', `${pageName}.html`);
    
    const htmlContent = await fs.readFile(draftPath, 'utf-8');
    res.send(htmlContent);
    
  } catch (error) {
    console.error('Error previewing page:', error);
    res.status(404).send('Page not found');
  }
});

// Publish a page (from drafts to generated-pages and git)
app.post('/api/publish-page/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    // Get the HTML from drafts
    const draftPath = path.join(__dirname, 'drafts', `${pageName}.html`);
    const htmlContent = await fs.readFile(draftPath, 'utf-8');
    
    // Save to generated-pages folder
    await ensureGeneratedPagesDir();
    const publishPath = path.join(__dirname, 'generated-pages', `${pageName}.html`);
    await fs.writeFile(publishPath, htmlContent, 'utf-8');
    
    // Update metadata
    const metadataPath = path.join(__dirname, 'drafts', `${pageName}.json`);
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      metadata.published = true;
      metadata.publishedAt = new Date().toISOString();
      await fs.writeFile(metadataPath, JSON.stringify(metadata), 'utf-8');
    } catch (error) {
      // Metadata might not exist for older pages
    }
    
    // Git operations to publish
    try {
      await execAsync('git add generated-pages/*');
      await execAsync(`git commit -m "Publish landing page: ${pageName}"`);
      await execAsync('git push origin main');
      
      res.json({ 
        success: true, 
        message: 'Page published successfully! Vercel will deploy it in 1-2 minutes.',
        liveUrl: `/pages/${pageName}.html`
      });
      
    } catch (gitError) {
      // If git fails, still report success since file is saved
      console.error('Git push failed:', gitError);
      res.json({ 
        success: true, 
        message: 'Page saved locally. Manual git push needed for Vercel deployment.',
        liveUrl: `/pages/${pageName}.html`,
        warning: 'Git push failed - you may need to push manually'
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

// Delete a page
app.delete('/api/delete-page/:pageName', async (req, res) => {
  try {
    const { pageName } = req.params;
    
    // Delete from drafts
    try {
      await fs.unlink(path.join(__dirname, 'drafts', `${pageName}.html`));
      await fs.unlink(path.join(__dirname, 'drafts', `${pageName}.json`));
    } catch (error) {
      // Might not exist in drafts
    }
    
    // Delete from published if exists
    try {
      const publishedPath = path.join(__dirname, 'generated-pages', `${pageName}.html`);
      await fs.unlink(publishedPath);
      
      // Commit deletion
      await execAsync('git add generated-pages/*');
      await execAsync(`git commit -m "Delete landing page: ${pageName}"`);
      await execAsync('git push origin main');
    } catch (error) {
      // Might not be published
    }
    
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Pages workflow: Generate (draft) → Preview → Publish (git + Vercel)`);
  console.log(`Draft pages are stored locally and persist across sessions`);
  console.log(`Published pages are committed to git and deployed via Vercel`);
});