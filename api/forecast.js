import { provinces } from './provinces.js';

const riskLevel = (score) => {
  if (score >= 75) return { key: 'critical', label: 'วิกฤต' };
  if (score >= 55) return { key: 'high', label: 'เสี่ยงสูง' };
  if (score >= 30) return { key: 'watch', label: 'เฝ้าระวัง' };
  return { key: 'low', label: 'ปกติ' };
};

const calcRisk = ({ rain24, rain3, probability, maxHourly }) => {
  // ดัชนีคัดกรองเพื่อสื่อสารความเสี่ยงจากฝน ไม่ใช่แบบจำลองอุทกวิทยาทางการ
  const score = Math.round(Math.min(100,
    rain24 * 1.15 +
    rain3 * 0.32 +
    probability * 0.22 +
    maxHourly * 1.8
  ));
  return { score, ...riskLevel(score) };
};

export default async function handler(req, res) {
  try {
    const lats = provinces.map(p => p.lat).join(',');
    const lons = provinces.map(p => p.lon).join(',');
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', lats);
    url.searchParams.set('longitude', lons);
    url.searchParams.set('daily', 'precipitation_sum,precipitation_probability_max,weather_code');
    url.searchParams.set('hourly', 'precipitation');
    url.searchParams.set('timezone', 'Asia/Bangkok');
    url.searchParams.set('forecast_days', '7');

    const r = await fetch(url, { headers: { 'User-Agent': 'ThaiFloodPro/1.0' } });
    if (!r.ok) throw new Error(`Weather upstream ${r.status}`);
    const raw = await r.json();
    const locations = Array.isArray(raw) ? raw : [raw];

    const rows = provinces.map((p, i) => {
      const d = locations[i] || {};
      const daily = d.daily || {};
      const hourly = d.hourly || {};
      const rain = daily.precipitation_sum || [];
      const probs = daily.precipitation_probability_max || [];
      const rain24 = Number(rain[0] || 0);
      const rain3 = Number(rain.slice(0, 3).reduce((a,b) => a + Number(b || 0), 0).toFixed(1));
      const probability = Number(probs[0] || 0);
      const maxHourly = Number(Math.max(0, ...(hourly.precipitation || []).slice(0,24)).toFixed(1));
      const risk = calcRisk({ rain24, rain3, probability, maxHourly });
      return {
        ...p,
        ...risk,
        rain24,
        rain3,
        probability,
        maxHourly,
        dates: daily.time || [],
        sevenDayRain: (rain || []).map(Number),
        sevenDayProb: (probs || []).map(Number),
        weatherCodes: daily.weather_code || []
      };
    });

    rows.sort((a,b) => b.score - a.score);
    const updatedAt = new Date().toISOString();
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json({
      ok: true,
      updatedAt,
      source: 'Open-Meteo',
      methodology: 'Rainfall screening index; not an official flood warning',
      provinces: rows
    });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ ok: false, error: 'ไม่สามารถดึงข้อมูลสภาพอากาศล่าสุดได้', detail: error.message });
  }
}
