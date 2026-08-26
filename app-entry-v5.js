await import('/app-entry-v4.js?v=20260826-semanticfix1');

function selectedProvinceName() {
  const name = document.querySelector('#selectedName')?.textContent?.trim();
  return name && name !== '—' ? name : null;
}

function selectedRecurrenceRecord() {
  const name = selectedProvinceName();
  return name ? window.__tfRecurrenceIndex?.get(name) : null;
}

function rewriteCompactCountText(el) {
  if (!el) return;
  let text = (el.textContent || '').trim();
  if (!text) return;
  text = text
    .replace(/ท่วมซ้ำ\s*(\d[\d,]*)\s*ปี\s*\/\s*7\s*ปี/g, 'พบข้อมูลอุทกภัย $1/7 ปี')
    .replace(/(\d[\d,]*)\s*ปี\s*\/\s*7\s*ปี/g, 'พบข้อมูล $1/7 ปี')
    .replace(/^(\d[\d,]*)\s*ปี$/g, 'พบข้อมูล $1/7 ปี');
  if (el.textContent !== text) el.textContent = text;
}

function applyUnambiguousFloodSemantics() {
  const rec = selectedRecurrenceRecord();
  if (!rec) return;

  const checked = Number(rec.checkedYears || 7);
  const value = Number(rec.floodYears || 0);
  const years = Array.isArray(rec.floodYearList) ? rec.floodYearList.map(Number) : [];
  const start = 2562;
  const end = 2568;

  const badge = document.querySelector('#recurrenceBadge');
  if (badge) {
    const html = `<small>ข้อมูลอุทกภัยจาก ปภ.</small><strong style="font-size:18px;line-height:1.25">ข้อมูลย้อนหลัง</strong><span>พ.ศ. ${start}–${end} • พบระเบียน ${value}/${checked} ปี</span>`;
    if (badge.innerHTML !== html) badge.innerHTML = html;
    badge.title = 'ตัวเลขนี้คือจำนวนปีที่พบระเบียนอุทกภัยในชุดข้อมูล ปภ. ไม่ใช่จำนวนครั้งที่จังหวัดน้ำท่วม';
  }

  const metric = document.querySelector('#metricRecurrence');
  if (metric) {
    metric.textContent = value;
    const card = metric.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'ปีที่พบระเบียนอุทกภัยในข้อมูล ปภ.';
    if (note) note.textContent = `พบ ${value} จาก ${checked} ปี • ไม่ใช่จำนวนครั้งที่น้ำท่วม`;
  }

  const officialYears = document.querySelector('#officialYears');
  if (officialYears) {
    officialYears.textContent = value;
    const card = officialYears.parentElement;
    const label = card?.querySelector('span');
    const note = card?.querySelector('small');
    if (label) label.textContent = 'ปีที่พบระเบียนอุทกภัย';
    if (note) note.textContent = `จาก ${checked} ปีที่ตรวจสอบ`;
  }

  const insight = document.querySelector('#patternInsight');
  if (insight) {
    const yearText = years.length ? years.join(', ') : 'ไม่พบ';
    insight.textContent = value > 0
      ? `ในชุดข้อมูล ปภ. พบระเบียนอุทกภัยของจังหวัดนี้ ${value} จาก ${checked} ปีที่ตรวจสอบ ได้แก่ พ.ศ. ${yearText} ตัวเลขนี้ใช้บอกความครอบคลุมของปีที่พบข้อมูล ไม่ใช่จำนวนครั้งที่น้ำท่วม และในหนึ่งปีอาจมีหลายเหตุการณ์หรือหลายพื้นที่`
      : `ไม่พบระเบียนอุทกภัยของจังหวัดนี้ในชุดข้อมูล ปภ. ช่วง พ.ศ. ${start}–${end}`;
  }

  const confidenceLabel = document.querySelector('#confidenceLabel');
  const confidenceText = document.querySelector('#confidenceText');
  if (confidenceLabel) confidenceLabel.textContent = 'ความครอบคลุมของข้อมูล ปภ. พ.ศ. 2562–2568';
  if (confidenceText) confidenceText.textContent = 'ตัวเลขสรุปนับจำนวนปีที่พบระเบียนอุทกภัยในฐานข้อมูล ปภ. เท่านั้น ไม่ใช่จำนวนเหตุการณ์ ไม่ใช่จำนวนครั้งที่น้ำท่วม และไม่ควรใช้แทนความถี่ของเหตุการณ์โดยตรง';

  document.querySelectorAll('#yearMatrix .year-cell').forEach(cell => {
    const suffix = Number(cell.querySelector('b')?.textContent);
    const year = Number.isFinite(suffix) ? 2500 + suffix : null;
    const hasRecord = year != null && years.includes(year);
    const span = cell.querySelector('span');
    if (span) span.textContent = hasRecord ? 'พบข้อมูล' : 'ไม่พบข้อมูล';
    if (year != null) cell.title = hasRecord
      ? `พ.ศ. ${year} พบระเบียนอุทกภัยของจังหวัดในชุดข้อมูล ปภ.`
      : `พ.ศ. ${year} ไม่พบระเบียนอุทกภัยของจังหวัดในชุดข้อมูลที่เชื่อมต่อ`;
  });

  document.querySelectorAll('#topProvinceMeta,.hotspot-chip small,.freq-pill,.search-item > span:last-child,.map-popup p')
    .forEach(rewriteCompactCountText);
}

let semanticObserver = null;
let semanticQueued = false;

function queueSemanticFix() {
  if (semanticQueued) return;
  semanticQueued = true;
  requestAnimationFrame(() => {
    semanticQueued = false;
    semanticObserver?.disconnect();
    try { applyUnambiguousFloodSemantics(); }
    finally { semanticObserver?.observe(document.body, { subtree:true, childList:true, characterData:true }); }
  });
}

semanticObserver = new MutationObserver(queueSemanticFix);
semanticObserver.observe(document.body, { subtree:true, childList:true, characterData:true });
setTimeout(queueSemanticFix, 50);
setTimeout(queueSemanticFix, 500);
setTimeout(queueSemanticFix, 1500);
