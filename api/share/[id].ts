import { app } from '../../server';

export default function handler(req, res) {
  // Ensure the ID from the URL is available to Express
  const { id } = req.query;
  if (id && !req.params) {
    req.params = { id };
  }
  return app(req, res);
}
