import { provinces } from './provinces.js';

// Historical recurrence seed built only from facts visible in the reference dashboard supplied by the user.
// Unknown fields are intentionally null rather than invented as zero.
const seed = {
  'เชียงใหม่': { recurrence: 7, hotspots:['ช้างคลาน','สารภี'], mechanisms:['น้ำล้นตลิ่ง/น้ำหลาก','น้ำท่วมเมืองและทางระบาย','น้ำป่า/ดินถล่มในพื้นที่ภูเขา'], events:[
    { year:2568, severity:'critical', maxWaterM:2.5, damageM:4500, aidM:1200, households:null, agriRai:null, cropAidM:null, note:'เหตุการณ์ตัวอย่างที่แสดงในแดชบอร์ดอ้างอิง' }
  ]},
  'ตาก': { recurrence: 5, hotspots:[], mechanisms:['น้ำป่าไหลหลาก','ลำน้ำล้นตลิ่ง'], events:[] },
  'อุบลราชธานี': { recurrence: 5, hotspots:[], mechanisms:['น้ำล้นตลิ่งลุ่มน้ำมูล','พื้นที่ลุ่มต่ำรับน้ำ'], events:[] },
  'พระนครศรีอยุธยา': { recurrence: 5, hotspots:['บางบาล','เสนา'], mechanisms:['น้ำล้นตลิ่งเจ้าพระยา','พื้นที่เกษตรนอกคันกั้นน้ำ'], events:[] },
  'สุโขทัย': { recurrence: 5, hotspots:[], mechanisms:['น้ำล้นตลิ่งแม่น้ำยม','พื้นที่ราบลุ่ม'], events:[] },
  'สงขลา': { recurrence: 5, hotspots:['หาดใหญ่'], mechanisms:['น้ำท่วมเมืองฉับพลัน','ระบบระบายน้ำไม่ทันฝนหนัก'], events:[] },
  'นครศรีธรรมราช': { recurrence: 5, hotspots:[], mechanisms:['น้ำป่าไหลหลาก','ฝนหนักต่อเนื่อง'], events:[] },
  'พิษณุโลก': { recurrence: 4, hotspots:[], mechanisms:['น้ำล้นตลิ่ง','พื้นที่ราบลุ่มแม่น้ำน่าน/ยม'], events:[] },
  'ปราจีนบุรี': { recurrence: 4, hotspots:[], mechanisms:['น้ำล้นตลิ่ง','พื้นที่ลุ่มต่ำและทางระบาย'], events:[] },
};

const aliases = {
  'อยุธยา':'พระนครศรีอยุธยา',
  'สงขลา / หาดใหญ่':'สงขลา'
};

export default function handler(req,res){
  const rows = provinces.map(p => {
    const h = seed[p.name] || {};
    return {
      ...p,
      recurrence: h.recurrence ?? null,
      yearsWindow: 11,
      hotspots: h.hotspots || [],
      mechanisms: h.mechanisms || [],
      events: h.events || [],
      dataStatus: h.recurrence == null ? 'not-in-reference-snapshot' : 'reference-snapshot'
    };
  });
  const ranked = rows.filter(x=>x.recurrence!=null).sort((a,b)=>b.recurrence-a.recurrence || a.name.localeCompare(b.name,'th'));
  res.setHeader('Cache-Control','s-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({
    ok:true,
    window:{start:2558,end:2568,years:11},
    sourceLabel:'แดชบอร์ดวิเคราะห์อุทกภัยประเทศไทย (2558–2568) ที่ผู้ใช้ให้เป็นต้นแบบ',
    disclaimer:'ชุดข้อมูลนี้ยึดเฉพาะค่าที่มองเห็นได้จากต้นแบบ จึงแสดง null เมื่อไม่มีข้อมูลยืนยัน และไม่เติมศูนย์หรือสร้างตัวเลขขึ้นเอง',
    aliases,
    provinces:rows,
    ranked
  });
}
