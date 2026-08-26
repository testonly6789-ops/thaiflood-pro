import ddpmHandler from './ddpm-fast-v5.js';

export const config = { maxDuration: 60 };

const AMPHOE_URL = 'https://gistdaportal.gistda.or.th/data/rest/services/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0/query';
const FLOOD_URL = 'https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/flood_freq11_20/MapServer/0/query';
const GISTDA_FIELDS = ['Y_2011','Y_2012','Y_2013','Y_2014','Y_2015','Y_2016','Y2017','Y_2018','Y_2019','Y_2020'];
const FIELD_YEAR = { Y_2011:2011, Y_2012:2012, Y_2013:2013, Y_2014:2014, Y_2015:2015, Y_2016:2016, Y2017:2017, Y_2018:2018, Y_2019:2019, Y_2020:2020 };
const DDPM_BE_TO_CE = {2563:2020,2564:2021,2565:2022,2566:2023,2567:2024};

function normalizeName(value='') {
  return String(value)
    .replace(/^อำเภอ/, '')
    .replace(/^อ\./, '')
    .replace(/\s+/g, '')
    .trim();
}

function escapeSql(value='') {
  return String(value).replace(/'/g, "''");
}

async function postForm(url, params, timeoutMs=18000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams();
    Object.entries(params).forEach(([k,v]) => {
      if (v !== undefined && v !== null) body.set(k, typeof v === 'string' ? v : JSON.stringify(v));
    });
    const response = await fetch(url, {
      method:'POST',
      headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','user-agent':'ThaiFlood-Pro/1.0'},
      body,
      signal:controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data?.error) throw new Error(data.error.message || 'ArcGIS query error');
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function getDistrictBoundaries(province) {
  const data = await postForm(AMPHOE_URL, {
    where:`PV_TN='${escapeSql(province)}'`,
    outFields:'AP_CODE,AP_TN,PV_TN',
    returnGeometry:'true',
    outSR:'3857',
    maxAllowableOffset:'250',
    f:'json',
  });
  const features = Array.isArray(data.features) ? data.features : [];
  return features
    .filter(f => f?.geometry?.rings?.length)
    .map(f => ({
      code:f.attributes?.AP_CODE || null,
      district:f.attributes?.AP_TN || '',
      key:normalizeName(f.attributes?.AP_TN || ''),
      geometry:{rings:f.geometry.rings, spatialReference:{wkid:3857}},
    }))
    .filter(x => x.key);
}

async function queryGistdaDistrict(province, district) {
  const years = new Set();
  let offset = 0;
  let pages = 0;
  let matchedFeatures = 0;
  while (pages < 8) {
    const data = await postForm(FLOOD_URL, {
      where:`PV_TN='${escapeSql(province)}'`,
      geometry:district.geometry,
      geometryType:'esriGeometryPolygon',
      inSR:'3857',
      spatialRel:'esriSpatialRelIntersects',
      outFields:GISTDA_FIELDS.join(','),
      returnGeometry:'false',
      resultOffset:String(offset),
      resultRecordCount:'1000',
      f:'json',
    });
    const features = Array.isArray(data.features) ? data.features : [];
    matchedFeatures += features.length;
    for (const feature of features) {
      const attrs = feature.attributes || {};
      for (const field of GISTDA_FIELDS) {
        if (Number(attrs[field] || 0) > 0) years.add(FIELD_YEAR[field]);
      }
    }
    pages += 1;
    if (features.length < 1000 || data.exceededTransferLimit !== true) break;
    offset += features.length;
  }
  return { years:[...years].sort((a,b)=>a-b), matchedFeatures, pages };
}

function runDdpm(province) {
  return new Promise((resolve, reject) => {
    let statusCode = 200;
    const req = { query:{ province } };
    const res = {
      setHeader(){ return this; },
      status(code){ statusCode=code; return this; },
      json(payload){ resolve({statusCode,payload}); return payload; },
    };
    Promise.resolve(ddpmHandler(req,res)).catch(reject);
  });
}

function buildDdpmDistrictYears(payload) {
  const map = new Map();
  for (const row of payload?.years || []) {
    const ce = DDPM_BE_TO_CE[Number(row.year)];
    if (!ce) continue;
    for (const raw of row.allDistricts || row.districts || []) {
      const key = normalizeName(raw);
      if (!key) continue;
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(ce);
    }
  }
  return map;
}

async function runPool(items, limit, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function one() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      try { out[i] = await worker(items[i], i); }
      catch (error) { out[i] = { error:error?.message || String(error), item:items[i] }; }
    }
  }
  await Promise.all(Array.from({length:Math.min(limit,items.length)}, one));
  return out;
}

function calibrationRow(gYears, dYears) {
  const g = gYears.includes(2020);
  const d = dYears.includes(2020);
  return { gistda2020:g, ddpm2020:d, agree:g===d };
}

export default async function handler(req,res) {
  const started = Date.now();
  const province = String(req.query?.province || '').trim();
  if (!province) return res.status(400).json({ok:false,error:'กรุณาระบุจังหวัด'});

  try {
    const [districts, ddpm] = await Promise.all([getDistrictBoundaries(province), runDdpm(province)]);
    if (!districts.length) throw new Error('ไม่พบขอบเขตอำเภอจาก GISTDA');
    if (ddpm.statusCode !== 200 || !ddpm.payload?.ok) throw new Error(ddpm.payload?.error || 'โหลดข้อมูล ปภ. ไม่สำเร็จ');

    const ddpmMap = buildDdpmDistrictYears(ddpm.payload);
    const gistdaRows = await runPool(districts, 6, async district => {
      const result = await queryGistdaDistrict(province, district);
      return {district:district.district,key:district.key,...result};
    });

    const rows = districts.map((district,index) => {
      const g = gistdaRows[index] || {};
      const gistdaYears = Array.isArray(g.years) ? g.years : [];
      const ddpmYears = [...(ddpmMap.get(district.key) || new Set())].sort((a,b)=>a-b);
      // 2011-2019 from satellite recurrence polygons; 2020-2024 from DDPM district-detail records.
      const combinedYears = [...new Set([
        ...gistdaYears.filter(y => y >= 2011 && y <= 2019),
        ...ddpmYears.filter(y => y >= 2020 && y <= 2024),
      ])].sort((a,b)=>a-b);
      return {
        district:district.district,
        districtCode:district.code,
        years:combinedYears,
        yearCount:combinedYears.length,
        recurring:combinedYears.length >= 2,
        gistdaYears:gistdaYears.filter(y => y >= 2011 && y <= 2020),
        ddpmYears,
        calibration2020:calibrationRow(gistdaYears,ddpmYears),
        gistdaMatchedFeatures:Number(g.matchedFeatures || 0),
        sourceError:g.error || null,
      };
    });

    const usable = rows.filter(x => !x.sourceError);
    const ranking = usable.filter(x => x.recurring)
      .sort((a,b)=>b.yearCount-a.yearCount || a.district.localeCompare(b.district,'th'));
    const cal = usable.map(x=>x.calibration2020);
    const agreements = cal.filter(x=>x.agree).length;
    const bothPositive = cal.filter(x=>x.gistda2020 && x.ddpm2020).length;
    const gistdaPositive = cal.filter(x=>x.gistda2020).length;
    const ddpmPositive = cal.filter(x=>x.ddpm2020).length;
    const unionPositive = cal.filter(x=>x.gistda2020 || x.ddpm2020).length;
    const jaccard = unionPositive ? bothPositive / unionPositive : 1;

    const payload = {
      ok:usable.length === rows.length,
      province,
      coverage:{startCE:2011,endCE:2024,startBE:2554,endBE:2567,years:14},
      definition:'อำเภอท่วมในปีนั้นเมื่อมีหลักฐานพื้นที่น้ำท่วมจาก GISTDA (2554–2562) หรือมีรายงานอุทกภัยระดับอำเภอจาก ปภ. (2563–2567)',
      methodology:{
        gistdaYears:'2554–2562 (2011–2019) จากชั้นพื้นที่น้ำท่วมซ้ำซาก GISTDA ซึ่งมีธงรายปี Y_2011–Y_2020',
        ddpmYears:'2563–2567 (2020–2024) จากข้อมูล ปภ. ระดับอำเภอ',
        bridgeYear:'ปี 2563/2020 มีทั้งสองแหล่ง ใช้เป็นปีตรวจสอบความสอดคล้อง ไม่ได้นับซ้ำ',
        spatialRule:'GISTDA ใช้การตัดกันเชิงพื้นที่ระหว่างขอบเขตอำเภอ GISTDA กับ polygon น้ำท่วม; รุ่นนี้เป็น presence/intersection และต้องผ่าน calibration ก่อนใช้แทนฐานหลักทั้งประเทศ',
      },
      sources:[
        {name:'GISTDA flood recurrence 2011–2020',url:'https://gistdaportal.gistda.or.th/data/rest/services/FL_Flood/flood_freq11_20/MapServer/0'},
        {name:'GISTDA amphoe boundary',url:'https://gistdaportal.gistda.or.th/data/rest/services/L05_AdminBoundary/L05_Amphoe_GISTDA_50k/MapServer/0'},
        {name:'DDPM Open Data dpm-gd027',url:'https://catalog.disaster.go.th/dataset/dpm-gd027'},
      ],
      districtCount:rows.length,
      usableDistrictCount:usable.length,
      recurringDistrictCount:ranking.length,
      maxYears:ranking[0]?.yearCount || 0,
      topDistricts:ranking.slice(0,12).map(x=>({district:x.district,yearCount:x.yearCount,years:x.years})),
      calibration2020:{
        districtCount:cal.length,
        agreementCount:agreements,
        agreementPct:cal.length ? Math.round(agreements/cal.length*1000)/10 : null,
        gistdaPositive,
        ddpmPositive,
        bothPositive,
        jaccardPct:Math.round(jaccard*1000)/10,
      },
      ranking,
      districts:rows,
      elapsedMs:Date.now()-started,
    };

    res.setHeader('Cache-Control','public, max-age=300');
    res.setHeader('CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
    res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(500).json({ok:false,province,error:error?.message || String(error),elapsedMs:Date.now()-started});
  }
}
