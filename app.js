const eyebrow=document.querySelector('.hero .eyebrow');
if(eyebrow)eyebrow.textContent='FLOOD PATTERN INTELLIGENCE • ประวัติ 14 ปี พ.ศ. 2554–2567';
const heroText=document.querySelector('.hero-copy-wrap > p:last-child');
if(heroText)heroText.innerHTML='วิเคราะห์ว่า <b>“พื้นที่เดิมท่วมซ้ำบ่อยเพียงใด และจังหวัดใดมีพื้นที่ท่วมซ้ำต่อเนื่อง”</b> จากประวัติ 14 ปี โดยใช้ GISTDA (ข้อมูลดาวเทียม) และ ปภ. (ข้อมูลภัยพิบัติราชการ) แยกตามช่วงเวลาอย่างชัดเจน';
await import('/app-entry-v12.js?v=20260827-historical14y-ready2');
