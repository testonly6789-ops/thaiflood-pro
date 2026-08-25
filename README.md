# ThaiFlood Intelligence V4

ระบบวิเคราะห์น้ำท่วมซ้ำซากประเทศไทยแบบ Data-first

## V4 เพิ่มอะไร

- จังหวัดเปิดเป็น Modal/Popup ไม่เลื่อนหน้า
- แผนที่ประเทศไทยจริงด้วย Leaflet + CARTO/OpenStreetMap
- สลับชั้นแผนที่ “ท่วมซ้ำ” กับ “ฝนวันนี้”
- กราฟจัดอันดับจังหวัดท่วมซ้ำ
- Province Deep Dive: รูปแบบ 11 ปี / เหตุการณ์รายปี / สัญญาณวันนี้ / ข้อมูล ปภ.
- เชื่อม DDPM CKAN Data API อัตโนมัติสำหรับสถิติอุทกภัย 2562–2568 (ทรัพยากรใดที่ DataStore เปิดใช้งาน)
- ดึงข้อมูลฝน 7 วันจาก Open-Meteo
- แสดง null/ไม่มีข้อมูลแทนการสร้างเลขศูนย์หลอกผู้ใช้
- รองรับมือถือและคอมพิวเตอร์

## แหล่งข้อมูล

1. ปภ. — สถิติรายปีการเกิดอุทกภัย: https://catalog.disaster.go.th/dataset/dpm-gd027
2. GISTDA Disaster Platform: https://disaster.gistda.or.th/
3. ThaiWater: https://www.thaiwater.net/
4. Open-Meteo: https://open-meteo.com/

## Deploy บน Vercel

Framework Preset: Other
Root Directory: ./
Build Command: ไม่ต้องตั้ง
Output Directory: ไม่ต้องตั้ง

เมื่อเชื่อม GitHub กับ Vercel แล้ว การ Commit เข้า main จะ Deploy อัตโนมัติ
