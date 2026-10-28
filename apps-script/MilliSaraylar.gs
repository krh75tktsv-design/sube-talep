// Milli Saraylar Talep Formu — şube ürün talebi toplama Web App'i.
//
// Şube Talepleri ve Ekip Paneli sistemlerinden TAMAMEN BAĞIMSIZ çalışır:
// kendi e-tablosu, kendi Web App URL'si. Biri bozulursa diğeri etkilenmez.
//
// KURULUM (tek seferlik, ~10 dakika):
// 1) sheets.google.com > yeni boş e-tablo > adını "Milli Saraylar Talep" koy.
// 2) Uzantılar > Apps Script. Açılan editördeki her şeyi sil, bu dosyanın
//    tamamını yapıştır, kaydet (disket ikonu).
// 3) Üstteki fonksiyon listesinden "kurulum" seç, Çalıştır'a bas.
//    İlk seferde yetki isteyecek: Gözden geçir > hesabını seç >
//    Gelişmiş > "... projesine git" > İzin ver.
//    Bu adım 2 sekmeyi oluşturur ve 16 şube + MERKEZ için rastgele şifre üretir.
// 4) E-tablodaki "Subeler" sekmesini aç: her şubenin şifresi orada yazıyor.
//    Şifreleri şubelere kendin dağıtırsın. Beğenmediğin şifreyi hücreye
//    yeni değerini yazarak değiştirirsin — kod değişmez, panel anında görür.
//    MERKEZ satırındaki şifre, talep panelinin şifresidir; şubelere verme.
// 5) Dağıt > Yeni dağıtım > tür: Web uygulaması.
//      - Yürüten: Ben (kendi hesabın)
//      - Erişimi olanlar: Herkes
//    Dağıt'a bas, verilen Web App URL'sini kopyala.
// 6) O URL'yi HEM milli-saraylar.html HEM milli-saraylar-paneli.html
//    dosyalarının başındaki APPS_SCRIPT_URL sabitine yapıştır (ikisi aynı URL).
//
// KOD DEĞİŞTİRDİĞİNDE: Dağıt > Dağıtımları yönet > kalem ikonu >
// Sürüm: "Yeni sürüm" > Dağıt. URL aynı kalır.
//
// GÜVENLİK NOTU: Şifreler bilerek bu dosyada değil, e-tabloda tutulur.
// Bu kod herkese açık bir GitHub deposunda duruyor; buraya yazılan bir
// şifreyi isteyen herkes okuyabilirdi. Şifreler tarayıcıya da hiç
// gönderilmez — doğrulama yalnızca burada, sunucu tarafında yapılır.

const SUBELER = [
  "HAREM", "KAFE", "SAAT", "KÜÇÜKSU", "IHLAMUR", "ŞEKER", "MASLAK", "ÇEŞMİ",
  "ABRAH", "LİMON", "BEYLER", "ÇAMLICA", "MECİDİYE", "YILDIZ", "AYNALI", "KASKAT",
];

// Panele giren merkez kullanıcısının "şube" adı. Şube listesinde görünmez.
const MERKEZ = "MERKEZ";

// Talep panelini açabilen roller. "izleyici" salt okunur: kayıtları görür,
// ama talep gönderemez ve e-tablo adresini alamaz (o e-tabloda tüm
// şifreler duruyor — izleyiciye verilmez).
const PANEL_ROLLERI = ["merkez", "izleyici"];

function panelRolu(rol) {
  return PANEL_ROLLERI.indexOf(rol) !== -1;
}

// Eksik şube uyarı maili bu adrese gider (opsiyonel, aşağıya bak).
const UYARI_EPOSTASI = "serkansalihoglu@lavita.com.tr";

const SEKMELER = {
  Talepler: ["Gönderim Zamanı", "Talep Tarihi", "Şube", "Ürün", "Miktar"],
  Subeler: ["Şube", "Şifre", "Rol", "Aktif", "Kapsam"],
};

// Notlar ayrı bir sütun yerine, ürün adı "NOT" olan tek bir satır olarak
// yazılır; miktar sütununda not metni durur. Tablo böylece düz kalır.
const NOT_URUN = "NOT";

// ————————————————————————————————————————————— kurulum

function kurulum() {
  Object.keys(SEKMELER).forEach(function (ad) { sekme(ad); });

  const s = sekme("Subeler");
  if (s.getLastRow() < 2) {
    // Şifreler metin olarak yazılır ki baştaki sıfır (0417) kaybolmasın.
    s.getRange(2, 1, SUBELER.length + 1, 4).setNumberFormat("@");
    const satirlar = SUBELER.map(function (ad) {
      return [ad, rastgeleSifre(4), "sube", "evet"];
    });
    satirlar.push([MERKEZ, rastgeleSifre(6), "merkez", "evet"]);
    s.getRange(2, 1, satirlar.length, 4).setValues(satirlar);
    s.setFrozenRows(1);
    s.autoResizeColumns(1, 4);
  }

  const t = sekme("Talepler");
  t.setFrozenRows(1);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    "Kurulum tamam. Şifreler 'Subeler' sekmesinde.", "Milli Saraylar", 10);
}

function rastgeleSifre(uzunluk) {
  let s = "";
  for (let i = 0; i < uzunluk; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function sekme(ad) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sy = ss.getSheetByName(ad);
  if (!sy) {
    sy = ss.insertSheet(ad);
    sy.appendRow(SEKMELER[ad]);
    sy.getRange(1, 1, 1, SEKMELER[ad].length).setFontWeight("bold");
  }
  return sy;
}

// ————————————————————————————————————————————— giriş / yetki

// Subeler sekmesini okur. Şifreler buradan çıkmaz; sadece dogrula() kullanır.
// E-tabloya elle yazilan degerleri karsilastirilabilir hale getirir.
// JavaScript'in toLowerCase()'i Turkce'de bozuk calisiyor: "İ".toLowerCase()
// duz "i" degil, noktali birlesik bir karakter uretiyor. Bu yuzden "İzleyici"
// yazilan bir rol hucresi tanInmiyordu ve satir hicbir yerde gorunmuyordu.
// I/İ/ı/i hepsi "i"ye, Ş/ş "s"ye, Ü/ü "u"ya indirgenir; sonuc yalnizca
// karsilastirma icin kullanilir, ekrana basilmaz.
function anahtar(deger) {
  return String(deger === undefined || deger === null ? "" : deger)
    .trim()
    .replace(/[İIıi]/g, "i")
    .replace(/[Şş]/g, "s")
    .replace(/[Üü]/g, "u")
    .replace(/[Ğğ]/g, "g")
    .replace(/[Öö]/g, "o")
    .replace(/[Çç]/g, "c")
    .toLowerCase();
}

function subeleriOku() {
  const sy = sekme("Subeler");
  if (sy.getLastRow() < 2) return [];
  // 5. sutun (Kapsam) eski e-tablolarda bos olabilir; sayfa daraltildiysa
  // 5 sutun istemek hata verirdi, o yuzden mevcut genislikle sinirlandi.
  const sutun = Math.min(5, sy.getMaxColumns());
  return sy.getRange(2, 1, sy.getLastRow() - 1, sutun).getValues()
    .filter(function (r) { return r[0]; })
    .map(function (r, i) {
      return {
        satir: i + 2,
        ad: String(r[0]).trim(),
        sifre: String(r[1]).trim(),
        rol: anahtar(r[2]) || "sube",
        // "Hayır", "HAYIR", "hayir" — hepsi kapali sayilir.
        aktif: anahtar(r[3]) !== "hayir",
        kapsam: kapsamiAyikla(r[4]),
      };
    });
}

// "SAAT, HAREM" / "SAAT; HAREM" / alt alta yazim — hepsi listeye cevrilir.
// Bos birakilirsa kapsam yok demektir: kisi butun subeleri gorur.
function kapsamiAyikla(deger) {
  if (deger === undefined || deger === null) return [];
  return String(deger).split(/[,;\n]/)
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length > 0; });
}

function dogrula(ad, sifre) {
  if (!ad || !sifre) return null;
  const hedefAd = String(ad).trim();
  const hedefSifre = String(sifre).trim();
  const bulunan = subeleriOku().filter(function (s) {
    return s.aktif && s.ad === hedefAd && s.sifre === hedefSifre;
  });
  return bulunan.length === 1 ? bulunan[0] : null;
}

// Panel girisi: tek kutu, sadece sifre. Ad sorulmaz cunku panel
// kullanicilari (merkez + izleyiciler) sube listesinde gorunmuyor.
// Ayni sifre iki kisideyse kimin oldugu belirsiz kalir; o yuzden
// bilerek reddedilir, sessizce birini secmek yanlis olurdu.
function panelGiris(sifre) {
  const hedef = String(sifre || "").trim();
  if (!hedef) return json({ ok: false, hata: "Şifre girin." });

  const bulunan = subeleriOku().filter(function (s) {
    return s.aktif && panelRolu(s.rol) && s.sifre === hedef;
  });
  if (bulunan.length === 0) return json({ ok: false, hata: "Şifre hatalı." });
  if (bulunan.length > 1) {
    return json({ ok: false, hata: "Bu şifre birden fazla kişide tanımlı. " +
      "Subeler sekmesinde şifreleri farklılaştırın." });
  }
  return json({ ok: true, ad: bulunan[0].ad, rol: bulunan[0].rol });
}

// ————————————————————————————————————————————— istekler

// Giriş ekranının şube açılır listesi için: sadece adlar, şifresiz.
function doGet(e) {
  const adlar = subeleriOku()
    .filter(function (s) { return s.aktif && s.rol === "sube"; })
    .map(function (s) { return s.ad; });
  return json({ ok: true, subeler: adlar });
}

function doPost(e) {
  let v;
  try {
    v = JSON.parse(e.postData.contents);
  } catch (hata) {
    return json({ ok: false, hata: "Geçersiz istek." });
  }

  // Panel girisi ad bilmeden yapilir; dogrula()'dan once ele alinir.
  if (v.islem === "panelGiris") return panelGiris(v.sifre);

  const kisi = dogrula(v.sube, v.sifre);
  if (!kisi) return json({ ok: false, hata: "Şube veya şifre hatalı." });

  switch (v.islem) {
    case "giris":         return json({ ok: true, sube: kisi.ad, rol: kisi.rol });
    case "kaydet":        return kaydet(kisi, v);
    case "gecmis":        return gecmis(kisi, v);
    case "kayitlar":      return kayitlar(kisi, v);
    case "etabloUrl":     return etabloUrl(kisi);
    case "gizliUrunler":  return gizliUrunler(kisi);
    case "sifreDegistir": return sifreDegistir(kisi, v);
    default:              return json({ ok: false, hata: "Bilinmeyen işlem." });
  }
}

function kaydet(kisi, v) {
  if (kisi.rol !== "sube") {
    return json({ ok: false, hata: "Bu hesapla talep gönderilmez; yalnızca şube hesapları gönderebilir." });
  }
  if (!v.tarih) return json({ ok: false, hata: "Talep tarihi eksik." });

  const kalemler = (v.kalemler || []).filter(function (k) {
    return k && k.urun && Number(k.miktar) > 0;
  });
  const not = String(v.not || "").trim();
  if (kalemler.length === 0 && !not) {
    return json({ ok: false, hata: "En az bir ürün için miktar girin." });
  }

  const zaman = new Date();
  const satirlar = kalemler.map(function (k) {
    return [zaman, v.tarih, kisi.ad, String(k.urun), Number(k.miktar)];
  });
  if (not) satirlar.push([zaman, v.tarih, kisi.ad, NOT_URUN, not]);

  const sy = sekme("Talepler");
  sy.getRange(sy.getLastRow() + 1, 1, satirlar.length, 5).setValues(satirlar);

  return json({ ok: true, kalem: kalemler.length });
}

// Şube kendi gönderdiklerini görür; başka şubenin kaydına erişemez.
function gecmis(kisi, v) {
  const hepsi = talepleriOku();
  const liste = hepsi.filter(function (k) {
    return k.sube === kisi.ad && (!v.tarih || k.tarih === v.tarih);
  });
  return json({ ok: true, kayitlar: liste });
}

// Panel için: tüm şubelerin kayıtları. Yalnızca merkez rolü çağırabilir.
function kayitlar(kisi, v) {
  if (!panelRolu(kisi.rol)) return json({ ok: false, hata: "Bu işlem için yetkiniz yok." });

  // Kapsam doluysa kisi yalnizca o subelerin kayitlarini gorur. Suzme burada,
  // sunucuda yapilir: kapsam disindaki veri tarayiciya hic gonderilmez.
  const kapsam = kisi.kapsam || [];
  const tumSubeler = subeleriOku()
    .filter(function (s) { return s.rol === "sube"; })
    .map(function (s) { return s.ad; });

  const kapsamAnahtarlari = kapsam.map(anahtar);
  let liste = talepleriOku();
  if (kapsam.length > 0) {
    liste = liste.filter(function (k) {
      return kapsamAnahtarlari.indexOf(anahtar(k.sube)) !== -1;
    });
  }
  if (v.baslangic) liste = liste.filter(function (k) { return k.tarih >= v.baslangic; });
  if (v.bitis)     liste = liste.filter(function (k) { return k.tarih <= v.bitis; });

  // Kapsama yazilan ad hicbir subeyle eslesmiyorsa panel bos kalirdi ve
  // sebebi anlasilmazdi; uyari olarak geri bildirilir.
  const bilinenAnahtarlar = tumSubeler.concat(SUBELER).map(anahtar);
  const bilinmeyen = kapsam.filter(function (s) {
    return bilinenAnahtarlar.indexOf(anahtar(s)) === -1;
  });

  return json({
    ok: true,
    kayitlar: liste,
    subeler: kapsam.length > 0 ? kapsam : SUBELER,
    kapsamli: kapsam.length > 0,
    uyari: bilinmeyen.length > 0
      ? "Kapsamdaki şu ad hiçbir şubeyle eşleşmiyor: " + bilinmeyen.join(", ")
      : "",
  });
}

// Panelin "E-Tablo" dugmesi icin. YALNIZCA merkez: bu e-tabloda Subeler
// sekmesi, yani tum subelerin sifreleri duruyor — sube hesabina verilmez.
function etabloUrl(kisi) {
  if (kisi.rol !== "merkez") return json({ ok: false, hata: "Bu işlem için yetkiniz yok." });
  return json({ ok: true, url: SpreadsheetApp.getActiveSpreadsheet().getUrl() });
}

function talepleriOku() {
  const sy = sekme("Talepler");
  if (sy.getLastRow() < 2) return [];
  const tz = Session.getScriptTimeZone();
  return sy.getRange(2, 1, sy.getLastRow() - 1, 5).getValues()
    .filter(function (r) { return r[2]; })
    .map(function (r) {
      return {
        zaman: bicimle(r[0], tz, "yyyy-MM-dd HH:mm"),
        tarih: bicimle(r[1], tz, "yyyy-MM-dd"),
        sube: String(r[2]).trim(),
        urun: String(r[3]).trim(),
        miktar: r[4],
      };
    });
}

function sifreDegistir(kisi, v) {
  const yeni = String(v.yeni || "").trim();
  if (!/^\d{4,8}$/.test(yeni)) return json({ ok: false, hata: "Şifre 4-8 rakam olmalı." });
  const sy = sekme("Subeler");
  sy.getRange(kisi.satir, 2).setNumberFormat("@").setValue(yeni);
  return json({ ok: true });
}

function bicimle(deger, tz, format) {
  if (Object.prototype.toString.call(deger) === "[object Date]") {
    return Utilities.formatDate(deger, tz, format);
  }
  return deger;
}

function json(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne))
    .setMimeType(ContentService.MimeType.JSON);
}

// ————————————————————————————————————————————— eksik şube uyarısı (opsiyonel)
//
// Kurmak için: fonksiyon listesinden "kurulumTetikleyiciOlustur" seç, Çalıştır.
// Her akşam 22:00'de ertesi gün için talep göndermemiş şubeleri mail atar.
// Tekrar çalıştırmak zararsızdır (eski tetikleyiciyi silip yenisini kurar).

function kurulumTetikleyiciOlustur() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "eksikSubeleriUyar") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("eksikSubeleriUyar").timeBased().everyDays(1).atHour(22).create();
}

function eksikSubeleriUyar() {
  const tz = Session.getScriptTimeZone();
  const yarin = new Date();
  yarin.setDate(yarin.getDate() + 1);
  const yarinStr = Utilities.formatDate(yarin, tz, "yyyy-MM-dd");

  const gonderen = {};
  talepleriOku().forEach(function (k) {
    if (k.tarih === yarinStr) gonderen[k.sube] = true;
  });

  const beklenen = subeleriOku()
    .filter(function (s) { return s.aktif && s.rol === "sube"; })
    .map(function (s) { return s.ad; });
  const eksikler = beklenen.filter(function (s) { return !gonderen[s]; });
  if (eksikler.length === 0) return;

  MailApp.sendEmail(
    UYARI_EPOSTASI,
    "Milli Saraylar Talep Uyarısı - " + yarinStr,
    yarinStr + " tarihi için henüz talep göndermeyen şubeler:\n\n" + eksikler.join("\n"));
}

// ————————————————————————————————————————————— tek seferlik: ürün adı düzeltme
//
// 2026-08-30'da ürün listesi yeniden adlandırıldı. Bu fonksiyon, o tarihten
// önce kaydedilmiş satırlardaki eski adları yenisiyle değiştirir; yoksa
// panel aynı ürünü iki ayrı satır gibi gösterir.
//
// Çalıştırmak için: fonksiyon listesinden "urunAdlariniGuncelle" seç,
// Çalıştır'a bas. Bir kez yeter; tekrar çalıştırmak zararsızdır (bulacak
// eski ad kalmadığı için hiçbir şeyi değiştirmez). Dağıtım yenilemek
// GEREKMEZ — bu fonksiyon web app üzerinden çağrılmaz.

const ESKI_YENI_URUN = {
  "TİRAMİSU (dilim)": "TİRAMİSU  (dilim)",
  "DİLİM FRAMBUAZ CHE": "DİLİM FRAMBUAZ CHEES",
  "PROFİTEROL": "PROFİTEROL KASE",
  "TRİLİÇE (dilim)": "TRİLİÇE  (dilim)",
  "MOİS": "MOİS PASTA",
  "MUZLU MAGNOLİA": "MUZLU MUHALLEBİ",
  "KROKAN": "KROKANLI PASTA",
  "FISTIKLI KÜP": "FISTIKLI KÜP PASTA",
  "GLUTENSİZ ÇİKOLATALI": "UNSUZ  ÇİKOLATA PASTA",
  "LİMONLU FİT": "LİMONLU FİT PASTA",
};

function urunAdlariniGuncelle() {
  const sy = sekme("Talepler");
  if (sy.getLastRow() < 2) return;

  const aralik = sy.getRange(2, 4, sy.getLastRow() - 1, 1);  // D sütunu: Ürün
  const degerler = aralik.getValues();
  let degisen = 0;

  degerler.forEach(function (satir) {
    const yeni = ESKI_YENI_URUN[String(satir[0]).trim()];
    if (yeni) { satir[0] = yeni; degisen++; }
  });

  if (degisen > 0) aralik.setValues(degerler);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    degisen + " satır güncellendi.", "Ürün adı düzeltme", 10);
  Logger.log(degisen + " satır güncellendi.");
}

// ————————————————————————————————————————————— şube bazlı ürün görünürlüğü
//
// Bazı ürünler bazı şubelerde satılmıyor; o şubenin formunda hiç görünmesin
// istiyoruz. Liste "Gorunurluk" sekmesinde durur: satırlar ürün, sütunlar
// şube, hücreye "yok" yazılan ürün o şubenin formunda gizlenir.
//
// Değişiklik e-tablodan yapılır, kod değişmez, dağıtım yenilemek gerekmez.
// Panel ve Excel bundan etkilenmez — orada ızgara tam kalır, gizli hücre
// yalnızca boş görünür.

const GORUNURLUK_SEKMESI = "Gorunurluk";
const GIZLI_ISARETI = "yok";

function gizliUrunler(kisi) {
  return json({ ok: true, gizli: subeninGizlileri(kisi.ad) });
}

function subeninGizlileri(subeAdi) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sy = ss.getSheetByName(GORUNURLUK_SEKMESI);
  if (!sy || sy.getLastRow() < 2) return [];

  const veri = sy.getRange(1, 1, sy.getLastRow(), sy.getLastColumn()).getValues();
  const basliklar = veri[0];
  let sutun = -1;
  for (let c = 1; c < basliklar.length; c++) {
    if (String(basliklar[c]).trim() === subeAdi) { sutun = c; break; }
  }
  if (sutun === -1) return [];

  const gizli = [];
  for (let r = 1; r < veri.length; r++) {
    const urun = String(veri[r][0]).trim();
    const hucre = String(veri[r][sutun]).trim().toLowerCase();
    if (urun && hucre === GIZLI_ISARETI) gizli.push(urun);
  }
  return gizli;
}

// Tek seferlik: Gorunurluk sekmesini oluşturup elle işaretlenen tabloyu yazar.
// Fonksiyon listesinden "gorunurlukKur" seç, Çalıştır. Sekme zaten varsa
// hiçbir şey yapmaz — elle yaptığın değişiklikleri ezmez.
// (Sıfırdan kurmak istersen önce sekmeyi e-tablodan sil.)

const GORUNURLUK_URUNLERI = [
  "TİRAMİSU  (dilim)",
  "DİLİM FRAMBUAZ CHEES",
  "DİLİM LİMONLU CHEES",
  "HASBAHÇE",
  "LATTE PASTA",
  "ÇİLEKLİ TART",
  "ÇİLEKLİ MUHALLEBİ",
  "OREO MUHALLEBİ",
  "MUZLU MUHALLEBİ",
  "DUBAİ MUHALLEBİSİ",
  "PROFİTEROL KASE",
  "MOZAİK",
  "TRİLİÇE  (dilim)",
  "MALAGA",
  "KAZANDİBİ",
  "MİLFÖY",
  "SAN SEBASTİAN",
  "FISTIKLI PASTA",
  "MOİS PASTA",
  "KIRMIZI MEYVALI",
  "KESTANE ÇİKOLATALI",
  "LİMONLU PARFE",
  "LİMONLU TART",
  "SÜTLAÇ",
  "KROKANLI PASTA",
  "FISTIKLI KÜP PASTA",
  "LOTUS PASTA",
  "UNSUZ  ÇİKOLATA PASTA",
  "LİMONLU FİT PASTA",
  "MALAGA YENİ SOS",
  "HURMALI BROWNİ",
  "HAVUÇLU BROWNİ",
  "DUBAİ ÇİKOLATASI",
];

const GORUNURLUK_TOHUM = {
  "HAREM": [
    "MALAGA",
    "FISTIKLI PASTA",
    "KIRMIZI MEYVALI",
    "LİMONLU PARFE",
    "LİMONLU TART",
    "KROKANLI PASTA",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "KAFE": [
    "LİMONLU PARFE",
    "LİMONLU TART",
  ],
  "SAAT": [
    "MUZLU MUHALLEBİ",
    "KAZANDİBİ",
    "LİMONLU PARFE",
    "LİMONLU TART",
    "SÜTLAÇ",
    "MALAGA YENİ SOS",
  ],
  "KÜÇÜKSU": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "SÜTLAÇ",
    "MALAGA YENİ SOS",
  ],
  "IHLAMUR": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "ŞEKER": [
    "TİRAMİSU  (dilim)",
    "ÇİLEKLİ MUHALLEBİ",
    "OREO MUHALLEBİ",
    "MUZLU MUHALLEBİ",
    "PROFİTEROL KASE",
    "MALAGA",
    "KAZANDİBİ",
    "FISTIKLI PASTA",
    "LİMONLU PARFE",
    "SÜTLAÇ",
    "KROKANLI PASTA",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "MASLAK": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "ÇEŞMİ": [
    "LİMONLU PARFE",
    "LİMONLU TART",
  ],
  "ABRAH": [
    "LİMONLU PARFE",
    "LİMONLU TART",
  ],
  "LİMON": [
    "LİMONLU TART",
    "KROKANLI PASTA",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "BEYLER": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "KROKANLI PASTA",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "ÇAMLICA": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "MECİDİYE": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "KROKANLI PASTA",
  ],
  "YILDIZ": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "AYNALI": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
  "KASKAT": [
    "LİMONLU PARFE",
    "LİMONLU TART",
    "UNSUZ  ÇİKOLATA PASTA",
    "LİMONLU FİT PASTA",
    "HURMALI BROWNİ",
    "HAVUÇLU BROWNİ",
  ],
};

function gorunurlukKur() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss.getSheetByName(GORUNURLUK_SEKMESI)) {
    ss.toast("Gorunurluk sekmesi zaten var, dokunulmadı.", "Görünürlük", 10);
    return;
  }
  const sy = ss.insertSheet(GORUNURLUK_SEKMESI);

  const basliklar = ["ÜRÜNLER"].concat(SUBELER);
  const satirlar = [basliklar];
  GORUNURLUK_URUNLERI.forEach(function (urun) {
    const satir = [urun];
    SUBELER.forEach(function (sube) {
      const liste = GORUNURLUK_TOHUM[sube] || [];
      satir.push(liste.indexOf(urun) !== -1 ? GIZLI_ISARETI : "");
    });
    satirlar.push(satir);
  });

  sy.getRange(1, 1, satirlar.length, basliklar.length).setValues(satirlar);
  sy.getRange(1, 1, 1, basliklar.length).setFontWeight("bold");
  sy.setFrozenRows(1);
  sy.setFrozenColumns(1);
  sy.setColumnWidth(1, 220);
  ss.toast("Gorunurluk sekmesi kuruldu.", "Görünürlük", 10);
}
