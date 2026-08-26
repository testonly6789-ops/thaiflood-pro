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
const THAI_DIGITS = { '๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9' };
const latinizeDigits = (s='') => String(s).replace(/[๐-๙]/g, d => THAI_DIGITS[d] || d);
const norm = (s='') => String(s).toLowerCase().replace(/[._()\s'’"-]/g,'');
const num = (v) => {
  if (v == null || v === '' || v === '-' || v === '—') return null;
  const cleaned = latinizeDigits(v).replace(/,/g,'').replace(/[^0-9.+-]/g,'');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};
const cleanName = (v='', prefix) => {
  const value = String(v || '').trim().replace(prefix || /^$/, '');
  return /^\d+$/.test(latinizeDigits(value)) ? '' : value;
};

function findField(fields, preferred = [], patterns = []) {
  const ids = (fields || []).map(f => f.id).filter(Boolean);
  for (const wanted of preferred) {
    const hit = ids.find(id => norm(id) === norm(wanted));
    if (hit) return hit;
  }
  for (const pattern of patterns) {
    const hit = ids.find(id => pattern.test(norm(id)) && !/(code|รหัส)/i.test(id));
    if (hit) return hit;
  }
  return null;
}

function schemaFor(fields) {
  const pick = (preferred, patterns) => findField(fields, preferred, patterns);
  return {
    province: pick(['province_name','prov_name','changwat_name','province','จังหวัด'], [/province.*name/i,/provname/i,/ชื่อจังหวัด/i,/จังหวัด/i]),
    district: pick(['district_name','amphoe_name','amp_name','district','อำเภอ','ชื่ออำเภอ'], [/district.*name/i,/amphoe.*name/i,/ampname/i,/ชื่ออำเภอ/i,/อำเภอ/i]),
    households: pick([], [/households/i,/ครัวเรือน/]),
    population: pick([], [/population/i,/ประชากร/]),
    deaths: pick([], [/deaths?/i,/เสียชีวิต/]),
    missing: pick([], [/missing/i,/สูญหาย/]),
    injured: pick([], [/injured/i,/บาดเจ็บ/]),
    totalDamage: pick([], [/totaldamage/i,/ความเสียหายรวม/i,/มูลค่ารวม/i]),
    agriDamage: pick([], [/agridamage/i,/agriculturaldamage/i,/ความเสียหาย.*เกษตร/i]),
    rice: pick([], [/ricefields/i,/rice/i,/นาข้าว/i,/ข้าว/i]),
    garden: pick([], [/gardencrops/i,/สวน/i]),
    fieldCrop: pick([], [/fieldcrops/i,/พืชไร่/i]),
    relief: pick([], [/reliefbudget/i,/compensation/i,/assistancebudget/i,/งบ.*ช่วยเหลือ/i,/เงิน.*ชดเชย/i,/งบ.*เยียวยา/i]),
    cropComp: pick([], [/cropcompensation/i,/agri(?:cultural)?compensation/i,/(?:เงิน|งบ).*ชดเชย.*(?:เกษตร|พืช)/i,/(?:เกษตร|พืช).*(?:เงิน|งบ).*ชดเชย/i]),
    cause: pick(['cause','disaster_cause','สาเหตุ','สาเหตุการเกิดภัย'], [/cause/i,/สาเหตุ/i]),
  };
}

async function getJson(url, timeout = 5500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'ThaiFlood-Intelligence/5.0' }, signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data?.success) throw new Error('CKAN success=false');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getSchema(resource) {
  const u = new URL(API);
  u.searchParams.set('resource_id', resource.id);
  u.searchParams.set('limit', '1');
  const data = await getJson(u);
  return { fields: data.result?.fields || [], schema: schemaFor(data.result?.fields || []) };
}

function selectedFields(schema) {
  return [...new Set(Object.values(schema).filter(Boolean))];
}

async function fetchRows(resource, province) {
  const { schema } = await getSchema(resource);
  if (!schema.province) return { year: resource.year, ok: false, records: [], total: 0, error: 'province field not found' };

  const makeUrl = (useFilter) => {
    const u = new URL(API);
    u.searchParams.set('resource_id', resource.id);
    u.searchParams.set('limit', '10000');
    u.searchParams.set('offset', '0');
    const fields = selectedFields(schema);
    if (fields.length) u.searchParams.set('fields', fields.join(','));
    if (useFilter) u.searchParams.set('filters', JSON.stringify({ [schema.province]: province }));
    else u.searchParams.set('q', province);
    return u;
  };

  let data = await getJson(makeUrl(true));
  let records = data.result?.records || [];
  if (!records.length) {
    data = await getJson(makeUrl(false));
    records = data.result?.records || [];
  }
  return { year: resource.year, ok: true, records, total: data.result?.total ?? records.length, schema };
}

function value(row, field) { return field ? row[field] : null; }
function sumRows(rows, field) {
  if (!field) return null;
  const vals = rows.map(r => num(value(r, field))).filter(v => v != null);
  return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
}

function aggregate(result, requestedProvince) {
  const { year, records, schema } = result;
  const rows = (records || []).filter(r => {
    const p = cleanName(value(r, schema.province), /^จังหวัด\s*/);
    return p === requestedProvince || p.includes(requestedProvince) || requestedProvince.includes(p);
  });
  if (!rows.length) return null;

  const allDistricts = [...new Set(rows.map(r => cleanName(value(r, schema.district), /^อำเภอ\s*/)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'));
  const causes = [...new Set(rows.map(r => String(value(r, schema.cause) || '').trim()).filter(Boolean))].slice(0, 4);
  const agriParts = [schema.rice, schema.garden, schema.fieldCrop].map(f => sumRows(rows, f)).filter(v => v != null);
  const agriRai = agriParts.length ? agriParts.reduce((a,b)=>a+b,0) : null;
  const totalDamageThb = sumRows(rows, schema.totalDamage);
  const agriDamageThb = sumRows(rows, schema.agriDamage);
  const reliefThb = sumRows(rows, schema.relief);
  const cropCompThb = sumRows(rows, schema.cropComp);

  return {
    year,
    recordCount: rows.length,
    districtCount: allDistricts.length,
    districts: allDistricts.slice(0, 5),
    subdistricts: [],
    affectedAreas: [],
    causes,
    descriptions: [],
    households: sumRows(rows, schema.households),
    population: sumRows(rows, schema.population),
    deaths: sumRows(rows, schema.deaths),
    missing: sumRows(rows, schema.missing),
    injured: sumRows(rows, schema.injured),
    agriRai,
    reliefBudgetThb: reliefThb,
    reliefBudgetM: reliefThb == null ? null : reliefThb / 1_000_000,
    cropCompensationThb: cropCompThb,
    cropCompensationM: cropCompThb == null ? null : cropCompThb / 1_000_000,
    totalDamageThb,
    totalDamageM: totalDamageThb == null ? null : totalDamageThb / 1_000_000,
    agriDamageThb,
    agriDamageM: agriDamageThb == null ? null : agriDamageThb / 1_000_000,
    source: 'DDPM Open Data',
  };
}

export default async function handler(req, res) {
  const province = String(req.query?.province || '').trim();
  if (!province) return res.status(400).json({ ok:false, error:'province is required' });

  const started = Date.now();
  const settled = await Promise.all(RESOURCES.map(async resource => {
    try { return await fetchRows(resource, province); }
    catch (error) { return { year:resource.year, ok:false, records:[], total:0, error:error.message }; }
  }));

  const years = settled.filter(r=>r.ok).map(r=>aggregate(r, province)).filter(Boolean).sort((a,b)=>b.year-a.year);
  const sum = (key) => {
    const vals = years.map(y=>y[key]).filter(v=>v != null);
    return vals.length ? vals.reduce((a,b)=>a+b,0) : null;
  };
  const districtNames = [...new Set(years.flatMap(y=>y.districts || []))].slice(0, 10);
  const districtCount = Math.max(0, ...years.map(y=>Number(y.districtCount || 0)));

  res.setHeader('Cache-Control', 's-maxage=43200, stale-while-revalidate=604800');
  return res.status(200).json({
    ok:true,
    province,
    source:'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.) — CKAN Data API',
    sourceUrl:'https://catalog.disaster.go.th/dataset/dpm-gd027',
    coverage:{ start:2562, end:2568 },
    fetchedAt:new Date().toISOString(),
    elapsedMs:Date.now()-started,
    status:settled.map(r=>({ year:r.year, ok:r.ok, total:r.total || 0, error:r.error || null })),
    summary:{
      officialYearsWithRecords:years.length || null,
      districts:districtNames,
      districtCount:districtCount || null,
      households:sum('households'),
      population:sum('population'),
      deaths:sum('deaths'),
      missing:sum('missing'),
      injured:sum('injured'),
      agriRai:sum('agriRai'),
      totalDamageM:sum('totalDamageM'),
      agriDamageM:sum('agriDamageM'),
      reliefBudgetM:sum('reliefBudgetM'),
      cropCompensationM:sum('cropCompensationM'),
    },
    years,
  });
}
