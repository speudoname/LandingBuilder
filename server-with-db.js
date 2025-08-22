require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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
    
    // Store in Supabase database
    const { data, error } = await supabase
      .from('pages')
      .insert([
        {
          name: sanitizedPageName,
          title: pageName,
          html_content: htmlContent,
          instructions: instructions
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    res.json({ 
      success: true, 
      pageId: data.id,
      pageName: sanitizedPageName,
      url: `/page/${data.id}`,
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

// Get a specific page by ID
app.get('/api/page/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Return the HTML content directly
    res.send(data.html_content);
    
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// List all pages
app.get('/api/list-pages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pages')
      .select('id, name, title, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }
    
    const pages = data.map(page => ({
      id: page.id,
      name: page.title,
      fileName: `${page.name}.html`,
      url: `/page/${page.id}`,
      created: page.created_at
    }));
    
    res.json({ pages });
  } catch (error) {
    console.error('Error listing pages:', error);
    res.status(500).json({ error: 'Failed to list pages' });
  }
});

// Delete a page
app.delete('/api/delete-page/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('pages')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
    
    res.json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    console.error('Error deleting page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Serve generated pages
app.get('/page/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('pages')
      .select('html_content')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).send('Page not found');
    }
    
    res.send(data.html_content);
    
  } catch (error) {
    console.error('Error serving page:', error);
    res.status(500).send('Error loading page');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Database-backed version ready for Vercel deployment!`);
});