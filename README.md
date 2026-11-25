# WNTK Photos

แอปสำหรับเก็บภาพความทรงจำของทุกช่วงเวลา (Photobooth PWA + Google Drive)

## ข้อมูลโปรเจกต์
- **ชื่อแอป:** WNTK Photos
- **คำอธิบาย:** แอปสำหรับเก็บภาพความทรงจำของทุกช่วงเวลา
- **Favicon / App Icon:** `https://i.postimg.cc/Hx10w2k6/Photobooth.png`
- **Google Apps Script ID:** `1zojy-OQ9Sv2_r9BNkWM9M1RQdwWY4CDwQgPX_P_ueCBBx94zoMqk4wyN`
- **Web App URL:** `https://script.google.com/macros/s/AKfycbyDyrIfE5QXCH4D5HwIpFpbEhvhmYWyTUSHEWOwnEJVZIYpf3fAP-XkUMUREYiRzWoMmQ/exec`

## โครงสร้าง Google Drive (`Code.gs`)
เมื่อรัน `initPhotoboothDrive` ใน Apps Script ระบบจะสร้างโครงสร้างใน Google Drive อัตโนมัติ:
- `Photobooth/` (โฟลเดอร์หลักเก็บข้อมูลทั้งหมดของแอป)
  - `Photos/` (โฟลเดอร์ย่อยเก็บรูปภาพ Photo Strip)
  - `Videos_GIF/` (โฟลเดอร์ย่อยเก็บไฟล์ GIF / วิดีโอ)
  - `Photobooth_Database` (Google Sheets บันทึกคลังภาพและตั้งค่า)

## การเปิดใช้งาน Google Drive ครั้งแรก
1. เปิด [WNTK Photos Apps Script](https://script.google.com/d/1zojy-OQ9Sv2_r9BNkWM9M1RQdwWY4CDwQgPX_P_ueCBBx94zoMqk4wyN/edit)
2. เลือกฟังก์ชัน `initPhotoboothDrive` แล้วกด **เรียกใช้ (Run)** เพื่ออนุญาตสิทธิ์ Google Drive และ Sheets
3. ตรวจสอบ **Deploy > Manage deployments** ให้สิทธิ์เข้าถึงเป็น **Anyone (ทุกคน)**
