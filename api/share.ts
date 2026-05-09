export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Use POST');

  const { id, file_name, size, content_type, password } = req.body;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(200).json({ error: "Missing Env Vars on Vercel" });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shares`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify({
        id, file_path: id, file_name, size, content_type, password_hash: password // Plain for now
      })
    });

    if (!response.ok) return res.status(200).json({ error: await response.text() });
    return res.status(201).json({ success: true });
  } catch (e) {
    return res.status(200).json({ error: e.message });
  }
}
