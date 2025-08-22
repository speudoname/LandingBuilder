# Setting Up Supabase for Persistent Storage

This guide will help you set up Supabase to store your generated landing pages persistently, which works both locally and on Vercel.

## Why Supabase?

- **Free tier** with 500MB database storage
- **Works on Vercel** - persists data across deployments
- **Real database** - PostgreSQL with easy-to-use API
- **No file system needed** - perfect for serverless

## Setup Steps

### 1. Create a Supabase Account

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub or email

### 2. Create a New Project

1. Click "New Project"
2. Enter project details:
   - Name: `landing-builder` (or any name you prefer)
   - Database Password: (save this securely)
   - Region: Choose closest to you
3. Click "Create new project" and wait ~2 minutes

### 3. Create the Pages Table

Once your project is ready:

1. Go to the SQL Editor (left sidebar)
2. Click "New Query"
3. Paste this SQL and run it:

```sql
-- Create pages table
CREATE TABLE pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  html_content TEXT NOT NULL,
  instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create an index for faster queries
CREATE INDEX idx_pages_created_at ON pages(created_at DESC);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations (for simplicity)
CREATE POLICY "Allow all operations" ON pages
  FOR ALL USING (true);
```

### 4. Get Your API Keys

1. Go to Settings → API (left sidebar)
2. Copy these values:
   - **Project URL**: `https://xxxx.supabase.co`
   - **anon public key**: `eyJhbGc...` (long string)

### 5. Update Your .env File

Add these to your `.env` file:

```env
ANTHROPIC_API_KEY=your_existing_key_here
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Update Vercel Environment Variables

1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add:
   - `SUPABASE_URL` - your project URL
   - `SUPABASE_ANON_KEY` - your anon key
   - `ANTHROPIC_API_KEY` - (already set)

### 7. Switch to Database-Backed Server

Update your `package.json` scripts:

```json
"scripts": {
  "start": "node server-with-db.js",
  "start:local": "node server.js",
  "dev": "node server-with-db.js"
}
```

### 8. Update Frontend

The frontend needs small updates to work with the new API structure (IDs instead of filenames).

## How It Works

1. **Page Generation**: When you create a page, it's stored in Supabase database
2. **Page Viewing**: Pages are fetched from database and served
3. **Persistence**: Pages survive server restarts and Vercel redeployments
4. **Scalability**: Can store thousands of pages (500MB free tier)

## Benefits Over File System

| Feature | File System | Supabase Database |
|---------|------------|-------------------|
| Works on Vercel | ❌ | ✅ |
| Persists data | Only locally | ✅ Everywhere |
| Scalable | Limited | ✅ 500MB free |
| Searchable | Basic | ✅ SQL queries |
| Backup | Manual | ✅ Automatic |

## Testing

1. Start the server: `npm start`
2. Create a landing page
3. Stop and restart server
4. Your pages are still there! ✨

## Next Steps

After setting up Supabase:
1. Test locally first
2. Deploy to Vercel
3. All your pages will persist across deployments!