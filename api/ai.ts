import { VercelRequest, VercelResponse } from '@vercel/node';
import app from './index';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // We delegate the request to the Express app which handles everything
  // including the ?action multiplexer we just added.
  return app(req, res);
}
