import { provinces } from './provinces.js';

// Seed data grounded on the user's reference dashboards/screenshots.
// Structure is intentionally richer than V2 so the UI can show province popups,
// year-by-year incident cards, hotspot tags, agricultural loss, and aid data.
// Unknown fields remain null rather than being fabricated.
const seed = {
  'เชียงใหม่': {
    recurrence: 7,
    hotspots: ['ช้างคลาน', 'สารภี'],
    mechanisms: ['น้ำล้นตลิ่ง/น้ำหลาก', 'น้ำท่วมเมืองและทางระบาย', 'น้ำป่า/ดินถล่มในพื้นที่ภูเขา'],
    summary: { maxWaterM: 2.5, damageM: 4500, aidM: 1200, agriRai: null, households: null, cropAidM: null },
    insight: 'มีการบันทึกน้ำท่วมซ้ำ 7 ครั้งในช่วง 11 ปี จึงควรถูกจัดเป็นพื้นที่เฝ้าระวังเชิงประวัติ โดยเฉพาะโซนช้างคลานและสารภีที่มักได้รับผลกระทบซ้ำจากทั้งลำน้ำและข้อจำกัดการระบายน้ำเมือง',
    events: [
      {
        year: 2568,
        severity: 'critical',
        severityLabel: 'วิกฤต',
        areas: 'ช้างคลาน / สารภี / เมืองเชียงใหม่',
        maxWaterM: 2.5,
        damageM: 4500,
        aidM: 1200,
        agriRai: null,
        households: null,
        cropAidM: null,
        crops: 'พื้นที่เมือง ชุมชนริมน้ำ และเกษตรลุ่มต่ำ',
        cause: 'ฝนสะสมต่อเนื่องในลุ่มน้ำปิงซ้อนกับน้ำหลากจากพื้นที่ต้นน้ำ และจุดอ่อนด้านการระบายน้ำในเขตเมือง ทำให้พื้นที่เศรษฐกิจและชุมชนริมน้ำได้รับผลกระทบเด่น',
        impact: 'พื้นที่ชุมชนริมน้ำและโซนเศรษฐกิจเมืองได้รับผลกระทบ ต้องจับตาพื้นที่ช้างคลานและสารภีเป็นพิเศษ',
        note: 'เหตุการณ์ตัวอย่างและตัวเลขสรุปจากแดชบอร์ดอ้างอิงที่ผู้ใช้ส่งมา',
      },
    ],
  },
  'ตาก': {
    recurrence: 5,
    hotspots: ['แม่สอด', 'ริมเมย'],
    mechanisms: ['น้ำป่าไหลหลาก', 'ลำน้ำล้นตลิ่ง', 'พื้นที่ชายแดนและชุมชนริมน้ำ'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'ตากเป็นจังหวัดที่ต้องเฝ้าระวังทั้งมิติชุมชนริมแม่น้ำและน้ำป่าไหลหลากจากพื้นที่ภูเขา โดยเฉพาะแนวแม่สอดและพื้นที่รับน้ำชายแดน',
    events: [],
  },
  'อุบลราชธานี': {
    recurrence: 5,
    hotspots: ['วารินชำราบ', 'เมืองอุบลราชธานี'],
    mechanisms: ['น้ำล้นตลิ่งลุ่มน้ำมูล', 'พื้นที่ลุ่มต่ำรับน้ำ', 'น้ำท่วมเมืองบางช่วง'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'พื้นที่ลุ่มต่ำริมแม่น้ำมูลและเขตชุมชนเมืองบางส่วนมีลักษณะเสี่ยงซ้ำ เมื่อมีฝนต่อเนื่องหรือระดับน้ำท้ายเขื่อนหนุนสูง ความเสี่ยงจะยกระดับเร็ว',
    events: [],
  },
  'พระนครศรีอยุธยา': {
    recurrence: 5,
    hotspots: ['บางบาล', 'เสนา', 'ผักไห่', 'บางปะอิน'],
    mechanisms: ['น้ำล้นตลิ่งเจ้าพระยา', 'พื้นที่เกษตรนอกคันกั้นน้ำ', 'พื้นที่รับน้ำเพื่อชะลอน้ำ', 'ผลกระทบต่อชุมชนริมน้ำ'],
    summary: { damageM: 14000, aidM: 825, agriRai: 558000, households: 143000, cropAidM: 825, maxWaterM: 2.5 },
    insight: 'อยุธยาไม่ใช่ปัญหาฝนอย่างเดียว แต่เป็นจังหวัดที่เสี่ยงเชิงโครงสร้างจากบทบาทพื้นที่รับน้ำและผลของการระบายน้ำผ่านลุ่มเจ้าพระยา จึงต้องดูทั้งคันกั้นน้ำ พื้นที่นอกคัน และทิศทางการผันน้ำควบคู่กัน',
    events: [
      {
        year: 2568,
        severity: 'critical',
        severityLabel: 'วิกฤต',
        areas: 'บางบาล / เสนา / ผักไห่',
        maxWaterM: null,
        damageM: 2900,
        aidM: null,
        agriRai: 125000,
        households: null,
        cropAidM: 190,
        crops: 'ข้าวนาปี/นาปรัง, สวนกล้วย, บ่อเลี้ยงปลา',
        cause: 'การระบายน้ำจากเขื่อนเจ้าพระยาพุ่งสูงราว 2,400 ลบ.ม./วินาที หนุนน้ำเหนือ ทำให้น้ำล้นตลิ่งเข้าท่วมชุมชนนอกคันกั้นน้ำริมแม่น้ำน้อยและแม่น้ำเจ้าพระยา',
        impact: 'ชุมชนนอกคันกั้นน้ำท่วมขังยาวนานกว่า 40 วัน ประชาชนต้องย้ายขึ้นไปอาศัยบนชั้นสองและริมถนน',
        note: 'โครงสร้างการ์ดและตัวเลขอ้างอิงจากภาพตัวอย่างแดชบอร์ดอยุธยา',
      },
      {
        year: 2567,
        severity: 'high',
        severityLabel: 'รุนแรง',
        areas: 'บางบาล / เสนา / ผักไห่',
        maxWaterM: null,
        damageM: 2700,
        aidM: null,
        agriRai: 110000,
        households: null,
        cropAidM: 165,
        crops: 'นาข้าว, พืชผัก',
        cause: 'เขื่อนเจ้าพระยาเร่งระบายน้ำจากมวลน้ำหลากเหนือ ท่วมชุมชนริมแม่น้ำน้อยและคลองบางบาล',
        impact: 'บ้านเรือนใต้ถุนสูงท่วมขัง และนาข้าวในทุ่งบางบาลผันน้ำเข้าชะลอความเร็ว',
        note: 'ข้อมูลเชิงสรุปจากภาพตัวอย่างที่ผู้ใช้ส่งมา',
      },
      {
        year: 2565,
        severity: 'critical',
        severityLabel: 'วิกฤต',
        areas: 'บางบาล / เสนา / ผักไห่ / บางปะอิน',
        maxWaterM: 2.5,
        damageM: 4500,
        aidM: null,
        agriRai: 140000,
        households: 41000,
        cropAidM: 220,
        crops: 'ข้าวนาปรัง, สวนกล้วย, บ่อปลา',
        cause: 'มหาอุทกภัยจากพายุโนรูและการระบายน้ำเขื่อนเจ้าพระยาสูงทะลุ 2,800 ลบ.ม./วินาที ท่วมทุ่งรับน้ำบางบาล เสนา และโบราณสถานในเขตเมืองบางส่วน',
        impact: 'พื้นที่เกษตรนอกคันกั้นน้ำได้รับผลกระทบหนัก ชุมชนบางส่วนต้องใช้เรือสัญจร และกิจกรรมเศรษฐกิจชะลอตัว',
        note: 'เหตุการณ์ตัวอย่างที่แสดงให้เห็นบทบาทของพื้นที่รับน้ำอยุธยา',
      },
      {
        year: 2564,
        severity: 'high',
        severityLabel: 'รุนแรง',
        areas: 'เสนา / ผักไห่ / บางบาล',
        maxWaterM: null,
        damageM: 2100,
        aidM: null,
        agriRai: 98000,
        households: 28000,
        cropAidM: 140,
        crops: 'นาข้าว, พืชผัก',
        cause: 'พายุเตี้ยนหมู่ทำให้ปริมาณน้ำหลากเจ้าพระยาและแม่น้ำน้อยเพิ่มสูง เอ่อล้นท่วมบ้านเรือนใต้ถุนสูงริมแม่น้ำ',
        impact: 'ประชาชนใช้ชีวิตบนเรือและตั้งเพิงพักริมทางหลวงสายอยุธยา-สุพรรณบุรีในบางช่วง',
        note: 'ภาพตัวอย่างแสดงผลกระทบเชิงพื้นที่ชัดเจน จึงนำมาออกแบบฟิลด์รองรับไว้',
      },
      {
        year: 2560,
        severity: 'high',
        severityLabel: 'รุนแรง',
        areas: 'บางบาล / พระนครศรีอยุธยา / เสนา',
        maxWaterM: null,
        damageM: 1800,
        aidM: null,
        agriRai: 85000,
        households: 18000,
        cropAidM: 110,
        crops: 'นาข้าวหอมปทุม',
        cause: 'การผันน้ำเข้าทุ่งรับน้ำ 7 ทุ่งในจังหวัดอยุธยาเพื่อชะลอน้ำเข้ากรุงเทพฯ ทำให้น้ำท่วมขังพื้นที่เกษตรกรรมและชุมชนบางส่วน',
        impact: 'ชุมชนนอกคันกั้นน้ำและพื้นที่เกษตรเสียหายต่อเนื่อง แต่ช่วยลดแรงกดดันต่อพื้นที่ท้ายน้ำ',
        note: 'เหตุการณ์นี้สะท้อนบทบาทอยุธยาในฐานะพื้นที่รับน้ำระดับระบบ',
      },
    ],
  },
  'สุโขทัย': {
    recurrence: 5,
    hotspots: ['กงไกรลาศ', 'ศรีสำโรง', 'เมืองสุโขทัย'],
    mechanisms: ['น้ำล้นตลิ่งแม่น้ำยม', 'พื้นที่ราบลุ่ม', 'คอขวดทางระบายน้ำ'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'สุโขทัยเป็นจังหวัดที่อ่อนไหวต่อภาวะแม่น้ำยมล้นตลิ่งและการระบายผ่านตัวเมือง จึงต้องจับตาทั้งต้นน้ำและคอขวดในพื้นที่ลุ่ม',
    events: [],
  },
  'สงขลา': {
    recurrence: 5,
    hotspots: ['หาดใหญ่'],
    mechanisms: ['น้ำท่วมเมืองฉับพลัน', 'ระบบระบายน้ำไม่ทันฝนหนัก', 'พื้นที่เศรษฐกิจเมืองลุ่มต่ำ'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'สงขลามีทั้งความเสี่ยงเมืองและชุมชนเศรษฐกิจสำคัญ โดยเฉพาะหาดใหญ่ซึ่งไวต่อฝนหนักช่วงสั้นผสมข้อจำกัดระบบระบายน้ำ',
    events: [],
  },
  'นครศรีธรรมราช': {
    recurrence: 5,
    hotspots: ['เชียรใหญ่', 'ปากพนัง'],
    mechanisms: ['น้ำป่าไหลหลาก', 'ฝนหนักต่อเนื่อง', 'พื้นที่ปลายน้ำลุ่มต่ำ'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'นครศรีธรรมราชมีความเสี่ยงจากทั้งน้ำป่าจากเทือกเขาและพื้นที่ปลายน้ำลุ่มต่ำริมปากพนัง จึงต้องวางแผนแบบต้นน้ำถึงปลายน้ำ',
    events: [],
  },
  'พิษณุโลก': {
    recurrence: 4,
    hotspots: ['บางระกำ'],
    mechanisms: ['น้ำล้นตลิ่ง', 'พื้นที่ราบลุ่มแม่น้ำน่าน/ยม', 'ทุ่งรับน้ำบางระกำ'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'พิษณุโลกสัมพันธ์กับพื้นที่รับน้ำบางระกำอย่างชัดเจน จึงควรดูทั้งบทบาทเชิงระบบและผลต่อเกษตรกรรมควบคู่กัน',
    events: [],
  },
  'ปราจีนบุรี': {
    recurrence: 4,
    hotspots: ['กบินทร์บุรี', 'ศรีมหาโพธิ'],
    mechanisms: ['น้ำล้นตลิ่ง', 'พื้นที่ลุ่มต่ำและทางระบาย', 'ผลกระทบภาคอุตสาหกรรมบางส่วน'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'ปราจีนบุรีเป็นพื้นที่ที่ต้องดูทั้งพื้นที่ลุ่มต่ำ แนวทางระบายน้ำ และผลกระทบต่อชุมชนกับกิจกรรมเศรษฐกิจในโซนอุตสาหกรรม',
    events: [],
  },
  'น่าน': {
    recurrence: 3,
    hotspots: ['เมืองน่าน', 'เวียงสา'],
    mechanisms: ['น้ำหลากจากลุ่มน้ำน่าน', 'น้ำท่วมเมือง', 'ผลจากฝนต่อเนื่อง'],
    summary: { damageM: null, aidM: null, agriRai: null, households: null, cropAidM: null, maxWaterM: null },
    insight: 'แม้น่านไม่ใช่จังหวัดความถี่สูงสุดในชุดอ้างอิง แต่เป็นตัวอย่างของจังหวัดที่ต้องซ้อนข้อมูลประวัติกับฝนล่าสุดเพื่อประเมินความเสี่ยงรายวัน',
    events: [],
  },
};

const aliases = {
  'อยุธยา': 'พระนครศรีอยุธยา',
  'หาดใหญ่': 'สงขลา',
  'สงขลา / หาดใหญ่': 'สงขลา',
};

export default function handler(req, res) {
  const rows = provinces.map(p => {
    const h = seed[p.name] || {};
    return {
      ...p,
      recurrence: h.recurrence ?? null,
      yearsWindow: 11,
      hotspots: h.hotspots || [],
      mechanisms: h.mechanisms || [],
      summary: h.summary || {},
      insight: h.insight || null,
      events: h.events || [],
      dataStatus: h.recurrence == null ? 'not-in-reference-snapshot' : 'reference-snapshot',
    };
  });

  const ranked = rows
    .filter(x => x.recurrence != null)
    .sort((a, b) => (b.recurrence - a.recurrence) || a.name.localeCompare(b.name, 'th'));

  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
  res.status(200).json({
    ok: true,
    window: { start: 2558, end: 2568, years: 11 },
    sourceLabel: 'แดชบอร์ดวิเคราะห์อุทกภัยประเทศไทย (2558–2568) ที่ผู้ใช้ให้เป็นต้นแบบ',
    disclaimer: 'ชุดข้อมูลนี้ยึดเฉพาะค่าที่มองเห็นได้จากต้นแบบและภาพอ้างอิงที่ผู้ใช้ส่งมา จึงแสดง null เมื่อไม่มีข้อมูลยืนยัน และไม่เติมศูนย์หรือสร้างตัวเลขขึ้นเอง',
    aliases,
    provinces: rows,
    ranked,
  });
}
