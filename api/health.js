module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  const hasBlob = !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN);
  
  res.status(200).json({
    status: 'ok',
    mode: 'production',
    blobConfigured: hasBlob,
    message: hasBlob ? 
      'Vercel Blob Storage is configured - pages publish instantly!' :
      'Blob Storage needs configuration'
  });
};