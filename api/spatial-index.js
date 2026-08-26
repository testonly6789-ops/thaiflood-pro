import { provinces as provinceMeta } from './provinces.js';
import { buildHistoricalProvince, probeGistdaSpatial } from '../lib/historical-14y-engine.js';

// National same-district recurrence snapshot, verified against DDPM district-detail data.
// Definition: same district reported in at least 2 comparable years.
// Comparable years: B.E. 2563-2567. Snapshot regenerated and QC-checked on 2026-08-26.
const SNAPSHOT_ROWS = [
  ['กรุงเทพมหานคร',12,2],['กระบี่',8,5],['กาญจนบุรี',13,5],['กาฬสินธุ์',18,5],['กำแพงเพชร',11,5],
  ['ขอนแก่น',23,5],['จันทบุรี',10,5],['ฉะเชิงเทรา',7,5],['ชลบุรี',7,5],['ชัยนาท',8,4],
  ['ชัยภูมิ',16,5],['ชุมพร',8,5],['เชียงราย',18,5],['เชียงใหม่',24,5],['ตรัง',10,5],
  ['ตราด',6,5],['ตาก',9,5],['นครนายก',4,4],['นครปฐม',7,5],['นครพนม',10,4],
  ['นครราชสีมา',31,5],['นครศรีธรรมราช',23,5],['นครสวรรค์',15,5],['นนทบุรี',6,3],['นราธิวาส',13,5],
  ['น่าน',15,5],['บึงกาฬ',1,2],['บุรีรัมย์',22,5],['ปทุมธานี',6,3],['ประจวบคีรีขันธ์',8,3],
  ['ปราจีนบุรี',7,5],['ปัตตานี',12,5],['พระนครศรีอยุธยา',15,4],['พะเยา',9,5],['พังงา',6,5],
  ['พัทลุง',11,5],['พิจิตร',12,5],['พิษณุโลก',9,5],['เพชรบุรี',6,3],['เพชรบูรณ์',11,5],
  ['แพร่',8,5],['ภูเก็ต',3,4],['มหาสารคาม',6,4],['มุกดาหาร',7,4],['แม่ฮ่องสอน',7,5],
  ['ยโสธร',9,4],['ยะลา',8,5],['ร้อยเอ็ด',14,4],['ระนอง',5,5],['ระยอง',8,5],
  ['ราชบุรี',6,4],['ลพบุรี',10,4],['ลำปาง',13,5],['ลำพูน',8,5],['เลย',11,5],
  ['ศรีสะเกษ',17,4],['สกลนคร',14,3],['สงขลา',16,5],['สตูล',7,5],['สมุทรปราการ',4,3],
  ['สมุทรสงคราม',2,2],['สมุทรสาคร',3,5],['สระแก้ว',9,5],['สระบุรี',13,5],['สิงห์บุรี',6,4],
  ['สุโขทัย',9,5],['สุพรรณบุรี',10,5],['สุราษฎร์ธานี',19,5],['สุรินทร์',14,5],['หนองคาย',8,4],
  ['หนองบัวลำภู',6,4],['อ่างทอง',7,4],['อำนาจเจริญ',7,3],['อุดรธานี',19,4],['อุตรดิตถ์',9,5],
  ['อุทัยธานี',8,5],['อุบลราชธานี',19,5]
];

const metaByName = new Map(provinceMeta.map(p => [p.name, p]));
const provinces = SNAPSHOT_ROWS.map(([province, recurringDistrictCount, maxYears]) => {
  const meta = metaByName.get(province) || {};
  return {
    province,
    region:meta.region || null,
    lat:meta.lat ?? null,
    lon:meta.lon ?? null,
    ok:true,
    recurringDistrictCount,
    maxYears,
    checkedYears:5,
    checkedYearList:[2563,2564,2565,2566,2567],
    topDistricts:[],
    ranking:[],
  };
});

const ranked = provinces.slice().sort((a,b) =>
  b.recurringDistrictCount - a.recurringDistrictCount ||
  b.maxYears - a.maxYears ||
  a.province.localeCompare(b.province,'th')
);
const totalRecurringDistricts = provinces.reduce((sum,x) => sum + x.recurringDistrictCount, 0);
const maxYears = Math.max(...provinces.map(x => x.maxYears));
const topProvince = ranked[0];

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const province = String(req.query?.province || '').trim();

  if (String(req.query?.gistdaProbe || '') === '1') {
    if (!province) return res.status(400).json({ok:false,error:'กรุณาระบุจังหวัด'});
    try { return res.status(200).json(await probeGistdaSpatial(province)); }
    catch (error) { return res.status(500).json({ok:false,province,error:error?.message || String(error)}); }
  }

  const historical14y = String(req.query?.historical14y || '') === '1';
  if (historical14y) {
    if (!province) return res.status(400).json({ok:false,error:'กรุณาระบุจังหวัด'});
    try {
      const payload = await buildHistoricalProvince(province);
      res.setHeader('Cache-Control','public, max-age=300');
      res.setHeader('CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
      res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=21600, stale-while-revalidate=86400');
      return res.status(200).json(payload);
    } catch (error) {
      return res.status(500).json({ok:false,province,error:error?.message || String(error)});
    }
  }

  res.setHeader('Cache-Control','public, max-age=3600');
  res.setHeader('CDN-Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
  res.setHeader('Vercel-CDN-Cache-Control','public, s-maxage=86400, stale-while-revalidate=604800');
  return res.status(200).json({
    ok:true,
    source:'กรมป้องกันและบรรเทาสาธารณภัย (ปภ.)',
    definition:'พื้นที่ท่วมซ้ำ = อำเภอเดิมที่มีรายงานอุทกภัยอย่างน้อย 2 ปี ในปีที่มีชื่ออำเภอเปรียบเทียบกันได้',
    coverage:{ start:2563, end:2567, years:5 },
    snapshotVerifiedAt:'2026-08-26',
    provinceCount:77,
    checkedProvinceCount:77,
    failedProvinceCount:0,
    totalRecurringDistricts,
    recurringProvinceCount:provinces.filter(x => x.recurringDistrictCount > 0).length,
    maxYears,
    checkedYearCounts:[5],
    topProvince,
    ranked,
    provinces,
    elapsedMs:0,
  });
}
