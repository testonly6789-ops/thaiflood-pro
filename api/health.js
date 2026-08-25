export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ ok: true, service: 'ThaiFlood Pro', time: new Date().toISOString() });
}
