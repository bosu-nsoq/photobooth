/**
 * SnappyBooth TH - Google Apps Script Backend (Code.gs)
 * ------------------------------------------------------------------
 * 1. สร้าง/เชื่อมต่อโฟลเดอร์หลักชื่อ "Photobooth" ใน Google Drive
 * 2. สร้างโฟลเดอร์ย่อย "Photos" (เก็บรูปภาพ) และ "Videos_GIF" (เก็บวิดีโอ/GIF)
 * 3. สร้างฐานข้อมูล Google Sheets ชื่อ "Photobooth_Database" ไว้ในโฟลเดอร์ "Photobooth"
 * 4. อัปโหลดไฟล์รูปภาพ/GIF/วิดีโอ และตั้งค่าแชร์แบบ Anyone with link เพื่อสร้าง QR Code ดาวน์โหลดได้ทันที
 */

const ROOT_FOLDER_NAME = "Photobooth";
const PHOTOS_SUBFOLDER_NAME = "Photos";
const MEDIA_SUBFOLDER_NAME = "Videos_GIF";
const DATABASE_NAME = "Photobooth_Database";
const SHEET_GALLERY = "Gallery";
const SHEET_SETTINGS = "Settings";

/**
 * ⭐ กด "เรียกใช้" (Run) ฟังก์ชันนี้ใน Apps Script Editor ครั้งแรก
 * เพื่อขอสิทธิ์เข้าถึง Drive/Sheets และสร้างโฟลเดอร์ Photobooth + โฟลเดอร์ย่อยอัตโนมัติ
 */
function initPhotoboothDrive() {
  const ctx = ensureWorkspace();
  const info = {
    status: "success",
    message: "สร้างและเชื่อมต่อโฟลเดอร์ Photobooth เรียบร้อยแล้ว",
    folderId: ctx.rootFolder.getId(),
    folderUrl: ctx.rootFolder.getUrl(),
    photosFolderId: ctx.photosFolder.getId(),
    photosFolderUrl: ctx.photosFolder.getUrl(),
    mediaFolderId: ctx.mediaFolder.getId(),
    mediaFolderUrl: ctx.mediaFolder.getUrl(),
    spreadsheetId: ctx.ss.getId(),
    spreadsheetUrl: ctx.ss.getUrl(),
    settings: getSettingsMap(ctx.ss)
  };
  Logger.log(JSON.stringify(info, null, 2));
  return info;
}

/**
 * ดึงหรือสร้างโฟลเดอร์หลักชื่อ "Photobooth" ใน Google Drive
 */
function getOrCreateRootFolder() {
  const folders = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(ROOT_FOLDER_NAME);
}

/**
 * ดึงหรือสร้างโฟลเดอร์ย่อยภายในโฟลเดอร์แม่
 */
function getOrCreateSubfolder(parentFolder, subfolderName) {
  const folders = parentFolder.getFoldersByName(subfolderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(subfolderName);
}

/**
 * ตรวจสอบและสร้างโครงสร้างทั้งหมด: Photobooth -> Photos, Videos_GIF, Photobooth_Database
 */
function ensureWorkspace() {
  const rootFolder = getOrCreateRootFolder();
  const photosFolder = getOrCreateSubfolder(rootFolder, PHOTOS_SUBFOLDER_NAME);
  const mediaFolder = getOrCreateSubfolder(rootFolder, MEDIA_SUBFOLDER_NAME);

  let ss;
  const files = rootFolder.getFilesByName(DATABASE_NAME);
  if (files.hasNext()) {
    ss = SpreadsheetApp.open(files.next());
  } else {
    ss = SpreadsheetApp.create(DATABASE_NAME);
    const file = DriveApp.getFileById(ss.getId());
    try {
      file.moveTo(rootFolder);
    } catch (e) {
      rootFolder.addFile(file);
      DriveApp.getRootFolder().removeFile(file);
    }
  }

  // สร้างชีต Gallery
  let gallerySheet = ss.getSheetByName(SHEET_GALLERY);
  if (!gallerySheet) {
    gallerySheet = ss.getActiveSheet();
    gallerySheet.setName(SHEET_GALLERY);
    const headers = [[
      "ID", "วันที่ (พ.ศ.)", "เวลา", "เลย์เอาต์", "เฟรม", "ฟิลเตอร์",
      "แคปชัน", "ลิงก์รูปภาพ", "ลิงก์ดาวน์โหลดรูป",
      "ลิงก์ GIF/วิดีโอ", "ลิงก์ดาวน์โหลด GIF/วิดีโอ",
      "PhotoFileId", "MediaFileId", "Timestamp"
    ]];
    gallerySheet.getRange(1, 1, 1, headers[0].length).setValues(headers);
    gallerySheet.getRange(1, 1, 1, headers[0].length)
      .setFontWeight("bold")
      .setBackground("#FFE0EC")
      .setFontColor("#3D2B3D")
      .setHorizontalAlignment("center");
    gallerySheet.setFrozenRows(1);
  }

  // สร้างชีต Settings
  let settingsSheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!settingsSheet) {
    settingsSheet = ss.insertSheet(SHEET_SETTINGS);
    settingsSheet.getRange(1, 1, 1, 2).setValues([["Key", "Value"]]);
    settingsSheet.getRange(1, 1, 1, 2)
      .setFontWeight("bold")
      .setBackground("#EDE9FE")
      .setFontColor("#2E1065");
    settingsSheet.setFrozenRows(1);

    const defaults = [
      ["booth_name", "WNTK Photos"],
      ["default_countdown", "3"],
      ["folder_id", rootFolder.getId()],
      ["photos_folder_id", photosFolder.getId()],
      ["media_folder_id", mediaFolder.getId()],
      ["folder_url", rootFolder.getUrl()],
      ["maintenance_mode", "false"],
      ["maintenance_msg", "ระบบกำลังปรับปรุงชั่วคราว กรุณารอสักครู่ 🛠️"],
      ["admin_pin", "8055"]
    ];
    settingsSheet.getRange(2, 1, defaults.length, 2).setValues(defaults);
  } else {
    // อัปเกรดรหัสผ่านเริ่มต้นเดิม 1234 เป็น 8055 หากยังไม่เคยตั้งค่าเอง
    const sData = settingsSheet.getDataRange().getValues();
    let hasPin = false;
    for (let i = 1; i < sData.length; i++) {
      if (String(sData[i][0] || "").trim() === "admin_pin") {
        hasPin = true;
        if (String(sData[i][1] || "").trim() === "1234") {
          settingsSheet.getRange(i + 1, 2).setValue("8055");
        }
        break;
      }
    }
    if (!hasPin) {
      settingsSheet.appendRow(["admin_pin", "8055"]);
    }
  }

  return {
    rootFolder: rootFolder,
    photosFolder: photosFolder,
    mediaFolder: mediaFolder,
    ss: ss,
    gallerySheet: gallerySheet,
    settingsSheet: settingsSheet
  };
}

/**
 * อ่านค่า Settings เป็น Object (ไม่ส่ง admin_pin ออกไปยังหน้าเว็บ)
 */
function getSettingsMap(ss) {
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return {};
  const data = sheet.getDataRange().getValues();
  const map = {
    maintenance_mode: "false",
    maintenance_msg: "ระบบกำลังปรับปรุงชั่วคราว กรุณารอสักครู่ 🛠️"
  };
  for (let i = 1; i < data.length; i++) {
    const k = String(data[i][0] || "").trim();
    if (k && k !== "admin_pin") map[k] = data[i][1];
  }
  return map;
}

/**
 * ดึง Admin PIN ภายในฝั่งเซิร์ฟเวอร์ (ค่าเริ่มต้น 8055)
 */
function getAdminPin(ss) {
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  if (!sheet) return "8055";
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim() === "admin_pin") {
      const val = String(data[i][1] || "8055").trim();
      return val === "1234" ? "8055" : val;
    }
  }
  return "8055";
}

/**
 * แปลงเวลาให้เหลือเฉพาะ HH:mm ไม่มี Timezone
 */
function formatTimeClean(val) {
  if (!val) return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return Utilities.formatDate(val, "Asia/Bangkok", "HH:mm");
  }
  const s = String(val).trim();
  const m = s.match(/(\d{1,2}:\d{2})/);
  return m ? m[1] : s;
}

/**
 * บันทึกค่า Settings ทีละรายการ
 */
function upsertSettings(ss, updates) {
  const sheet = ss.getSheetByName(SHEET_SETTINGS);
  const data = sheet.getDataRange().getValues();
  const rowMap = {};
  for (let i = 1; i < data.length; i++) {
    rowMap[String(data[i][0] || "").trim()] = i + 1;
  }
  Object.keys(updates).forEach(function (key) {
    if (rowMap[key]) {
      sheet.getRange(rowMap[key], 2).setValue(updates[key]);
    } else {
      sheet.appendRow([key, updates[key]]);
    }
  });
  SpreadsheetApp.flush();
}

/**
 * ตรวจสอบวันที่รองรับทั้ง YYYY-MM-DD และ DD/MM/YYYY (ค.ศ. และ พ.ศ.)
 */
function checkDateMatch(rowDateStr, targetDateStr) {
  if (!targetDateStr) return true;
  if (!rowDateStr) return false;

  const parseParts = function (str) {
    const val = String(str).trim();
    let d, m, y;
    if (val.includes("/")) {
      const parts = val.split("/");
      d = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      y = parseInt(parts[2], 10);
    } else if (val.includes("-")) {
      const parts = val.split("-");
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else {
      return null;
    }
    if (!d || !m || !y) return null;
    if (y > 2400) y -= 543;
    return { d: d, m: m, y: y };
  };

  let rowObj = null;
  if (Object.prototype.toString.call(rowDateStr) === "[object Date]" && !isNaN(rowDateStr.getTime())) {
    rowObj = {
      d: rowDateStr.getDate(),
      m: rowDateStr.getMonth() + 1,
      y: rowDateStr.getFullYear()
    };
  } else {
    rowObj = parseParts(rowDateStr);
  }
  const targetObj = parseParts(targetDateStr);
  if (!rowObj || !targetObj) return false;
  return rowObj.d === targetObj.d && rowObj.m === targetObj.m && rowObj.y === targetObj.y;
}

/**
 * แปลง Date เป็น dd/mm/yyyy พ.ศ.
 */
function formatThaiDateBE(dateObj) {
  const dt = dateObj || new Date();
  const d = String(dt.getDate()).padStart(2, "0");
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const y = dt.getFullYear() + 543;
  return d + "/" + m + "/" + y;
}

/**
 * จัดการ HTTP GET
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) ? e.parameter : {};
    const action = params.action || "init";

    if (action === "init" || action === "ping") {
      return createJsonResponse(initPhotoboothDrive());
    }

    if (action === "getGallery") {
      const ctx = ensureWorkspace();
      const filterDate = params.date || "";
      const data = ctx.gallerySheet.getDataRange().getValues();
      const items = [];

      for (let i = data.length - 1; i >= 1; i--) {
        const r = data[i];
        if (!r[0]) continue;
        const rowDate = r[1];
        if (filterDate && !checkDateMatch(rowDate, filterDate)) continue;

        const photoId = String(r[11] || "");
        const mediaId = String(r[12] || "");
        items.push({
          id: String(r[0]),
          dateStr: (rowDate instanceof Date) ? formatThaiDateBE(rowDate) : String(rowDate || ""),
          timeStr: formatTimeClean(r[2]),
          layout: String(r[3] || ""),
          frame: String(r[4] || ""),
          filter: String(r[5] || ""),
          caption: String(r[6] || ""),
          photoViewUrl: String(r[7] || ""),
          photoDownloadUrl: String(r[8] || ""),
          photoThumbUrl: photoId ? ("https://drive.google.com/thumbnail?id=" + photoId + "&sz=w800") : "",
          mediaViewUrl: String(r[9] || ""),
          mediaDownloadUrl: String(r[10] || ""),
          photoFileId: photoId,
          mediaFileId: mediaId,
          timestamp: Number(r[13] || 0)
        });
      }

      return createJsonResponse({
        status: "success",
        folderUrl: ctx.rootFolder.getUrl(),
        photosFolderUrl: ctx.photosFolder.getUrl(),
        mediaFolderUrl: ctx.mediaFolder.getUrl(),
        spreadsheetUrl: ctx.ss.getUrl(),
        settings: getSettingsMap(ctx.ss),
        items: items
      });
    }

    return createJsonResponse({
      status: "success",
      message: "WNTK Photos Backend is running"
    });
  } catch (err) {
    return createJsonResponse({
      status: "error",
      message: err.toString()
    });
  }
}

/**
 * บันทึกไฟล์ Base64 ลงโฟลเดอร์ Google Drive พร้อมเปิดสิทธิ์ลิงก์สำหรับ QR Code
 */
function saveBase64FileToFolder(folder, base64Data, mimeType, fileName) {
  const cleanB64 = String(base64Data).replace(/^data:[^;]+;base64,/, "");
  const bytes = Utilities.base64Decode(cleanB64);
  const blob = Utilities.newBlob(bytes, mimeType || "application/octet-stream", fileName);
  const file = folder.createFile(blob);

  // ตั้งค่าให้สแกน QR Code แล้วเปิดดู/ดาวน์โหลดได้ทันที
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const fileId = file.getId();

  return {
    id: fileId,
    name: file.getName(),
    viewUrl: "https://drive.google.com/file/d/" + fileId + "/view?usp=sharing",
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + fileId,
    thumbUrl: "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w800"
  };
}

/**
 * จัดการ HTTP POST
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  let hasLock = false;
  try {
    hasLock = lock.tryLock(15000);
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "uploadSession";
    const ctx = ensureWorkspace();

    if (action === "uploadSession") {
      const id = payload.id || ("PB_" + Date.now());
      const dateStr = payload.dateStr || formatThaiDateBE(new Date());
      const timeStr = payload.timeStr || Utilities.formatDate(new Date(), "Asia/Bangkok", "HH:mm");

      let photoRes = null;
      if (payload.photoBase64) {
        const photoName = payload.photoName || (id + "_strip.png");
        photoRes = saveBase64FileToFolder(
          ctx.photosFolder,
          payload.photoBase64,
          payload.photoMime || "image/png",
          photoName
        );
      }

      let mediaRes = null;
      if (payload.mediaBase64) {
        const mediaName = payload.mediaName || (id + "_motion.gif");
        mediaRes = saveBase64FileToFolder(
          ctx.mediaFolder,
          payload.mediaBase64,
          payload.mediaMime || "image/gif",
          mediaName
        );
      }

      const row = [
        id,
        dateStr,
        "'" + timeStr,
        payload.layout || "1x4",
        payload.frame || "cream",
        payload.filter || "original",
        payload.caption || "",
        photoRes ? photoRes.viewUrl : "",
        photoRes ? photoRes.downloadUrl : "",
        mediaRes ? mediaRes.viewUrl : "",
        mediaRes ? mediaRes.downloadUrl : "",
        photoRes ? photoRes.id : "",
        mediaRes ? mediaRes.id : "",
        payload.timestamp || Date.now()
      ];

      ctx.gallerySheet.appendRow(row);

      return createJsonResponse({
        status: "success",
        id: id,
        dateStr: dateStr,
        timeStr: timeStr,
        folderUrl: ctx.rootFolder.getUrl(),
        photosFolderUrl: ctx.photosFolder.getUrl(),
        mediaFolderUrl: ctx.mediaFolder.getUrl(),
        photoViewUrl: photoRes ? photoRes.viewUrl : "",
        photoDownloadUrl: photoRes ? photoRes.downloadUrl : "",
        photoThumbUrl: photoRes ? photoRes.thumbUrl : "",
        photoFileId: photoRes ? photoRes.id : "",
        mediaViewUrl: mediaRes ? mediaRes.viewUrl : "",
        mediaDownloadUrl: mediaRes ? mediaRes.downloadUrl : "",
        mediaFileId: mediaRes ? mediaRes.id : ""
      });
    }

    if (action === "deleteSession") {
      const targetId = String(payload.id || "");
      const data = ctx.gallerySheet.getDataRange().getValues();
      let deleted = false;

      for (let i = data.length - 1; i >= 1; i--) {
        if (String(data[i][0]) === targetId) {
          const pId = String(data[i][11] || "");
          const mId = String(data[i][12] || "");
          if (pId) { try { DriveApp.getFileById(pId).setTrashed(true); } catch (e1) {} }
          if (mId) { try { DriveApp.getFileById(mId).setTrashed(true); } catch (e2) {} }
          ctx.gallerySheet.deleteRow(i + 1);
          deleted = true;
          break;
        }
      }

      return createJsonResponse({ status: "success", deleted: deleted });
    }

    if (action === "saveSettings") {
      const incoming = payload.settings || {};
      delete incoming.admin_pin;
      upsertSettings(ctx.ss, incoming);
      return createJsonResponse({
        status: "success",
        settings: getSettingsMap(ctx.ss)
      });
    }

    if (action === "adminLogin") {
      const pin = String(payload.pin || "").trim();
      if (pin !== getAdminPin(ctx.ss)) {
        return createJsonResponse({ status: "error", message: "รหัสผ่าน Admin ไม่ถูกต้อง" });
      }
      return createJsonResponse({
        status: "success",
        settings: getSettingsMap(ctx.ss)
      });
    }

    if (action === "adminSetMaintenance") {
      const pin = String(payload.pin || "").trim();
      if (pin !== getAdminPin(ctx.ss)) {
        return createJsonResponse({ status: "error", message: "รหัสผ่าน Admin ไม่ถูกต้อง" });
      }
      const updates = {
        maintenance_mode: payload.enabled ? "true" : "false"
      };
      if (payload.message !== undefined) {
        updates.maintenance_msg = String(payload.message || "").trim() || "ระบบกำลังปรับปรุงชั่วคราว กรุณารอสักครู่ 🛠️";
      }
      upsertSettings(ctx.ss, updates);
      return createJsonResponse({
        status: "success",
        settings: getSettingsMap(ctx.ss)
      });
    }

    if (action === "adminChangePin") {
      const oldPin = String(payload.oldPin || "").trim();
      const newPin = String(payload.newPin || "").trim();
      if (oldPin !== getAdminPin(ctx.ss)) {
        return createJsonResponse({ status: "error", message: "รหัสผ่านเดิมไม่ถูกต้อง" });
      }
      if (!newPin || newPin.length < 4) {
        return createJsonResponse({ status: "error", message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัว" });
      }
      upsertSettings(ctx.ss, { admin_pin: newPin });
      return createJsonResponse({ status: "success" });
    }

    return createJsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  } finally {
    if (hasLock) {
      try { lock.releaseLock(); } catch (eLock) {}
    }
  }
}

/**
 * สร้าง JSON Output มาตรฐาน
 */
function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
