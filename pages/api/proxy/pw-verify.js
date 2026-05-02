const BASE_URL = 'https://apiserver-all.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${BASE_URL}/api/pw/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({ success: false, message: `Upstream error (${response.status}): ${text.slice(0, 200)}` });
    }

    res.status(response.status).json(data);
  } catch (e) {
    if (e.name === 'AbortError') {
      return res.status(504).json({ success: false, message: 'Request timed out. Try again.' });
    }
    res.status(500).json({ success: false, message: e.message });
  }
}
