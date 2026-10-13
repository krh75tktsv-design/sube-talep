// Filo Paneli — sevkiyat araçlarının km, yakıt, bakım, belge ve gider takibi.
// Şube Talepleri ve Ekip Paneli'nden BAĞIMSIZ çalışır: kendi e-tablosu, kendi Web App URL'si.
//
// İki rol var:
//   yonetici — tüm araçlar, tüm kayıtlar, giderler; araç ve kişi ekler/düzenler.
//   sofor    — yalnızca kendisine atanmış araçları görür; km, yakıt, arıza ve
//              HGS girer. Kendi girdiği kaydı 24 saat içinde düzeltip silebilir.
//
// KURULUM (tek seferlik, ~10 dakika):
// 1) sheets.google.com > yeni boş e-tablo > adını "Filo Paneli" koy.
// 2) Uzantılar > Apps Script. Açılan editördeki her şeyi sil, bu dosyanın
//    tamamını yapıştır, kaydet (disket ikonu).
// 3) Üstteki fonksiyon listesinden "kurulum" seç, Çalıştır'a bas.
//    İlk seferde yetki isteyecek: Gözden geçir > hesabını seç >
//    Gelişmiş > "... projesine git" > İzin ver.
//    Bu adım 3 sekmeyi oluşturur, ILK_YONETICILER'i ekler ve her birine
//    rastgele 6 haneli PIN verip ekranda gösterir — bu PIN'leri not al.
//    (PIN'ler bu dosyada yazmaz; depo herkese açık.)
// 4) Dağıt > Yeni dağıtım > tür: Web uygulaması.
//      - Yürüten: Ben (kendi hesabın)
//      - Erişimi olanlar: Herkes
//    Dağıt'a bas, verilen Web App URL'sini kopyala.
// 5) O URL'yi filo.html dosyasındaki APPS_SCRIPT_URL sabitine yapıştır.
//    Not: Güzergâh km'si Google Haritalar'dan (Apps Script'in Maps hizmeti)
//    hesaplanır; ilk yetki ekranında bunun izni de istenir.
// 6) PIN'leri sahiplerine ilet. Araçları ve şoförleri panelin "Araçlar" ve
//    "Kişiler" sekmelerinden ekle. Herkes kendi PIN'ini sağ üstteki PIN
//    düğmesinden değiştirebilir.
//
// KOD DEĞİŞTİRDİĞİNDE: Dağıt > Dağıtımları yönet > kalem ikonu >
// Sürüm: "Yeni sürüm" > Dağıt. URL aynı kalır. ("Yeni dağıtım" URL'yi değiştirir.)

// kurulum() çalıştığında Kisiler sekmesinde yoksa eklenecek yöneticiler.
// Hepsi aynı yetkide: tüm araçlar, giderler, araç/şoför ekleme, PIN verme.
const ILK_YONETICILER = ["Serkan Salihoğlu", "Ayhan Türedi", "Muzaffer Yıldırım"];

// Üst üste bu kadar yanlış PIN girilen isim KILIT_DAKIKA boyunca kilitlenir.
const HATALI_DENEME = 5;
const KILIT_DAKIKA = 15;

// Şoförün kendi kaydını düzeltebileceği / silebileceği süre.
const SOFOR_DUZELTME_SAAT = 24;

// Panele gönderilen kayıtlar: yönetici son 400 gün, şoför son 60 gün (yalnızca kendi araçları).
const GUN_SINIRI = { yonetici: 400, sofor: 60 };

const ROLLER = ["yonetici", "sofor"];
const TURLER = ["km", "yakit", "bakim", "tamir", "lastik", "muayene", "trafik", "kasko", "hgs", "ceza", "ariza", "diger"];
const SOFOR_TURLERI = ["km", "yakit", "ariza", "hgs"];
const BELGE_TURU = { muayene: "muayene", trafik: "trafik", kasko: "kasko" };

// Sekme adı → [sütun başlığı, alan adı, tür]. Tür: m=metin, s=sayı, t=tarih (yyyy-MM-dd metin), b=evet/hayır
const SEKMELER = {
  Kisiler: [
    ["Ad", "ad", "m"], ["Rol", "rol", "m"], ["PIN", "pin", "m"],
    ["Araclar", "araclar", "m"], ["Aktif", "aktif", "b"],
  ],
  Araclar: [
    ["Id", "id", "m"], ["Plaka", "plaka", "m"], ["Tip", "tip", "m"], ["Marka", "marka", "m"],
    ["Yil", "yil", "m"], ["Sofor", "surucu", "m"], ["Guzergah", "guzergah", "m"],
    ["BaslangicKm", "baslangicKm", "s"], ["BakimKm", "bakimKm", "s"], ["BakimAy", "bakimAy", "s"],
    ["SonBakimKm", "sonBakimKm", "s"], ["SonBakimTarih", "sonBakimTarih", "t"],
    ["Muayene", "muayene", "t"], ["Trafik", "trafik", "t"], ["Kasko", "kasko", "t"],
    ["Aktif", "aktif", "b"], ["Not", "not", "m"], ["Guncelleme", "guncelleme", "m"],
  ],
  Kayitlar: [
    ["Id", "id", "m"], ["Zaman", "zaman", "m"], ["Giren", "giren", "m"], ["AracId", "aracId", "m"],
    ["Plaka", "plaka", "m"], ["Tur", "tur", "m"], ["Tarih", "tarih", "t"], ["Km", "km", "s"],
    ["Litre", "litre", "s"], ["Tutar", "tutar", "s"], ["Yer", "yer", "m"], ["Aciklama", "aciklama", "m"],
    ["Bitis", "bitis", "t"], ["Cozuldu", "cozuldu", "m"], ["Silindi", "silindi", "m"],
  ],
  // Güzergâh planlaması: duraklar (atölye, şubeler), hazır güzergâhlar,
  // araç başına günlük plan ve Google Haritalar'dan hesaplanan durak arası mesafeler.
  // Tur "teslimat" olan duraklar tek seferlik müşteri adresleridir (özel tasarım pasta vb.).
  Duraklar: [
    ["Id", "id", "m"], ["Ad", "ad", "m"], ["Adres", "adres", "m"], ["Aktif", "aktif", "b"],
    ["Tur", "tur", "m"], ["Telefon", "telefon", "m"], ["Saat", "saat", "m"], ["Siparis", "siparis", "m"],
    ["Tarih", "tarih", "t"], ["Teslim", "teslim", "m"], ["Olusturan", "olusturan", "m"],
  ],
  Guzergahlar: [
    ["Id", "id", "m"], ["Ad", "ad", "m"], ["Duraklar", "duraklar", "m"], ["Km", "km", "s"],
    ["Dk", "dk", "s"], ["Eksik", "eksik", "m"], ["Aktif", "aktif", "b"], ["Not", "not", "m"],
  ],
  Planlar: [
    ["Id", "id", "m"], ["Tarih", "tarih", "t"], ["AracId", "aracId", "m"], ["Plaka", "plaka", "m"],
    ["Duraklar", "duraklar", "m"], ["PlanKm", "planKm", "s"], ["Dk", "dk", "s"],
    ["KmKaynak", "kmKaynak", "m"], ["Eksik", "eksik", "m"], ["Not", "not", "m"],
    ["Olusturan", "olusturan", "m"], ["Zaman", "zaman", "m"], ["Silindi", "silindi", "m"],
  ],
  // Bir kez hesaplanan bacak burada saklanır, haritaya tekrar sorulmaz.
  // Yanlış bulduğun mesafeyi Km hücresini düzelterek değiştirebilirsin.
  Mesafeler: [
    ["Kimden", "kimden", "m"], ["Kime", "kime", "m"], ["Km", "km", "s"], ["Dk", "dk", "s"],
    ["Rota", "rota", "m"], ["Zaman", "zaman", "m"],
  ],
};

// Plan ile gün sonu km'si arasındaki farkın kabul edilen payı (panel de aynısını kullanır).
const PLAN_TOLERANS = { yuzde: 10, km: 8 };

// ————————————————————————————————————————————— kurulum

function kurulum() {
  const kitap = SpreadsheetApp.getActiveSpreadsheet();
  kitap.setSpreadsheetTimeZone("Europe/Istanbul");
  Object.keys(SEKMELER).forEach(function (ad) { sekme(ad); });

  const kisiler = sekme("Kisiler");
  kisiler.getRange(2, 3, 500, 1).setNumberFormat("@");
  const mevcut = tumSatirlar("Kisiler").map(function (k) { return k.ad; });
  const eklenen = [];
  ILK_YONETICILER.forEach(function (ad) {
    if (mevcut.indexOf(ad) >= 0) return;
    const pin = String(100000 + Math.floor(Math.random() * 900000));
    kisiler.appendRow([ad, "yonetici", pin, "", "evet"]);
    eklenen.push(ad + " — PIN " + pin);
  });
  const rolKural = SpreadsheetApp.newDataValidation().requireValueInList(ROLLER, true).build();
  kisiler.getRange(2, 2, 500, 1).setDataValidation(rolKural);
  const aktifKural = SpreadsheetApp.newDataValidation().requireValueInList(["evet", "hayır"], true).build();
  kisiler.getRange(2, 5, 500, 1).setDataValidation(aktifKural);

  Object.keys(SEKMELER).forEach(function (ad) { metinSutunlari(sekme(ad), ad); });

  surumuArtir();
  SpreadsheetApp.getUi().alert(
    "Kurulum tamam.\n\n" +
    (eklenen.length ? "Eklenen yöneticiler (PIN'leri not alın, bir daha gösterilmez):\n" + eklenen.join("\n") + "\n\n" : "Yöneticiler zaten kayıtlı.\n\n") +
    "Sıradaki adım: Dağıt > Yeni dağıtım > Web uygulaması."
  );
}

function sekme(ad) {
  const kitap = SpreadsheetApp.getActiveSpreadsheet();
  let s = kitap.getSheetByName(ad);
  if (!s) s = kitap.insertSheet(ad);
  if (s.getLastRow() === 0) {
    const basliklar = SEKMELER[ad].map(function (x) { return x[0]; });
    s.appendRow(basliklar);
    s.getRange(1, 1, 1, basliklar.length).setFontWeight("bold");
    s.setFrozenRows(1);
    metinSutunlari(s, ad);
  } else if (s.getLastColumn() < SEKMELER[ad].length) {
    // Koda sonradan eklenen sütunların başlığını mevcut sekmeye de yaz.
    const basliklar = SEKMELER[ad].map(function (x) { return x[0]; });
    s.getRange(1, 1, 1, basliklar.length).setValues([basliklar]).setFontWeight("bold");
    metinSutunlari(s, ad);
  }
  return s;
}

// Tarih, PIN ve kimlik sütunları metin kalsın: e-tablo "2026-10-13"ü tarihe,
// "0123"ü 123'e çevirmesin.
function metinSutunlari(s, ad) {
  SEKMELER[ad].forEach(function (sutun, i) {
    if (sutun[2] === "t" || ["pin", "id", "yil", "duraklar", "kimden", "kime", "aracId", "telefon", "saat"].indexOf(sutun[1]) >= 0) {
      s.getRange(2, i + 1, 20000, 1).setNumberFormat("@");
    }
  });
}

// ————————————————————————————————————————————— istekler

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.islem === "nabiz") return json({ ok: true, surum: surum() });
  return json({ ok: true, bilgi: "Filo Paneli servisi çalışıyor." });
}

function doPost(e) {
  try {
    const v = JSON.parse(e.postData.contents);

    if (v.islem === "kisiListesi") {
      return json({ ok: true, kisiler: kisiler().map(function (k) { return { ad: k.ad }; }) });
    }

    const sonuc = dogrula(v.ad, v.pin);
    if (sonuc.kilitli) return json({ ok: false, hata: "Çok fazla hatalı deneme. " + KILIT_DAKIKA + " dakika sonra tekrar deneyin.", yenidenGiris: true });
    const kisi = sonuc.kisi;

    if (v.islem === "giris") {
      if (!kisi) return json({ ok: false, hata: "Ad veya PIN hatalı." });
      return json({ ok: true, kisi: disKisi(kisi) });
    }
    if (!kisi) return json({ ok: false, hata: "Oturum geçersiz. Yeniden giriş yapın.", yenidenGiris: true });

    if (v.islem === "veri") return json(veriPaketi(kisi));

    // Yazma işlemleri aynı anda iki kişi tarafından yapılınca satırlar karışmasın.
    const kilit = LockService.getScriptLock();
    kilit.waitLock(20000);
    try {
      switch (v.islem) {
        case "kayitKaydet":   return kayitKaydet(kisi, v.kayit || {});
        case "kayitSil":      return kayitSil(kisi, String(v.id || ""));
        case "arizaKapat":    return arizaKapat(kisi, String(v.id || ""), v.geriAc === true);
        case "aracKaydet":    return aracKaydet(kisi, v.arac || {});
        case "aracSil":       return aracSil(kisi, String(v.id || ""));
        case "kisiKaydet":    return kisiKaydet(kisi, v);
        case "pinDegistir":   return pinDegistir(kisi, v);
        case "durakKaydet":   return durakKaydet(kisi, v.durak || {});
        case "teslimEt":      return teslimEt(kisi, String(v.id || ""), v.geriAl === true);
        case "guzergahKaydet": return guzergahKaydet(kisi, v.guzergah || {});
        case "guzergahSil":   return guzergahSil(kisi, String(v.id || ""));
        case "planKaydet":    return planKaydet(kisi, v.plan || {});
        case "planSil":       return planSil(kisi, String(v.id || ""));
        case "planKopyala":   return planKopyala(kisi, String(v.kaynak || ""), String(v.hedef || ""));
        default:              return json({ ok: false, hata: "Bilinmeyen işlem: " + v.islem });
      }
    } finally {
      kilit.releaseLock();
    }
  } catch (hata) {
    return json({ ok: false, hata: String(hata && hata.message ? hata.message : hata) });
  }
}

function json(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne)).setMimeType(ContentService.MimeType.JSON);
}

// ————————————————————————————————————————————— satır ↔ nesne

const TZ = "Europe/Istanbul";

function hucreOku(deger, tur) {
  if (deger === "" || deger === null || deger === undefined) return tur === "b" ? true : null;
  if (tur === "s") { const n = Number(deger); return isFinite(n) ? n : null; }
  if (tur === "t") {
    if (Object.prototype.toString.call(deger) === "[object Date]") return Utilities.formatDate(deger, TZ, "yyyy-MM-dd");
    return String(deger).trim().slice(0, 10) || null;
  }
  if (tur === "b") return String(deger).trim().toLowerCase() !== "hayır";
  if (Object.prototype.toString.call(deger) === "[object Date]") return Utilities.formatDate(deger, TZ, "yyyy-MM-dd HH:mm");
  return String(deger).trim();
}

function hucreYaz(deger, tur) {
  if (deger === null || deger === undefined || deger === "") return tur === "b" ? "evet" : "";
  if (tur === "s") { const n = Number(deger); return isFinite(n) ? n : ""; }
  if (tur === "b") return deger ? "evet" : "hayır";
  if (tur === "t") return /^\d{4}-\d{2}-\d{2}$/.test(String(deger)) ? String(deger) : "";
  return String(deger).slice(0, 2000);
}

function tumSatirlar(ad) {
  const s = sekme(ad), alanlar = SEKMELER[ad];
  if (s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, alanlar.length).getValues().map(function (r, i) {
    const o = { _satir: i + 2 };
    alanlar.forEach(function (a, j) { o[a[1]] = hucreOku(r[j], a[2]); });
    return o;
  });
}

function satirDizisi(ad, o) {
  return SEKMELER[ad].map(function (a) { return hucreYaz(o[a[1]], a[2]); });
}

function satirYaz(ad, satir, o) {
  const s = sekme(ad), dizi = satirDizisi(ad, o);
  if (satir) s.getRange(satir, 1, 1, dizi.length).setValues([dizi]);
  else s.appendRow(dizi);
}

function temiz(o) {
  const c = {};
  Object.keys(o).forEach(function (k) { if (k.charAt(0) !== "_" && o[k] !== null && o[k] !== "") c[k] = o[k]; });
  return c;
}

// ————————————————————————————————————————————— kimlik

function kisiler() {
  return tumSatirlar("Kisiler").filter(function (k) { return k.ad && k.aktif; }).map(function (k) {
    k.rol = ROLLER.indexOf(String(k.rol || "").toLowerCase()) >= 0 ? String(k.rol).toLowerCase() : "sofor";
    k.pin = String(k.pin || "");
    k.aracListesi = String(k.araclar || "").split(",").map(plakaAnahtar).filter(String);
    return k;
  });
}

function dogrula(ad, pin) {
  if (!ad || !pin) return { kisi: null };
  ad = String(ad).trim();
  const cache = CacheService.getScriptCache();
  const anahtar = "hata:" + ad;
  const hatalar = Number(cache.get(anahtar) || 0);
  if (hatalar >= HATALI_DENEME) return { kilitli: true };
  const k = kisiler().filter(function (x) { return x.ad === ad; })[0];
  if (!k || k.pin !== String(pin).trim()) {
    cache.put(anahtar, String(hatalar + 1), KILIT_DAKIKA * 60);
    return { kisi: null };
  }
  if (hatalar) cache.remove(anahtar);
  return { kisi: k };
}

function disKisi(k) {
  return { ad: k.ad, rol: k.rol };
}

function plakaAnahtar(p) {
  return String(p || "").toLocaleUpperCase("tr").replace(/\s+/g, "");
}

// Şoför yalnızca Kisiler › Araclar sütunundaki plakaları görür. Boşsa
// Araclar › Sofor sütununda adı yazan araçlar ona atanmış sayılır.
function gorebildigiAraclar(kisi, araclar) {
  if (kisi.rol === "yonetici") return araclar;
  return araclar.filter(function (a) {
    if (a.aktif === false) return false;
    if (kisi.aracListesi.length) return kisi.aracListesi.indexOf(plakaAnahtar(a.plaka)) >= 0;
    return String(a.surucu || "").trim() === kisi.ad;
  });
}

// ————————————————————————————————————————————— okuma

function veriPaketi(kisi) {
  const tumAraclar = tumSatirlar("Araclar").filter(function (a) { return a.id; });
  const araclar = gorebildigiAraclar(kisi, tumAraclar);
  const aracIdleri = {};
  araclar.forEach(function (a) { aracIdleri[a.id] = true; });

  const sinir = Utilities.formatDate(new Date(Date.now() - GUN_SINIRI[kisi.rol] * 86400000), TZ, "yyyy-MM-dd");
  const ozet = {};
  const kayitlar = [];
  tumSatirlar("Kayitlar").forEach(function (k) {
    if (!k.id || k.silindi || !aracIdleri[k.aracId]) return;
    // Araç başına güncel km ve son bakım tüm geçmişten hesaplanır;
    // panele yalnızca son dönemin kayıtları gider.
    const o = ozet[k.aracId] || (ozet[k.aracId] = { maxKm: null, maxKmTarih: null, sonBakimKm: null, sonBakimTarih: null });
    if (k.km != null && (o.maxKm == null || k.km > o.maxKm)) { o.maxKm = k.km; o.maxKmTarih = k.tarih; }
    if (k.tur === "bakim" && (!o.sonBakimTarih || k.tarih > o.sonBakimTarih || (k.tarih === o.sonBakimTarih && k.km > o.sonBakimKm))) {
      o.sonBakimTarih = k.tarih; o.sonBakimKm = k.km;
    }
    const acikAriza = k.tur === "ariza" && !k.cozuldu;
    if (k.tarih >= sinir || acikAriza) {
      if (kisi.rol === "sofor" && k.tur !== "km" && k.tur !== "yakit" && k.tur !== "ariza" && k.tur !== "hgs" && k.tur !== "bakim") return;
      kayitlar.push(temiz(k));
    }
  });

  const paket = {
    ok: true,
    surum: surum(),
    kisi: disKisi(kisi),
    araclar: araclar.map(temiz),
    kayitlar: kayitlar,
    ozet: ozet,
    soforDuzeltmeSaat: SOFOR_DUZELTME_SAAT,
    planTolerans: PLAN_TOLERANS,
  };

  // Şoför kendi araçlarının bir hafta öncesi ile bir hafta sonrası arasındaki planlarını görür.
  const gun = function (n) { return Utilities.formatDate(new Date(Date.now() + n * 86400000), TZ, "yyyy-MM-dd"); };
  const planAlt = kisi.rol === "yonetici" ? sinir : gun(-7);
  const planUst = kisi.rol === "yonetici" ? "9999-12-31" : gun(7);
  paket.planlar = tumSatirlar("Planlar").filter(function (p) {
    return p.id && !p.silindi && aracIdleri[p.aracId] && p.tarih >= planAlt && p.tarih <= planUst;
  }).map(temiz);

  // Müşteri adresleri: yönetici son dönemin hepsini, şoför yalnızca kendi
  // planlarındakileri görür. Sabit duraklar (atölye, şubeler) herkese gider.
  const plandaki = {};
  paket.planlar.forEach(function (p) { idListesi(p.duraklar).forEach(function (id) { plandaki[id] = true; }); });
  paket.duraklar = tumSatirlar("Duraklar").filter(function (d) {
    if (!d.id) return false;
    if (d.tur !== "teslimat") return true;
    return kisi.rol === "yonetici" ? (!d.tarih || d.tarih >= sinir) : !!plandaki[d.id];
  }).map(temiz);

  if (kisi.rol === "yonetici") {
    paket.guzergahlar = tumSatirlar("Guzergahlar").filter(function (g) { return g.id; }).map(temiz);
    paket.mesafeler = {};
    tumSatirlar("Mesafeler").forEach(function (m) {
      if (m.kimden && m.kime && m.km != null) paket.mesafeler[m.kimden + ">" + m.kime] = m.km;
    });
    paket.kisiler = tumSatirlar("Kisiler").filter(function (k) { return k.ad; }).map(function (k) {
      return { ad: k.ad, rol: k.rol || "sofor", araclar: k.araclar || "", aktif: k.aktif, pinVar: !!String(k.pin || "") };
    });
  }
  return paket;
}

// ————————————————————————————————————————————— yazma

function yeniId(on) {
  return on + Utilities.getUuid().replace(/-/g, "").slice(0, 10);
}

function simdi() {
  return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm");
}

function kayitKaydet(kisi, g) {
  const araclar = gorebildigiAraclar(kisi, tumSatirlar("Araclar").filter(function (a) { return a.id; }));
  const arac = araclar.filter(function (a) { return a.id === String(g.aracId || ""); })[0];
  if (!arac) return json({ ok: false, hata: "Bu araç için kayıt giremezsiniz." });

  const tur = String(g.tur || "");
  if (TURLER.indexOf(tur) < 0) return json({ ok: false, hata: "Geçersiz kayıt türü." });
  if (kisi.rol === "sofor" && SOFOR_TURLERI.indexOf(tur) < 0) return json({ ok: false, hata: "Bu kayıt türünü yalnızca yönetici girebilir." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.tarih || ""))) return json({ ok: false, hata: "Tarih eksik." });
  const km = g.km === null || g.km === undefined || g.km === "" ? null : Number(g.km);
  if (km !== null && (!isFinite(km) || km < 0 || km > 3000000)) return json({ ok: false, hata: "Km geçersiz." });
  if ((tur === "km" || tur === "yakit" || tur === "bakim") && km === null) return json({ ok: false, hata: "Bu kayıt türünde km zorunlu." });

  const sayi = function (x) { return x === null || x === undefined || x === "" ? null : (isFinite(Number(x)) ? Number(x) : null); };
  let mevcut = null;
  if (g.id) {
    mevcut = tumSatirlar("Kayitlar").filter(function (k) { return k.id === String(g.id) && !k.silindi; })[0];
    if (!mevcut) return json({ ok: false, hata: "Kayıt bulunamadı; silinmiş olabilir." });
    const izin = duzeltebilir(kisi, mevcut);
    if (!izin.ok) return json(izin);
  }

  const kayit = {
    id: mevcut ? mevcut.id : yeniId("k"),
    zaman: mevcut ? mevcut.zaman : simdi(),
    giren: mevcut ? mevcut.giren : kisi.ad,
    aracId: arac.id, plaka: arac.plaka, tur: tur, tarih: String(g.tarih), km: km,
    litre: tur === "yakit" ? sayi(g.litre) : null,
    tutar: tur === "km" || tur === "ariza" ? null : sayi(g.tutar),
    yer: String(g.yer || "").trim(), aciklama: String(g.aciklama || "").trim(),
    bitis: BELGE_TURU[tur] && /^\d{4}-\d{2}-\d{2}$/.test(String(g.bitis || "")) ? String(g.bitis) : null,
    cozuldu: mevcut ? mevcut.cozuldu : null, silindi: null,
  };
  if (tur === "ariza" && !kayit.aciklama) return json({ ok: false, hata: "Arızayı kısaca yazın." });
  satirYaz("Kayitlar", mevcut ? mevcut._satir : 0, kayit);

  // Muayene / sigorta / kasko kaydı yeni bitiş tarihi taşıyorsa aracın tarihini ileri al.
  const alan = BELGE_TURU[tur];
  if (alan && kayit.bitis && (!arac[alan] || kayit.bitis > arac[alan])) {
    arac[alan] = kayit.bitis;
    arac.guncelleme = simdi();
    satirYaz("Araclar", arac._satir, arac);
  }
  surumuArtir();
  return json({ ok: true, id: kayit.id });
}

function duzeltebilir(kisi, kayit) {
  if (kisi.rol === "yonetici") return { ok: true };
  if (kayit.giren !== kisi.ad) return { ok: false, hata: "Yalnızca kendi girdiğiniz kaydı değiştirebilirsiniz." };
  const zaman = String(kayit.zaman || "");
  const m = zaman.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (m) {
    const girildi = Utilities.parseDate(zaman.slice(0, 16), TZ, "yyyy-MM-dd HH:mm");
    if (Date.now() - girildi.getTime() > SOFOR_DUZELTME_SAAT * 3600000) {
      return { ok: false, hata: SOFOR_DUZELTME_SAAT + " saatten eski kayıtları yalnızca yönetici değiştirebilir." };
    }
  }
  return { ok: true };
}

// Silme = satırı yok etmek değil, "Silindi" sütununu işaretlemek.
// Yanlışlıkla silineni e-tabloda o hücreyi boşaltarak geri getirirsin.
function kayitSil(kisi, id) {
  const k = tumSatirlar("Kayitlar").filter(function (x) { return x.id === id && !x.silindi; })[0];
  if (!k) return json({ ok: false, hata: "Kayıt bulunamadı." });
  const izin = duzeltebilir(kisi, k);
  if (!izin.ok) return json(izin);
  k.silindi = simdi() + " " + kisi.ad;
  satirYaz("Kayitlar", k._satir, k);
  surumuArtir();
  return json({ ok: true });
}

function arizaKapat(kisi, id, geriAc) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Arızayı yalnızca yönetici kapatabilir." });
  const k = tumSatirlar("Kayitlar").filter(function (x) { return x.id === id && !x.silindi; })[0];
  if (!k || k.tur !== "ariza") return json({ ok: false, hata: "Arıza kaydı bulunamadı." });
  k.cozuldu = geriAc ? null : simdi() + " " + kisi.ad;
  satirYaz("Kayitlar", k._satir, k);
  surumuArtir();
  return json({ ok: true });
}

function aracKaydet(kisi, g) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Araçları yalnızca yönetici düzenleyebilir." });
  const plaka = String(g.plaka || "").trim().toLocaleUpperCase("tr");
  if (!plaka) return json({ ok: false, hata: "Plaka girin." });
  const tum = tumSatirlar("Araclar").filter(function (a) { return a.id; });
  const cakisan = tum.filter(function (a) { return a.id !== g.id && plakaAnahtar(a.plaka) === plakaAnahtar(plaka); })[0];
  if (cakisan) return json({ ok: false, hata: "Bu plaka zaten kayıtlı." });
  const mevcut = g.id ? tum.filter(function (a) { return a.id === String(g.id); })[0] : null;
  if (g.id && !mevcut) return json({ ok: false, hata: "Araç bulunamadı." });

  const arac = {};
  SEKMELER.Araclar.forEach(function (a) { arac[a[1]] = g[a[1]]; });
  arac.id = mevcut ? mevcut.id : yeniId("a");
  arac.plaka = plaka;
  arac.aktif = g.aktif !== false;
  arac.guncelleme = simdi();
  satirYaz("Araclar", mevcut ? mevcut._satir : 0, arac);

  // Plaka değiştiyse şoförlerin araç listesini de güncelle.
  if (mevcut && plakaAnahtar(mevcut.plaka) !== plakaAnahtar(plaka)) {
    tumSatirlar("Kisiler").forEach(function (k) {
      const liste = String(k.araclar || "").split(",").map(function (x) { return x.trim(); }).filter(String);
      const yeni = liste.map(function (x) { return plakaAnahtar(x) === plakaAnahtar(mevcut.plaka) ? plaka : x; });
      if (yeni.join(",") !== liste.join(",")) { k.araclar = yeni.join(", "); satirYaz("Kisiler", k._satir, k); }
    });
  }
  surumuArtir();
  return json({ ok: true, id: arac.id });
}

function aracSil(kisi, id) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Yetkiniz yok." });
  const a = tumSatirlar("Araclar").filter(function (x) { return x.id === id; })[0];
  if (!a) return json({ ok: false, hata: "Araç bulunamadı." });
  const kayitVar = tumSatirlar("Kayitlar").some(function (k) { return k.aracId === id && !k.silindi; });
  if (kayitVar) return json({ ok: false, hata: "Bu aracın kayıtları var; silmek yerine pasife alın." });
  sekme("Araclar").deleteRow(a._satir);
  surumuArtir();
  return json({ ok: true });
}

function kisiKaydet(kisi, v) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Kişileri yalnızca yönetici düzenleyebilir." });
  const g = v.kisi || {};
  const ad = String(g.ad || "").trim();
  if (!ad) return json({ ok: false, hata: "Ad girin." });
  const rol = ROLLER.indexOf(g.rol) >= 0 ? g.rol : "sofor";
  const tum = tumSatirlar("Kisiler").filter(function (k) { return k.ad; });
  const eskiAd = String(v.eskiAd || "").trim();
  const mevcut = eskiAd ? tum.filter(function (k) { return k.ad === eskiAd; })[0] : null;
  if (eskiAd && !mevcut) return json({ ok: false, hata: "Kişi bulunamadı." });
  if (tum.some(function (k) { return k.ad === ad && k !== mevcut; })) return json({ ok: false, hata: "Bu isimde biri zaten var." });
  const pin = String(g.pin || "").trim();
  if (pin && !/^\d{4,8}$/.test(pin)) return json({ ok: false, hata: "PIN 4–8 rakam olmalı." });
  if (!mevcut && !pin) return json({ ok: false, hata: "Yeni kişiye PIN verin." });
  if (rol === "yonetici" && pin && pin.length < 6) return json({ ok: false, hata: "Yönetici PIN'i en az 6 rakam olmalı." });
  // Kendini yöneticilikten çıkaran ya da pasife alan son yönetici paneli kilitlemesin.
  const digerYonetici = tum.some(function (k) { return k !== mevcut && k.aktif && String(k.rol) === "yonetici"; });
  if (mevcut && String(mevcut.rol) === "yonetici" && (rol !== "yonetici" || g.aktif === false) && !digerYonetici) {
    return json({ ok: false, hata: "En az bir aktif yönetici kalmalı." });
  }
  const yeni = {
    ad: ad, rol: rol, pin: pin || (mevcut ? mevcut.pin : ""),
    araclar: String(g.araclar || "").trim(), aktif: g.aktif !== false,
  };
  satirYaz("Kisiler", mevcut ? mevcut._satir : 0, yeni);
  surumuArtir();
  return json({ ok: true });
}

function pinDegistir(kisi, v) {
  const yeni = String(v.yeniPin || "").trim();
  const enAz = kisi.rol === "yonetici" ? 6 : 4;
  if (!new RegExp("^\\d{" + enAz + ",8}$").test(yeni)) return json({ ok: false, hata: "PIN " + enAz + "–8 rakam olmalı." });
  sekme("Kisiler").getRange(kisi._satir, 3).setValue(yeni);
  return json({ ok: true });
}

// ————————————————————————————————————————————— güzergâh planlaması

function yoneticiMi(kisi) {
  return kisi.rol === "yonetici" ? null : json({ ok: false, hata: "Güzergâh planını yalnızca yönetici düzenleyebilir." });
}

function idListesi(v) {
  const dizi = Array.isArray(v) ? v : String(v || "").split(",");
  return dizi.map(function (x) { return String(x).trim(); }).filter(String);
}

function durakKaydet(kisi, g) {
  const red = yoneticiMi(kisi); if (red) return red;
  const teslimat = g.tur === "teslimat";
  const ad = String(g.ad || "").trim();
  if (!ad) return json({ ok: false, hata: teslimat ? "Müşteri adını ya da siparişi yazın." : "Durak adını girin." });
  if (teslimat && !String(g.adres || "").trim()) return json({ ok: false, hata: "Teslimat adresini yazın." });
  const tum = tumSatirlar("Duraklar").filter(function (d) { return d.id; });
  if (!teslimat && tum.some(function (d) { return d.id !== g.id && d.tur !== "teslimat" && d.ad.toLocaleLowerCase("tr") === ad.toLocaleLowerCase("tr"); })) {
    return json({ ok: false, hata: "Bu isimde bir durak zaten var." });
  }
  const mevcut = g.id ? tum.filter(function (d) { return d.id === String(g.id); })[0] : null;
  if (g.id && !mevcut) return json({ ok: false, hata: "Durak bulunamadı." });
  const durak = {
    id: mevcut ? mevcut.id : yeniId(teslimat ? "t" : "d"), ad: ad, adres: String(g.adres || "").trim(), aktif: g.aktif !== false,
    tur: teslimat ? "teslimat" : "", telefon: teslimat ? String(g.telefon || "").trim() : "",
    saat: teslimat ? String(g.saat || "").trim() : "", siparis: teslimat ? String(g.siparis || "").trim() : "",
    tarih: teslimat && /^\d{4}-\d{2}-\d{2}$/.test(String(g.tarih || "")) ? String(g.tarih) : null,
    teslim: mevcut ? mevcut.teslim : null, olusturan: mevcut ? mevcut.olusturan : kisi.ad,
  };
  satirYaz("Duraklar", mevcut ? mevcut._satir : 0, durak);
  // Adres değiştiyse bu durağa ait eski mesafeler geçersiz.
  if (mevcut && mevcut.adres !== durak.adres) mesafeleriSil(durak.id);
  surumuArtir();
  return json({ ok: true, id: durak.id });
}

// Şoför teslimatı, kendi aracının planındaysa işaretleyebilir; yönetici her zaman.
function teslimEt(kisi, id, geriAl) {
  const d = tumSatirlar("Duraklar").filter(function (x) { return x.id === id && x.tur === "teslimat"; })[0];
  if (!d) return json({ ok: false, hata: "Teslimat bulunamadı." });
  if (kisi.rol !== "yonetici") {
    const araclar = {};
    gorebildigiAraclar(kisi, tumSatirlar("Araclar").filter(function (a) { return a.id; })).forEach(function (a) { araclar[a.id] = true; });
    const benim = tumSatirlar("Planlar").some(function (p) {
      return p.id && !p.silindi && araclar[p.aracId] && idListesi(p.duraklar).indexOf(id) >= 0;
    });
    if (!benim) return json({ ok: false, hata: "Bu teslimat sizin planınızda değil." });
  }
  d.teslim = geriAl ? null : simdi() + " " + kisi.ad;
  satirYaz("Duraklar", d._satir, d);
  surumuArtir();
  return json({ ok: true });
}

function mesafeleriSil(durakId) {
  const s = sekme("Mesafeler");
  const satirlar = tumSatirlar("Mesafeler").filter(function (m) { return m.kimden === durakId || m.kime === durakId; });
  satirlar.reverse().forEach(function (m) { s.deleteRow(m._satir); });
}

// Durak sırası için toplam km ve süre. Bilinen bacaklar Mesafeler'den,
// bilinmeyenler Google Haritalar'dan (araçla, en kısa önerilen rota) gelir.
function rotaHesapla(idler) {
  const duraklar = {};
  tumSatirlar("Duraklar").forEach(function (d) { if (d.id) duraklar[d.id] = d; });
  const bilinen = {};
  tumSatirlar("Mesafeler").forEach(function (m) { if (m.km != null) bilinen[m.kimden + ">" + m.kime] = m; });
  let km = 0, dk = 0;
  const eksik = [];
  for (let i = 1; i < idler.length; i++) {
    const a = duraklar[idler[i - 1]], b = duraklar[idler[i]];
    if (!a || !b) { eksik.push("silinmiş durak"); continue; }
    if (a.id === b.id) continue;
    let m = bilinen[a.id + ">" + b.id];
    if (!m) {
      m = haritadanBacak(a, b);
      if (m) bilinen[a.id + ">" + b.id] = m;
    }
    if (!m) { eksik.push(a.ad + " → " + b.ad); continue; }
    km += Number(m.km) || 0;
    dk += Number(m.dk) || 0;
  }
  return { km: eksik.length ? null : Math.round(km * 10) / 10, dk: eksik.length ? null : dk, eksik: eksik };
}

function haritadanBacak(a, b) {
  if (!a.adres || !b.adres) return null;
  try {
    const sonuc = Maps.newDirectionFinder()
      .setOrigin(a.adres).setDestination(b.adres)
      .setMode(Maps.DirectionFinder.Mode.DRIVING)
      .setRegion("tr").setLanguage("tr")
      .getDirections();
    if (!sonuc || !sonuc.routes || !sonuc.routes.length) return null;
    const bacak = sonuc.routes[0].legs[0];
    const m = {
      kimden: a.id, kime: b.id,
      km: Math.round(bacak.distance.value / 100) / 10,
      dk: Math.round(bacak.duration.value / 60),
      rota: a.ad + " → " + b.ad, zaman: simdi(),
    };
    satirYaz("Mesafeler", 0, m);
    return m;
  } catch (hata) {
    return null;
  }
}

function guzergahKaydet(kisi, g) {
  const red = yoneticiMi(kisi); if (red) return red;
  const ad = String(g.ad || "").trim();
  const idler = idListesi(g.duraklar);
  if (!ad) return json({ ok: false, hata: "Güzergâha bir ad verin." });
  if (idler.length < 2) return json({ ok: false, hata: "En az iki durak seçin." });
  const tum = tumSatirlar("Guzergahlar").filter(function (x) { return x.id; });
  const mevcut = g.id ? tum.filter(function (x) { return x.id === String(g.id); })[0] : null;
  if (g.id && !mevcut) return json({ ok: false, hata: "Güzergâh bulunamadı." });
  const r = rotaHesapla(idler);
  const guz = {
    id: mevcut ? mevcut.id : yeniId("g"), ad: ad, duraklar: idler.join(","),
    km: r.km, dk: r.dk, eksik: r.eksik.join("; "), aktif: g.aktif !== false, not: String(g.not || "").trim(),
  };
  satirYaz("Guzergahlar", mevcut ? mevcut._satir : 0, guz);
  surumuArtir();
  return json({ ok: true, id: guz.id, km: r.km, eksik: r.eksik });
}

function guzergahSil(kisi, id) {
  const red = yoneticiMi(kisi); if (red) return red;
  const g = tumSatirlar("Guzergahlar").filter(function (x) { return x.id === id; })[0];
  if (!g) return json({ ok: false, hata: "Güzergâh bulunamadı." });
  sekme("Guzergahlar").deleteRow(g._satir);
  surumuArtir();
  return json({ ok: true });
}

function planYaz(kisi, g, mevcut, arac) {
  const idler = idListesi(g.duraklar);
  const elle = g.elleKm === null || g.elleKm === undefined || g.elleKm === "" ? null : Number(g.elleKm);
  const r = idler.length >= 2 ? rotaHesapla(idler) : { km: null, dk: null, eksik: [] };
  const plan = {
    id: mevcut ? mevcut.id : yeniId("p"), tarih: String(g.tarih), aracId: arac.id, plaka: arac.plaka,
    duraklar: idler.join(","),
    planKm: elle != null && isFinite(elle) ? elle : r.km,
    dk: r.dk,
    kmKaynak: elle != null && isFinite(elle) ? "elle" : (r.km != null ? "harita" : "eksik"),
    eksik: r.eksik.join("; "), not: String(g.not || "").trim(),
    olusturan: kisi.ad, zaman: simdi(), silindi: null,
  };
  satirYaz("Planlar", mevcut ? mevcut._satir : 0, plan);
  return plan;
}

function planKaydet(kisi, g) {
  const red = yoneticiMi(kisi); if (red) return red;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(g.tarih || ""))) return json({ ok: false, hata: "Tarih eksik." });
  const arac = tumSatirlar("Araclar").filter(function (a) { return a.id && a.id === String(g.aracId || ""); })[0];
  if (!arac) return json({ ok: false, hata: "Araç seçin." });
  const elleVar = g.elleKm !== null && g.elleKm !== undefined && g.elleKm !== "";
  if (idListesi(g.duraklar).length < 2 && !elleVar) return json({ ok: false, hata: "En az iki durak seçin ya da plan km'sini elle yazın." });
  const planlar = tumSatirlar("Planlar").filter(function (p) { return p.id && !p.silindi; });
  const mevcut = g.id ? planlar.filter(function (p) { return p.id === String(g.id); })[0] : null;
  if (g.id && !mevcut) return json({ ok: false, hata: "Plan bulunamadı; silinmiş olabilir." });
  const cakisan = planlar.filter(function (p) { return p !== mevcut && p.aracId === arac.id && p.tarih === String(g.tarih); })[0];
  if (cakisan) return json({ ok: false, hata: arac.plaka + " için o güne zaten plan var; onu düzenleyin." });
  const plan = planYaz(kisi, g, mevcut, arac);
  surumuArtir();
  return json({ ok: true, id: plan.id, planKm: plan.planKm, eksik: plan.eksik });
}

function planSil(kisi, id) {
  const red = yoneticiMi(kisi); if (red) return red;
  const p = tumSatirlar("Planlar").filter(function (x) { return x.id === id && !x.silindi; })[0];
  if (!p) return json({ ok: false, hata: "Plan bulunamadı." });
  p.silindi = simdi() + " " + kisi.ad;
  satirYaz("Planlar", p._satir, p);
  surumuArtir();
  return json({ ok: true });
}

// Bir günün planlarını başka güne kopyalar; hedef günde planı olan araca dokunmaz.
function planKopyala(kisi, kaynak, hedef) {
  const red = yoneticiMi(kisi); if (red) return red;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(kaynak) || !/^\d{4}-\d{2}-\d{2}$/.test(hedef)) return json({ ok: false, hata: "Tarih eksik." });
  const araclar = {};
  tumSatirlar("Araclar").forEach(function (a) { if (a.id && a.aktif !== false) araclar[a.id] = a; });
  const planlar = tumSatirlar("Planlar").filter(function (p) { return p.id && !p.silindi; });
  const dolu = {};
  planlar.forEach(function (p) { if (p.tarih === hedef) dolu[p.aracId] = true; });
  let adet = 0;
  planlar.forEach(function (p) {
    if (p.tarih !== kaynak || dolu[p.aracId] || !araclar[p.aracId]) return;
    planYaz(kisi, { tarih: hedef, duraklar: p.duraklar, elleKm: p.kmKaynak === "elle" ? p.planKm : null, not: p.not }, null, araclar[p.aracId]);
    adet++;
  });
  if (adet) surumuArtir();
  return json({ ok: true, adet: adet });
}

// ————————————————————————————————————————————— sürüm sayacı

// Her yazmada artar. Panel dakikada bir doGet?islem=nabiz ile bunu sorar;
// değişmemişse ağır veri isteğini hiç yapmaz.
function surum() {
  return Number(PropertiesService.getScriptProperties().getProperty("surum") || 0);
}

function surumuArtir() {
  PropertiesService.getScriptProperties().setProperty("surum", String(Date.now()));
}
