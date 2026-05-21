function doGet(e) {
  // รับค่าจาก parameter ?page=... ถ้าไม่มีให้ไปหน้า dashboard
  var page = e.parameter.page || "dashboard";

  // สร้าง Template จากไฟล์ (ชื่อไฟล์ต้องตรงกับที่เรียกใน URL)
  try {
    return HtmlService.createTemplateFromFile(page)
        .evaluate()
        .setTitle("ระบบประเมิน PHQ-A")
        .addMetaTag('viewport', 'width=device-width, initial-scale=1')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    // ถ้าหาไฟล์ไม่เจอ (เช่น พิมพ์ผิด) ให้เด้งไปหน้า dashboard
    return HtmlService.createHtmlOutput("ไม่พบหน้าที่ต้องการ (Error: " + err.message + ")");
  }
}

// ฟังก์ชันสำคัญเพื่อให้หน้าเว็บรู้ URL ของตัวเอง
function getScriptUrl() {
  return ScriptApp.getService().getUrl();
}

function getDashboardData() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Sheet1");

    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) return [];

    var result = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];

      // ข้ามแถวว่างอย่างมีประสิทธิภาพ
      if (!row[0] && !row[1] && !row[2]) continue;
      if (row.join("").trim() === "") continue;

      // จัดการเรื่องวันที่ (ป้องกันปัญหา Date Object ส่งข้ามฝั่งไม่ได้)
      var timeStr = "";
      if (row[4]) {
        if (row[4] instanceof Date) {
          timeStr = Utilities.formatDate(row[4], Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
        } else {
          timeStr = row[4].toString();
        }
      }

      result.push({
        student_id: row[0] ? row[0].toString() : "",
        fullname: row[1] || "",
        email: row[2] || "",
        phone: row[3] ? row[3].toString() : "",
        timestamp: timeStr,

        level: row[5] || "",
        classroom: row[6] ? row[6].toString() : "",
        school: row[7] || "ไม่ระบุโรงเรียน",

        age: row[8] ? row[8].toString() : "0",
        gender: row[9] || "ไม่ระบุ",

        totalScore: isNaN(Number(row[10])) ? 0 : Number(row[10]),
        riskStatus: row[11] ? row[11].toString().trim() : "ปกติ",
        interpretation: row[12] || ""
      });
    }

    Logger.log("ดึงข้อมูลสำเร็จ: " + result.length + " รายการ");
    return result;

  } catch (e) {
    Logger.log("ERROR getDashboardData: " + e.message);
    return [];
  }
}
function checkEmailStatus(email) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
  if (!sheet) return "OK";
  
  var found = sheet.createTextFinder(email).matchEntireCell(true).findNext();

  if (found) {
    return "ALREADY_SUBMITTED";
  } else {
    return "OK";
  }
}

function sendOTP(email) {
  var otp = Math.floor(100000 + Math.random() * 900000); // 6 หลัก

  // เก็บ OTP ไว้ 5 นาที
  CacheService.getScriptCache().put(email, otp.toString(), 300);

  MailApp.sendEmail({
    to: email,
    subject: "รหัสยืนยันระบบประเมิน PHQ-A",
    htmlBody: "รหัส OTP ของคุณคือ: <h2>" + otp + "</h2> ใช้ได้ภายใน 5 นาที"
  });

  return "sent";
}

function verifyOTP(email, otp) {
  var cacheOtp = CacheService.getScriptCache().get(email);

  if (cacheOtp === otp) {
    return "success";
  } else {
    return "fail";
  }
}

// 🔔 Flex Message
function sendLineGroupFlex(data) {
  var url = "https://api.line.me/v2/bot/message/push";

  var token = "NZdCOcHgWFA+vNgKVhWgdu1YEmm/HLcWBcEFaTGuuHkdKUcPRYWaIlHQatCmnZMKKg+Bc4rXZRA0Gmed8AX8PxqY3XO1+etU2dabwEeuLSDFTOtLlOwbk01zS0zpYOOVwU5RFTGEG4koj1ok6F7OEgdB04t89/1O/w1cDnyilFU=";
  var groupId = "C0a6b32228c98b67e73071beec131017a";

  var flexMessage = {
    to: groupId,
    messages: [
      {
        type: "flex",
        altText: "มีผลประเมินใหม่",
        contents: {
          type: "bubble",
          size: "mega",
          body: {
            type: "box",
            layout: "vertical",
            contents: [
              {
                type: "text",
                text: "📊 ผลการประเมิน",
                weight: "bold",
                size: "xl",
                color: "#1a73e8"
              },
              { type: "separator", margin: "md" },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                spacing: "sm",
                contents: [
                  { type: "text", text: "🆔 รหัสนักเรียน: " + data.student_id, size: "sm" },
                  { type: "text", text: "👤 ชื่อ-สกุล: " + data.fullname, size: "sm" },
                  { type: "text", text: "🏫 โรงเรียน: " + data.school, size: "sm" },
                  { type: "text", text: "🏫 ห้อง: " + (data.classroom || "-"), size: "sm" },
                  { type: "text", text: "👤 อายุ: " + data.age + " ปี", size: "sm" },
                  { type: "text", text: "🚻 เพศ: " + data.gender, size: "sm" },
                  { type: "text", text: "📧 E-mail: " + data.email, size: "sm" },
                  { type: "text", text: "📞 เบอร์โทร: " + (data.phone || "-"), size: "sm" },
                  { type: "text", text: "📊 คะแนน: " + data.totalScore, size: "sm", weight: "bold" }
                ]
              },
              { type: "separator", margin: "md" },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                  { type: "text", text: "⚠️ ระดับความเสี่ยง", size: "sm", color: "#999999" },
                  {
                    type: "text",
                    text: data.riskStatus,
                    size: "lg",
                    weight: "bold",
                    color: data.totalScore >= 10 ? "#d32f2f" : "#2e7d32"
                  }
                ]
              },
              {
                type: "box",
                layout: "vertical",
                margin: "md",
                contents: [
                  { type: "text", text: "📝 คำแปลผล", size: "sm", color: "#999999" },
                  { type: "text", text: data.interpretation, size: "sm", wrap: true }
                ]
              }
            ]
          }
        }
      }
    ]
  };

  var options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + token
    },
    payload: JSON.stringify(flexMessage)
  };

  try {
    UrlFetchApp.fetch(url, options);
  } catch(e) {
    Logger.log("🔥 LINE Notification Failed: " + e.toString());
  }
}

function saveResponse(data){
  try {
    if (checkEmailStatus(data.email) === "ALREADY_SUBMITTED") {
      throw new Error("❌ อีเมลนี้เคยทำแบบประเมินแล้ว");
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet1");
    if (!sheet) throw new Error("❌ ไม่พบ Sheet ชื่อ 'Sheet1'");

    // ใช้เวลาปัจจุบันของฝั่ง Server ป้องกันการส่งฟอร์แมตเวลาผิดพลาดมาจาก Client
    var timestamp = new Date(); 

    sheet.appendRow([
      data.student_id,
      data.fullname,
      data.email,
      data.phone,
      timestamp,
      data.level,
      data.classroom,
      data.school,
      data.age,
      data.gender,
      data.totalScore,
      data.riskStatus,
      data.interpretation
    ]);

    // 🔔 ส่ง LINE Notification
    sendLineGroupFlex(data);

    return "success";

  } catch(err) {
    Logger.log("🔥 เกิดข้อผิดพลาดใน saveResponse: " + err.toString());
    throw err;
  }
}
