const Anthropic = require('@anthropic-ai/sdk');
const { getBlobUrl } = require('./config/blob');

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

    console.log('=== GENERATE PAGE REQUEST ===');
    console.log('Page Name:', pageName);
    console.log('Instructions:', instructions);
    
    // ALWAYS check if page exists and fetch its content for context
    let existingContent = null;
    const sanitizedPageName = pageName.replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const blobUrl = getBlobUrl(`pages/${sanitizedPageName}.html`);
    
    try {
      const existingResponse = await fetch(blobUrl);
      if (existingResponse.ok) {
        existingContent = await existingResponse.text();
        console.log('Found existing page content, will update it with awareness of current state');
      }
    } catch (e) {
      console.log('No existing page found, will create new');
    }

    // Build appropriate prompt based on whether page exists
    let prompt;
    if (existingContent) {
      // For updates, be very clear about modifying the EXISTING page
      prompt = `You are working on an existing HTML page. The user wants to make the following change: "${instructions}"

Here is the current HTML page that needs to be modified:

${existingContent}

IMPORTANT INSTRUCTIONS:
1. Apply ONLY the requested change: "${instructions}"
2. Keep everything else exactly as it is
3. Do not add explanatory text
4. Do not say "Here is the updated HTML" or similar
5. Return ONLY the complete modified HTML starting with <!DOCTYPE html> and ending with </html>

Apply the change and return the complete HTML.`;
    } else {
      // For new pages, create from scratch
      prompt = `Create a complete HTML page with this requirement: ${instructions}

Requirements:
- Single HTML file with embedded CSS and JavaScript
- Responsive and mobile-friendly
- Modern design with good typography
- Professional appearance
- No explanatory text - just the HTML

Return ONLY the HTML code starting with <!DOCTYPE html> and ending with </html>.`;
    }

    // Try to call Claude with retry logic for overloaded errors
    let message;
    let retries = 3;
    
    while (retries > 0) {
      try {
        message = await anthropic.messages.create({
          model: 'claude-3-5-haiku-20241022',  // Claude 3.5 Haiku - newer and better!
          max_tokens: 8192,
          temperature: 0.7,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        });
        break; // Success, exit retry loop
      } catch (error) {
        if (error.status === 529 && retries > 1) {
          console.log(`Claude API overloaded, retrying in 2 seconds... (${retries - 1} retries left)`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          retries--;
        } else {
          throw error; // Re-throw if not overloaded or no retries left
        }
      }
    }

    // Extract just the HTML from Claude's response
    let htmlContent = message.content[0].text;
    
    // Remove any explanatory text before <!DOCTYPE html>
    const docTypeIndex = htmlContent.indexOf('<!DOCTYPE html>');
    if (docTypeIndex > 0) {
      htmlContent = htmlContent.substring(docTypeIndex);
      console.log('Extracted HTML from response, removed explanatory text');
    }
    
    // Also remove any text after </html>
    const htmlEndIndex = htmlContent.lastIndexOf('</html>');
    if (htmlEndIndex > 0) {
      htmlContent = htmlContent.substring(0, htmlEndIndex + 7);
    }
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
      allowOverwrite: true,     // CRITICAL: Allow updating existing pages
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
      allowOverwrite: true,  // Allow updating metadata too
      cacheControlMaxAge: 0
    });
    
    console.log('=== PAGE SAVED TO BLOB ===');
    console.log('Blob URL:', url);
    console.log('Live URL:', `https://landinger.vercel.app/${sanitizedPageName}.html`);
    console.log('Was Update:', !!existingContent);
    
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