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
//
// Eksik şube uyarı maili kurulumu (opsiyonel, tek seferlik):
// 6) Yukarıdaki fonksiyon açılır listesinden "kurulumTetikleyiciOlustur"
//    seçilir, Çalıştır'a basılır (Gmail gönderme izni için tekrar
//    yetkilendirme istenebilir, onayla). Bu, her akşam 22:00'de o gün
//    henüz talep göndermemiş şubeleri UYARI_EPOSTASI adresine mail atan
//    bir zamanlayıcı kurar. Tekrar çalıştırmak zararsızdır (eski
//    zamanlayıcıyı silip yenisini kurar, tekrarlanan mail oluşturmaz).

const SHEET_ADI = "Talepler";
const UYARI_EPOSTASI = "serkansalihoglu@lavita.com.tr";
const SUBELER = ["Nişantaşı", "Fulya", "Maslak", "Kireçburnu", "Beykent", "Z.burnu", "S.beyli"];
// Veri silme (panelden gönderim silme + toplu temizleme) bu anahtarı ister.
// ÖNEMLİ: Bu dosya herkese açık bir GitHub deposunda duruyor. Anahtarı BURAYA
// yazmayın; yalnızca Apps Script editöründeki kopyaya yazın. Depodaki değer
// her zaman aşağıdaki gibi boş kalmalı.
const TEMIZLEME_ANAHTARI = "BURAYA_KENDI_ANAHTARINI_YAZ";

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

  if (veri.islem === "temizle") {
    if (veri.anahtar !== TEMIZLEME_ANAHTARI) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, hata: "Geçersiz anahtar" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const sayfa = sayfayiGetirYaOlustur();
    const sonSatir = sayfa.getLastRow();
    if (sonSatir > 1) {
      sayfa.deleteRows(2, sonSatir - 1);
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, silinen: Math.max(0, sonSatir - 1) }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Panelden bir gönderimin tamamını siler (yinelenen kayıtları temizlemek için).
  // veri: { islem: "gonderimSil", anahtar, sube, tarih, zaman }  zaman: "yyyy-MM-dd HH:mm"
  if (veri.islem === "gonderimSil") {
    if (veri.anahtar !== TEMIZLEME_ANAHTARI) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: false, hata: "Geçersiz anahtar" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const sayfa2 = sayfayiGetirYaOlustur();
    const tz2 = Session.getScriptTimeZone();
    const satirlar2 = sayfa2.getDataRange().getValues();
    let silinen = 0;
    // Alttan yukarı: silme sonrası satır numaraları kaymasın.
    for (let i = satirlar2.length - 1; i >= 1; i--) {
      const st = satirlar2[i];
      if (String(st[2]) !== String(veri.sube)) continue;
      if (bicimle(st[1], tz2, "yyyy-MM-dd") !== veri.tarih) continue;
      if (bicimle(st[0], tz2, "yyyy-MM-dd HH:mm") !== veri.zaman) continue;
      sayfa2.deleteRow(i + 1);
      silinen++;
    }
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, silinen: silinen }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  const sayfa = sayfayiGetirYaOlustur();
  const zaman = new Date();

  const satirlar = (veri.kalemler || []).map(function (kalem) {
    return [
      zaman, veri.tarih, veri.sube,
      kalem.kategori || "", kalem.urun,
      kalem.boy !== undefined ? kalem.boy : "",
      kalem.miktar, kalem.birim,
    ];
  });

  if (veri.not) {
    satirlar.push([zaman, veri.tarih, veri.sube, "", "NOT", "", veri.not, ""]);
  }

  if (satirlar.length > 0) {
    const ilkSatir = sayfa.getLastRow() + 1;
    sayfa.getRange(ilkSatir, 1, satirlar.length, satirlar[0].length).setValues(satirlar);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function kurulumTetikleyiciOlustur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "eksikSubeleriUyar") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("eksikSubeleriUyar")
    .timeBased()
    .everyDays(1)
    .atHour(22)
    .create();
}

function eksikSubeleriUyar() {
  const tz = Session.getScriptTimeZone();
  const yarin = new Date();
  yarin.setDate(yarin.getDate() + 1);
  const yarinStr = Utilities.formatDate(yarin, tz, "yyyy-MM-dd");

  const sayfa = sayfayiGetirYaOlustur();
  const veriler = sayfa.getDataRange().getValues();
  veriler.shift();

  const gonderenSubeler = new Set();
  veriler.forEach(function (satir) {
    const tarih = bicimle(satir[1], tz, "yyyy-MM-dd");
    if (tarih === yarinStr && satir[2]) gonderenSubeler.add(satir[2]);
  });

  const eksikler = SUBELER.filter(function (s) { return !gonderenSubeler.has(s); });
  if (eksikler.length === 0) return;

  const konu = "Şube Talebi Uyarısı - " + yarinStr;
  const govde = yarinStr + " tarihi için henüz ürün talebi göndermeyen şubeler:\n\n" +
    eksikler.join("\n");
  MailApp.sendEmail(UYARI_EPOSTASI, konu, govde);
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
