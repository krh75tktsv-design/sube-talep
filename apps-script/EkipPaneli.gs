// Ekip Paneli — duyuru, birim mesajlaşma, görev takibi ve vardiya devir notu.
// Şube Talepleri sisteminden BAĞIMSIZ çalışır: kendi e-tablosu, kendi Web App URL'si.
//
// KURULUM (tek seferlik, ~10 dakika):
// 1) sheets.google.com > yeni boş e-tablo > adını "Ekip Paneli" koy.
// 2) Uzantılar > Apps Script. Açılan editördeki her şeyi sil, bu dosyanın
//    tamamını yapıştır, kaydet (disket ikonu).
// 3) Üstteki fonksiyon listesinden "kurulum" seç, Çalıştır'a bas.
//    İlk seferde yetki isteyecek: Gözden geçir > hesabını seç >
//    Gelişmiş > "... projesine git" > İzin ver.
//    Bu adım 6 sekmeyi oluşturur ve ilk yönetici kaydını açar.
// 4) Dağıt > Yeni dağıtım > tür: Web uygulaması.
//      - Yürüten: Ben (kendi hesabın)
//      - Erişimi olanlar: Herkes
//    Dağıt'a bas, verilen Web App URL'sini kopyala.
// 5) O URL'yi ekip-paneli.js dosyasının en üstündeki APPS_SCRIPT_URL
//    sabitine yapıştır.
// 6) E-tablodaki "Kisiler" sekmesine ekip arkadaşlarını satır satır ekle
//    (Ad, Birim, PIN, Rol, Aktif). Panel bunu anında görür, kod değişikliği
//    gerekmez.
//
// KOD DEĞİŞTİRDİĞİNDE: Dağıt > Dağıtımları yönet > kalem ikonu >
// Sürüm: "Yeni sürüm" > Dağıt. URL aynı kalır.

const BIRIMLER = ["Üretim", "Sevkiyat", "Satış", "Sipariş Alma", "Yönetim"];

// kurulum() çalıştığında Kisiler sekmesi boşsa açılacak ilk yönetici.
// Panele bu bilgilerle girip kendi PIN'ini değiştirebilirsin.
const ILK_YONETICI = { ad: "Serkan Salihoğlu", birim: "Yönetim", pin: "1234" };

// Panelin bir seferde çektiği kayıt sınırları (e-tablo büyüdükçe hız korunur).
const LIMIT = { mesaj: 300, duyuru: 80, gorev: 200, devir: 60, okundu: 3000 };

// Bu günden eski mesaj / devir notu kayıtları gece temizlikçisinde silinir.
const SAKLAMA_GUN = { mesaj: 90, devir: 180 };

const SEKMELER = {
  Kisiler:      ["Ad", "Birim", "PIN", "Rol", "Aktif"],
  Duyurular:    ["Id", "Zaman", "Yazan", "Hedef", "Baslik", "Metin", "Oncelik", "Silindi"],
  Okundu:       ["DuyuruId", "Kisi", "Zaman"],
  Mesajlar:     ["Id", "Zaman", "Yazan", "Kanal", "Metin", "Silindi"],
  Gorevler:     ["Id", "Zaman", "Olusturan", "HedefBirim", "HedefKisi", "Baslik", "SonTarih", "Durum", "Kapatan", "KapanisZamani", "Silindi"],
  DevirNotlari: ["Id", "Zaman", "Tarih", "Birim", "Yazan", "Metin", "Silindi"],
};

// ————————————————————————————————————————————— kurulum

function kurulum() {
  Object.keys(SEKMELER).forEach(function (ad) {
    sekme(ad);
  });

  const kisiler = sekme("Kisiler");
  if (kisiler.getLastRow() < 2) {
    kisiler.appendRow([ILK_YONETICI.ad, ILK_YONETICI.birim, ILK_YONETICI.pin, "yonetici", "evet"]);
  }

  // Birim sütunu için açılır liste — elle yazarken yazım hatasını önler.
  const kural = SpreadsheetApp.newDataValidation().requireValueInList(BIRIMLER, true).build();
  kisiler.getRange(2, 2, 500, 1).setDataValidation(kural);
  const rolKural = SpreadsheetApp.newDataValidation().requireValueInList(["yonetici", "uye"], true).build();
  kisiler.getRange(2, 4, 500, 1).setDataValidation(rolKural);
  const aktifKural = SpreadsheetApp.newDataValidation().requireValueInList(["evet", "hayır"], true).build();
  kisiler.getRange(2, 5, 500, 1).setDataValidation(aktifKural);
  // PIN'ler metin olarak dursun ki baştaki sıfır (0123) kaybolmasın.
  kisiler.getRange(2, 3, 500, 1).setNumberFormat("@");

  temizlikTetikleyicisiKur();
  surumuArtir();

  SpreadsheetApp.getUi().alert(
    "Kurulum tamam.\n\n" +
    "Sekmeler oluşturuldu ve ilk yönetici eklendi:\n" +
    ILK_YONETICI.ad + " — PIN " + ILK_YONETICI.pin + "\n\n" +
    "Sıradaki adım: Dağıt > Yeni dağıtım > Web uygulaması."
  );
}

function sekme(ad) {
  const kitap = SpreadsheetApp.getActiveSpreadsheet();
  let s = kitap.getSheetByName(ad);
  if (!s) {
    s = kitap.insertSheet(ad);
  }
  const basliklar = SEKMELER[ad];
  if (s.getLastRow() === 0) {
    s.appendRow(basliklar);
    s.getRange(1, 1, 1, basliklar.length).setFontWeight("bold");
    s.setFrozenRows(1);
  }
  return s;
}

function temizlikTetikleyicisiKur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "geceTemizligi") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("geceTemizligi").timeBased().everyDays(1).atHour(3).create();
}

// ————————————————————————————————————————————— istekler

function doGet(e) {
  // Tek işi var: "yeni bir şey oldu mu?" sorusuna ucuza cevap vermek.
  // Panel bunu dakikada bir sorar; sürüm değişmediyse ağır veri çekmez.
  const p = (e && e.parameter) || {};
  if (p.islem === "nabiz") {
    return json({ ok: true, surum: surum() });
  }
  return json({ ok: true, bilgi: "Ekip Paneli servisi çalışıyor." });
}

function doPost(e) {
  try {
    const v = JSON.parse(e.postData.contents);
    const kisi = dogrula(v.ad, v.pin);

    if (v.islem === "giris") {
      if (!kisi) return json({ ok: false, hata: "Ad veya PIN hatalı." });
      return json({ ok: true, kisi: kisi, birimler: BIRIMLER });
    }

    // Giriş ekranı için: sadece isim listesi, PIN'siz.
    if (v.islem === "kisiListesi") {
      return json({ ok: true, kisiler: kisiler().map(function (k) {
        return { ad: k.ad, birim: k.birim };
      }) });
    }

    if (!kisi) return json({ ok: false, hata: "Oturum geçersiz. Yeniden giriş yapın.", yenidenGiris: true });

    switch (v.islem) {
      case "veri":          return json(veriPaketi(kisi));
      case "duyuruEkle":    return duyuruEkle(kisi, v);
      case "okundu":        return okunduIsaretle(kisi, v);
      case "mesajEkle":     return mesajEkle(kisi, v);
      case "gorevEkle":     return gorevEkle(kisi, v);
      case "gorevGuncelle": return gorevGuncelle(kisi, v);
      case "devirEkle":     return devirEkle(kisi, v);
      case "sil":           return kayitSil(kisi, v);
      case "pinDegistir":   return pinDegistir(kisi, v);
      default:              return json({ ok: false, hata: "Bilinmeyen işlem: " + v.islem });
    }
  } catch (hata) {
    return json({ ok: false, hata: String(hata && hata.message ? hata.message : hata) });
  }
}

function json(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

// ————————————————————————————————————————————— kimlik

function kisiler() {
  const s = sekme("Kisiler");
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, 5).getValues()
    .filter(function (r) { return String(r[0]).trim(); })
    .map(function (r, i) {
      return {
        satir: i + 2,
        ad: String(r[0]).trim(),
        birim: String(r[1]).trim(),
        pin: String(r[2]).trim(),
        rol: String(r[3]).trim().toLowerCase() || "uye",
        aktif: String(r[4]).trim().toLowerCase() !== "hayır",
      };
    })
    .filter(function (k) { return k.aktif; });
}

function dogrula(ad, pin) {
  if (!ad || !pin) return null;
  const bulunan = kisiler().filter(function (k) {
    return k.ad === String(ad).trim() && k.pin === String(pin).trim();
  })[0];
  if (!bulunan) return null;
  return { ad: bulunan.ad, birim: bulunan.birim, rol: bulunan.rol, satir: bulunan.satir };
}

function pinDegistir(kisi, v) {
  const yeni = String(v.yeniPin || "").trim();
  if (!/^\d{4}$/.test(yeni)) return json({ ok: false, hata: "PIN 4 rakam olmalı." });
  sekme("Kisiler").getRange(kisi.satir, 3).setValue(yeni);
  return json({ ok: true });
}

// ————————————————————————————————————————————— okuma

// Son N satırı okur — sekme büyüse de istek süresi sabit kalır.
function sonSatirlar(ad, limit) {
  const s = sekme(ad);
  const sonSatir = s.getLastRow();
  if (sonSatir < 2) return [];
  const adet = Math.min(limit, sonSatir - 1);
  const bas = sonSatir - adet + 1;
  return s.getRange(bas, 1, adet, SEKMELER[ad].length).getValues();
}

function veriPaketi(kisi) {
  const tz = Session.getScriptTimeZone();
  const zmn = function (d) { return bicimle(d, tz, "yyyy-MM-dd HH:mm"); };

  const duyurular = sonSatirlar("Duyurular", LIMIT.duyuru)
    .filter(function (r) { return r[0] && !r[7]; })
    .map(function (r) {
      return {
        id: String(r[0]), zaman: zmn(r[1]), yazan: r[2],
        hedef: String(r[3] || "Hepsi"), baslik: r[4], metin: r[5],
        oncelik: String(r[6] || "normal"),
      };
    })
    .filter(function (d) {
      // Yazan kişi, hedef kitlede olmasa da kendi duyurusunu görür.
      return d.hedef === "Hepsi" || d.yazan === kisi.ad ||
        d.hedef.split(",").indexOf(kisi.birim) >= 0;
    })
    .reverse();

  const okundu = {};
  sonSatirlar("Okundu", LIMIT.okundu).forEach(function (r) {
    const id = String(r[0]);
    if (!id) return;
    if (!okundu[id]) okundu[id] = [];
    okundu[id].push(String(r[1]));
  });

  const mesajlar = sonSatirlar("Mesajlar", LIMIT.mesaj)
    .filter(function (r) { return r[0] && !r[5]; })
    .map(function (r) {
      return { id: String(r[0]), zaman: zmn(r[1]), yazan: r[2], kanal: r[3], metin: r[4] };
    });

  const gorevler = sonSatirlar("Gorevler", LIMIT.gorev)
    .filter(function (r) { return r[0] && !r[10]; })
    .map(function (r) {
      return {
        id: String(r[0]), zaman: zmn(r[1]), olusturan: r[2],
        hedefBirim: r[3], hedefKisi: r[4], baslik: r[5],
        sonTarih: bicimle(r[6], tz, "yyyy-MM-dd"),
        durum: String(r[7] || "acik"), kapatan: r[8],
        kapanisZamani: zmn(r[9]),
      };
    })
    .reverse();

  const devir = sonSatirlar("DevirNotlari", LIMIT.devir)
    .filter(function (r) { return r[0] && !r[6]; })
    .map(function (r) {
      return {
        id: String(r[0]), zaman: zmn(r[1]),
        tarih: bicimle(r[2], tz, "yyyy-MM-dd"),
        birim: r[3], yazan: r[4], metin: r[5],
      };
    })
    .reverse();

  return {
    ok: true,
    surum: surum(),
    kisi: { ad: kisi.ad, birim: kisi.birim, rol: kisi.rol },
    birimler: BIRIMLER,
    ekip: kisiler().map(function (k) { return { ad: k.ad, birim: k.birim, rol: k.rol }; }),
    duyurular: duyurular,
    okundu: okundu,
    mesajlar: mesajlar,
    gorevler: gorevler,
    devir: devir,
  };
}

function bicimle(deger, tz, format) {
  if (Object.prototype.toString.call(deger) === "[object Date]") {
    return Utilities.formatDate(deger, tz, format);
  }
  return deger === "" || deger === null || deger === undefined ? "" : String(deger);
}

// ————————————————————————————————————————————— yazma

function yeniId() {
  return Utilities.getUuid().slice(0, 8);
}

function duyuruEkle(kisi, v) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Duyuru yayınlama yetkiniz yok." });
  const metin = String(v.metin || "").trim();
  const baslik = String(v.baslik || "").trim();
  if (!baslik || !metin) return json({ ok: false, hata: "Başlık ve metin zorunlu." });

  const hedef = Array.isArray(v.hedef) && v.hedef.length ? v.hedef.join(",") : "Hepsi";
  const id = yeniId();
  sekme("Duyurular").appendRow([
    id, new Date(), kisi.ad, hedef, baslik, metin,
    String(v.oncelik || "normal"), "",
  ]);
  surumuArtir();
  return json({ ok: true, id: id });
}

function okunduIsaretle(kisi, v) {
  const id = String(v.duyuruId || "");
  if (!id) return json({ ok: false, hata: "Duyuru id yok." });
  const s = sekme("Okundu");
  if (s.getLastRow() > 1) {
    const varMi = s.getRange(2, 1, s.getLastRow() - 1, 2).getValues().some(function (r) {
      return String(r[0]) === id && String(r[1]) === kisi.ad;
    });
    if (varMi) return json({ ok: true, tekrar: true });
  }
  s.appendRow([id, kisi.ad, new Date()]);
  surumuArtir();
  return json({ ok: true });
}

function mesajEkle(kisi, v) {
  const metin = String(v.metin || "").trim();
  if (!metin) return json({ ok: false, hata: "Boş mesaj gönderilemez." });
  const kanal = String(v.kanal || "Genel").trim();
  const id = yeniId();
  sekme("Mesajlar").appendRow([id, new Date(), kisi.ad, kanal, metin, ""]);
  surumuArtir();
  return json({ ok: true, id: id });
}

function gorevEkle(kisi, v) {
  const baslik = String(v.baslik || "").trim();
  if (!baslik) return json({ ok: false, hata: "Görev başlığı zorunlu." });
  const id = yeniId();
  sekme("Gorevler").appendRow([
    id, new Date(), kisi.ad,
    String(v.hedefBirim || ""), String(v.hedefKisi || ""),
    baslik, String(v.sonTarih || ""), "acik", "", "", "",
  ]);
  surumuArtir();
  return json({ ok: true, id: id });
}

function gorevGuncelle(kisi, v) {
  const s = sekme("Gorevler");
  const satir = satirBul(s, String(v.id || ""));
  if (!satir) return json({ ok: false, hata: "Görev bulunamadı." });

  const durum = String(v.durum || "");
  if (["acik", "devam", "bitti"].indexOf(durum) < 0) {
    return json({ ok: false, hata: "Geçersiz durum." });
  }
  s.getRange(satir, 8).setValue(durum);
  if (durum === "bitti") {
    s.getRange(satir, 9).setValue(kisi.ad);
    s.getRange(satir, 10).setValue(new Date());
  } else {
    s.getRange(satir, 9).setValue("");
    s.getRange(satir, 10).setValue("");
  }
  surumuArtir();
  return json({ ok: true });
}

function devirEkle(kisi, v) {
  const metin = String(v.metin || "").trim();
  if (!metin) return json({ ok: false, hata: "Not boş olamaz." });
  const id = yeniId();
  const tarih = String(v.tarih || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"));
  sekme("DevirNotlari").appendRow([
    id, new Date(), tarih, String(v.birim || kisi.birim), kisi.ad, metin, "",
  ]);
  surumuArtir();
  return json({ ok: true, id: id });
}

// Silme = satırı yok etmek değil, "Silindi" sütununu işaretlemek.
// Kayıt e-tabloda kalır, panelde görünmez. Yanlışlıkla silineni
// sütunu boşaltarak geri getirebilirsin.
const SILINDI_SUTUNU = { Duyurular: 8, Mesajlar: 6, Gorevler: 11, DevirNotlari: 7 };
const YAZAN_SUTUNU   = { Duyurular: 3, Mesajlar: 3, Gorevler: 3, DevirNotlari: 5 };

function kayitSil(kisi, v) {
  const tur = String(v.tur || "");
  if (!SILINDI_SUTUNU[tur]) return json({ ok: false, hata: "Geçersiz kayıt türü." });
  const s = sekme(tur);
  const satir = satirBul(s, String(v.id || ""));
  if (!satir) return json({ ok: false, hata: "Kayıt bulunamadı." });

  const yazan = String(s.getRange(satir, YAZAN_SUTUNU[tur]).getValue()).trim();
  if (kisi.rol !== "yonetici" && yazan !== kisi.ad) {
    return json({ ok: false, hata: "Sadece kendi kaydınızı silebilirsiniz." });
  }
  s.getRange(satir, SILINDI_SUTUNU[tur]).setValue("evet");
  surumuArtir();
  return json({ ok: true });
}

function satirBul(s, id) {
  if (!id || s.getLastRow() < 2) return 0;
  const idler = s.getRange(2, 1, s.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < idler.length; i++) {
    if (String(idler[i][0]) === id) return i + 2;
  }
  return 0;
}

// ————————————————————————————————————————————— sürüm sayacı

// Her yazmada artar. Panel dakikada bir doGet?islem=nabiz ile bunu
// sorar; değişmemişse ağır veri isteğini hiç yapmaz. Böylece 30 kişi
// aynı anda açık dursa bile Apps Script kotası zorlanmaz.
function surum() {
  return Number(PropertiesService.getScriptProperties().getProperty("surum") || 0);
}

function surumuArtir() {
  PropertiesService.getScriptProperties().setProperty("surum", String(Date.now()));
}

// ————————————————————————————————————————————— bakım

function geceTemizligi() {
  eskileriSil("Mesajlar", 2, SAKLAMA_GUN.mesaj);
  eskileriSil("DevirNotlari", 2, SAKLAMA_GUN.devir);
}

function eskileriSil(ad, zamanSutunu, gun) {
  const s = sekme(ad);
  if (s.getLastRow() < 2) return;
  const sinir = new Date(Date.now() - gun * 24 * 60 * 60 * 1000);
  const zamanlar = s.getRange(2, zamanSutunu, s.getLastRow() - 1, 1).getValues();

  // Kayıtlar zaman sırasıyla eklendiği için eski olanlar hep en üstte.
  let silinecek = 0;
  for (let i = 0; i < zamanlar.length; i++) {
    const d = zamanlar[i][0];
    if (d instanceof Date && d < sinir) silinecek++;
    else break;
  }
  if (silinecek > 0) s.deleteRows(2, silinecek);
}
