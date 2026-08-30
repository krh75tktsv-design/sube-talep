// Ekip Paneli — istemci tarafı.
// Arka uç: apps-script/EkipPaneli.gs (Google Apps Script Web App).
//
// KURULUM: EkipPaneli.gs'i dağıttıktan sonra aldığın Web App URL'sini
// aşağıdaki APPS_SCRIPT_URL'e yapıştır. Başka ayar gerekmiyor.

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbw1R2BICikVCBFfR3cjFYTIlt75wgnBVtFXBM0hMtVgTybm0lGRHux_fnkAA37VA5MLqw/exec";

// Panel bu aralıkla "yeni bir şey var mı?" diye sorar. Cevap tek sayı
// olduğu için ucuzdur; ancak sayı değiştiyse asıl veri çekilir.
// Sekme arka plandayken hiç sorulmaz.
const NABIZ_MS = 45000;

const DEPO_OTURUM = "ekipPaneli.oturum";
const DEPO_GORULEN = "ekipPaneli.gorulen";

let oturum = { ad: "", pin: "" };
let veri = null;
let surum = 0;
let nabizZamanlayici = null;

let aktifSayfa = "Duyuru";
let aktifKanal = "Genel";
let gorevFiltre = "bana";
let devirFiltre = "";
let gorulen = { Mesaj: "", Devir: "" };
let seceneklerCizildi = false;

const $ = function (id) { return document.getElementById(id); };

// ————————————————————————————————————————————— yardımcılar

function kacir(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bugunISO() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") +
    "-" + String(d.getDate()).padStart(2, "0");
}

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

// "2026-08-30 14:32" → bugünse "14:32", dünse "Dün 14:32", değilse "30 Ağu 14:32"
function zamanYaz(zaman) {
  if (!zaman) return "";
  const parca = String(zaman).split(" ");
  const gun = parca[0];
  const saat = parca[1] || "";
  const bugun = bugunISO();
  if (gun === bugun) return saat;

  const dun = new Date(Date.now() - 86400000);
  const dunISO = dun.getFullYear() + "-" + String(dun.getMonth() + 1).padStart(2, "0") +
    "-" + String(dun.getDate()).padStart(2, "0");
  if (gun === dunISO) return "Dün " + saat;

  return tarihYaz(gun) + (saat ? " " + saat : "");
}

// "2026-08-30" → "30 Ağu"
function tarihYaz(gun) {
  const p = String(gun || "").split("-");
  if (p.length !== 3) return String(gun || "");
  return Number(p[2]) + " " + (AYLAR[Number(p[1]) - 1] || p[1]);
}

function gunBasligi(gun) {
  if (gun === bugunISO()) return "Bugün";
  const dun = new Date(Date.now() - 86400000);
  const dunISO = dun.getFullYear() + "-" + String(dun.getMonth() + 1).padStart(2, "0") +
    "-" + String(dun.getDate()).padStart(2, "0");
  if (gun === dunISO) return "Dün";
  return tarihYaz(gun);
}

function durumGoster(el, tur, mesaj) {
  el.className = "durum gorunur " + tur;
  el.textContent = mesaj;
  if (tur === "basarili") {
    setTimeout(function () { el.className = "durum"; }, 3000);
  }
}

function durumGizle(el) { el.className = "durum"; }

// ————————————————————————————————————————————— sunucu

let bekleyenIstek = 0;

async function istek(islem, ek) {
  if (APPS_SCRIPT_URL.indexOf("BURAYA_") === 0) {
    return { ok: false, hata: "Kurulum tamamlanmadı: ekip-paneli.js içindeki APPS_SCRIPT_URL boş." };
  }
  const govde = Object.assign({ islem: islem, ad: oturum.ad, pin: oturum.pin }, ek || {});
  bekleyenIstek++;
  $("yenileButon").classList.add("calisiyor");
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(govde),
      redirect: "follow",
    });
    const cevap = await res.json();
    if (cevap && cevap.yenidenGiris) cikis();
    return cevap;
  } catch (hata) {
    return { ok: false, hata: "Bağlantı kurulamadı. İnterneti kontrol edin." };
  } finally {
    bekleyenIstek--;
    if (bekleyenIstek <= 0) $("yenileButon").classList.remove("calisiyor");
  }
}

async function nabiz() {
  if (document.hidden || !oturum.ad) return;
  try {
    const res = await fetch(APPS_SCRIPT_URL + "?islem=nabiz", { method: "GET" });
    const cevap = await res.json();
    if (cevap && cevap.ok && Number(cevap.surum) !== surum) await veriCek();
  } catch (hata) {
    // Ağ yoksa sessizce geç; bir sonraki nabızda tekrar denenir.
  }
}

async function veriCek() {
  const cevap = await istek("veri");
  if (!cevap.ok) return cevap;
  veri = cevap;
  surum = Number(cevap.surum) || 0;
  cizHepsi();
  return cevap;
}

// ————————————————————————————————————————————— giriş / çıkış

async function kisiListesiYukle() {
  const sec = $("kisiSec");
  const cevap = await istek("kisiListesi");
  if (!cevap.ok) {
    sec.innerHTML = '<option value="">Liste alınamadı</option>';
    durumGoster($("girisDurum"), "hata", cevap.hata || "Kişi listesi alınamadı.");
    return;
  }
  const kayitli = (JSON.parse(localStorage.getItem(DEPO_OTURUM) || "{}") || {}).ad || "";
  sec.innerHTML = '<option value="">— seçin —</option>' +
    cevap.kisiler.map(function (k) {
      return '<option value="' + kacir(k.ad) + '"' + (k.ad === kayitli ? " selected" : "") +
        ">" + kacir(k.ad) + " · " + kacir(k.birim) + "</option>";
    }).join("");
}

async function girisYap(ad, pin, sessiz) {
  const durum = $("girisDurum");
  if (!ad) { durumGoster(durum, "hata", "Önce isminizi seçin."); return false; }
  if (!/^\d{4}$/.test(pin)) { durumGoster(durum, "hata", "PIN 4 rakam olmalı."); return false; }

  oturum = { ad: ad, pin: pin };
  const cevap = await istek("giris");
  if (!cevap.ok) {
    oturum = { ad: "", pin: "" };
    localStorage.removeItem(DEPO_OTURUM);
    if (!sessiz) durumGoster(durum, "hata", cevap.hata || "Giriş yapılamadı.");
    return false;
  }

  localStorage.setItem(DEPO_OTURUM, JSON.stringify(oturum));
  gorulen = JSON.parse(localStorage.getItem(DEPO_GORULEN) || "{}");
  if (!gorulen.Mesaj) gorulen = { Mesaj: "", Devir: "" };

  $("girisEkran").style.display = "none";
  $("uygulama").classList.add("acik");
  $("basAd").textContent = cevap.kisi.ad;
  $("basBirim").textContent = cevap.kisi.birim + (cevap.kisi.rol === "yonetici" ? " · yönetici" : "");

  aktifKanal = "Genel";
  devirFiltre = cevap.kisi.birim;

  await veriCek();
  if (nabizZamanlayici) clearInterval(nabizZamanlayici);
  nabizZamanlayici = setInterval(nabiz, NABIZ_MS);
  return true;
}

function cikis() {
  localStorage.removeItem(DEPO_OTURUM);
  oturum = { ad: "", pin: "" };
  veri = null;
  seceneklerCizildi = false;
  if (nabizZamanlayici) clearInterval(nabizZamanlayici);
  $("uygulama").classList.remove("acik");
  $("girisEkran").style.display = "";
  $("pin").value = "";
}

// ————————————————————————————————————————————— sekmeler

function sayfaAc(ad) {
  aktifSayfa = ad;
  ["Duyuru", "Mesaj", "Gorev", "Devir", "Ayar"].forEach(function (s) {
    $("sayfa" + s).classList.toggle("acik", s === ad);
  });
  document.querySelectorAll("nav button").forEach(function (b) {
    b.classList.toggle("secili", b.dataset.sayfa === ad);
  });

  if (ad === "Mesaj" || ad === "Devir") {
    const kayitlar = ad === "Mesaj" ? (veri ? veri.mesajlar : []) : (veri ? veri.devir : []);
    const enSon = kayitlar.reduce(function (a, k) { return k.zaman > a ? k.zaman : a; }, "");
    if (enSon) {
      gorulen[ad] = enSon;
      localStorage.setItem(DEPO_GORULEN, JSON.stringify(gorulen));
    }
    cizSayaclar();
  }
  if (ad === "Mesaj") mesajlariEnAltaKaydir();
  else window.scrollTo(0, 0);
}

// ————————————————————————————————————————————— çizim

function cizHepsi() {
  if (!veri) return;
  cizDuyurular();
  cizKanallar();
  cizMesajlar();
  cizGorevler();
  cizDevir();
  cizEkip();
  cizSecenekler();
  cizSayaclar();
}

function benimMi(ad) { return veri && ad === veri.kisi.ad; }

// —— duyurular

function okudumMu(d) {
  const liste = (veri.okundu && veri.okundu[d.id]) || [];
  return liste.indexOf(veri.kisi.ad) >= 0;
}

function cizDuyurular() {
  $("duyuruFormKutu").hidden = veri.kisi.rol !== "yonetici";
  const liste = $("duyuruListe");
  const okunmamis = veri.duyurular.filter(function (d) { return !okudumMu(d); }).length;
  $("duyuruNot").textContent = okunmamis ? okunmamis + " okunmamış" : "hepsi okundu";

  if (!veri.duyurular.length) {
    liste.innerHTML = '<div class="bos">Henüz duyuru yok.</div>';
    return;
  }

  liste.innerHTML = veri.duyurular.map(function (d) {
    const okundu = okudumMu(d);
    const okuyanlar = (veri.okundu && veri.okundu[d.id]) || [];
    const hedefler = d.hedef === "Hepsi" ? [] : d.hedef.split(",");
    const hedefEtiket = d.hedef === "Hepsi" ? "Tüm ekip"
      : hedefler.length > 2 ? hedefler[0] + " +" + (hedefler.length - 1)
      : hedefler.join(" · ");

    let altSatir = "";
    if (veri.kisi.rol === "yonetici") {
      const okumayanlar = veri.ekip
        .filter(function (k) {
          const hedefte = d.hedef === "Hepsi" || d.hedef.split(",").indexOf(k.birim) >= 0;
          return hedefte && okuyanlar.indexOf(k.ad) < 0;
        })
        .map(function (k) { return k.ad; });
      let ozet;
      if (!okuyanlar.length) {
        ozet = "Henüz kimse okumadı";
      } else if (!okumayanlar.length) {
        ozet = "Herkes okudu (" + okuyanlar.length + ")";
      } else {
        // Okumayan listesi uzarsa kart şişmesin: ilk 4 isim + kalan sayısı.
        const gosterilen = okumayanlar.slice(0, 4).join(", ");
        const kalan = okumayanlar.length - 4;
        ozet = "Okuyan " + okuyanlar.length + " · Okumayan: " +
          gosterilen + (kalan > 0 ? " +" + kalan : "");
      }
      altSatir = '<div style="font-size:12px;color:var(--muted);margin-top:8px;">' +
        kacir(ozet) + "</div>";
    }

    const silButon = (veri.kisi.rol === "yonetici" || benimMi(d.yazan))
      ? '<button class="mini sil" data-sil="Duyurular" data-id="' + d.id + '">Sil</button>' : "";

    return '<div class="kart ' + kacir(d.oncelik) + '">' +
      '<div class="ust"><span class="yazan">' + kacir(d.yazan) + "</span>" +
      '<span class="rozet">' + kacir(hedefEtiket) + "</span>" +
      (d.oncelik === "acil" ? '<span class="rozet acil">Acil</span>' : "") +
      (d.oncelik === "onemli" ? '<span class="rozet brass">Önemli</span>' : "") +
      '<span class="sag">' + kacir(zamanYaz(d.zaman)) + "</span></div>" +
      "<h3>" + kacir(d.baslik) + "</h3>" +
      "<p>" + kacir(d.metin) + "</p>" +
      altSatir +
      '<div class="kart-alt">' +
      (okundu
        ? '<span class="rozet yesil">Okundu</span>'
        : '<button class="mini" data-okundu="' + d.id + '">Okudum</button>') +
      silButon + "</div></div>";
  }).join("");
}

// —— mesajlar

function kanallar() {
  return ["Genel"].concat(veri.birimler);
}

function cizKanallar() {
  $("kanalCipler").innerHTML = kanallar().map(function (k) {
    const yeni = veri.mesajlar.filter(function (m) {
      return m.kanal === k && m.zaman > (gorulen.Mesaj || "") && !benimMi(m.yazan);
    }).length;
    return '<button class="cip' + (k === aktifKanal ? " secili" : "") + '" data-kanal="' + kacir(k) + '">' +
      kacir(k) + (yeni ? ' <span class="adet">' + yeni + "</span>" : "") + "</button>";
  }).join("");
}

function cizMesajlar() {
  const liste = $("mesajListe");
  const kanalMesajlari = veri.mesajlar.filter(function (m) { return m.kanal === aktifKanal; });

  if (!kanalMesajlari.length) {
    liste.innerHTML = '<div class="bos">' + kacir(aktifKanal) +
      " kanalında henüz mesaj yok. İlk yazan siz olun.</div>";
    return;
  }

  let sonGun = "";
  liste.innerHTML = kanalMesajlari.map(function (m) {
    const gun = String(m.zaman).split(" ")[0];
    let ayrac = "";
    if (gun !== sonGun) {
      sonGun = gun;
      ayrac = '<div class="gun-ayrac">' + kacir(gunBasligi(gun)) + "</div>";
    }
    const benim = benimMi(m.yazan);
    const silinebilir = benim || veri.kisi.rol === "yonetici";
    return ayrac + '<div class="balon' + (benim ? " benim" : "") + '">' +
      '<div class="kim">' + kacir(m.yazan) + "</div>" +
      '<div class="metin">' + kacir(m.metin) + "</div>" +
      '<div class="saat">' + kacir(String(m.zaman).split(" ")[1] || "") +
      (silinebilir
        ? ' <button class="balon-sil" data-sil="Mesajlar" data-id="' + m.id + '">sil</button>'
        : "") +
      "</div></div>";
  }).join("");
}

function mesajlariEnAltaKaydir() {
  requestAnimationFrame(function () {
    window.scrollTo(0, document.body.scrollHeight);
  });
}

// —— görevler

function gorevBanaMi(g) {
  if (g.hedefKisi) return g.hedefKisi === veri.kisi.ad;
  return g.hedefBirim === veri.kisi.birim;
}

function gorevSuz(filtre) {
  return veri.gorevler.filter(function (g) {
    if (filtre === "bitti") return g.durum === "bitti";
    if (g.durum === "bitti") return false;
    if (filtre === "bana") return gorevBanaMi(g);
    if (filtre === "birimim") return g.hedefBirim === veri.kisi.birim;
    return true;
  });
}

const GOREV_FILTRELER = [
  { anahtar: "bana", etiket: "Bana" },
  { anahtar: "birimim", etiket: "Birimim" },
  { anahtar: "acik", etiket: "Tüm açık" },
  { anahtar: "bitti", etiket: "Bitenler" },
];

function cizGorevler() {
  $("gorevCipler").innerHTML = GOREV_FILTRELER.map(function (f) {
    const adet = gorevSuz(f.anahtar).length;
    return '<button class="cip' + (f.anahtar === gorevFiltre ? " secili" : "") +
      '" data-gorev-filtre="' + f.anahtar + '">' + f.etiket +
      ' <span class="adet">' + adet + "</span></button>";
  }).join("");

  const bana = gorevSuz("bana").length;
  $("gorevNot").textContent = bana ? bana + " iş sizde" : "sizde açık iş yok";

  const liste = $("gorevListe");
  const gorevler = gorevSuz(gorevFiltre);
  if (!gorevler.length) {
    liste.innerHTML = '<div class="bos">Bu filtrede görev yok.</div>';
    return;
  }

  const bugun = bugunISO();
  liste.innerHTML = gorevler.map(function (g) {
    const kimeEtiket = g.hedefKisi || g.hedefBirim || "atanmamış";
    const gecikti = g.sonTarih && g.sonTarih < bugun && g.durum !== "bitti";
    const silButon = (veri.kisi.rol === "yonetici" || benimMi(g.olusturan))
      ? '<button class="mini sil" data-sil="Gorevler" data-id="' + g.id + '">Sil</button>' : "";

    const durumButonlari = ["acik", "devam", "bitti"].map(function (d) {
      const etiket = d === "acik" ? "Açık" : d === "devam" ? "Devam" : "Bitti";
      return '<button class="mini' + (g.durum === d ? " secili" : "") +
        '" data-gorev="' + g.id + '" data-durum="' + d + '">' + etiket + "</button>";
    }).join("");

    return '<div class="kart' + (gecikti ? " acil" : "") + '">' +
      '<div class="ust"><span class="yazan">' + kacir(kimeEtiket) + "</span>" +
      '<span class="rozet">' + kacir(g.olusturan) + " açtı</span>" +
      (g.sonTarih
        ? '<span class="rozet' + (gecikti ? " acil" : "") + '">' +
          (gecikti ? "gecikti · " : "") + kacir(gunBasligi(g.sonTarih)) + "</span>"
        : "") +
      '<span class="sag">' + kacir(zamanYaz(g.zaman)) + "</span></div>" +
      "<p>" + kacir(g.baslik) + "</p>" +
      (g.durum === "bitti" && g.kapatan
        ? '<div style="font-size:12px;color:var(--yesil);margin-top:6px;">' +
          kacir(g.kapatan) + " bitirdi · " + kacir(zamanYaz(g.kapanisZamani)) + "</div>"
        : "") +
      '<div class="kart-alt">' + durumButonlari + silButon + "</div></div>";
  }).join("");
}

// —— devir notları

function cizDevir() {
  const birimler = ["Hepsi"].concat(veri.birimler);
  $("devirCipler").innerHTML = birimler.map(function (b) {
    const secili = (b === "Hepsi" && !devirFiltre) || b === devirFiltre;
    return '<button class="cip' + (secili ? " secili" : "") +
      '" data-devir-filtre="' + kacir(b === "Hepsi" ? "" : b) + '">' + kacir(b) + "</button>";
  }).join("");

  const notlar = veri.devir.filter(function (n) {
    return !devirFiltre || n.birim === devirFiltre;
  });

  const liste = $("devirListe");
  if (!notlar.length) {
    liste.innerHTML = '<div class="bos">Bu filtrede devir notu yok.</div>';
    return;
  }

  liste.innerHTML = notlar.map(function (n) {
    const silButon = (veri.kisi.rol === "yonetici" || benimMi(n.yazan))
      ? '<button class="mini sil" data-sil="DevirNotlari" data-id="' + n.id + '">Sil</button>' : "";
    return '<div class="kart">' +
      '<div class="ust"><span class="yazan">' + kacir(n.yazan) + "</span>" +
      '<span class="rozet brass">' + kacir(n.birim) + "</span>" +
      '<span class="sag">' + kacir(gunBasligi(n.tarih)) + "</span></div>" +
      "<p>" + kacir(n.metin) + "</p>" +
      (silButon ? '<div class="kart-alt">' + silButon + "</div>" : "") +
      "</div>";
  }).join("");
}

// —— ekip / form seçenekleri / sayaçlar

function cizEkip() {
  const birimBazli = {};
  veri.ekip.forEach(function (k) {
    (birimBazli[k.birim] = birimBazli[k.birim] || []).push(k.ad);
  });
  $("ekipListe").innerHTML = Object.keys(birimBazli).map(function (b) {
    return '<div style="margin-bottom:8px;"><span class="rozet brass">' + kacir(b) + "</span>" +
      '<div style="font-size:13px;color:var(--muted);margin-top:4px;">' +
      kacir(birimBazli[b].join(", ")) + "</div></div>";
  }).join("");
}

function cizSecenekler() {
  if (seceneklerCizildi) return;
  seceneklerCizildi = true;

  $("dHedef").innerHTML = veri.birimler.map(function (b) {
    return '<label class="onay"><input type="checkbox" value="' + kacir(b) + '">' + kacir(b) + "</label>";
  }).join("");

  $("gBirim").innerHTML = '<option value="">— birim seçilmedi —</option>' +
    veri.birimler.map(function (b) {
      return '<option value="' + kacir(b) + '"' + (b === veri.kisi.birim ? " selected" : "") +
        ">" + kacir(b) + "</option>";
    }).join("");

  $("vBirim").innerHTML = veri.birimler.map(function (b) {
    return '<option value="' + kacir(b) + '"' + (b === veri.kisi.birim ? " selected" : "") +
      ">" + kacir(b) + "</option>";
  }).join("");

  gorevKisiListesiTazele();
  $("vTarih").value = bugunISO();
}

// Görev formundaki kişi listesi seçili birime göre daralır.
function gorevKisiListesiTazele() {
  const birim = $("gBirim").value;
  const uygun = veri.ekip.filter(function (k) { return !birim || k.birim === birim; });
  $("gKisi").innerHTML = '<option value="">— tüm birim —</option>' +
    uygun.map(function (k) {
      return '<option value="' + kacir(k.ad) + '">' + kacir(k.ad) + "</option>";
    }).join("");
}

function cizSayaclar() {
  const okunmamis = veri.duyurular.filter(function (d) { return !okudumMu(d); }).length;
  const yeniMesaj = veri.mesajlar.filter(function (m) {
    return m.zaman > (gorulen.Mesaj || "") && !benimMi(m.yazan);
  }).length;
  const acikIs = gorevSuz("bana").length;
  const yeniDevir = veri.devir.filter(function (n) {
    return n.zaman > (gorulen.Devir || "") && !benimMi(n.yazan);
  }).length;

  [["Duyuru", okunmamis], ["Mesaj", yeniMesaj], ["Gorev", acikIs], ["Devir", yeniDevir]]
    .forEach(function (c) {
      const el = $("sayac" + c[0]);
      el.textContent = c[1] > 99 ? "99+" : c[1];
      el.classList.toggle("gorunur", c[1] > 0);
    });
}

// ————————————————————————————————————————————— olaylar

document.addEventListener("DOMContentLoaded", function () {
  $("girisButon").addEventListener("click", async function () {
    this.disabled = true;
    await girisYap($("kisiSec").value, $("pin").value.trim(), false);
    this.disabled = false;
  });
  $("pin").addEventListener("keydown", function (e) {
    if (e.key === "Enter") $("girisButon").click();
  });

  document.querySelectorAll("nav button").forEach(function (b) {
    b.addEventListener("click", function () { sayfaAc(b.dataset.sayfa); });
  });
  $("ayarButon").addEventListener("click", function () {
    sayfaAc(aktifSayfa === "Ayar" ? "Duyuru" : "Ayar");
  });
  $("yenileButon").addEventListener("click", function () { veriCek(); });
  $("cikisButon").addEventListener("click", cikis);

  // —— duyuru yayınla
  $("dGonder").addEventListener("click", async function () {
    const hedef = Array.prototype.slice.call($("dHedef").querySelectorAll("input:checked"))
      .map(function (i) { return i.value; });
    const durum = $("dDurum");
    this.disabled = true;
    const cevap = await istek("duyuruEkle", {
      baslik: $("dBaslik").value.trim(),
      metin: $("dMetin").value.trim(),
      hedef: hedef,
      oncelik: $("dOncelik").value,
    });
    this.disabled = false;
    if (!cevap.ok) { durumGoster(durum, "hata", cevap.hata); return; }
    durumGoster(durum, "basarili", "Duyuru yayınlandı.");
    $("dBaslik").value = ""; $("dMetin").value = "";
    $("dHedef").querySelectorAll("input:checked").forEach(function (i) {
      i.checked = false; i.closest(".onay").classList.remove("isaretli");
    });
    $("duyuruFormKutu").open = false;
    await veriCek();
  });

  $("dHedef").addEventListener("change", function (e) {
    const kutu = e.target.closest(".onay");
    if (kutu) kutu.classList.toggle("isaretli", e.target.checked);
  });

  // —— duyuru kartı: okundum / sil
  $("duyuruListe").addEventListener("click", async function (e) {
    const okundu = e.target.closest("[data-okundu]");
    if (okundu) {
      okundu.disabled = true;
      await istek("okundu", { duyuruId: okundu.dataset.okundu });
      await veriCek();
      return;
    }
    await silTiklandi(e);
  });

  // —— mesaj
  $("mesajListe").addEventListener("click", silTiklandi);

  $("kanalCipler").addEventListener("click", function (e) {
    const cip = e.target.closest("[data-kanal]");
    if (!cip) return;
    aktifKanal = cip.dataset.kanal;
    cizKanallar();
    cizMesajlar();
    mesajlariEnAltaKaydir();
  });

  const metinAlani = $("mesajMetin");
  metinAlani.addEventListener("input", function () {
    this.style.height = "auto";
    this.style.height = Math.min(this.scrollHeight, 110) + "px";
  });
  metinAlani.addEventListener("keydown", function (e) {
    // Masaüstünde Enter gönderir, Shift+Enter satır atlar. Telefonda
    // sanal klavyenin Enter'ı satır atlar; gönderme butonla yapılır.
    if (e.key === "Enter" && !e.shiftKey && !("ontouchstart" in window)) {
      e.preventDefault();
      $("mesajGonder").click();
    }
  });

  $("mesajGonder").addEventListener("click", async function () {
    const metin = metinAlani.value.trim();
    if (!metin) return;
    this.disabled = true;
    const cevap = await istek("mesajEkle", { kanal: aktifKanal, metin: metin });
    this.disabled = false;
    if (!cevap.ok) { durumGoster($("mDurum"), "hata", cevap.hata); return; }
    durumGizle($("mDurum"));
    metinAlani.value = "";
    metinAlani.style.height = "auto";
    await veriCek();
    gorulen.Mesaj = veri.mesajlar.reduce(function (a, m) { return m.zaman > a ? m.zaman : a; }, "");
    localStorage.setItem(DEPO_GORULEN, JSON.stringify(gorulen));
    cizSayaclar();
    mesajlariEnAltaKaydir();
  });

  // —— görev
  $("gBirim").addEventListener("change", gorevKisiListesiTazele);

  $("gGonder").addEventListener("click", async function () {
    const durum = $("gDurum");
    this.disabled = true;
    const cevap = await istek("gorevEkle", {
      baslik: $("gBaslik").value.trim(),
      hedefBirim: $("gBirim").value,
      hedefKisi: $("gKisi").value,
      sonTarih: $("gTarih").value,
    });
    this.disabled = false;
    if (!cevap.ok) { durumGoster(durum, "hata", cevap.hata); return; }
    durumGoster(durum, "basarili", "Görev açıldı.");
    $("gBaslik").value = ""; $("gTarih").value = "";
    await veriCek();
  });

  $("gorevCipler").addEventListener("click", function (e) {
    const cip = e.target.closest("[data-gorev-filtre]");
    if (!cip) return;
    gorevFiltre = cip.dataset.gorevFiltre;
    cizGorevler();
  });

  $("gorevListe").addEventListener("click", async function (e) {
    const btn = e.target.closest("[data-gorev]");
    if (btn) {
      btn.disabled = true;
      const cevap = await istek("gorevGuncelle", { id: btn.dataset.gorev, durum: btn.dataset.durum });
      if (!cevap.ok) { btn.disabled = false; alert(cevap.hata); return; }
      await veriCek();
      return;
    }
    await silTiklandi(e);
  });

  // —— devir notu
  $("vGonder").addEventListener("click", async function () {
    const durum = $("vDurum");
    this.disabled = true;
    const cevap = await istek("devirEkle", {
      birim: $("vBirim").value,
      tarih: $("vTarih").value || bugunISO(),
      metin: $("vMetin").value.trim(),
    });
    this.disabled = false;
    if (!cevap.ok) { durumGoster(durum, "hata", cevap.hata); return; }
    durumGoster(durum, "basarili", "Devir notu kaydedildi.");
    $("vMetin").value = "";
    await veriCek();
  });

  $("devirCipler").addEventListener("click", function (e) {
    const cip = e.target.closest("[data-devir-filtre]");
    if (!cip) return;
    devirFiltre = cip.dataset.devirFiltre;
    cizDevir();
  });

  $("devirListe").addEventListener("click", silTiklandi);

  // —— PIN değiştir
  $("pinGonder").addEventListener("click", async function () {
    const yeni = $("yeniPin").value.trim();
    const durum = $("pDurum");
    this.disabled = true;
    const cevap = await istek("pinDegistir", { yeniPin: yeni });
    this.disabled = false;
    if (!cevap.ok) { durumGoster(durum, "hata", cevap.hata); return; }
    oturum.pin = yeni;
    localStorage.setItem(DEPO_OTURUM, JSON.stringify(oturum));
    $("yeniPin").value = "";
    durumGoster(durum, "basarili", "PIN güncellendi.");
  });

  // —— sekme öne gelince hemen tazele
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) nabiz();
  });

  baslat();
});

async function silTiklandi(e) {
  const btn = e.target.closest("[data-sil]");
  if (!btn) return;
  if (!confirm("Bu kayıt silinsin mi?")) return;
  btn.disabled = true;
  const cevap = await istek("sil", { tur: btn.dataset.sil, id: btn.dataset.id });
  if (!cevap.ok) { btn.disabled = false; alert(cevap.hata); return; }
  await veriCek();
}

async function baslat() {
  await kisiListesiYukle();
  const kayitli = JSON.parse(localStorage.getItem(DEPO_OTURUM) || "{}");
  if (kayitli && kayitli.ad && kayitli.pin) {
    await girisYap(kayitli.ad, kayitli.pin, true);
  }
}
