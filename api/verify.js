import generate from './generate.js';
export { config } from './generate.js';

export default async function verify(req, res, dependencies) {
  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return generate(req, res, dependencies); }
  if (body?.phase !== undefined && body.phase !== 'story_verification') {
    return res.status(400).json({ error: 'Fase di verifica non valida.' });
  }
  return generate({ ...req, body: { ...body, phase: 'story_verification' } }, res, dependencies);
}
