import baseHandler from './ddpm-fast-v3.js';

const ACRE_TO_RAI = 4046.8564224 / 1600;

function finiteOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function agricultureMeta(year) {
  if (year === 2567 || year === 2568) {
    return { sourceField:'Agriculture (Acres)', sourceUnit:'acre', sourceUnitTh:'เอเคอร์', convertibleToRai:true };
  }
  if (year === 2566) {
    return { sourceField:'Agriculture Damage', sourceUnit:'unspecified', sourceUnitTh:'ต้นทางไม่ระบุหน่วย', convertibleToRai:false };
  }
  if (year === 2562) {
    return { sourceField:'Rice Fields + Garden Crops + Field Crops', sourceUnit:'unspecified', sourceUnitTh:'ต้นทางไม่ระบุหน่วย', convertibleToRai:false };
  }
  return { sourceField:null, sourceUnit:null, sourceUnitTh:null, convertibleToRai:false };
}

function normalizeYear(item) {
  if (!item || !Number.isFinite(Number(item.year))) return item;
  const year = Number(item.year);
  const meta = agricultureMeta(year);
  const raw = finiteOrNull(item.agriSourceValue ?? item.agriRai);
  const agriRai = raw == null || !meta.convertibleToRai ? null : raw * ACRE_TO_RAI;
  return {
    ...item,
    agriSourceValue: raw,
    agriSourceField: meta.sourceField,
    agriSourceUnit: meta.sourceUnit,
    agriSourceUnitTh: meta.sourceUnitTh,
    agriRai,
    agriConversion: meta.convertibleToRai ? { from:'acre', to:'rai', factor:ACRE_TO_RAI } : null,
  };
}

function normalizeAgriculture(payload) {
  if (!payload?.ok) return payload;
  const years = (payload.years || []).map(normalizeYear);
  const provinceSummaryYears = (payload.provinceSummaryYears || []).map(normalizeYear);
  const floodYears = (payload.floodYears || []).map(normalizeYear);
  const all = [...years, ...provinceSummaryYears].sort((a,b) => Number(b.year) - Number(a.year));
  const latestRaw = all.find(y => y.agriSourceValue != null) || null;
  const latestRai = all.find(y => y.agriRai != null) || null;

  return {
    ...payload,
    years,
    provinceSummaryYears,
    floodYears,
    summary: {
      ...(payload.summary || {}),
      // Never sum unlike units across years. This is the latest comparable value only.
      agriRai: latestRai?.agriRai ?? null,
      agriYear: latestRai?.year ?? null,
      agriLatest: latestRaw ? {
        year: latestRaw.year,
        sourceValue: latestRaw.agriSourceValue,
        sourceField: latestRaw.agriSourceField,
        sourceUnit: latestRaw.agriSourceUnit,
        sourceUnitTh: latestRaw.agriSourceUnitTh,
        raiEquivalent: latestRaw.agriRai,
      } : null,
      agriAggregation: 'latest-year-only; never summed across incompatible source units',
    },
    agricultureMethodology: {
      rule:'Preserve source units. Convert only fields explicitly named Agriculture (Acres); never assume units for fields whose DDPM metadata does not specify one.',
      acreToRai:ACRE_TO_RAI,
    },
  };
}

export { normalizeAgriculture, normalizeYear, ACRE_TO_RAI };

export default async function handler(req, res) {
  let statusCode = 200;
  const proxy = {
    status(code) { statusCode = code; return proxy; },
    setHeader(name, value) { res.setHeader(name, value); return proxy; },
    json(payload) { return res.status(statusCode).json(normalizeAgriculture(payload)); },
  };
  return baseHandler(req, proxy);
}
