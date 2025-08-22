const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { instructions, pageName } = req.body;
    
    if (!instructions || !pageName) {
      return res.status(400).json({ error: 'Instructions and page name are required' });
    }

    console.log('Generating page with instructions:', instructions);
    
    // Check if page already exists and fetch its content
    let existingContent = null;
    const sanitizedPageName = pageName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const blobUrl = `https://nvldrzv6kcjoahys.public.blob.vercel-storage.com/pages/${sanitizedPageName}.html`;
    
    try {
      const existingResponse = await fetch(blobUrl);
      if (existingResponse.ok) {
        existingContent = await existingResponse.text();
        console.log('Found existing page, will update it');
      }
    } catch (e) {
      console.log('No existing page found, will create new');
    }

    // Build appropriate prompt based on whether page exists
    let prompt;
    if (existingContent) {
      // For updates, send the current HTML and ask for modifications
      prompt = `You are an expert web developer. Update this existing HTML page with the following changes: ${instructions}

Current HTML to modify:
${existingContent}

Important: Return the complete updated HTML page with the requested changes applied. Preserve the existing structure and content while making the requested modifications.

Return ONLY the complete HTML code, nothing else.`;
    } else {
      // For new pages, create from scratch
      prompt = `You are an expert web developer. Create a complete, modern, responsive landing page based on these instructions: ${instructions}
      
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
    }

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
    // sanitizedPageName already declared above
    const fileName = `${sanitizedPageName}.html`;
    
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(200).json({ 
        success: false, 
        error: 'Blob Storage not configured',
        message: '⚠️ Blob Storage needs to be connected in Vercel Dashboard > Storage',
        htmlContent: htmlContent // Still return the generated HTML
      });
    }
    
    // Save to Vercel Blob Storage (with overwrite for updates)
    const { put } = require('@vercel/blob');
    const { url } = await put(`pages/${fileName}`, htmlContent, {
      access: 'public',
      contentType: 'text/html',
      addRandomSuffix: false,  // Use consistent URLs
      cacheControlMaxAge: 0     // No caching for live updates
    });
    
    // Also save metadata
    await put(`metadata/${sanitizedPageName}.json`, JSON.stringify({
      name: sanitizedPageName,
      title: pageName,
      instructions: instructions,
      createdAt: existingContent ? undefined : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pageUrl: url,
      fileName: fileName
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      cacheControlMaxAge: 0
    });
    
    console.log('Page published to:', url);
    
    res.status(200).json({ 
      success: true, 
      fileName: fileName,
      pageName: sanitizedPageName,
      pageUrl: `/${sanitizedPageName}.html`,  // Clean HTML URL
      blobUrl: url,  // Keep blob URL for reference
      liveUrl: `https://landinger.vercel.app/${sanitizedPageName}.html`,  // Clean HTML URL on your domain
      htmlContent: htmlContent,  // Return the HTML for frontend to store
      message: existingContent ? '✨ Page updated successfully!' : '🎉 Page created successfully! It\'s live right now!'
    });

  } catch (error) {
    console.error('Error generating page:', error);
    res.status(500).json({ 
      error: 'Failed to generate page', 
      details: error.message 
    });
  }
};