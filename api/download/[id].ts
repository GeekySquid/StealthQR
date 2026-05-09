import jwt from 'jsonwebtoken';

export default async function handler(req, res) {
  const { id, token } = req.query;
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const JWT_SECRET = process.env.JWT_SECRET || "stealthqr-super-secret-key";

  if (!id) return res.status(400).send("Missing ID");

  try {
    // 1. Fetch share record metadata
    const metaResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/shares?id=eq.${id}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );
    const metaData = await metaResponse.json();
    if (!metaData || metaData.length === 0) return res.status(404).send("File not found");
    const share = metaData[0];

    // 2. Validate token if password protected
    if (share.password_hash) {
      if (!token) return res.status(401).send("Authentication required");
      try {
        const decoded: any = jwt.verify(token as string, JWT_SECRET);
        if (decoded.id !== id) return res.status(403).send("Invalid token scope");
      } catch (err) {
        return res.status(401).send("Session expired or invalid");
      }
    }

    // 3. Proxy the download from Supabase Storage
    const storageResponse = await fetch(
      `${SUPABASE_URL}/storage/v1/object/private_files/${id}`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
      }
    );

    if (!storageResponse.ok) {
       return res.status(storageResponse.status).send("Storage access failed");
    }

    // Pass through headers
    res.setHeader('Content-Type', share.content_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${share.file_name}"`);
    res.setHeader('Content-Length', share.size);

    // Stream the body
    const reader = storageResponse.body?.getReader();
    if (!reader) return res.status(500).send("Unable to stream file");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();

  } catch (e: any) {
    console.error("[Download Error]", e);
    return res.status(500).send("Download failed: " + e.message);
  }
}
