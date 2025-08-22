# System Architecture - How Landinger Works

## Overview
Landinger is a conversational AI landing page builder that uses the Claude SDK to enable continuous editing through natural language, similar to Claude Code but for web pages.

## Complete Flow

### 1. User Sends Message
- User types instruction in chat: "Add a blue header"
- Frontend (`public/index.html`) captures the message

### 2. Frontend Processing
```javascript
// Context is prepared with current page state
const context = {
  projectName: project.name,
  pageName: page.name,
  pageType: page.type,
  currentContent: page.content,  // Stored HTML from previous edit
  instruction: message
}
```

### 3. API Request
- Frontend sends POST to `/api/generate-page` with:
  - `instructions`: User's message
  - `pageName`: Sanitized page ID (e.g., "landing_page")

### 4. API Fetches Current State
```javascript
// API ALWAYS fetches latest HTML from Blob Storage
const blobUrl = `https://nvldrzv6kcjoahys.public.blob.vercel-storage.com/pages/${pageName}.html`;
const existingContent = await fetch(blobUrl).text();
```

### 5. Claude SDK Processing
```javascript
// Send COMPLETE HTML + instruction to Claude
const prompt = `You are working on an existing HTML page. 
The user wants to make the following change: "${instructions}"

Here is the current HTML page that needs to be modified:
${existingContent}

Apply ONLY the requested change and return the complete HTML.`;

// Claude SDK call (NOT raw API)
const message = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 4096,
  messages: [{ role: 'user', content: prompt }]
});
```

### 6. HTML Extraction
```javascript
// Extract pure HTML from Claude's response
let htmlContent = message.content[0].text;
// Remove "Here is the updated HTML..." text
const docTypeIndex = htmlContent.indexOf('<!DOCTYPE html>');
if (docTypeIndex > 0) {
  htmlContent = htmlContent.substring(docTypeIndex);
}
```

### 7. Save to Blob Storage
```javascript
// Save with overwrite enabled and no caching
await put(`pages/${fileName}`, htmlContent, {
  access: 'public',
  contentType: 'text/html',
  addRandomSuffix: false,  // Keep consistent URLs
  allowOverwrite: true,     // Allow updates
  cacheControlMaxAge: 0     // No caching
});
```

### 8. Return to Frontend
```javascript
// API returns the complete HTML
res.json({
  success: true,
  htmlContent: htmlContent,  // Full HTML for next edit
  liveUrl: `https://landinger.vercel.app/${pageName}.html`
});
```

### 9. Frontend Updates
```javascript
// Store HTML for next modification
page.content = data.htmlContent;

// Refresh preview with cache-busting
setTimeout(() => {
  const refreshUrl = page.liveUrl + '?t=' + Date.now();
  iframe.src = refreshUrl;
}, 2000);  // Wait for Blob propagation
```

### 10. Page Serving
When the iframe loads `/pagename.html`:
- Vercel rewrites to `/api/view?page=pagename`
- `/api/view` fetches from Blob Storage
- Serves with NO CACHE headers:
  ```
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0
  ```

## Key Components

### Claude SDK (NOT API)
- Uses `@anthropic-ai/sdk` npm package
- Direct SDK calls with proper error handling
- Retry logic for overloaded errors (529)

### Context Awareness
- Each edit receives the COMPLETE current HTML
- Claude knows exactly what to modify
- Changes are incremental, not replacements

### Blob Storage
- Instant publishing without Git commits
- `allowOverwrite: true` for updates
- `cacheControlMaxAge: 0` to prevent CDN caching

### No Caching
- API view endpoint: `no-cache` headers
- Preview iframe: Timestamp query parameters
- Blob Storage: Zero cache max age

## Common Issues & Solutions

### Issue: Changes don't appear
**Cause**: Browser caching
**Solution**: We now send `no-cache` headers and use cache-busting timestamps

### Issue: Claude adds explanatory text
**Cause**: Claude's natural response style
**Solution**: Extract only HTML between `<!DOCTYPE` and `</html>`

### Issue: Context lost between edits
**Cause**: Not sending current HTML to Claude
**Solution**: Always fetch from Blob and include in prompt

### Issue: Overwrite errors
**Cause**: Blob Storage protection
**Solution**: Use `allowOverwrite: true`

## Testing the Flow

1. Create a new page: "Create a landing page"
2. Add element: "Add a blue header saying 'Welcome'"
3. Modify element: "Make the header red instead"
4. Add more: "Add a contact form below the header"

Each instruction should modify the existing page, not create a new one.

## Environment Variables
- `ANTHROPIC_API_KEY`: For Claude SDK
- `BLOB_READ_WRITE_TOKEN`: For Vercel Blob Storage

## Important Files
- `/api/generate-page.js`: Main logic for page generation/updates
- `/api/view.js`: Serves pages from Blob Storage
- `/public/index.html`: Chat interface and preview
- `vercel.json`: URL rewrites for clean URLs

## The Experience
Like Claude Code, but for landing pages:
- Continuous conversation with your page
- Each change builds on the previous state
- Claude is aware of the current page content
- Instant preview updates
- No Git commits needed