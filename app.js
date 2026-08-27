const eyebrow=document.querySelector('.hero .eyebrow');
if(eyebrow)eyebrow.textContent='FLOOD PATTERN INTELLIGENCE • ประวัติ 14 ปี พ.ศ. 2554–2567';
const heroText=document.querySelector('.hero-copy-wrap > p:last-child');
if(heroText)heroText.innerHTML='ระบบวิเคราะห์ว่า <b>“พื้นที่เดิมท่วมซ้ำบ่อยแค่ไหน และจังหวัดใดมีภาระพื้นที่ท่วมซ้ำต่อเนื่องสูง”</b> จากหลักฐานย้อนหลัง 14 ปี โดยแยกแหล่งข้อมูล GISTDA และ ปภ. อย่างชัดเจน';
await import('/app-entry-v11.js?v=20260827-historical14y-final3');
