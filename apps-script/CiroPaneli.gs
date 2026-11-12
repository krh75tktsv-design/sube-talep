// Ciro Paneli — şubelerin günlük satış (ciro) girişi.
// Şube Talepleri, Ekip ve Filo panellerinden BAĞIMSIZ çalışır: kendi e-tablosu, kendi Web App URL'si.
//
// İki rol var:
//   yonetici — tüm şubelerin cirosunu görür/girer/siler, hedef koyar, kişi ve PIN yönetir.
//              (Kasa+ içindeki "Ciro" sekmesi bu rolle bağlanır.)
//   sube     — yalnızca kendisine atanmış şubeler için ciro girer; bugünden CIRO_DUZELTME_GUN gün
//              öncesine kadarki girişi düzeltebilir. Başka şubeyi göremez.
//
// KURULUM (tek seferlik, ~10 dakika):
// 1) sheets.google.com > yeni boş e-tablo > adını "Ciro Paneli" koy.
// 2) Uzantılar > Apps Script. Editördeki her şeyi sil, bu dosyanın tamamını yapıştır, kaydet.
// 3) Üstteki fonksiyon listesinden "kurulum" seç, Çalıştır'a bas. İlk seferde yetki isteyecek:
//    Gözden geçir > hesabını seç > Gelişmiş > "... projesine git" > İzin ver.
//    Bu adım 5 sekmeyi (Kisiler, Ciro, Hedefler, KasaKalemleri, Personeller) kurar, ILK_YONETICILER'e rastgele 6 haneli
//    PIN verip ekranda gösterir — PIN'leri not al (bu dosyada yazmaz; depo herkese açık).
// 4) Dağıt > Yeni dağıtım > tür: Web uygulaması. Yürüten: Ben. Erişimi olanlar: Herkes.
//    Dağıt'a bas, Web App URL'sini kopyala.
// 5) URL'yi ciro.html içindeki APPS_SCRIPT_URL sabitine yapıştır (Kasa+'ta Ciro sekmesine de
//    aynı URL yapıştırılır). ciro.html'i GitHub Pages'e yayınla.
// 6) Şube sorumlularını "Kisiler" sekmesine elle ekle:
//      Ad | Rol=sube | PIN (4-8 rakam) | Subeler (virgülle: "Nişantaşı" ya da "Fulya,Maslak") | Aktif=evet
//    Herkes kendi PIN'ini ciro.html'deki PIN düğmesinden değiştirebilir.
//
// KOD DEĞİŞTİRDİĞİNDE: Dağıt > Dağıtımları yönet > kalem ikonu > Sürüm: "Yeni sürüm" > Dağıt.
// URL aynı kalır. ("Yeni dağıtım" URL'yi değiştirir ve bağlantıları kırar.)

const ILK_YONETICILER = ["Serkan Salihoğlu"];

// Ciro girilebilen şubeler (Kasa+'taki şube adlarıyla birebir aynı yazılmalı).
const SUBELER = ["Nişantaşı", "Fulya", "Maslak"];

// Ödeme türleri: alan adı → görünen ad / grup. (Sütunlar sabit; görünen ad değiştirmek serbest.)
// Toplam ciro = bu kalemlerin tümü + "Kasa Ödemeleri" kalemlerinin toplamı.
const KANALLAR = [
  { alan: "nakit", ad: "Nakit", grup: "satis" },
  { alan: "kart", ad: "Kredi Kartı", grup: "satis" },
  { alan: "havale", ad: "Banka Havale", grup: "satis" },
  { alan: "edenred", ad: "Edenred", grup: "yemek" },
  { alan: "pluxee", ad: "Pluxee", grup: "yemek" },
  { alan: "multinet", ad: "Multinet", grup: "yemek" },
  { alan: "setcard", ad: "Setcard", grup: "yemek" },
  { alan: "metropol", ad: "Metropol", grup: "yemek" },
  { alan: "token", ad: "Token", grup: "yemek" },
];

// Kasa ödemeleri: şube sorumlusu her gün listedeki adlardan seçip tutar girer (serbest isim yazılamaz).
// Her adın geçerli olduğu şubeler vardır (boş = tüm şubeler). Tür "personel" olan kalemde (ör. Personel ürün)
// ayrıca şubedeki personel adı seçilir. "alt" doluysa (virgülle) satırda ayrıca bu alt kalemlerden biri seçilir (ör. Atölye > Çilek); personel listesi Kasa+'tan "Personeller" sekmesine gönderilir.
// Liste "KasaKalemleri" sekmesinden ya da Kasa+ Ciro sekmesinden düzenlenir.
const ILK_KASA_KALEMLERI = [
  { ad: "Market / Muhtelif", subeler: "" },
  { ad: "Kurye", subeler: "" },
  { ad: "Kurye adisyon", subeler: "Fulya" },
  { ad: "Damacana su", subeler: "" },
  { ad: "Yol ücreti", subeler: "" },
  { ad: "Personel ürün", subeler: "", tur: "personel" },
  { ad: "Yufka", subeler: "Maslak,Fulya" },
  { ad: "Mantar", subeler: "Fulya" },
  { ad: "Bazlama", subeler: "Fulya" },
  { ad: "Atölye", subeler: "Nişantaşı", alt: "Çilek,Muhtelif,Börek" },
];

const HATALI_DENEME = 5;
const KILIT_DAKIKA = 15;
const CIRO_DUZELTME_GUN = 7;                 // şube sorumlusu kaç gün geriye giriş/düzeltme yapabilir
const GUN_SINIRI = { yonetici: 800, sube: 62 };
const ROLLER = ["yonetici", "sube"];
const TZ = "Europe/Istanbul";

// Sekme adı → [sütun başlığı, alan adı, tür]. Tür: m=metin, s=sayı, t=tarih (yyyy-MM-dd metin), b=evet/hayır
const SEKMELER = {
  Kisiler: [["Ad", "ad", "m"], ["Rol", "rol", "m"], ["PIN", "pin", "m"], ["Subeler", "subeler", "m"], ["Aktif", "aktif", "b"]],
  Ciro: [
    ["Zaman", "zaman", "m"], ["Giren", "giren", "m"], ["Sube", "sube", "m"], ["Tarih", "tarih", "t"],
    ["Nakit", "nakit", "s"], ["Kart", "kart", "s"], ["Edenred", "edenred", "s"], ["Pluxee", "pluxee", "s"],
    ["Multinet", "multinet", "s"], ["Setcard", "setcard", "s"], ["Metropol", "metropol", "s"], ["Token", "token", "s"],
    ["KasaOdemeleri", "kasa", "s"], ["KasaDetay", "kasaDetay", "m"], ["Toplam", "toplam", "s"], ["Not", "not", "m"],
    ["Havale", "havale", "s"],   // sonradan eklendi: e-tablodaki mevcut sütun sırası bozulmasın diye en sonda
  ],
  KasaKalemleri: [["Ad", "ad", "m"], ["Subeler", "subeler", "m"], ["Tur", "tur", "m"], ["Alt", "alt", "m"], ["Aktif", "aktif", "b"]],
  Personeller: [["Ad", "ad", "m"], ["Sube", "sube", "m"]],
  Hedefler: [["Ay", "ay", "m"], ["Sube", "sube", "m"], ["Hedef", "hedef", "s"]],
};

// ————————————————————————————————————————————— kurulum

function kurulum() {
  const kitap = SpreadsheetApp.getActiveSpreadsheet();
  kitap.setSpreadsheetTimeZone(TZ);
  Object.keys(SEKMELER).forEach(function (ad) { sekme(ad); });

  const kisiSekme = sekme("Kisiler");
  const mevcut = tumSatirlar("Kisiler").map(function (k) { return k.ad; });
  const eklenen = [];
  ILK_YONETICILER.forEach(function (ad) {
    if (mevcut.indexOf(ad) >= 0) return;
    const pin = String(100000 + Math.floor(Math.random() * 900000));
    kisiSekme.appendRow([ad, "yonetici", pin, "", "evet"]);
    eklenen.push(ad + " — PIN " + pin);
  });
  kisiSekme.getRange(2, 2, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ROLLER, true).build());
  kisiSekme.getRange(2, 5, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["evet", "hayır"], true).build());
  // PIN, tarih ve ay sütunları metin kalsın ("0123" → 123 ve "2026-11" → tarih olmasın).
  kisiSekme.getRange(2, 3, 500, 1).setNumberFormat("@");
  sekme("Ciro").getRange(2, 4, 20000, 1).setNumberFormat("@");
  const kk = sekme("KasaKalemleri"), mevcutKalem = tumSatirlar("KasaKalemleri").map(function (x) { return x.ad; });
  ILK_KASA_KALEMLERI.forEach(function (k) { if (mevcutKalem.indexOf(k.ad) < 0) kk.appendRow([k.ad, k.subeler || "", k.tur || "", k.alt || "", "evet"]); });
  kk.getRange(2, 5, 500, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["evet", "hayır"], true).build());
  sekme("Hedefler").getRange(2, 1, 2000, 1).setNumberFormat("@");

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
  const basliklar = SEKMELER[ad].map(function (x) { return x[0]; });
  // Sona yeni sütun eklendiyse (ör. Havale) başlığı kendiliğinden yazılır.
  if (s.getLastRow() > 0 && s.getRange(1, basliklar.length).getValue() !== basliklar[basliklar.length - 1]) {
    s.getRange(1, 1, 1, basliklar.length).setValues([basliklar]).setFontWeight("bold").setBackground("#f3f4f6");
  }
  if (s.getLastRow() === 0 || s.getRange(1, 1).getValue() !== basliklar[0]) {
    s.getRange(1, 1, 1, basliklar.length).setValues([basliklar]).setFontWeight("bold").setBackground("#f3f4f6");
    s.setFrozenRows(1);
  }
  return s;
}

// ————————————————————————————————————————————— istekler

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.islem === "nabiz") return json({ ok: true });
  return json({ ok: true, bilgi: "Ciro Paneli servisi çalışıyor." });
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

    const kilit = LockService.getScriptLock();
    kilit.waitLock(20000);
    try {
      switch (v.islem) {
        case "ciroKaydet":  return ciroKaydet(kisi, v.ciro || {});
        case "ciroSil":     return ciroSil(kisi, String(v.sube || ""), String(v.tarih || ""));
        case "hedefKaydet": return hedefKaydet(kisi, String(v.ay || ""), String(v.sube || ""), v.hedef);
        case "kalemKaydet": return kalemKaydet(kisi, v);
        case "personelGuncelle": return personelGuncelle(kisi, v.personeller);
        case "pinDegistir": return pinDegistir(kisi, v);
        default:            return json({ ok: false, hata: "Bilinmeyen işlem: " + v.islem });
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

function satirYaz(ad, satir, o) {
  const s = sekme(ad), dizi = SEKMELER[ad].map(function (a) { return hucreYaz(o[a[1]], a[2]); });
  if (satir) s.getRange(satir, 1, 1, dizi.length).setValues([dizi]);
  else s.appendRow(dizi);
}

// ————————————————————————————————————————————— kimlik

function kisiler() {
  return tumSatirlar("Kisiler").filter(function (k) { return k.ad && k.aktif; }).map(function (k) {
    k.rol = ROLLER.indexOf(String(k.rol || "").toLowerCase()) >= 0 ? String(k.rol).toLowerCase() : "sube";
    k.pin = String(k.pin || "");
    k.subeListesi = k.rol === "yonetici" ? SUBELER.slice()
      : String(k.subeler || "").split(",").map(function (x) { return x.trim(); }).filter(function (x) { return SUBELER.indexOf(x) >= 0; });
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
  return { ad: k.ad, rol: k.rol, subeler: k.subeListesi };
}

// ————————————————————————————————————————————— veri

function bugunStr() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function gunOnce(n) { return Utilities.formatDate(new Date(Date.now() - n * 86400000), TZ, "yyyy-MM-dd"); }

function veriPaketi(kisi) {
  const alt = gunOnce(GUN_SINIRI[kisi.rol] || 62);
  const izinli = kisi.subeListesi;
  const kayitlar = tumSatirlar("Ciro").filter(function (c) {
    return c.sube && c.tarih && c.tarih >= alt && izinli.indexOf(c.sube) >= 0;
  }).map(function (c) {
    const r = { sube: c.sube, tarih: c.tarih, kasa: c.kasa || 0, toplam: c.toplam || 0, not: c.not || "", giren: c.giren || "", zaman: c.zaman || "" };
    KANALLAR.forEach(function (k) { r[k.alan] = c[k.alan] || 0; });
    try { r.kasaDetay = c.kasaDetay ? JSON.parse(c.kasaDetay) : []; } catch (x) { r.kasaDetay = []; }
    return r;
  });
  const hedefler = tumSatirlar("Hedefler").filter(function (h) {
    return h.ay && izinli.indexOf(h.sube) >= 0;
  }).map(function (h) { return { ay: h.ay, sube: h.sube, hedef: h.hedef || 0 }; });
  return {
    ok: true, kisi: disKisi(kisi), bugun: bugunStr(), kanallar: KANALLAR, subeler: izinli,
    duzeltmeGun: CIRO_DUZELTME_GUN, kasaKalemleri: kasaKalemleri(), personeller: personeller(izinli), kayitlar: kayitlar, hedefler: hedefler,
  };
}

// Aktif kasa ödemesi adları: [{ad, subeler: [...] (boş = tümü), tur: "" | "personel"}]
function kasaKalemleri() {
  return tumSatirlar("KasaKalemleri").filter(function (k) { return k.ad && k.aktif; }).map(function (k) {
    return { ad: k.ad, tur: String(k.tur || "").toLowerCase() === "personel" ? "personel" : "",
             alt: String(k.alt || "").split(",").map(function (x) { return x.trim(); }).filter(String),
             subeler: String(k.subeler || "").split(",").map(function (x) { return x.trim(); }).filter(String) };
  });
}
function kalemGecerli(kalem, sube) { return !kalem.subeler.length || kalem.subeler.indexOf(sube) >= 0; }
function personeller(izinli) {
  return tumSatirlar("Personeller").filter(function (p) { return p.ad && izinli.indexOf(p.sube) >= 0; })
    .map(function (p) { return { ad: p.ad, sube: p.sube }; });
}

function sayi(v) {
  const n = Number(String(v === undefined || v === null || v === "" ? 0 : v).replace(",", "."));
  return isFinite(n) ? n : NaN;
}

function ciroKaydet(kisi, g) {
  const sube = String(g.sube || "").trim(), tarih = String(g.tarih || "").trim();
  if (kisi.subeListesi.indexOf(sube) < 0) return json({ ok: false, hata: "Bu şube için giriş yetkiniz yok." });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tarih)) return json({ ok: false, hata: "Tarih geçersiz." });
  if (tarih > bugunStr()) return json({ ok: false, hata: "Gelecek tarihe ciro girilemez." });
  if (kisi.rol !== "yonetici" && tarih < gunOnce(CIRO_DUZELTME_GUN)) {
    return json({ ok: false, hata: "En fazla " + CIRO_DUZELTME_GUN + " gün öncesine kadar giriş yapılabilir. Daha eski için yöneticiye başvurun." });
  }
  const o = { zaman: Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HH:mm"), giren: kisi.ad, sube: sube, tarih: tarih, not: String(g.not || "").trim() };
  let toplam = 0;
  for (var i = 0; i < KANALLAR.length; i++) {
    const a = KANALLAR[i].alan, n = sayi(g[a]);
    if (isNaN(n) || n < 0 || n > 100000000) return json({ ok: false, hata: KANALLAR[i].ad + " tutarı geçersiz." });
    o[a] = n; toplam += n;
  }
  // Kasa ödemeleri: [{ad, tutar, kisi?}] — ad şubede geçerli bir kalem olmalı; "personel" türünde kisi şubenin personeli olmalı.
  // Aynı ad (ve kişi) birden fazla satırsa toplanır.
  const kalemler = kasaKalemleri(), kisiler_ = personeller([sube]).map(function (p) { return p.ad; });
  const birlesik = {}, kasaSirasi = [];
  const satirlar = Array.isArray(g.kasa) ? g.kasa : [];
  for (var j = 0; j < satirlar.length; j++) {
    const ad = String((satirlar[j] && satirlar[j].ad) || "").trim(), t = sayi(satirlar[j] && satirlar[j].tutar);
    const kisi_ = String((satirlar[j] && satirlar[j].kisi) || "").trim();
    const alt_ = String((satirlar[j] && satirlar[j].alt) || "").trim();
    if (!ad && !(t > 0)) continue;
    const kalem = kalemler.filter(function (k) { return k.ad === ad; })[0];
    if (!kalem || !kalemGecerli(kalem, sube)) return json({ ok: false, hata: "Bu şubede geçerli olmayan kasa ödemesi adı: " + (ad || "(boş)") });
    if (kalem.tur === "personel" && kisiler_.indexOf(kisi_) < 0) return json({ ok: false, hata: ad + " için şubedeki personeli seçin." });
    if (kalem.alt.length && kalem.alt.indexOf(alt_) < 0) return json({ ok: false, hata: ad + " için alt kalemi seçin (" + kalem.alt.join(", ") + ")." });
    if (isNaN(t) || t < 0 || t > 100000000) return json({ ok: false, hata: "Kasa ödemesi tutarı geçersiz: " + ad });
    const anahtar = ad + "|" + (kalem.tur === "personel" ? kisi_ : "") + "|" + (kalem.alt.length ? alt_ : "");
    if (!(anahtar in birlesik)) { birlesik[anahtar] = { ad: ad, kisi: kalem.tur === "personel" ? kisi_ : "", alt: kalem.alt.length ? alt_ : "", tutar: 0 }; kasaSirasi.push(anahtar); }
    birlesik[anahtar].tutar += t;
  }
  const detay = kasaSirasi.map(function (a) { const d = birlesik[a]; d.tutar = Math.round(d.tutar * 100) / 100; if (!d.kisi) delete d.kisi; if (!d.alt) delete d.alt; return d; }).filter(function (d) { return d.tutar > 0; });
  o.kasa = Math.round(detay.reduce(function (a, d) { return a + d.tutar; }, 0) * 100) / 100;
  o.kasaDetay = detay.length ? JSON.stringify(detay) : "";
  toplam += o.kasa;
  o.toplam = Math.round(toplam * 100) / 100;
  const mevcut = tumSatirlar("Ciro").filter(function (c) { return c.sube === sube && c.tarih === tarih; })[0];
  satirYaz("Ciro", mevcut ? mevcut._satir : 0, o);
  return json({ ok: true, guncellendi: !!mevcut, toplam: o.toplam });
}

function ciroSil(kisi, sube, tarih) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Ciro kaydını yalnızca yönetici silebilir." });
  const mevcut = tumSatirlar("Ciro").filter(function (c) { return c.sube === sube && c.tarih === tarih; })[0];
  if (!mevcut) return json({ ok: false, hata: "Kayıt bulunamadı." });
  sekme("Ciro").deleteRow(mevcut._satir);
  return json({ ok: true });
}

function hedefKaydet(kisi, ay, sube, hedef) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Hedefi yalnızca yönetici belirler." });
  if (!/^\d{4}-\d{2}$/.test(ay) || SUBELER.indexOf(sube) < 0) return json({ ok: false, hata: "Ay ya da şube geçersiz." });
  const n = sayi(hedef);
  if (isNaN(n) || n < 0) return json({ ok: false, hata: "Hedef geçersiz." });
  const mevcut = tumSatirlar("Hedefler").filter(function (h) { return h.ay === ay && h.sube === sube; })[0];
  satirYaz("Hedefler", mevcut ? mevcut._satir : 0, { ay: ay, sube: sube, hedef: n });
  return json({ ok: true });
}

function kalemKaydet(kisi, v) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Kasa ödemesi adlarını yalnızca yönetici düzenler." });
  const ad = String(v.kalemAd || "").trim();   // not: v.ad giriş yapan kişinin adıdır, kalem adı kalemAd'dır
  if (!ad || ad.length > 60) return json({ ok: false, hata: "Ad 1-60 karakter olmalı." });
  const subeler = (Array.isArray(v.subeler) ? v.subeler : []).filter(function (x) { return SUBELER.indexOf(x) >= 0; });
  const tum = tumSatirlar("KasaKalemleri");
  const mevcut = tum.filter(function (k) { return k.ad === ad; })[0];
  const alt = (Array.isArray(v.alt) ? v.alt : []).map(function (x) { return String(x).trim().slice(0, 40); }).filter(String).slice(0, 20);
  satirYaz("KasaKalemleri", mevcut ? mevcut._satir : 0, { ad: ad, subeler: subeler.join(","), tur: v.tur === "personel" ? "personel" : "", alt: alt.join(","), aktif: v.aktif !== false });
  return json({ ok: true });
}

// Kasa+ personel listesini gönderir (yalnızca yönetici). Liste tümüyle değiştirilir.
function personelGuncelle(kisi, liste) {
  if (kisi.rol !== "yonetici") return json({ ok: false, hata: "Personel listesini yalnızca yönetici günceller." });
  const temiz = (Array.isArray(liste) ? liste : []).map(function (p) { return { ad: String(p.ad || "").trim().slice(0, 80), sube: String(p.sube || "").trim() }; })
    .filter(function (p) { return p.ad && SUBELER.indexOf(p.sube) >= 0; });
  const s = sekme("Personeller");
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, 2).clearContent();
  if (temiz.length) s.getRange(2, 1, temiz.length, 2).setValues(temiz.map(function (p) { return [p.ad, p.sube]; }));
  return json({ ok: true, adet: temiz.length });
}

function pinDegistir(kisi, v) {
  const yeni = String(v.yeniPin || "").trim();
  const enAz = kisi.rol === "yonetici" ? 6 : 4;
  if (!new RegExp("^\\d{" + enAz + ",8}$").test(yeni)) return json({ ok: false, hata: "PIN " + enAz + "–8 rakam olmalı." });
  sekme("Kisiler").getRange(kisi._satir, 3).setValue(yeni);
  return json({ ok: true });
}
