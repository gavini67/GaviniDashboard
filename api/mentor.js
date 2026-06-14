// Server-side proxy for the Nova mentor.
// The Anthropic API key lives ONLY in the ANTHROPIC_API_KEY environment
// variable (set in Vercel project settings, and in .env for `vercel dev`).
// The browser calls /api/mentor — the key never reaches the client.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: { message: 'ANTHROPIC_API_KEY is not set on the server.' } });
  }
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: 'Upstream request failed: ' + (err && err.message) } });
  }
}
