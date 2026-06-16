// Generates config.js with Supabase credentials from environment variables.
// Runs at Vercel build time (and locally via: node build.js)
const fs = require('fs');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('[build] Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set');
}

const content = `window.__SUPABASE_URL__ = ${JSON.stringify(url)};\nwindow.__SUPABASE_ANON_KEY__ = ${JSON.stringify(key)};\n`;

fs.writeFileSync('config.js', content);
console.log('[build] config.js generated');
