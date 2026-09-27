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
const ARSIV_SHEET_ADI = "Talepler Arşiv";
// Bu kadar aydan eski talepler arşiv sayfasına taşınır (veri silinmez).
const ARSIV_AY = 3;
const BASLIKLAR = ["Gönderim Zamanı", "Talep Tarihi", "Şube", "Kategori", "Ürün", "Boy", "Miktar", "Birim"];
const UYARI_EPOSTASI = "serkansalihoglu@lavita.com.tr";
const SUBELER = ["Nişantaşı", "Fulya", "Maslak", "Kireçburnu", "Beykent", "Z.burnu", "S.beyli", "SUTİŞ"];
// Veri silme (panelden gönderim silme + toplu temizleme) bu anahtarı ister.
// ÖNEMLİ: Bu dosya herkese açık bir GitHub deposunda duruyor. Anahtarı BURAYA
// yazmayın; yalnızca Apps Script editöründeki kopyaya yazın. Depodaki değer
// her zaman aşağıdaki gibi boş kalmalı.
const TEMIZLEME_ANAHTARI = "BURAYA_KENDI_ANAHTARINI_YAZ";

// Kayıtları döndürür.
//   ?bas=2026-09-28&bit=2026-09-28  -> yalnızca bu tarih aralığı
//   ?sube=Fulya                     -> yalnızca bu şube
// Parametre verilmezse tüm tablo döner (eski davranış).
//
// Tarih süzmesi ÖNEMLİ: tablo büyüdükçe tümünü döndürmek panelin açılışını
// dakikalara çıkarıyordu. Pahalı olan kısım her satır için tarih biçimlendirmek
// ve hepsini JSON'a koymak; bu yüzden önce süzülür, sonra biçimlendirilir.
function doGet(e) {
  const p = (e && e.parameter) || {};
  const bas = p.bas || "";
  const bit = p.bit || bas;
  const subeFiltre = p.sube || "";

  const tz = Session.getScriptTimeZone();
  const kayitlar = sayfadanSuz(sayfayiGetirYaOlustur(), tz, bas, bit, subeFiltre);

  // Arşivdeki bir tarih isteniyorsa arşiv sayfası da taranır.
  const arsivSon = PropertiesService.getScriptProperties().getProperty("ARSIV_SON_TARIH") || "";
  const arsivGerek = p.arsiv === "1" || (bas && arsivSon && bas <= arsivSon);
  if (arsivGerek) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const arsiv = ss.getSheetByName(ARSIV_SHEET_ADI);
    if (arsiv) {
      sayfadanSuz(arsiv, tz, bas, bit, subeFiltre).forEach(function (k) { kayitlar.push(k); });
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, kayitlar: kayitlar }))
    .setMimeType(ContentService.MimeType.JSON);
}

function sayfadanSuz(sayfa, tz, bas, bit, subeFiltre) {
  const veriler = sayfa.getDataRange().getValues();
  veriler.shift(); // başlık satırı
  const cikti = [];
  for (var i = 0; i < veriler.length; i++) {
    const satir = veriler[i];
    if (!satir[2]) continue;
    if (subeFiltre && String(satir[2]) !== subeFiltre) continue;
    // Tarih biçimlendirmek pahalı; önce süz, sonra biçimlendir.
    const tarih = bicimle(satir[1], tz, "yyyy-MM-dd");
    if (bas && (tarih < bas || tarih > bit)) continue;
    cikti.push({
      zaman: bicimle(satir[0], tz, "yyyy-MM-dd HH:mm"),
      tarih: tarih,
      sube: satir[2],
      kategori: satir[3],
      urun: satir[4],
      boy: satir[5],
      miktar: satir[6],
      birim: satir[7],
    });
  }
  return cikti;
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
  return sayfaGetir(SHEET_ADI);
}

function sayfaGetir(ad) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sayfa = ss.getSheetByName(ad);
  if (!sayfa) {
    sayfa = ss.insertSheet(ad);
    sayfa.appendRow(BASLIKLAR);
  }
  return sayfa;
}

// ---------------------------------------------------------------------------
// ARŞİV
//
// Talepler sayfası büyüdükçe doGet her isteği yavaşlatıyor. ARSIV_AY aydan
// eski satırlar "Talepler Arşiv" sayfasına taşınır. Veri SİLİNMEZ, yer
// değiştirir; panel eski bir tarih aralığı istediğinde arşiv de taranır.
//
// Kullanım:
//   arsivOnizleme()  -> hiçbir şey değiştirmez, kaç satır taşınacağını söyler
//   arsivle()        -> taşımayı yapar
// ---------------------------------------------------------------------------

function arsivSiniriHesapla(tz) {
  const d = new Date();
  d.setMonth(d.getMonth() - ARSIV_AY);
  return Utilities.formatDate(d, tz, "yyyy-MM-dd");
}

function arsivOnizleme() {
  const tz = Session.getScriptTimeZone();
  const sinir = arsivSiniriHesapla(tz);
  const sayfa = sayfayiGetirYaOlustur();
  const veriler = sayfa.getDataRange().getValues();
  veriler.shift();
  let tasinacak = 0, kalacak = 0, enEski = "", enYeni = "";
  veriler.forEach(function (satir) {
    if (!satir[2]) return;
    const tarih = bicimle(satir[1], tz, "yyyy-MM-dd");
    if (!enEski || tarih < enEski) enEski = tarih;
    if (!enYeni || tarih > enYeni) enYeni = tarih;
    if (tarih < sinir) tasinacak++; else kalacak++;
  });
  const mesaj = "Sınır: " + sinir + " (bu tarihten ÖNCEKİLER arşive gider)\n" +
    "Talepler sayfası: " + enEski + " – " + enYeni + "\n" +
    "Taşınacak: " + tasinacak + " satır\n" +
    "Kalacak:   " + kalacak + " satır";
  Logger.log(mesaj);
  return mesaj;
}

function arsivle() {
  const kilit = LockService.getScriptLock();
  if (!kilit.tryLock(30000)) throw new Error("Başka bir işlem sürüyor, sonra deneyin.");
  try {
    const tz = Session.getScriptTimeZone();
    const sinir = arsivSiniriHesapla(tz);
    const sayfa = sayfayiGetirYaOlustur();
    const tumu = sayfa.getDataRange().getValues();
    const baslik = tumu.shift();

    const kalan = [], tasinan = [];
    let arsivEnYeni = "";
    tumu.forEach(function (satir) {
      if (!satir[2]) return;
      const tarih = bicimle(satir[1], tz, "yyyy-MM-dd");
      if (tarih < sinir) {
        tasinan.push(satir);
        if (tarih > arsivEnYeni) arsivEnYeni = tarih;
      } else {
        kalan.push(satir);
      }
    });

    if (tasinan.length === 0) {
      Logger.log("Taşınacak satır yok.");
      return "Taşınacak satır yok.";
    }

    // 1) Önce arşive yaz ve diske indiğini doğrula.
    const arsiv = sayfaGetir(ARSIV_SHEET_ADI);
    const oncekiArsivSatir = arsiv.getLastRow();
    arsiv.getRange(oncekiArsivSatir + 1, 1, tasinan.length, baslik.length).setValues(tasinan);
    SpreadsheetApp.flush();
    const sonrakiArsivSatir = arsiv.getLastRow();
    if (sonrakiArsivSatir - oncekiArsivSatir !== tasinan.length) {
      throw new Error("Arşive yazma doğrulanamadı; Talepler sayfasına dokunulmadı.");
    }

    // 2) Ancak doğrulandıktan sonra Talepler sayfası yeniden yazılır.
    sayfa.getRange(2, 1, sayfa.getMaxRows() - 1, baslik.length).clearContent();
    if (kalan.length) {
      sayfa.getRange(2, 1, kalan.length, baslik.length).setValues(kalan);
    }
    SpreadsheetApp.flush();

    // 3) Panel eski tarih isterse arşivi de tarasın diye sınır kaydedilir.
    const ozellik = PropertiesService.getScriptProperties();
    const eskiSinir = ozellik.getProperty("ARSIV_SON_TARIH") || "";
    if (arsivEnYeni > eskiSinir) ozellik.setProperty("ARSIV_SON_TARIH", arsivEnYeni);

    const mesaj = tasinan.length + " satır arşive taşındı, " + kalan.length + " satır kaldı.";
    Logger.log(mesaj);
    return mesaj;
  } finally {
    kilit.releaseLock();
  }
}
