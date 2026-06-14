// Server-side proxy for the Nova mentor + Peak coach.
// The Anthropic key lives ONLY in the ANTHROPIC_API_KEY environment variable
// (set in Vercel project settings, and in .env for `vercel dev`). The browser
// POSTs a normal Messages API body to /api/mentor — the key never reaches the
// client. CommonJS to match the other api/ functions (no package.json type).
module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  if (req.method !== 'POST') { res.statusCode = 405; res.end('{"error":"POST only"}'); return; }
  const key = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!key) { res.statusCode = 500; res.end('{"error":"ANTHROPIC_API_KEY is not set"}'); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  if (!body || typeof body !== 'object') body = {};
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    res.statusCode = r.status;
    res.end(JSON.stringify(await r.json()));
  } catch (e) {
    res.statusCode = 502;
    res.end(JSON.stringify({ error: (e && e.message) || 'Upstream request failed' }));
  }
};
