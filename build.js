const fs = require('fs');

// .env ファイルを手動で読み込む
if (fs.existsSync('.env')) {
  fs.readFileSync('.env', 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.trim().split('=');
    if (key && rest.length) process.env[key] = rest.join('=');
  });
}

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

if (!url || !key) {
  console.warn('[build] Warning: SUPABASE_URL or SUPABASE_ANON_KEY not set');
}

const content = `window.__SUPABASE_URL__ = ${JSON.stringify(url)};\nwindow.__SUPABASE_ANON_KEY__ = ${JSON.stringify(key)};\n`;

fs.writeFileSync('config.js', content);
console.log('[build] config.js generated');
