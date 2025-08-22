# AI Landing Page Builder

An AI-powered landing page builder that uses Claude SDK to generate complete, responsive landing pages based on natural language instructions.

## Features

- 🤖 AI-powered page generation using Claude
- 📝 Natural language instructions input
- 🎨 Modern, responsive designs
- 💾 Automatic saving of generated pages
- 🔍 View and manage all generated pages
- 🗑️ Delete unwanted pages
- 🚀 Instant preview of generated pages

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your Claude API key:**
   - Open the `.env` file
   - Replace `your_api_key_here` with your actual Anthropic API key
   - You can get your API key from: https://console.anthropic.com/account/keys

3. **Start the server:**
   ```bash
   npm start
   ```

4. **Open the app:**
   - Navigate to http://localhost:3000 in your browser

## Usage

1. **Create a Landing Page:**
   - Enter a name for your page (e.g., "my-product-launch")
   - Describe what you want in the instructions field
   - Click "Build New Landing Page"
   - Wait for the AI to generate your page

2. **Example Instructions:**
   - "Create a modern landing page for a fitness app with hero section, features, pricing, and testimonials"
   - "Build a minimalist portfolio page with about section, projects gallery, and contact form"
   - "Design a startup landing page with dark theme, animated hero, and newsletter signup"

3. **View Generated Pages:**
   - All generated pages appear in the list below
   - Click "View" to open in a new tab
   - Click "Delete" to remove unwanted pages

## Project Structure

```
ai-landing-page-builder/
├── server.js             # Express server with API endpoints
├── public/               # Frontend files
│   └── index.html       # Main interface
├── generated-pages/      # Stores all generated HTML pages
├── .env                 # Environment variables (API key)
└── package.json         # Project dependencies
```

## API Endpoints

- `POST /api/generate-page` - Generate a new landing page
- `GET /api/list-pages` - List all generated pages
- `DELETE /api/delete-page/:fileName` - Delete a specific page

## Technologies Used

- **Claude SDK** - AI-powered content generation
- **Express.js** - Backend server
- **Node.js** - Runtime environment
- **HTML/CSS/JavaScript** - Frontend interface

## Tips for Better Results

1. Be specific in your instructions
2. Mention color schemes, layouts, and specific sections
3. Include details about the target audience
4. Specify if you want animations or interactive elements
5. Mention any specific features like forms, galleries, or maps

## Troubleshooting

- **API Key Error:** Make sure your Anthropic API key is correctly set in the `.env` file
- **Generation Failed:** Check that your instructions are clear and the API key has sufficient credits
- **Page Not Loading:** Ensure the server is running on port 3000

## License

MIT