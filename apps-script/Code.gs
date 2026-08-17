// Şube ürün taleplerini bir Google E-Tablosuna kaydeden Web App.
//
// Kurulum:
// 1) sheets.google.com üzerinde yeni, boş bir e-tablo oluştur (ör. "Şube Talepleri").
// 2) Uzantılar > Apps Script menüsünden açılan editörde bu dosyanın tüm içeriğini yapıştır.
// 3) Dağıt > Yeni Dağıtım > tür: Web Uygulaması.
//    - Yürüten: Ben (kendi hesabın)
//    - Erişimi olanlar: Herkes
// 4) Dağıt'a bas, verilen Web App URL'sini kopyala.
// 5) O URL'yi sube-talep.html VE talep-paneli.html içindeki APPS_SCRIPT_URL
//    sabitlerine yapıştır (ikisi de aynı URL'yi kullanır).

const SHEET_ADI = "Talepler";

function doGet(e) {
  const sayfa = sayfayiGetirYaOlustur();
  const veriler = sayfa.getDataRange().getValues();
  veriler.shift(); // başlık satırı

  const tz = Session.getScriptTimeZone();
  const kayitlar = veriler
    .filter(function (satir) { return satir[2]; })
    .map(function (satir) {
      return {
        zaman: bicimle(satir[0], tz, "yyyy-MM-dd HH:mm"),
        tarih: bicimle(satir[1], tz, "yyyy-MM-dd"),
        sube: satir[2],
        kategori: satir[3],
        urun: satir[4],
        boy: satir[5],
        miktar: satir[6],
        birim: satir[7],
      };
    });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, kayitlar: kayitlar }))
    .setMimeType(ContentService.MimeType.JSON);
}

function bicimle(deger, tz, format) {
  if (Object.prototype.toString.call(deger) === "[object Date]") {
    return Utilities.formatDate(deger, tz, format);
  }
  return deger;
}

function doPost(e) {
  const veri = JSON.parse(e.postData.contents);
  const sayfa = sayfayiGetirYaOlustur();
  const zaman = new Date();

  (veri.kalemler || []).forEach(function (kalem) {
    sayfa.appendRow([
      zaman, veri.tarih, veri.sube,
      kalem.kategori || "", kalem.urun,
      kalem.boy !== undefined ? kalem.boy : "",
      kalem.miktar, kalem.birim,
    ]);
  });

  if (veri.not) {
    sayfa.appendRow([zaman, veri.tarih, veri.sube, "", "NOT", "", veri.not, ""]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sayfayiGetirYaOlustur() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sayfa = ss.getSheetByName(SHEET_ADI);
  if (!sayfa) {
    sayfa = ss.insertSheet(SHEET_ADI);
    sayfa.appendRow(["Gönderim Zamanı", "Talep Tarihi", "Şube", "Kategori", "Ürün", "Boy", "Miktar", "Birim"]);
  }
  return sayfa;
}
