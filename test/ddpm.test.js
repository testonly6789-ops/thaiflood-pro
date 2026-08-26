import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { aggregateYear, normalizeDistrictName, parseRecord } from '../api/ddpm.js';
import { provinces } from '../api/provinces.js';

test('uses readable administrative names and rejects numeric district codes', () => {
  const record = parseRecord({
    province_code: 10,
    province_name: 'กรุงเทพมหานคร',
    district_code: 25,
    amphoe_name: 'เขตดอนเมือง',
    households: '1,234',
    rice_fields: '50',
    garden_crops: '25',
    cause: 'ฝนตกหนัก',
    incident_description: 'น้ำท่วมชุมชน',
    relief_budget: '2,000,000',
  }, 2568);

  assert.equal(record.province, 'กรุงเทพมหานคร');
  assert.equal(record.district, 'เขตดอนเมือง');
  assert.equal(record.households, 1234);
  assert.equal(record.agriRai, 75);
  assert.equal(record.reliefBudgetThb, 2_000_000);
  assert.equal(normalizeDistrictName('23'), '');
});

test('aggregates only confirmed official values and preserves descriptions', () => {
  const result = aggregateYear([
    { province_name: 'เชียงใหม่', district_name: 'เมืองเชียงใหม่', households: 10, cause: 'น้ำล้นตลิ่ง' },
    { province_name: 'เชียงใหม่', district_name: '25', households: 5, situation: 'น้ำเข้าพื้นที่ลุ่มต่ำ' },
  ], 2568, 'เชียงใหม่');

  assert.deepEqual(result.districts, ['เมืองเชียงใหม่']);
  assert.equal(result.households, 15);
  assert.equal(result.totalDamageM, null);
  assert.deepEqual(result.causes, ['น้ำล้นตลิ่ง']);
  assert.deepEqual(result.descriptions, ['น้ำเข้าพื้นที่ลุ่มต่ำ']);
});

test('DDPM endpoint returns a usable deep-dive response for all 77 provinces', async (t) => {
  assert.equal(provinces.length, 77);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const province = new URL(url).searchParams.get('q');
    return new Response(JSON.stringify({
      success: true,
      result: { total: 1, records: [{ province_name: province, district_code: 25, district_name: 'เมือง', households: 1 }] },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  for (const province of provinces) {
    let payload;
    await handler(
      { query: { province: province.name } },
      {
        setHeader() {},
        status(code) { assert.equal(code, 200); return this; },
        json(value) { payload = value; },
      },
    );
    assert.equal(payload.province, province.name);
    assert.equal(payload.years.length, 7);
    assert.deepEqual(payload.summary.districts, ['เมือง']);
    assert.ok(payload.summary.districts.every(name => !/^\d+$/.test(name)));
  }
});
