# CLAUDE.md - Important Project Context

## Critical Requirements

### 1. Use Claude SDK, NOT API Calls
**IMPORTANT**: This project uses the `@anthropic-ai/sdk` npm package to interact with Claude, NOT direct API calls.

```javascript
// CORRECT - Using Claude SDK
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const message = await anthropic.messages.create({
  model: 'claude-3-haiku-20240307',
  max_tokens: 4096,
  temperature: 0.7,
  messages: [{ role: 'user', content: prompt }]
});
```

```javascript
// WRONG - Direct API calls (DO NOT USE)
fetch('https://api.anthropic.com/v1/messages', {...})
```

### 2. Working Models  
Models available with the user's API key (tested via SDK):
- ✅ `claude-3-5-haiku-20241022` - **Currently using this** (Claude 3.5 Haiku - latest)
- ✅ `claude-3-haiku-20240307` - (Claude 3 Haiku - older version)

Models NOT available (404 errors):
- ❌ `claude-3-5-sonnet-20241022` - Sonnet models require API plan upgrade
- ❌ `claude-3-opus-20240229` - Opus requires API plan upgrade
- ❌ Claude 4 models - Not yet available in the API

Note: We're using Claude 3.5 Haiku which is significantly better than Claude 3 Haiku for code generation.

### 3. Architecture Overview
- **Frontend**: Interactive chat UI with live preview (public/index.html)
- **Backend**: Vercel serverless functions using Claude SDK
- **Storage**: Vercel Blob Storage for instant publishing
- **Deployment**: Automatic via GitHub integration

### 4. Key Features
1. **Chat-based page building** - Users chat to create and edit pages
2. **Multi-page projects** - Support for funnels with multiple page types
3. **Live preview** - Real-time preview updates as users chat
4. **Instant publishing** - Pages are immediately live at landinger.vercel.app/[pagename].html
5. **No Git commits needed** - Uses Blob Storage, not Git for publishing

### 5. API Endpoints
All endpoints use the Claude SDK internally:
- `/api/generate-page` - Creates/updates pages using Claude SDK
- `/api/view` - Serves pages from Blob Storage
- `/api/list-pages` - Lists all published pages
- `/api/get-page` - Retrieves page content for editing
- `/api/update-page` - Updates existing pages using Claude SDK

### 6. Environment Variables
Required in Vercel:
- `ANTHROPIC_API_KEY` - For Claude SDK
- `BLOB_READ_WRITE_TOKEN` - For Vercel Blob Storage

### 7. Important Notes
- Always test locally at http://localhost:3000
- Deployed at https://landinger.vercel.app
- Pages are served as true HTML files for payment gateway compatibility
- URL rewrites in vercel.json enable clean URLs like /pagename.html

## Development Commands
```bash
# Local development
npm start

# Check deployment
npx vercel ls

# View logs
npx vercel logs [deployment-url]

# Deploy
git push  # Automatic deployment via GitHub integration
```

## Remember
This is an AI landing page builder that uses the Claude SDK to generate pages through natural conversation, similar to how Claude Code works but for web pages.