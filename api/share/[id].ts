export default async function handler(req, res) {
  const { id } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!id) return res.status(400).json({ error: "Missing ID" });

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: "Configuration Error: Missing Supabase Env Vars" });
  }

  try {
    // Direct query to Supabase REST API
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

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: "Supabase Error", details: errText });
    }

    const data = await response.json();
    if (!data || data.length === 0) {
      return res.status(404).json({ error: "Share not found in database" });
    }

    // Return the first matching share
    return res.status(200).json(data[0]);
  } catch (e: any) {
    console.error("[Vercel Share ID Error]", e);
    return res.status(500).json({ error: "Internal Server Error", details: e.message });
  }
}
