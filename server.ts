import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { Readable } from "stream";
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || "stealthqr-super-secret-key";

// Cleanup cron job
function startCleanupJob(supabaseUrl: string, serviceRoleKey: string) {
  // Run every hour
  setInterval(async () => {
    try {
      console.log("[Cleanup] Starting expiration cleanup task");
      // Find shares older than 24 hours
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);
      
      const res = await fetch(`${supabaseUrl}/rest/v1/shares?created_at=lt.${yesterday.toISOString()}&select=id,file_path`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`
        }
      });
      
      if (!res.ok) throw new Error("Failed to fetch old shares");
      
      const expiredShares = await res.json();
      if (!expiredShares || expiredShares.length === 0) {
         console.log("[Cleanup] No expired shares found.");
         return;
      }
      
      console.log(`[Cleanup] Found ${expiredShares.length} expired shares. Deleting...`);
      
      for (const share of expiredShares) {
         // Delete file from storage
         await fetch(`${supabaseUrl}/storage/v1/object/private_files/${share.file_path}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${serviceRoleKey}`
            }
         });
         
         // Delete record from DB
         await fetch(`${supabaseUrl}/rest/v1/shares?id=eq.${share.id}`, {
            method: 'DELETE',
            headers: {
              apikey: serviceRoleKey,
              Authorization: `Bearer ${serviceRoleKey}`
            }
         });
      }
      console.log("[Cleanup] Finished cleanup task successfully.");
    } catch (err) {
      console.error("[Cleanup] Error during auto-cleanup: ", err);
    }
  }, 1000 * 60 * 60); // 1 hour
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Supabase keys
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
     startCleanupJob(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }

  // API Route to Create Share Record securely
  app.post("/api/share", async (req, res) => {
    try {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
         return res.status(500).json({ error: "Missing Supabase configuration" });
      }

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
        return res.status(500).json({ error: err });
      }

      res.status(201).json({ success: true });
    } catch (e: any) {
      console.error("Create share error:", e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Verify password and get temporary token
  app.post("/api/share/:id/auth", async (req, res) => {
     try {
       if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
         return res.status(500).json({ error: "Missing Supabase configuration" });
       }

       const { id } = req.params;
       const { password } = req.body;

       const dbRes = await fetch(`${SUPABASE_URL}/rest/v1/shares?id=eq.${id}&select=password_hash`, {
          headers: {
             apikey: SUPABASE_SERVICE_ROLE_KEY,
             Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
       });

       const data = await dbRes.json();
       if (!data || data.length === 0) {
          return res.status(404).json({ error: "Share not found" });
       }

       const share = data[0];
       if (!share.password_hash) {
          // No password protection needed
          const token = jwt.sign({ id, auth: true }, JWT_SECRET, { expiresIn: '15m' });
          return res.json({ token });
       }

       if (!password) {
          return res.status(401).json({ error: "Password required" });
       }

       const isMatch = await bcrypt.compare(password, share.password_hash);
       if (!isMatch) {
          return res.status(401).json({ error: "Invalid password" });
       }

       const token = jwt.sign({ id, auth: true }, JWT_SECRET, { expiresIn: '15m' });
       res.json({ token });
     } catch (e) {
        console.error("Auth error", e);
        res.status(500).json({ error: "Internal Server Error" });
     }
  });

  // API route for validating UUID and checking share
  app.get("/api/share/:id", async (req, res) => {
    try {
      if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
         return res.status(500).json({ error: "Missing Supabase configuration" });
      }

      const { id } = req.params;
      
      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/shares?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (!data || data.length === 0) {
        return res.status(404).json({ error: "Share not found" });
      }

      const share = data[0];
      res.json(share);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Masking Route handler (Download)
  app.get("/api/download/:id", async (req, res) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).send("Missing Supabase configuration");
    }

    try {
      const { id } = req.params;
      const { token } = req.query; // JWT token
      
      // 1. Fetch share record bypass RLS
      const checkRes = await fetch(
        `${SUPABASE_URL}/rest/v1/shares?id=eq.${id}&select=*`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );

      const shares = await checkRes.json();
      if (!shares || shares.length === 0) {
        return res.status(404).send("File not found or expired.");
      }

      const share = shares[0];
      
      if (share.password_hash) {
         if (!token) {
            return res.status(401).send("Unauthorized: Token required");
         }
         try {
            const decoded: any = jwt.verify(token as string, JWT_SECRET);
            if (decoded.id !== id) {
               return res.status(401).send("Unauthorized: Invalid token subject");
            }
         } catch (err) {
            return res.status(401).send("Unauthorized: Invalid or expired token");
         }
      }

      const filePath = share.file_path;

      
      // 2. Fetch file stream using REST
      // The bucket is "private_files"
      const bucketName = "private_files";
      const fileRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/authenticated/${bucketName}/${filePath}`,
        {
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
        }
      );

      if (!fileRes.ok) {
         return res.status(404).send("File content not found remotely.");
      }

      // Allow CORS for download
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      // Force download headers
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(share.file_name)}"`);
      res.setHeader("Content-Type", share.content_type || "application/octet-stream");
      if (share.size) {
        res.setHeader("Content-Length", share.size.toString());
      }

      // Stream the response to avoid memory bloat
      if (fileRes.body) {
         // @ts-ignore
         Readable.fromWeb(fileRes.body).pipe(res);
      } else {
         res.status(500).send("Empty stream");
      }

    } catch (error) {
       console.error("Masking proxy error:", error);
       res.status(500).send("Internal Server Error while streaming");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
