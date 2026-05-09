import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Use POST');

  const { id, file_name, size, content_type, password } = req.body;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Missing Supabase configuration on Vercel" });
  }

  try {
    let password_hash = null;
    if (password) {
      const trimmedPassword = String(password).trim();
      const salt = await bcrypt.genSalt(10);
      password_hash = await bcrypt.hash(trimmedPassword, salt);
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/shares`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
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
      return res.status(500).json({ error: "Database Error", details: err });
    }

    return res.status(201).json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ error: "Internal Server Error", details: e.message });
  }
}
