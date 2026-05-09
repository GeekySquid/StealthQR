import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { id } = req.query;
  const { password } = req.body;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const JWT_SECRET = process.env.JWT_SECRET || "stealthqr-super-secret-key";

  if (req.method !== 'POST') return res.status(405).send('Use POST');
  if (!id) return res.status(400).json({ error: "Missing ID" });

  try {
    const trimmedPassword = password ? String(password).trim() : "";
    console.log(`[Auth] Checking share: ${id}`);

    // 1. Fetch share record from database
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/shares?id=eq.${id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json"
        },
      }
    );

    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Share not found" });
    }

    const share = data[0];

    // 2. Verify password if required
    if (share.password_hash) {
       if (!trimmedPassword) {
          return res.status(401).json({ error: "Password required" });
       }
       
       const isMatch = await bcrypt.compare(trimmedPassword, share.password_hash);
       console.log(`[Auth] Comparison result: ${isMatch}`);
       
       if (!isMatch) {
          return res.status(401).json({ error: "Invalid password" });
       }
    }

    // 3. Generate session token
    const token = jwt.sign({ id, auth: true }, JWT_SECRET, { expiresIn: '15m' });
    return res.status(200).json({ token });

  } catch (e: any) {
    console.error("[Auth Error]", e);
    return res.status(500).json({ error: "Auth failed", details: e.message });
  }
}
