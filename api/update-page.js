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
    const { pageName, currentContent, instruction, context } = req.body;
    
    if (!pageName || !instruction) {
      return res.status(400).json({ error: 'Page name and instruction are required' });
    }

    // Build the update prompt
    let prompt = `You are an expert web developer. `;
    
    if (currentContent) {
      prompt += `Update this existing HTML page with the following changes: ${instruction}\n\n`;
      prompt += `Current HTML to modify:\n${currentContent}\n\n`;
    } else {
      prompt += `Create a new ${context?.pageType || 'landing'} page with these requirements: ${instruction}\n\n`;
    }
    
    if (context?.otherPages && context.otherPages.length > 0) {
      prompt += `This is part of a funnel/website with these other pages: ${context.otherPages.join(', ')}. `;
      prompt += `Add appropriate navigation or links to these pages where relevant.\n\n`;
    }
    
    prompt += `
    Requirements:
    - Return a complete, valid HTML file
    - Preserve existing functionality while making requested changes
    - Ensure all links and forms work properly
    - Keep the design consistent
    - Make it responsive and professional
    
    Return ONLY the complete HTML code, nothing else.`;

    console.log('Updating page with instruction:', instruction);

    const message = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',  // Claude 3.5 Haiku - newer version!
      max_tokens: 8192,
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
    
    // Check if Blob Storage is configured
    const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
    
    if (!hasBlob) {
      return res.status(200).json({ 
        success: false, 
        error: 'Blob Storage not configured',
        htmlContent: htmlContent
      });
    }
    
    // Update in Vercel Blob Storage
    const { put } = require('@vercel/blob');
    const { url } = await put(`pages/${fileName}`, htmlContent, {
      access: 'public',
      contentType: 'text/html',
      addRandomSuffix: false,
      allowOverwrite: true  // CRITICAL: Allow updating existing pages
    });
    
    // Update metadata
    await put(`metadata/${sanitizedPageName}.json`, JSON.stringify({
      name: sanitizedPageName,
      title: pageName,
      instructions: instruction,
      updatedAt: new Date().toISOString(),
      pageUrl: url,
      fileName: fileName
    }), {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true  // Allow updating metadata too
    });
    
    console.log('Page updated at:', url);
    
    res.status(200).json({ 
      success: true, 
      fileName: fileName,
      pageName: sanitizedPageName,
      pageUrl: `/${sanitizedPageName}.html`,
      blobUrl: url,
      liveUrl: `https://landinger.vercel.app/${sanitizedPageName}.html`,
      htmlContent: htmlContent
    });

  } catch (error) {
    console.error('Error updating page:', error);
    res.status(500).json({ 
      error: 'Failed to update page', 
      details: error.message 
    });
  }
};