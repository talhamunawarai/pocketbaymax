// PocketBaymax local server. No dependencies, needs Node 18 or newer.
// Serves the prototype and forwards Claude requests to the Anthropic API so your API key stays on your machine.
const http = require('http');
const fs = require('fs');
const path = require('path');

// tiny .env loader
try {
  for (const line of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) { /* no .env file, that's fine */ }

const PORT = Number(process.env.PORT) || 3000;
const KEY = process.env.ANTHROPIC_API_KEY;
// PROVIDER=ollama runs a free local model. PROVIDER=anthropic uses the Claude API.
// If PROVIDER is not set: a key means anthropic, no key means ollama.
const PROVIDER = (process.env.PROVIDER || (KEY ? 'anthropic' : 'ollama')).toLowerCase();
const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma3:4b'; // multilingual and can read images

async function ollamaUp() {
  try { const r = await fetch(OLLAMA_URL + '/api/tags', { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch (e) { return false; }
}
const MODELS = {
  quick: process.env.MODEL_QUICK || 'claude-haiku-5-5',
  default: process.env.MODEL_DEFAULT || 'claude-sonnet-5-5',
  complex: process.env.MODEL_COMPLEX || 'claude-opus-5-5',
};

// Only these files are ever served, so .env can never be downloaded.
const FILES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/local-claude.js': ['local-claude.js', 'text/javascript; charset=utf-8'],
  '/doctors.json': ['doctors.json', 'application/json; charset=utf-8'],
};

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Local model through Ollama. Converts our messages (text plus optional image blocks) to Ollama's format.
async function handleOllama(body, res, ac) {
  const messages = body.messages.map(m => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content };
    const text = m.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
    const images = m.content.filter(b => b.type === 'image').map(b => b.source.data);
    return images.length ? { role: m.role, content: text, images } : { role: m.role, content: text };
  });
  let up;
  try {
    up = await fetch(OLLAMA_URL + '/api/chat', {
      method: 'POST', signal: ac.signal, headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: true, options: { temperature: 0.4, num_ctx: 8192 } }),
    });
  } catch (e) {
    return sendJSON(res, 502, { code: 'upstream_error', message: 'Could not reach Ollama at ' + OLLAMA_URL + '. Is it running?' });
  }
  if (!up.ok) {
    const t = await up.text(); let msg = t;
    try { msg = JSON.parse(t).error; } catch (e) {}
    console.error('Ollama error', up.status, msg);
    return sendJSON(res, 502, { code: 'upstream_error', message: String(msg) + (up.status === 404 ? ' Run: ollama pull ' + OLLAMA_MODEL : '') });
  }
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
  const reader = up.body.getReader(), dec = new TextDecoder(); let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line) continue;
        try { const ev = JSON.parse(line); if (ev.message && ev.message.content) res.write(ev.message.content); } catch (e) {}
      }
    }
  } catch (e) { /* client left */ }
  res.end();
}

async function handleClaude(req, res) {
  if (PROVIDER === 'anthropic' && !KEY) return sendJSON(res, 503, { code: 'sampling_disabled', message: 'Set ANTHROPIC_API_KEY in the .env file.' });
  let body;
  try { body = JSON.parse(await readBody(req, 25e6)); }
  catch (e) { return sendJSON(res, 400, { code: 'invalid_request', message: 'Bad request body.' }); }
  if (!Array.isArray(body.messages) || !body.messages.length) return sendJSON(res, 400, { code: 'invalid_request', message: 'No messages.' });

  const ac = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ac.abort(); });
  if (PROVIDER === 'ollama') return handleOllama(body, res, ac);

  let up;
  try {
    up = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: ac.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODELS[body.tier] || MODELS.default, max_tokens: 4096, stream: true, messages: body.messages }),
    });
  } catch (e) {
    return sendJSON(res, 502, { code: 'upstream_error', message: String((e && e.message) || e) });
  }
  if (!up.ok) {
    const t = await up.text(); let msg = t;
    try { msg = JSON.parse(t).error.message; } catch (e) {}
    const code = up.status === 429 ? 'rate_limited' : (up.status === 401 || up.status === 403) ? 'sampling_disabled' : 'upstream_error';
    console.error('Anthropic API error', up.status, msg);
    return sendJSON(res, up.status === 429 ? 429 : 502, { code, message: msg });
  }

  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
  const reader = up.body.getReader(); const dec = new TextDecoder(); let buf = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const d = line.slice(5).trim();
        if (!d || d === '[DONE]') continue;
        try {
          const ev = JSON.parse(d);
          if (ev.type === 'content_block_delta' && ev.delta && ev.delta.type === 'text_delta') res.write(ev.delta.text);
        } catch (e) { /* ignore keep-alive and partial lines */ }
      }
    }
  } catch (e) { /* client left or stream ended early */ }
  res.end();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return sendJSON(res, 200, { ok: PROVIDER === 'ollama' ? await ollamaUp() : !!KEY, provider: PROVIDER });
  if (req.method === 'POST' && url.pathname === '/api/claude') return handleClaude(req, res);
  const entry = req.method === 'GET' && FILES[url.pathname];
  if (!entry) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('Not found'); }
  fs.readFile(path.join(__dirname, entry[0]), (err, data) => {
    if (err) { res.writeHead(500, { 'content-type': 'text/plain' }); return res.end('Could not read ' + entry[0]); }
    res.writeHead(200, { 'content-type': entry[1], 'cache-control': 'no-store' });
    res.end(data);
  });
});

// Bind to localhost only so nobody else on your network can use your API key.
server.listen(PORT, '127.0.0.1', () => {
  console.log('PocketBaymax running at http://localhost:' + PORT);
  if (PROVIDER === 'ollama') {
    console.log('AI: local model "' + OLLAMA_MODEL + '" via Ollama at ' + OLLAMA_URL);
    ollamaUp().then(up => console.log(up ? 'Ollama: running' : 'Ollama: NOT reachable. Install it from https://ollama.com, then run: ollama pull ' + OLLAMA_MODEL));
  } else {
    console.log(KEY ? 'AI: Claude API (key found)' : 'AI: NOT connected. Add ANTHROPIC_API_KEY to .env and restart. The app still works with built-in fallbacks.');
  }
});
