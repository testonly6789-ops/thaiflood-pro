# ThaiFlood Pro

แดชบอร์ดเฝ้าระวังความเสี่ยงน้ำท่วมจากฝนรายวันสำหรับประเทศไทย ออกแบบใหม่สำหรับมือถือและเดสก์ท็อป และพร้อม Deploy บน Vercel

## จุดเด่น

- ค้นหาจังหวัดแบบพิมพ์ค้นหา ไม่ใช้ Dropdown ยาว 77 จังหวัด
- ปุ่ม "ตำแหน่งฉัน" เลือกจังหวัดที่ใกล้ที่สุดโดยอัตโนมัติ
- แสดงจังหวัดเสี่ยงสูงสุดของวัน
- แผนที่ตำแหน่งจังหวัดแบบ Interactive
- ดัชนีความเสี่ยงจากฝน 0–100
- ปริมาณฝนวันนี้ / ฝนสะสม 3 วัน / โอกาสฝน / ฝนหนักสุดรายชั่วโมง
- แนวโน้มฝน 7 วัน
- Responsive รองรับมือถือและคอมพิวเตอร์
- Auto refresh ทุก 30 นาที
- Vercel Function ดึงข้อมูลใหม่และ Cache 30 นาที
- ไม่มี API Key สำหรับข้อมูลพยากรณ์พื้นฐาน

## แหล่งข้อมูล

ปัจจุบันระบบใช้ Open-Meteo สำหรับข้อมูลพยากรณ์ฝนรายจังหวัด และแสดงลิงก์ไปยัง GISTDA Disaster / ThaiWater เพื่อยืนยันสถานการณ์จริง

> สำคัญ: คะแนนในระบบเป็น Rainfall Screening Index หรือดัชนีคัดกรองความเสี่ยงจากฝน ไม่ใช่ประกาศเตือนภัยทางการ และยังไม่ได้รวมระดับน้ำจริง ความจุเขื่อน ความชื้นดิน และ Digital Elevation Model

## Deploy ขึ้น Vercel — วิธีง่ายที่สุด

1. แตกไฟล์ ZIP
2. เข้า https://vercel.com
3. เลือก **Add New → Project**
4. อัปโหลดโฟลเดอร์นี้ผ่าน GitHub หรือใช้ Vercel CLI
5. ไม่ต้องตั้ง Build Command และไม่ต้องตั้ง Environment Variable สำหรับเวอร์ชันพื้นฐาน
6. Deploy ได้ทันที

### ถ้าใช้ GitHub

```bash
git init
git add .
git commit -m "Initial ThaiFlood Pro"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

แล้ว Import Repository ใน Vercel

### ถ้าใช้ Vercel CLI

```bash
npm i -g vercel
vercel
```

## API

- `/api/health` ตรวจสอบว่า Backend ทำงาน
- `/api/forecast` ดึงข้อมูลจังหวัดทั้งหมดและคำนวณดัชนีความเสี่ยง

## สูตรดัชนี

ใช้ปริมาณฝนวันนี้ + ฝนสะสม 3 วัน + โอกาสฝน + ความเข้มฝนสูงสุดรายชั่วโมง เพื่อจัดระดับ Low / Watch / High / Critical

สูตรนี้ตั้งใจใช้เพื่อคัดกรอง UX ระดับประเทศ ไม่ควรอ้างว่าเป็นโมเดลพยากรณ์น้ำท่วมทางวิศวกรรม

## ถ้าจะทำเป็น Production ระดับหน่วยงาน

ควรเพิ่มข้อมูลจริงต่อไปนี้:

- GISTDA flood extent / flood depth
- ThaiWater / RID ระดับน้ำแม่น้ำและอ่างเก็บน้ำ
- TMD radar / severe weather alerts
- DEM + drainage + flood recurrence layer
- ข้อมูลตำบล/อำเภอแทน centroid จังหวัด
- ระบบแจ้งเตือน LINE / Email / Push Notification
- Database เก็บ snapshot รายวันเพื่อทำกราฟย้อนหลัง
