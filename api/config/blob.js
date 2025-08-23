// Centralized Blob Storage configuration
// This uses the production Blob Store URL that's connected to the project

const BLOB_BASE_URL = process.env.BLOB_STORE_URL || 'https://nvldrzv6kcjoahys.public.blob.vercel-storage.com';

module.exports = {
  getBlobUrl: (path) => {
    return `${BLOB_BASE_URL}/${path}`;
  },
  BLOB_BASE_URL
};