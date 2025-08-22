require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/pages', express.static('generated-pages'));

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
    const filePath = path.join(__dirname, 'generated-pages', fileName);
    
    await fs.writeFile(filePath, htmlContent, 'utf-8');
    
    res.json({ 
      success: true, 
      fileName: fileName,
      url: `/pages/${fileName}`,
      message: 'Page generated successfully!'
    });

  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).json({ 
      error: 'Failed to generate page', 
      details: error.message 
    });
  }
});

app.get('/api/list-pages', async (req, res) => {
  try {
    const pagesDir = path.join(__dirname, 'generated-pages');
    const files = await fs.readdir(pagesDir);
    const htmlFiles = files.filter(file => file.endsWith('.html'));
    
    const pages = await Promise.all(htmlFiles.map(async (file) => {
      const stats = await fs.stat(path.join(pagesDir, file));
      return {
        name: file,
        url: `/pages/${file}`,
        created: stats.birthtime,
        modified: stats.mtime
      };
    }));
    
    res.json({ pages });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

app.delete('/api/delete-page/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(__dirname, 'generated-pages', fileName);
    
    await fs.unlink(filePath);
    
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`API endpoint: http://localhost:${PORT}/api/generate-page`);
});