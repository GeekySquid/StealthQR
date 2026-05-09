import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[Vercel] Missing Supabase Config");
    return res.status(500).json({ 
      error: 'Missing Supabase configuration in Vercel environment variables.',
      details: 'Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Vercel Project Settings.'
    });
  }

  try {
    const { id, file_name, size, content_type, password } = req.body;
    let password_hash = null;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      password_hash = await bcrypt.hash(password, salt);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/shares`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        id,
        file_path: id,
        file_name,
        size,
        content_type,
        password_hash
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Database Error', details: err });
    }

    return res.status(201).json({ success: true });
  } catch (e: any) {
    console.error("[Vercel] Handler Error:", e);
    return res.status(500).json({ error: 'Internal Server Error', details: e.message });
  }
}
