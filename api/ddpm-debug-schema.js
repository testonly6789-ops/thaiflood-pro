const RESOURCES = [
  { year: 2562, id: '8c477d58-3ae9-436f-9e3d-f7d302fe8197' },
  { year: 2563, id: '27e81e82-7cdc-4fe9-94b9-f3ca193c2328' },
  { year: 2564, id: 'beb61961-ded4-447d-a348-8a39623e95d4' },
  { year: 2565, id: 'bc36c686-79f3-4574-a654-54cf0ef00d82' },
  { year: 2566, id: 'af2370d1-d2d0-4844-a16d-e6af34926e71' },
  { year: 2567, id: 'dde2eddc-28f5-40bf-8a62-28bc68f02af8' },
  { year: 2568, id: '9eae087c-8931-4a74-9968-200cdb3d2fb3' },
];
const API = 'https://catalog.disaster.go.th/api/3/action/datastore_search';
async function one(resource) {
  const u = new URL(API);
  u.searchParams.set('resource_id', resource.id);
  u.searchParams.set('limit', '1');
  const r = await fetch(u, { headers: { 'User-Agent': 'ThaiFlood-Intelligence/schema-inspection' } });
  const d = await r.json();
  return { year: resource.year, ok: r.ok && !!d?.success, fields: (d?.result?.fields || []).map(f => f.id), sample: d?.result?.records?.[0] || null };
}
export default async function handler(req, res) {
  try {
    const rows = await Promise.all(RESOURCES.map(one));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
