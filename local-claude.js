// Gives the page the same window.claude.use("sample") interface it has inside claude.ai,
// but backed by the local server (server.js), which calls the Anthropic API.
(function () {
  if (window.claude) return; // already inside claude.ai, nothing to do

  let healthPromise = null;
  const health = () => healthPromise || (healthPromise = fetch('/api/health').then(r => r.json()).catch(() => ({ ok: false })));

  function parseLoose(text) {
    const t = text.trim();
    try { return JSON.parse(t); } catch (e) {}
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) { try { return JSON.parse(fence[1].trim()); } catch (e) {} }
    const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
    if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (e) {} }
    throw new Error('no json');
  }

  async function toJpegBase64(blob) {
    const bmp = await createImageBitmap(blob);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * scale)); c.height = Math.max(1, Math.round(bmp.height * scale));
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.86).split(',')[1];
  }

  async function sample(input, opts) {
    opts = opts || {};
    const raw = typeof input === 'string' ? [{ role: 'user', content: input }] : input;
    const messages = [];
    for (const m of raw) {
      const last = messages[messages.length - 1];
      if (last && last.role === m.role) last.content += '\n\n' + m.content;
      else messages.push({ role: m.role, content: m.content });
    }
    const imgs = opts.images ? (opts.images instanceof Blob ? [opts.images] : Array.from(opts.images)) : [];
    if (imgs.length) {
      let blocks;
      try {
        blocks = await Promise.all(imgs.map(async b => ({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: await toJpegBase64(b) } })));
      } catch (e) { throw { code: 'image_rejected', message: 'Could not read the image.' }; }
      const last = messages[messages.length - 1];
      last.content = blocks.concat([{ type: 'text', text: last.content }]);
    }
    let res;
    try {
      res = await fetch('/api/claude', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: opts.signal,
        body: JSON.stringify({ messages, tier: opts.modelTier || 'default' }),
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelled' };
      throw { code: 'upstream_error', message: String(e) };
    }
    if (!res.ok) {
      let j = {}; try { j = await res.json(); } catch (e) {}
      throw { code: j.code || 'upstream_error', message: j.message || 'HTTP ' + res.status };
    }
    const reader = res.body.getReader(), dec = new TextDecoder(); let text = '';
    try {
      for (;;) {
        const r = await reader.read(); if (r.done) break;
        const delta = dec.decode(r.value, { stream: true }); if (!delta) continue;
        text += delta; if (opts.onText) opts.onText({ text, delta });
      }
    } catch (e) {
      if (e && e.name === 'AbortError') throw { code: 'cancelled', message: 'cancelled', text };
      throw { code: 'upstream_error', message: String(e), text };
    }
    if (!text.trim()) throw { code: 'empty_completion', message: 'No text came back.' };
    return { text, truncated: false, modelTierApplied: opts.modelTier || 'default' };
  }
  sample.json = async function (input, opts) {
    const r = await sample(input, opts);
    try { return parseLoose(r.text); } catch (e) { throw { code: 'invalid_json', message: 'Reply was not valid JSON.', text: r.text }; }
  };
  sample.limits = async function () {
    return { maxPromptBytes: 262144, modelTiers: ['quick', 'default', 'complex'],
      images: { maxCount: 5, maxInputBytes: 20 * 1024 * 1024, mediaTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } };
  };

  window.claude = {
    use: async function (name) {
      if (name !== 'sample') return null;
      const h = await health();
      return h.ok ? sample : null;
    },
  };
})();
