export default function handler(req, res) {
  res.status(200).json({ 
    status: "Service is online",
    timestamp: new Date().toISOString(),
    node: process.version
  });
}
