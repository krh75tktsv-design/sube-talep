/* ============================================================
   Kasa+ — Finansal Yönetim Paneli
   Tek dosyalık, tarayıcı içi çalışan finans uygulaması.
   Veriler window.storage üzerinde kalıcı olarak saklanır.
============================================================ */

const ICONS = {
  ozet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  gelir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 19V5M6 11l6-6 6 6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gider: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M6 13l6 6 6-6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  banka: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 10l9-6 9 6M4 10v9M20 10v9M9 10v9M15 10v9M2 21h20" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  takip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  sube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 21V9l8-5 8 5v12M9 21v-6h6v6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  ayar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.9 2.9l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.6V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.9-2.9l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.6-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.9-2.9l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.6V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.9 2.9l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.6 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  personel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.3 6.5-6.3s6.5 2.7 6.5 6.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 8.2a3 3 0 010 5.9M19 20c0-2.7-1.6-4.9-4-5.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

const MENU = [
  { id: "ozet",     ad: "Genel Bakış",         icon: ICONS.ozet,     mobil: true },
  { id: "gelir",    ad: "Gelirler",            icon: ICONS.gelir,    mobil: true },
  { id: "gider",    ad: "Giderler",            icon: ICONS.gider,    mobil: true },
  { id: "personel", ad: "Personel Ödemeleri",  icon: ICONS.personel, mobil: false },
  { id: "banka",    ad: "Banka Hesapları",     icon: ICONS.banka,    mobil: true },
  { id: "takip",    ad: "Ödeme & Tahsilat",    icon: ICONS.takip,    mobil: true },
  { id: "sube",     ad: "Şube Karşılaştırma",  icon: ICONS.sube,     mobil: false },
  { id: "ayar",     ad: "Ayarlar",             icon: ICONS.ayar,     mobil: false },
];

const SUBE_RENK = ["#0F766E","#B45309","#6D28D9","#BE185D","#0369A1","#4D7C0F","#9333EA","#C2410C","#334155"];
const fmt = (n) => new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:0}).format(n||0);
const fmtTarih = (t) => t ? new Date(t+"T00:00:00").toLocaleDateString("tr-TR",{day:"numeric",month:"short",year:"numeric"}) : "-";
const uid = () => Date.now() + Math.floor(Math.random()*1000);
const todayStr = () => new Date().toISOString().slice(0,10);
const gunFarki = (t) => Math.ceil((new Date(t+"T00:00:00") - new Date(new Date().toDateString())) / 86400000);

/* ---------------- State ---------------- */
let DATA = null;
let activeTab = "ozet";
let activeSube = "tumu";
let charts = {};

/* Depolama katmanı: Claude artifact önizlemesinde window.storage,
   bağımsız barındırmada (GitHub Pages, Netlify, dosya olarak açma) ise
   tarayıcının localStorage'ı kullanılır — böylece uygulama her iki
   ortamda da kalıcı çalışır. */
async function storageGet(key){
  if(window.storage){
    try{ return await window.storage.get(key); }catch(e){ return null; }
  }
  try{
    const v = localStorage.getItem(key);
    return v ? {key, value:v} : null;
  }catch(e){ return null; }
}
async function storageSet(key, value){
  if(window.storage){
    try{ return await window.storage.set(key, value); }catch(e){ console.error("Kayıt hatası", e); return null; }
  }
  try{ localStorage.setItem(key, value); return {key, value}; }
  catch(e){ console.error("Kayıt hatası", e); return null; }
}

async function loadData(){
  try{
    const res = await storageGet("kasa-plus-data");
    if(res && res.value){
      DATA = JSON.parse(res.value);
      if(!DATA.cariler) DATA.cariler = [];
      return;
    }
  }catch(e){ /* yok, seed'e düş */ }
  const seedEl = document.getElementById("seed-data");
  DATA = JSON.parse(seedEl.textContent);
  if(!DATA.cariler) DATA.cariler = [];
  await saveData();
}
async function saveData(){
  await storageSet("kasa-plus-data", JSON.stringify(DATA));
}

function renderCariDatalist(){
  const dl = document.getElementById("cari-list");
  if(dl) dl.innerHTML = DATA.cariler.map(c=>`<option value="${c.replace(/"/g,'&quot;')}"></option>`).join("");
}
function cariKaydet(aciklama){
  const v = (aciklama||"").trim();
  if(!v) return;
  const varMi = DATA.cariler.some(c => c.toLocaleUpperCase("tr") === v.toLocaleUpperCase("tr"));
  if(!varMi){ DATA.cariler.push(v); DATA.cariler.sort((a,b)=>a.localeCompare(b,'tr')); renderCariDatalist(); }
}

function subeRenk(s){
  const i = DATA.subeler.indexOf(s);
  return SUBE_RENK[i >= 0 ? i % SUBE_RENK.length : SUBE_RENK.length-1];
}
function subeRozet(s){
  if(!s) return "";
  const c = subeRenk(s);
  return `<span class="badge-sube" style="background:${c}18;color:${c}"><span class="badge-dot" style="background:${c}"></span>${s}</span>`;
}
function f(list){
  if(activeSube === "tumu") return list;
  return list.filter(x => x.sube === activeSube);
}

/* ---------------- Panel içi filtreler ---------------- */
function buAyAraligi(){
  const n = new Date();
  const yil = n.getFullYear(), ay = n.getMonth();
  const bas = `${yil}-${String(ay+1).padStart(2,'0')}-01`;
  const sonGun = new Date(yil, ay+1, 0).getDate();
  const bit = `${yil}-${String(ay+1).padStart(2,'0')}-${String(sonGun).padStart(2,'0')}`;
  return { bas, bit };
}
const _buAy = buAyAraligi();
const FILTERS = {
  ozet:  { bas:_buAy.bas, bit:_buAy.bit },
  gelir: { kategori:"tumu", arama:"", bas:_buAy.bas, bit:_buAy.bit },
  gider: { kategori:"tumu", arama:"", bas:_buAy.bas, bit:_buAy.bit },
  banka: { arama:"" },
  takip: { tip:"tumu", durum:"tumu", arama:"", bas:"", bit:"" },
  sube:  { bas:_buAy.bas, bit:_buAy.bit },
  personel: { arama:"", bas:_buAy.bas, bit:_buAy.bit },
};
function tarihAralikta(tarih, bas, bit){
  if(!tarih) return true;
  if(bas && tarih < bas) return false;
  if(bit && tarih > bit) return false;
  return true;
}
function metinEslesir(hedefler, arama){
  if(!arama) return true;
  const q = arama.toLocaleLowerCase("tr");
  return hedefler.some(t => (t||"").toLocaleLowerCase("tr").includes(q));
}
function filtreTemizleMi(fs){
  return Object.values(fs).some(v => v && v !== "tumu");
}
/* ---------------- Dışa Aktarma (CSV / Yazdır) ---------------- */
function csvIndir(dosyaAdi, basliklar, satirlar){
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
  };
  const satirlarStr = [basliklar, ...satirlar].map(r => r.map(esc).join(";")).join("\r\n");
  const csv = "\uFEFF" + satirlarStr; // BOM: Excel'de Türkçe karakterler doğru görünsün
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = dosyaAdi; a.click();
  URL.revokeObjectURL(url);
}
function disaAktarToolbarHTML(tabKey){
  return `<div class="export-toolbar">
    <button class="btn btn-ghost btn-sm" id="export-csv-${tabKey}">⬇ CSV İndir</button>
    <button class="btn btn-ghost btn-sm" id="export-print-${tabKey}">🖶 Yazdır / PDF Kaydet</button>
  </div>`;
}
function disaAktarWire(tabKey, dosyaAdiFn, basliklarFn, satirlarFn){
  const csvBtn = document.getElementById(`export-csv-${tabKey}`);
  if(csvBtn) csvBtn.addEventListener("click", ()=> csvIndir(dosyaAdiFn(), basliklarFn(), satirlarFn()));
  const printBtn = document.getElementById(`export-print-${tabKey}`);
  if(printBtn) printBtn.addEventListener("click", ()=> window.print());
}

function filtreBarWire(tabKey, onChange){
  const bar = document.getElementById(`filtre-${tabKey}`);
  if(!bar) return;
  bar.querySelectorAll("[data-fkey]").forEach(el=>{
    const ev = (el.tagName === "SELECT" || el.type === "date") ? "change" : "input";
    el.addEventListener(ev, ()=>{
      FILTERS[tabKey][el.dataset.fkey] = el.value;
      onChange();
    });
  });
  const clr = document.getElementById(`filtre-temizle-${tabKey}`);
  if(clr) clr.addEventListener("click", ()=>{
    Object.keys(FILTERS[tabKey]).forEach(k=> FILTERS[tabKey][k] = (k==='kategori'||k==='tip'||k==='durum') ? 'tumu' : '');
    renderAll();
  });
}

/* ---------------- Layout render ---------------- */
function renderShell(){
  const nav = document.getElementById("nav");
  nav.innerHTML = MENU.map(m => `
    <div class="nav-item ${activeTab===m.id?'active':''}" data-tab="${m.id}">
      ${m.icon}<span>${m.ad}</span>
    </div>`).join("");
  nav.querySelectorAll(".nav-item").forEach(el=>{
    el.addEventListener("click", ()=>{ activeTab = el.dataset.tab; renderAll(); });
  });

  const tb = document.getElementById("tabbar");
  const mobilMenu = MENU.filter(m=>m.mobil);
  tb.innerHTML = mobilMenu.map(m => `
    <button class="tab-btn ${activeTab===m.id?'active':''}" data-tab="${m.id}">
      ${m.icon}<span>${m.ad.split(' ')[0]}</span>
    </button>`).join("");
  tb.querySelectorAll(".tab-btn").forEach(el=>{
    el.addEventListener("click", ()=>{ activeTab = el.dataset.tab; renderAll(); });
  });

  document.getElementById("sidebar-foot").textContent =
    new Date().toLocaleDateString("tr-TR",{day:"numeric",month:"long",year:"numeric"}) + " · " + DATA.subeler.length + " şube aktif";

  document.getElementById("page-title").textContent = MENU.find(m=>m.id===activeTab).ad;

  const chips = document.getElementById("chips");
  chips.innerHTML = `<button class="chip ${activeSube==='tumu'?'active':''}" data-sube="tumu">Tüm Şubeler</button>` +
    DATA.subeler.map(s=>`<button class="chip ${activeSube===s?'active':''}" data-sube="${s}"
       style="${activeSube===s?`background:${subeRenk(s)};border-color:${subeRenk(s)}`:''}">${s}</button>`).join("");
  chips.querySelectorAll(".chip").forEach(el=>{
    el.addEventListener("click", ()=>{ activeSube = el.dataset.sube; renderAll(); });
  });
}

function renderAll(){
  renderShell();
  const c = document.getElementById("content");
  Object.values(charts).forEach(ch=>ch && ch.destroy && ch.destroy());
  charts = {};
  const renderers = { ozet: renderOzet, gelir: ()=>renderIslemSayfa("gelir"), gider: ()=>renderIslemSayfa("gider"),
    personel: renderPersonel, banka: renderBanka, takip: renderTakip, sube: renderSubeKarsilastirma, ayar: renderAyarlar };
  c.innerHTML = "";
  renderers[activeTab]();
  window.scrollTo(0,0);
}

/* ---------------- Hesaplamalar ---------------- */
function hesapla(bas, bit){
  const gelirler = f(DATA.gelirler).filter(x=>tarihAralikta(x.tarih,bas,bit));
  const giderler = f(DATA.giderler).filter(x=>tarihAralikta(x.tarih,bas,bit));
  const planli = f(DATA.planli);
  const gelir = gelirler.reduce((a,b)=>a+b.tutar,0);
  const gider = giderler.reduce((a,b)=>a+b.tutar,0);
  const kasa = activeSube==='tumu' ? DATA.hesaplar.reduce((a,b)=>a+b.bakiye,0) : null; // banka hesapları şubesiz
  const bekleyenTahsilat = planli.filter(p=>p.tip==='Tahsilat' && p.durum==='Bekliyor').reduce((a,b)=>a+b.tutar,0);
  const bekleyenOdeme = planli.filter(p=>p.tip==='Ödeme' && p.durum==='Bekliyor').reduce((a,b)=>a+b.tutar,0);
  const net = gelir - gider;
  const aySonuNet = net + bekleyenTahsilat - bekleyenOdeme;
  return {gelir, gider, kasa, bekleyenTahsilat, bekleyenOdeme, net, aySonuNet};
}

function son14GunAkis(){
  const gunler = [];
  for(let i=13;i>=0;i--){
    const d = new Date(); d.setDate(d.getDate()-i);
    const key = d.toISOString().slice(0,10);
    const g = f(DATA.gelirler).filter(x=>x.tarih===key).reduce((a,b)=>a+b.tutar,0);
    const gi = f(DATA.giderler).filter(x=>x.tarih===key).reduce((a,b)=>a+b.tutar,0);
    gunler.push({key, net: g-gi});
  }
  return gunler;
}

function beklenenGelirHesapla(){
  const now = new Date();
  const yil = now.getFullYear(), ay = now.getMonth();
  const ayPrefix = `${yil}-${String(ay+1).padStart(2,'0')}`;
  const ayinGunSayisi = new Date(yil, ay+1, 0).getDate();
  const bugunGunu = now.getDate();
  const kalanGun = Math.max(0, ayinGunSayisi - bugunGunu);

  const ayIcindekiler = f(DATA.gelirler).filter(x =>
    x.tarih && x.tarih.startsWith(ayPrefix) && (x.kategori === 'Kredi Kartı' || x.kategori === 'Nakit')
  );
  const toplamAySoFar = ayIcindekiler.reduce((a,b)=>a+b.tutar,0);
  const ortalamaGunluk = bugunGunu > 0 ? toplamAySoFar / bugunGunu : 0;
  const beklenenGelir = ortalamaGunluk * kalanGun;

  return { toplamAySoFar, ortalamaGunluk, kalanGun, beklenenGelir, bugunGunu, ayinGunSayisi };
}

/* ---------------- Genel Bakış ---------------- */
function renderOzet(){
  const fs = FILTERS.ozet;
  const v = hesapla(fs.bas, fs.bit);
  const akis = son14GunAkis();
  const son = akis[akis.length-1];
  const w = 600, h = 46, pad=4;
  const vals = akis.map(a=>a.net);
  const maxAbs = Math.max(1, ...vals.map(Math.abs));
  const pts = akis.map((a,i)=>{
    const x = pad + i*(w-2*pad)/(akis.length-1);
    const y = h/2 - (a.net/maxAbs) * (h/2-6);
    return [x,y];
  });
  const path = pts.map((p,i)=> (i===0?"M":"L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length-1];

  const giderDagilim = {};
  f(DATA.giderler).filter(x=>tarihAralikta(x.tarih,fs.bas,fs.bit)).forEach(i=>{ giderDagilim[i.kategori] = (giderDagilim[i.kategori]||0) + i.tutar; });
  const dagilimSirali = Object.entries(giderDagilim).sort((a,b)=>b[1]-a[1]);

  const bekleyenler = f(DATA.planli).filter(p=>p.durum==='Bekliyor').sort((a,b)=>new Date(a.vade)-new Date(b.vade));
  const bg = beklenenGelirHesapla();
  const aySonuNetGuncel = v.aySonuNet + bg.beklenenGelir;

  document.getElementById("content").innerHTML = `
    <div id="pulse-wrap">
      <div id="pulse-top">
        <span id="pulse-label">Nakit Akışı Nabzı · Son 14 gün</span>
        <span id="pulse-value" class="tabular ${son.net>=0?'':''}" style="color:${son.net>=0?'#4ADE80':'#F87171'}">${son.net>=0?'+':''}${fmt(son.net)}</span>
      </div>
      <svg id="pulse-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
        <line x1="0" y1="${h/2}" x2="${w}" y2="${h/2}" stroke="rgba(255,255,255,.12)" stroke-width="1"/>
        <path d="${path}" fill="none" stroke="${'#C79A55'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <circle class="pulse-dot" cx="${last[0]}" cy="${last[1]}" r="4" fill="${son.net>=0?'#4ADE80':'#F87171'}"/>
      </svg>
    </div>

    ${disaAktarToolbarHTML("ozet")}

    <div class="card" id="filtre-ozet" style="margin-bottom:14px;">
      <div class="card-body" style="padding-top:14px;">
        <div class="form-grid" style="grid-template-columns:1fr 1fr auto;">
          <input type="date" data-fkey="bas" value="${fs.bas}" placeholder="Başlangıç">
          <input type="date" data-fkey="bit" value="${fs.bit}" placeholder="Bitiş">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-ozet">Temizle</button>
        </div>
        <div class="row-sub" style="margin-top:4px;">Varsayılan olarak içinde bulunulan ay gösterilir. Tarih filtresi Gelir, Gider, Net ve gider dağılımını etkiler. Kasa ve bekleyen tutarlar her zaman güncel duruma göre hesaplanır. Geçmiş ayları görmek için tarihleri değiştirin veya "Temizle" ile tüm zamanları görün.</div>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card"><div class="kpi-label">Toplam Kasa</div><div class="kpi-value tabular">${activeSube==='tumu'?fmt(v.kasa):'—'}</div><div class="kpi-sub">${activeSube==='tumu'?DATA.hesaplar.length+' banka hesabı':'Banka hesapları şubesiz izlenir'}</div></div>
      <div class="kpi-card"><div class="kpi-label">Toplam Gelir</div><div class="kpi-value tabular pos">${fmt(v.gelir)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Toplam Gider</div><div class="kpi-value tabular neg">${fmt(v.gider)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Net Nakit</div><div class="kpi-value tabular" style="color:${v.net>=0?'var(--income)':'var(--expense)'}">${fmt(v.net)}</div><div class="kpi-sub">Gelir − Gider</div></div>
      <div class="kpi-card"><div class="kpi-label">Bekleyen Tahsilat</div><div class="kpi-value tabular">${fmt(v.bekleyenTahsilat)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Bekleyen Ödeme</div><div class="kpi-value tabular">${fmt(v.bekleyenOdeme)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Ay Sonu Net Durum</div><div class="kpi-value tabular" style="color:${aySonuNetGuncel>=0?'var(--income)':'var(--expense)'}">${fmt(aySonuNetGuncel)}</div><div class="kpi-sub">Net + Bekl. Tahsilat − Bekl. Ödeme + Beklenen Gelir</div></div>
      <div class="kpi-card"><div class="kpi-label">Beklenen Gelir</div><div class="kpi-value tabular pos">${fmt(bg.beklenenGelir)}</div><div class="kpi-sub">Günlük ort. ${fmt(bg.ortalamaGunluk)} × kalan ${bg.kalanGun} gün (Kredi Kartı + Nakit)</div></div>
    </div>

    <div class="section-title">Gider Dağılımı</div>
    ${dagilimSirali.length ? `
    <div class="card">
      <div class="card-body" style="padding:0;">
        <table>
          <thead><tr><th>Kategori</th><th class="right">Tutar</th><th class="right">Oran</th></tr></thead>
          <tbody id="gider-dagilim-tbody">
            ${dagilimSirali.map(([kat,tutar],i)=>{
              const renk = ['#0F766E','#B45309','#6D28D9','#BE185D','#0369A1','#4D7C0F','#9333EA','#C2410C'][i%8];
              const kayitlar = f(DATA.giderler).filter(x=>tarihAralikta(x.tarih,fs.bas,fs.bit) && x.kategori===kat);
              const cariGruplari = {};
              kayitlar.forEach(k=>{
                const key = (k.cari||'').trim() || (k.aciklama||'').trim() || 'Cari Belirtilmemiş';
                if(!cariGruplari[key]) cariGruplari[key] = { toplam:0, adet:0 };
                cariGruplari[key].toplam += k.tutar;
                cariGruplari[key].adet += 1;
              });
              const cariListesi = Object.entries(cariGruplari).sort((a,b)=>b[1].toplam-a[1].toplam);
              const katId = `gd-${i}`;
              return `<tr class="tikla-duzenle" data-acilim="${katId}">
                <td><span class="badge-dot" style="background:${renk};display:inline-block;margin-right:7px;"></span>${kat}</td>
                <td class="right tabular neg" style="font-weight:700;">${fmt(tutar)}</td>
                <td class="right tabular">${(tutar/v.gider*100).toFixed(1)}%</td>
              </tr>
              <tr id="${katId}" style="display:none;">
                <td colspan="3" style="padding:0;background:var(--paper);">
                  <div class="row-list" style="padding:6px 16px;">
                    ${cariListesi.map(([cari,g])=>`<div class="row-item">
                      <div class="row-main">
                        <div class="row-title">${cari}</div>
                        <div class="row-sub">${g.adet} kayıt</div>
                      </div>
                      <div class="row-amount neg">${fmt(g.toplam)}</div>
                    </div>`).join("") || '<div class="empty">Kayıt bulunamadı.</div>'}
                  </div>
                </td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot><tr style="background:var(--paper);font-weight:700;">
            <td>Toplam</td>
            <td class="right tabular">${fmt(dagilimSirali.reduce((a,b)=>a+b[1],0))}</td>
            <td class="right tabular">100%</td>
          </tr></tfoot>
        </table>
      </div>
    </div>` : `<div class="card"><div class="card-body"><div class="empty">Bu filtreyle gider kaydı yok.</div></div></div>`}

    <div class="section-title">Yaklaşan Hareketler</div>
    <div class="card"><div class="card-body">
      <div class="row-list">
      ${bekleyenler.slice(0,8).map(p=>{
        const gun = gunFarki(p.vade);
        const renk = p.tip==='Tahsilat' ? 'var(--income)' : 'var(--expense)';
        const urg = gun<=3 ? 'urgent' : (gun<=7 ? 'soon':'');
        return `<div class="row-item">
          <span class="row-dot" style="background:${renk}"></span>
          <div class="row-main">
            <div class="row-title">${p.aciklama||p.cari||'-'}</div>
            <div class="row-sub">${p.cari?p.cari+' · ':''}${fmtTarih(p.vade)} ${subeRozet(p.sube)}</div>
          </div>
          <div style="text-align:right;">
            <div class="row-amount" style="color:${renk}">${p.tip==='Tahsilat'?'+':'−'}${fmt(p.tutar)}</div>
            <div class="row-sub ${urg}">${gun<=0?'Bugün':gun+' gün'}</div>
          </div>
        </div>`;
      }).join("") || '<div class="empty">Bekleyen hareket yok.</div>'}
      </div>
    </div></div>
  `;

  filtreBarWire("ozet", renderOzet);
  disaAktarWire("ozet",
    ()=> `genel-bakis-${todayStr()}.csv`,
    ()=> ["Kalem","Tutar"],
    ()=> [
      ["Toplam Kasa", activeSube==='tumu' ? v.kasa : ""],
      ["Toplam Gelir", v.gelir],
      ["Toplam Gider", v.gider],
      ["Net Nakit", v.net],
      ["Bekleyen Tahsilat", v.bekleyenTahsilat],
      ["Bekleyen Ödeme", v.bekleyenOdeme],
      ["Beklenen Gelir", bg.beklenenGelir],
      ["Ay Sonu Net Durum", aySonuNetGuncel],
      ...dagilimSirali.map(([kat,tutar])=>[`Gider · ${kat}`, tutar]),
    ]
  );

  document.querySelectorAll('#gider-dagilim-tbody [data-acilim]').forEach(row=>{
    row.style.cursor = "pointer";
    row.addEventListener("click", ()=>{
      const target = document.getElementById(row.dataset.acilim);
      if(target) target.style.display = target.style.display === "none" ? "" : "none";
    });
  });
}

/* ---------------- Gelirler / Giderler ---------------- */
let EDITING = { gelir: null, gider: null, takip: null };

function islemFiltreli(tip){
  const liste = tip==='gelir' ? DATA.gelirler : DATA.giderler;
  const fs = FILTERS[tip];
  return f(liste)
    .filter(i => fs.kategori==='tumu' || i.kategori===fs.kategori)
    .filter(i => tarihAralikta(i.tarih, fs.bas, fs.bit))
    .filter(i => metinEslesir([i.aciklama, i.kategori, i.cari], fs.arama))
    .slice().sort((a,b)=> new Date(b.tarih) - new Date(a.tarih) || b.id-a.id);
}

function renderIslemIcerik(tip){
  const liste = tip==='gelir' ? DATA.gelirler : DATA.giderler;
  const kategoriler = tip==='gelir' ? DATA.gelirKategoriler : DATA.giderKategoriler;
  const renk = tip==='gelir' ? 'var(--income)' : 'var(--expense)';
  const filtreli = islemFiltreli(tip);
  const toplam = filtreli.reduce((a,b)=>a+b.tutar,0);
  const editId = EDITING[tip];

  document.getElementById(`kpi-${tip}`).innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Toplam ${tip==='gelir'?'Gelir':'Gider'}</div><div class="kpi-value tabular" style="color:${renk}">${fmt(toplam)}</div><div class="kpi-sub">${filtreli.length} kayıt${filtreTemizleMi(FILTERS[tip])?' · filtre uygulanıyor':''}</div></div>
  `;

  const editRowDesktop = (i) => `
    <tr style="background:var(--brass-soft);">
      <td colspan="7" style="padding:10px;">
        <div class="form-grid" style="grid-template-columns:repeat(6,1fr);">
          <input type="date" class="e-tarih" value="${i.tarih}">
          <select class="e-kategori">${kategoriler.map(k=>`<option ${k===i.kategori?'selected':''}>${k}</option>`).join("")}</select>
          <input type="text" class="e-cari" list="cari-list" placeholder="Cari" value="${(i.cari||'').replace(/"/g,'&quot;')}">
          <input type="text" class="e-aciklama" placeholder="Açıklama (opsiyonel)" value="${(i.aciklama||'').replace(/"/g,'&quot;')}">
          <select class="e-sube">${DATA.subeler.map(s=>`<option ${s===i.sube?'selected':''}>${s}</option>`).join("")}</select>
          <input type="number" class="e-tutar" value="${i.tutar}">
        </div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          <button class="btn btn-sm" data-kaydet="${i.id}">Kaydet</button>
          <button class="btn btn-ghost btn-sm" data-kopyala="${i.id}">Kopyala</button>
          <button class="btn btn-ghost btn-sm" data-del="${i.id}">Sil</button>
          <button class="btn btn-ghost btn-sm" data-iptal="${i.id}">İptal</button>
        </div>
      </td>
    </tr>`;

  const editRowMobile = (i) => `
    <div class="row-item" style="background:var(--brass-soft); flex-direction:column; align-items:stretch; gap:8px;">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <input type="date" class="e-tarih" value="${i.tarih}">
        <select class="e-kategori">${kategoriler.map(k=>`<option ${k===i.kategori?'selected':''}>${k}</option>`).join("")}</select>
        <input type="text" class="e-cari" list="cari-list" placeholder="Cari" value="${(i.cari||'').replace(/"/g,'&quot;')}" style="grid-column:1/-1;">
        <input type="text" class="e-aciklama" placeholder="Açıklama (opsiyonel)" value="${(i.aciklama||'').replace(/"/g,'&quot;')}" style="grid-column:1/-1;">
        <select class="e-sube">${DATA.subeler.map(s=>`<option ${s===i.sube?'selected':''}>${s}</option>`).join("")}</select>
        <input type="number" class="e-tutar" value="${i.tutar}">
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-sm" data-kaydet="${i.id}" style="flex:1;">Kaydet</button>
        <button class="btn btn-ghost btn-sm" data-kopyala="${i.id}" style="flex:1;">Kopyala</button>
        <button class="btn btn-ghost btn-sm" data-del="${i.id}" style="flex:1;">Sil</button>
        <button class="btn btn-ghost btn-sm" data-iptal="${i.id}" style="flex:1;">İptal</button>
      </div>
    </div>`;

  document.getElementById(`liste-${tip}`).innerHTML = `
    <div class="desktop-table" style="overflow-x:auto;">
      <table>
        <thead><tr><th>Tarih</th><th>Kategori</th><th>Cari</th><th>Açıklama</th><th>Şube</th><th class="right">Tutar</th><th></th></tr></thead>
        <tbody>
          ${filtreli.map(i => i.id===editId ? editRowDesktop(i) : `<tr class="tikla-duzenle" data-row="${i.id}">
            <td>${fmtTarih(i.tarih)}</td><td>${i.kategori||'-'}</td><td style="color:${subeRenk(i.sube)};font-weight:600;">${i.cari||'-'}</td><td>${i.aciklama||'-'}</td>
            <td>${subeRozet(i.sube)}</td>
            <td class="right tabular" style="color:${renk};font-weight:700;">${fmt(i.tutar)}</td>
            <td><button class="btn btn-ghost btn-sm" data-del="${i.id}">Sil</button></td>
          </tr>`).join("") || `<tr><td colspan="7"><div class="empty">Filtreye uyan kayıt yok.</div></td></tr>`}
        </tbody>
        ${filtreli.length ? `<tfoot><tr style="background:var(--paper);font-weight:700;">
          <td colspan="5">Toplam (${filtreli.length} kayıt)</td>
          <td class="right tabular" style="color:${renk};">${fmt(toplam)}</td>
          <td></td>
        </tr></tfoot>` : ''}
      </table>
    </div>
    <div class="mobile-cards row-list" style="padding:6px 16px;">
      ${filtreli.map(i => i.id===editId ? editRowMobile(i) : `<div class="row-item tikla-duzenle" data-row="${i.id}">
        <span class="row-dot" style="background:${renk}"></span>
        <div class="row-main">
          <div class="row-title" style="color:${subeRenk(i.sube)}">${i.cari||i.aciklama||i.kategori||'-'}</div>
          <div class="row-sub">${i.kategori||''}${i.aciklama?' · '+i.aciklama:''} · ${fmtTarih(i.tarih)} ${subeRozet(i.sube)}</div>
        </div>
        <div style="text-align:right;">
          <div class="row-amount" style="color:${renk}">${fmt(i.tutar)}</div>
          <button class="btn btn-ghost btn-sm" data-del="${i.id}" style="margin-top:4px;">Sil</button>
        </div>
      </div>`).join("") || '<div class="empty">Filtreye uyan kayıt yok.</div>'}
      ${filtreli.length ? `<div class="row-item" style="border-top:2px solid var(--line);font-weight:700;">
        <div class="row-main">Toplam (${filtreli.length} kayıt)</div>
        <div class="row-amount" style="color:${renk}">${fmt(toplam)}</div>
      </div>` : ''}
    </div>
  `;

  const container = document.getElementById(`liste-${tip}`);

  container.querySelectorAll(".tikla-duzenle").forEach(el=>{
    el.style.cursor = "pointer";
    el.addEventListener("click", (ev)=>{
      if(ev.target.closest("[data-del]")) return;
      EDITING[tip] = Number(el.dataset.row);
      renderIslemIcerik(tip);
    });
  });
  container.querySelectorAll("[data-kopyala]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.kopyala);
      const orijinal = liste.find(x=>x.id===id);
      if(!orijinal) return;
      const yeni = { ...orijinal, id: uid(), tarih: todayStr() };
      liste.push(yeni);
      await saveData();
      EDITING[tip] = yeni.id;
      renderIslemIcerik(tip);
    });
  });
  container.querySelectorAll("[data-del]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.del);
      const idx = liste.findIndex(x=>x.id===id);
      if(idx>-1){ liste.splice(idx,1); await saveData(); renderIslemIcerik(tip); }
    });
  });
  container.querySelectorAll("[data-kaydet]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.kaydet);
      const kayit = liste.find(x=>x.id===id);
      const wrap = btn.closest("tr") || btn.closest(".row-item");
      const tarih = wrap.querySelector(".e-tarih").value;
      const kategori = wrap.querySelector(".e-kategori").value;
      const cari = wrap.querySelector(".e-cari").value.trim();
      const aciklama = wrap.querySelector(".e-aciklama").value.trim();
      const sube = wrap.querySelector(".e-sube").value;
      const tutar = parseFloat(wrap.querySelector(".e-tutar").value);
      if(!tarih || !tutar || tutar<=0) return;
      Object.assign(kayit, { tarih, kategori, cari, aciklama, sube, tutar });
      cariKaydet(cari);
      await saveData();
      EDITING[tip] = null;
      renderIslemIcerik(tip);
    });
  });
  container.querySelectorAll("[data-iptal]").forEach(btn=>{
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      EDITING[tip] = null;
      renderIslemIcerik(tip);
    });
  });
}

function renderIslemSayfa(tip){
  const kategoriler = tip==='gelir' ? DATA.gelirKategoriler : DATA.giderKategoriler;
  const fs = FILTERS[tip];

  document.getElementById("content").innerHTML = `
    <div class="kpi-grid" style="margin-bottom:14px;" id="kpi-${tip}"></div>
    ${disaAktarToolbarHTML(tip)}

    <div class="card" id="filtre-${tip}">
      <div class="card-head">Filtrele</div>
      <div class="card-body">
        <div class="form-grid">
          <select data-fkey="kategori"><option value="tumu">Tüm Kategoriler</option>${kategoriler.map(k=>`<option value="${k}" ${fs.kategori===k?'selected':''}>${k}</option>`).join("")}</select>
          <input type="date" data-fkey="bas" value="${fs.bas}">
          <input type="date" data-fkey="bit" value="${fs.bit}">
          <input type="text" data-fkey="arama" placeholder="Cari / açıklamada ara…" value="${fs.arama}">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-${tip}">Temizle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Yeni ${tip==='gelir'?'Gelir':'Gider'} Ekle</div>
      <div class="card-body">
        <div class="form-grid">
          <input type="date" id="f-tarih" value="${todayStr()}">
          <select id="f-kategori">${kategoriler.map(k=>`<option>${k}</option>`).join("")}</select>
          <input type="text" id="f-cari" list="cari-list" placeholder="Cari">
          <input type="text" id="f-aciklama" placeholder="Açıklama (opsiyonel)">
          <select id="f-sube">${DATA.subeler.map(s=>`<option>${s}</option>`).join("")}</select>
          <input type="number" id="f-tutar" placeholder="Tutar (₺)" min="0">
        </div>
        <button class="btn" id="btn-ekle">Kaydet</button>
      </div>
    </div>

    <div class="section-title">Kayıtlar <span style="text-transform:none;font-weight:400;color:var(--text-3);letter-spacing:0;">· satıra dokunarak düzenleyebilirsiniz</span></div>
    <div class="card">
      <div class="card-body" style="padding:0;" id="liste-${tip}"></div>
    </div>
  `;

  filtreBarWire(tip, ()=>renderIslemIcerik(tip));
  disaAktarWire(tip,
    ()=> `${tip==='gelir'?'gelirler':'giderler'}-${todayStr()}.csv`,
    ()=> ["Tarih","Kategori","Cari","Açıklama","Şube","Tutar"],
    ()=> islemFiltreli(tip).map(i=>[fmtTarih(i.tarih), i.kategori||"", i.cari||"", i.aciklama||"", i.sube||"", i.tutar])
  );
  document.getElementById(`filtre-temizle-${tip}`).addEventListener("click", ()=>{
    FILTERS[tip] = { kategori:"tumu", arama:"", bas:"", bit:"" };
    renderIslemSayfa(tip);
  });
  renderIslemIcerik(tip);

  document.getElementById("btn-ekle").addEventListener("click", async ()=>{
    const liste = tip==='gelir' ? DATA.gelirler : DATA.giderler;
    const tarih = document.getElementById("f-tarih").value;
    const kategori = document.getElementById("f-kategori").value;
    const cari = document.getElementById("f-cari").value.trim();
    const aciklama = document.getElementById("f-aciklama").value.trim();
    const sube = document.getElementById("f-sube").value;
    const tutar = parseFloat(document.getElementById("f-tutar").value);
    if(!tarih || !tutar || tutar<=0) return;
    liste.push({ id: uid(), tarih, kategori, cari, aciklama, sube, tutar });
    cariKaydet(cari);
    await saveData();
    renderIslemIcerik(tip);
    document.getElementById("f-cari").value = "";
    document.getElementById("f-aciklama").value = "";
    document.getElementById("f-tutar").value = "";
  });
}

/* ---------------- Banka Hesapları ---------------- */
function bankaFiltreli(){
  const fs = FILTERS.banka;
  return DATA.hesaplar.filter(h => metinEslesir([h.banka], fs.arama));
}

function renderBankaIcerik(){
  const filtreli = bankaFiltreli();
  const toplamGorunen = filtreli.reduce((a,b)=>a+b.bakiye,0);
  document.getElementById("kpi-banka").innerHTML = `
    <div class="kpi-card"><div class="kpi-label">${filtreTemizleMi(FILTERS.banka)?'Filtrelenen':'Toplam'} Banka Varlığı</div><div class="kpi-value tabular">${fmt(toplamGorunen)}</div><div class="kpi-sub">${filtreli.length} / ${DATA.hesaplar.length} hesap (şubesiz, genel merkez konsolide)</div></div>
  `;
  document.getElementById("liste-banka").innerHTML = `
    <div class="row-list" style="padding:6px 16px;">
      ${filtreli.map(h=>`<div class="row-item">
        <div class="row-main"><div class="row-title">${h.banka}</div></div>
        <input type="number" class="tabular" style="width:140px;text-align:right;font-weight:700;" data-bakiye="${h.id}" value="${h.bakiye}">
        <button class="btn btn-ghost btn-sm" data-del-hesap="${h.id}">Sil</button>
      </div>`).join("") || '<div class="empty">Filtreye uyan hesap yok.</div>'}
      ${filtreli.length ? `<div class="row-item" style="border-top:2px solid var(--line);font-weight:700;">
        <div class="row-main">Toplam (${filtreli.length} hesap)</div>
        <div class="row-amount tabular">${fmt(toplamGorunen)}</div>
      </div>` : ''}
    </div>
  `;
  document.querySelectorAll("[data-bakiye]").forEach(inp=>{
    inp.addEventListener("change", async ()=>{
      const id = Number(inp.dataset.bakiye);
      const h = DATA.hesaplar.find(x=>x.id===id);
      if(h){ h.bakiye = parseFloat(inp.value)||0; await saveData(); renderBankaIcerik(); }
    });
  });
  document.querySelectorAll("[data-del-hesap]").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const id = Number(btn.dataset.delHesap);
      DATA.hesaplar = DATA.hesaplar.filter(x=>x.id!==id);
      await saveData(); renderBankaIcerik();
    });
  });
}

function renderBanka(){
  const fs = FILTERS.banka;
  document.getElementById("content").innerHTML = `
    <div class="kpi-grid" style="margin-bottom:14px;" id="kpi-banka"></div>
    ${disaAktarToolbarHTML("banka")}

    <div class="card" id="filtre-banka">
      <div class="card-head">Filtrele</div>
      <div class="card-body">
        <div class="form-grid" style="grid-template-columns:1fr auto;">
          <input type="text" data-fkey="arama" placeholder="Banka adında ara…" value="${fs.arama}">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-banka">Temizle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Yeni Hesap Ekle</div>
      <div class="card-body">
        <div class="form-grid">
          <input type="text" id="f-banka" placeholder="Banka / Hesap adı">
          <input type="number" id="f-bakiye" placeholder="Bakiye (₺)">
        </div>
        <button class="btn" id="btn-ekle-hesap">Ekle</button>
      </div>
    </div>
    <div class="section-title">Hesaplar</div>
    <div class="card"><div class="card-body" style="padding:0;" id="liste-banka"></div></div>
  `;

  filtreBarWire("banka", renderBankaIcerik);
  disaAktarWire("banka",
    ()=> `banka-hesaplari-${todayStr()}.csv`,
    ()=> ["Banka","Bakiye"],
    ()=> bankaFiltreli().map(h=>[h.banka, h.bakiye])
  );
  document.getElementById("filtre-temizle-banka").addEventListener("click", ()=>{
    FILTERS.banka = { arama:"" };
    renderBanka();
  });
  renderBankaIcerik();

  document.getElementById("btn-ekle-hesap").addEventListener("click", async ()=>{
    const banka = document.getElementById("f-banka").value.trim();
    const bakiye = parseFloat(document.getElementById("f-bakiye").value);
    if(!banka || isNaN(bakiye)) return;
    DATA.hesaplar.push({ id: uid(), banka, bakiye });
    await saveData(); renderBankaIcerik();
    document.getElementById("f-banka").value = "";
    document.getElementById("f-bakiye").value = "";
  });
}

/* ---------------- Ödeme & Tahsilat ---------------- */
function takipFiltreli(){
  const fs = FILTERS.takip;
  return f(DATA.planli)
    .filter(p => fs.tip==='tumu' || p.tip===fs.tip)
    .filter(p => fs.durum==='tumu' || p.durum===fs.durum)
    .filter(p => tarihAralikta(p.vade, fs.bas, fs.bit))
    .filter(p => metinEslesir([p.aciklama, p.cari], fs.arama))
    .slice().sort((a,b)=>new Date(a.vade)-new Date(b.vade));
}

function renderTakipIcerik(){
  const v = hesapla();
  const planli = takipFiltreli();
  const toplamTahsilat = planli.filter(p=>p.tip==='Tahsilat').reduce((a,b)=>a+b.tutar,0);
  const toplamOdeme = planli.filter(p=>p.tip==='Ödeme').reduce((a,b)=>a+b.tutar,0);
  const editId = EDITING.takip;

  const bugun = todayStr();
  const bugununOdemesi = f(DATA.planli).filter(p=>p.tip==='Ödeme' && p.vade===bugun && p.durum==='Bekliyor').reduce((a,b)=>a+b.tutar,0);
  const bugununOdemeSayisi = f(DATA.planli).filter(p=>p.tip==='Ödeme' && p.vade===bugun && p.durum==='Bekliyor').length;

  document.getElementById("kpi-takip").innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Bekleyen Tahsilat</div><div class="kpi-value tabular pos">${fmt(v.bekleyenTahsilat)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Bekleyen Ödeme</div><div class="kpi-value tabular neg">${fmt(v.bekleyenOdeme)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Bugünün Toplam Ödemesi</div><div class="kpi-value tabular neg">${fmt(bugununOdemesi)}</div><div class="kpi-sub">${bugununOdemeSayisi} kayıt · vadesi bugün</div></div>
    <div class="kpi-card"><div class="kpi-label">Filtredeki Kayıt</div><div class="kpi-value tabular">${planli.length}</div><div class="kpi-sub">${planli.filter(p=>p.durum==='Bekliyor' && gunFarki(p.vade)<=7).length} tanesi 7 gün içinde</div></div>
  `;

  const editRow = (p) => `
    <div class="row-item" style="background:var(--brass-soft); flex-direction:column; align-items:stretch; gap:8px;">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;">
        <input type="date" class="e-vade" value="${p.vade}">
        <select class="e-tip"><option ${p.tip==='Ödeme'?'selected':''}>Ödeme</option><option ${p.tip==='Tahsilat'?'selected':''}>Tahsilat</option></select>
        <input type="text" class="e-aciklama" value="${(p.aciklama||'').replace(/"/g,'&quot;')}" style="grid-column:1/-1;" placeholder="Açıklama">
        <input type="text" class="e-cari" list="cari-list" value="${(p.cari||'').replace(/"/g,'&quot;')}" placeholder="Cari / Kişi">
        <select class="e-sube">${DATA.subeler.map(s=>`<option ${s===p.sube?'selected':''}>${s}</option>`).join("")}</select>
        <input type="number" class="e-tutar" value="${p.tutar}">
        <select class="e-durum"><option ${p.durum==='Bekliyor'?'selected':''}>Bekliyor</option><option ${p.durum==='Tamamlandı'?'selected':''}>Tamamlandı</option></select>
      </div>
      <div style="display:flex;gap:6px;">
        <button class="btn btn-sm" data-kaydet-plan="${p.id}" style="flex:1;">Kaydet</button>
        <button class="btn btn-ghost btn-sm" data-iptal-plan="${p.id}" style="flex:1;">İptal</button>
      </div>
    </div>`;

  document.getElementById("liste-takip").innerHTML = `
    <div class="row-list" style="padding:6px 16px;">
    ${planli.map(p => {
      if(p.id===editId) return editRow(p);
      const gun = gunFarki(p.vade);
      const tamam = p.durum==='Tamamlandı';
      const renk = p.tip==='Tahsilat' ? 'var(--income)' : 'var(--expense)';
      return `<div class="row-item tikla-duzenle ${tamam?'row-tamamlandi':''}" data-row="${p.id}">
        <span class="row-dot" style="background:${renk}"></span>
        <div class="row-main">
          <div class="row-title" style="color:${subeRenk(p.sube)}">${p.aciklama||'-'}</div>
          <div class="row-sub" style="color:${subeRenk(p.sube)}">${p.cari?p.cari+' · ':''}${fmtTarih(p.vade)} ${subeRozet(p.sube)} ${!tamam && gun<=3 ? '<span class="urgent">ACİL</span>':''}</div>
        </div>
        <div style="text-align:right;">
          <div class="row-amount" style="color:${renk}">${fmt(p.tutar)}</div>
          <div style="display:flex;gap:5px;margin-top:3px;justify-content:flex-end;">
            ${tamam ? '<span class="row-sub">✓ Tamamlandı</span>' :
              `<button class="btn btn-ghost btn-sm" data-tamamla="${p.id}">${p.tip==='Tahsilat'?'Tahsil Edildi':'Ödendi'}</button>`}
            <button class="btn btn-ghost btn-sm" data-del-plan="${p.id}">Sil</button>
          </div>
        </div>
      </div>`;
    }).join("") || '<div class="empty">Filtreye uyan kayıt yok.</div>'}
    ${planli.length ? `<div class="row-item" style="border-top:2px solid var(--line);">
      <div class="row-main" style="font-weight:700;">Toplam (${planli.length} kayıt)</div>
      <div style="text-align:right;">
        <div class="tabular pos" style="font-weight:700;">Tahsilat: ${fmt(toplamTahsilat)}</div>
        <div class="tabular neg" style="font-weight:700;margin-top:2px;">Ödeme: ${fmt(toplamOdeme)}</div>
      </div>
    </div>` : ''}
    </div>
  `;

  const container = document.getElementById("liste-takip");

  container.querySelectorAll(".tikla-duzenle").forEach(el=>{
    el.style.cursor = "pointer";
    el.addEventListener("click", (ev)=>{
      if(ev.target.closest("[data-tamamla], [data-del-plan]")) return;
      EDITING.takip = Number(el.dataset.row);
      renderTakipIcerik();
    });
  });
  container.querySelectorAll("[data-tamamla]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.tamamla);
      const p = DATA.planli.find(x=>x.id===id);
      if(p){ p.durum = "Tamamlandı"; await saveData(); renderTakipIcerik(); }
    });
  });
  container.querySelectorAll("[data-del-plan]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.delPlan);
      DATA.planli = DATA.planli.filter(x=>x.id!==id);
      await saveData(); renderTakipIcerik();
    });
  });
  container.querySelectorAll("[data-kaydet-plan]").forEach(btn=>{
    btn.addEventListener("click", async (ev)=>{
      ev.stopPropagation();
      const id = Number(btn.dataset.kaydetPlan);
      const kayit = DATA.planli.find(x=>x.id===id);
      const wrap = btn.closest(".row-item");
      const vade = wrap.querySelector(".e-vade").value;
      const tip = wrap.querySelector(".e-tip").value;
      const aciklama = wrap.querySelector(".e-aciklama").value.trim();
      const cari = wrap.querySelector(".e-cari").value.trim();
      const sube = wrap.querySelector(".e-sube").value;
      const tutar = parseFloat(wrap.querySelector(".e-tutar").value);
      const durum = wrap.querySelector(".e-durum").value;
      if(!vade || !tutar || tutar<=0) return;
      Object.assign(kayit, { vade, tip, aciklama, cari, sube, tutar, durum });
      cariKaydet(cari);
      await saveData();
      EDITING.takip = null;
      renderTakipIcerik();
    });
  });
  container.querySelectorAll("[data-iptal-plan]").forEach(btn=>{
    btn.addEventListener("click", (ev)=>{
      ev.stopPropagation();
      EDITING.takip = null;
      renderTakipIcerik();
    });
  });
}

function renderTakip(){
  const fs = FILTERS.takip;
  document.getElementById("content").innerHTML = `
    <div class="kpi-grid" style="margin-bottom:14px;" id="kpi-takip"></div>
    ${disaAktarToolbarHTML("takip")}

    <div class="card" id="filtre-takip">
      <div class="card-head">Filtrele</div>
      <div class="card-body">
        <div class="form-grid">
          <select data-fkey="tip"><option value="tumu" ${fs.tip==='tumu'?'selected':''}>Tüm Hareketler</option><option value="Ödeme" ${fs.tip==='Ödeme'?'selected':''}>Ödeme</option><option value="Tahsilat" ${fs.tip==='Tahsilat'?'selected':''}>Tahsilat</option></select>
          <select data-fkey="durum"><option value="tumu" ${fs.durum==='tumu'?'selected':''}>Tüm Durumlar</option><option value="Bekliyor" ${fs.durum==='Bekliyor'?'selected':''}>Bekliyor</option><option value="Tamamlandı" ${fs.durum==='Tamamlandı'?'selected':''}>Tamamlandı</option></select>
          <input type="date" data-fkey="bas" value="${fs.bas}">
          <input type="date" data-fkey="bit" value="${fs.bit}">
          <input type="text" data-fkey="arama" placeholder="Açıklama / cari ara…" value="${fs.arama}">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-takip">Temizle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Yeni Planlı Hareket</div>
      <div class="card-body">
        <div class="form-grid">
          <input type="date" id="f-vade" value="${todayStr()}">
          <select id="f-tip"><option>Ödeme</option><option>Tahsilat</option></select>
          <input type="text" id="f-aciklama2" placeholder="Açıklama">
          <input type="text" id="f-cari" list="cari-list" placeholder="Cari / Kişi">
          <select id="f-sube2">${DATA.subeler.map(s=>`<option>${s}</option>`).join("")}</select>
          <input type="number" id="f-tutar2" placeholder="Tutar (₺)">
        </div>
        <button class="btn" id="btn-ekle-plan">Kaydet</button>
      </div>
    </div>
    <div class="section-title">Kayıtlar <span style="text-transform:none;font-weight:400;color:var(--text-3);letter-spacing:0;">· satıra dokunarak düzenleyebilirsiniz</span></div>
    <div class="card"><div class="card-body" style="padding:0;" id="liste-takip"></div></div>
  `;

  filtreBarWire("takip", renderTakipIcerik);
  disaAktarWire("takip",
    ()=> `odeme-tahsilat-${todayStr()}.csv`,
    ()=> ["Vade","Tip","Açıklama","Cari","Şube","Tutar","Durum"],
    ()=> takipFiltreli().map(p=>[fmtTarih(p.vade), p.tip, p.aciklama||"", p.cari||"", p.sube||"", p.tutar, p.durum])
  );
  document.getElementById("filtre-temizle-takip").addEventListener("click", ()=>{
    FILTERS.takip = { tip:"tumu", durum:"tumu", arama:"", bas:"", bit:"" };
    renderTakip();
  });
  renderTakipIcerik();

  document.getElementById("btn-ekle-plan").addEventListener("click", async ()=>{
    const vade = document.getElementById("f-vade").value;
    const tip = document.getElementById("f-tip").value;
    const aciklama = document.getElementById("f-aciklama2").value.trim();
    const cari = document.getElementById("f-cari").value.trim();
    const sube = document.getElementById("f-sube2").value;
    const tutar = parseFloat(document.getElementById("f-tutar2").value);
    if(!vade || !tutar || tutar<=0) return;
    DATA.planli.push({ id: uid(), vade, tip, aciklama, cari, sube, tutar, durum:"Bekliyor" });
    cariKaydet(cari);
    await saveData(); renderTakipIcerik();
    document.getElementById("f-aciklama2").value = "";
    document.getElementById("f-cari").value = "";
    document.getElementById("f-tutar2").value = "";
  });
}

/* ---------------- Şube Karşılaştırma ---------------- */
function renderSubeKarsilastirma(){
  const fs = FILTERS.sube;
  const rows = DATA.subeler.map(s=>{
    const gelir = DATA.gelirler.filter(x=>x.sube===s && tarihAralikta(x.tarih,fs.bas,fs.bit)).reduce((a,b)=>a+b.tutar,0);
    const gider = DATA.giderler.filter(x=>x.sube===s && tarihAralikta(x.tarih,fs.bas,fs.bit)).reduce((a,b)=>a+b.tutar,0);
    const tahsilat = DATA.planli.filter(p=>p.sube===s && p.tip==='Tahsilat' && p.durum==='Bekliyor').reduce((a,b)=>a+b.tutar,0);
    const odeme = DATA.planli.filter(p=>p.sube===s && p.tip==='Ödeme' && p.durum==='Bekliyor').reduce((a,b)=>a+b.tutar,0);
    const net = gelir-gider;
    const aySonuNet = net + tahsilat - odeme;
    return { s, gelir, gider, net, tahsilat, odeme, aySonuNet };
  });

  document.getElementById("content").innerHTML = `
    ${disaAktarToolbarHTML("sube")}
    <div class="card" id="filtre-sube" style="margin-bottom:14px;">
      <div class="card-head">Filtrele</div>
      <div class="card-body">
        <div class="form-grid" style="grid-template-columns:1fr 1fr auto;">
          <input type="date" data-fkey="bas" value="${fs.bas}">
          <input type="date" data-fkey="bit" value="${fs.bit}">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-sube">Temizle</button>
        </div>
        <div class="row-sub" style="margin-top:4px;">Varsayılan olarak içinde bulunulan ay gösterilir. Tarih filtresi Gelir/Gider/Net hesaplarını etkiler. Bekleyen tahsilat ve ödeme her zaman güncel duruma göre gösterilir.</div>
      </div>
    </div>

    <div class="kpi-grid" style="margin-bottom:14px;">
      ${rows.map(r=>`<div class="branch-card" style="border-top-color:${subeRenk(r.s)}">
        <div class="name">${r.s}</div>
        <div class="branch-kpi-row"><span style="color:var(--text-3)">Gelir</span><span class="tabular pos">${fmt(r.gelir)}</span></div>
        <div class="branch-kpi-row"><span style="color:var(--text-3)">Gider</span><span class="tabular neg">${fmt(r.gider)}</span></div>
        <div class="branch-kpi-row" style="border-top:1px solid var(--line);padding-top:6px;margin-top:2px;"><span style="color:var(--text-3)">Net</span><span class="tabular" style="font-weight:700;color:${r.net>=0?'var(--income)':'var(--expense)'}">${fmt(r.net)}</span></div>
      </div>`).join("")}
    </div>

    <div class="section-title">Detay Tablo</div>
    <div class="card"><div class="card-body" style="padding:0;overflow-x:auto;">
      <table>
        <thead><tr><th>Şube</th><th class="right">Gelir</th><th class="right">Gider</th><th class="right">Net</th><th class="right">Bekl. Tahsilat</th><th class="right">Bekl. Ödeme</th><th class="right">Ay Sonu Net</th></tr></thead>
        <tbody>
          ${rows.map(r=>`<tr>
            <td>${subeRozet(r.s)}</td>
            <td class="right tabular pos">${fmt(r.gelir)}</td>
            <td class="right tabular neg">${fmt(r.gider)}</td>
            <td class="right tabular" style="font-weight:700;color:${r.net>=0?'var(--income)':'var(--expense)'}">${fmt(r.net)}</td>
            <td class="right tabular">${fmt(r.tahsilat)}</td>
            <td class="right tabular">${fmt(r.odeme)}</td>
            <td class="right tabular" style="font-weight:700;color:${r.aySonuNet>=0?'var(--income)':'var(--expense)'}">${fmt(r.aySonuNet)}</td>
          </tr>`).join("")}
          <tr style="background:var(--paper);font-weight:700;">
            <td>Toplam</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.gelir,0))}</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.gider,0))}</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.net,0))}</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.tahsilat,0))}</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.odeme,0))}</td>
            <td class="right tabular">${fmt(rows.reduce((a,b)=>a+b.aySonuNet,0))}</td>
          </tr>
        </tbody>
      </table>
    </div></div>
  `;

  filtreBarWire("sube", renderSubeKarsilastirma);
  disaAktarWire("sube",
    ()=> `sube-karsilastirma-${todayStr()}.csv`,
    ()=> ["Şube","Gelir","Gider","Net","Bekl. Tahsilat","Bekl. Ödeme","Ay Sonu Net"],
    ()=> rows.map(r=>[r.s, r.gelir, r.gider, r.net, r.tahsilat, r.odeme, r.aySonuNet])
  );
  document.getElementById("filtre-temizle-sube").addEventListener("click", ()=>{
    FILTERS.sube = { bas:"", bit:"" };
    renderSubeKarsilastirma();
  });
}

/* ---------------- Personel Ödemeleri ---------------- */
function personelFiltreli(){
  const fs = FILTERS.personel;
  return f(DATA.giderler)
    .filter(g => g.kategori === "PERSONEL")
    .filter(g => tarihAralikta(g.tarih, fs.bas, fs.bit))
    .filter(g => metinEslesir([g.aciklama, g.cari], fs.arama));
}

function personelGrupla(kayitlar){
  const gruplar = new Map();
  kayitlar.forEach(g=>{
    const ad = (g.cari || g.aciklama || "").trim() || "Belirtilmemiş";
    if(!gruplar.has(ad)) gruplar.set(ad, { ad, tutar:0, sayi:0, subeler:new Set(), sonTarih:"" });
    const grup = gruplar.get(ad);
    grup.tutar += g.tutar;
    grup.sayi += 1;
    if(g.sube) grup.subeler.add(g.sube);
    if(!grup.sonTarih || g.tarih > grup.sonTarih) grup.sonTarih = g.tarih;
  });
  return Array.from(gruplar.values()).sort((a,b)=>b.tutar-a.tutar);
}

function renderPersonelIcerik(){
  const kayitlar = personelFiltreli();
  const gruplar = personelGrupla(kayitlar);
  const toplam = kayitlar.reduce((a,b)=>a+b.tutar,0);
  const kisiSayisi = gruplar.length;
  const ortalama = kisiSayisi ? toplam/kisiSayisi : 0;

  document.getElementById("kpi-personel").innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Toplam Personel Ödemesi</div><div class="kpi-value tabular neg">${fmt(toplam)}</div><div class="kpi-sub">${kayitlar.length} kayıt</div></div>
    <div class="kpi-card"><div class="kpi-label">Kişi Sayısı</div><div class="kpi-value tabular">${kisiSayisi}</div></div>
    <div class="kpi-card"><div class="kpi-label">Kişi Başı Ortalama</div><div class="kpi-value tabular">${fmt(ortalama)}</div></div>
  `;

  document.getElementById("liste-personel").innerHTML = `
    <table>
      <thead><tr><th>Ad</th><th>Şube</th><th class="right">Ödeme Sayısı</th><th>Son Ödeme</th><th class="right">Toplam</th></tr></thead>
      <tbody>
        ${gruplar.map(g=>`<tr>
          <td>${g.ad}</td>
          <td>${Array.from(g.subeler).map(subeRozet).join(" ")}</td>
          <td class="right tabular">${g.sayi}</td>
          <td>${fmtTarih(g.sonTarih)}</td>
          <td class="right tabular neg" style="font-weight:700;">${fmt(g.tutar)}</td>
        </tr>`).join("") || `<tr><td colspan="5" class="empty">Filtreye uyan kayıt yok.</td></tr>`}
        ${gruplar.length ? `<tr style="background:var(--paper);font-weight:700;">
          <td colspan="4">Toplam (${kisiSayisi} kişi)</td>
          <td class="right tabular">${fmt(toplam)}</td>
        </tr>` : ""}
      </tbody>
    </table>
  `;
}

function renderPersonel(){
  const fs = FILTERS.personel;
  document.getElementById("content").innerHTML = `
    <div class="kpi-grid" style="margin-bottom:14px;" id="kpi-personel"></div>
    ${disaAktarToolbarHTML("personel")}

    <div class="card" id="filtre-personel" style="margin-bottom:14px;">
      <div class="card-head">Filtrele</div>
      <div class="card-body">
        <div class="form-grid">
          <input type="date" data-fkey="bas" value="${fs.bas}">
          <input type="date" data-fkey="bit" value="${fs.bit}">
          <input type="text" data-fkey="arama" placeholder="İsim ara…" value="${fs.arama}">
          <button class="btn btn-ghost btn-sm" id="filtre-temizle-personel">Temizle</button>
        </div>
        <div class="row-sub" style="margin-top:4px;">Giderler sekmesindeki "PERSONEL" kategorili kayıtlardan kişi bazlı özetlenir. Kayıtları düzenlemek için Giderler sekmesini kullanın.</div>
      </div>
    </div>

    <div class="section-title">Kişi Bazlı Özet</div>
    <div class="card"><div class="card-body" style="padding:0;overflow-x:auto;" id="liste-personel"></div></div>
  `;

  filtreBarWire("personel", renderPersonelIcerik);
  disaAktarWire("personel",
    ()=> `personel-odemeleri-${todayStr()}.csv`,
    ()=> ["Ad","Şube","Ödeme Sayısı","Son Ödeme","Toplam"],
    ()=> personelGrupla(personelFiltreli()).map(g=>[g.ad, Array.from(g.subeler).join(", "), g.sayi, fmtTarih(g.sonTarih), g.tutar])
  );
  document.getElementById("filtre-temizle-personel").addEventListener("click", ()=>{
    FILTERS.personel = { arama:"", bas:"", bit:"" };
    renderPersonel();
  });
  renderPersonelIcerik();
}

/* ---------------- Ayarlar ---------------- */
function renderAyarlar(){
  document.getElementById("content").innerHTML = `
    <div class="hint-box">
      <strong>Bu dosyayı iPhone'da gerçek bir uygulama gibi kullanmak için:</strong>
      <ol style="margin:8px 0 0;padding-left:18px;line-height:1.7;">
        <li>Dosyayı bir web barındırmaya yükleyin. En kolay ücretsiz yöntem: <em>app.netlify.com/drop</em> adresine Mac'ten bu HTML dosyasını sürükleyip bırakmak — hesap bile gerekmez, size anında bir link verir.</li>
        <li>iPhone'da o linki <strong>Safari</strong> ile açın (Chrome değil — "Ana Ekrana Ekle" özelliği için Safari gerekir).</li>
        <li>Alt ortadaki <strong>Paylaş</strong> ikonuna (kare + yukarı ok) dokunun.</li>
        <li>Aşağı kaydırıp <strong>"Ana Ekrana Ekle"</strong> seçeneğine dokunun, isim verip <strong>Ekle</strong>'ye basın.</li>
        <li>Ana ekranınızda gerçek bir uygulama ikonu belirir; dokunduğunuzda adres çubuğu olmadan tam ekran açılır.</li>
      </ol>
      <strong style="display:block;margin-top:10px;">Mac'te kullanmak için:</strong> Aynı linki Safari'de açıp Dock'a sürükleyin ya da sekmeyi sabitleyin.<br><br>
      Veriler artık tarayıcınızda kalıcı olarak saklanıyor (localStorage) — sayfayı kapatıp açsanız bile girdikleriniz kaybolmaz. Sadece o cihazın o tarayıcısına özeldir; başka bir cihazdan aynı veriyi görmek isterseniz Ayarlar'daki "Yedeği İndir" ile aldığınız JSON dosyasını taşımanız gerekir.
    </div>

    <div class="card">
      <div class="card-head">Şubeler</div>
      <div class="card-body">
        <div class="list-manage" id="sube-list"></div>
        <div class="form-grid" style="margin-top:12px;grid-template-columns:1fr auto;">
          <input type="text" id="yeni-sube" placeholder="Yeni şube adı">
          <button class="btn" id="btn-yeni-sube">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Gider Kategorileri</div>
      <div class="card-body">
        <div class="list-manage" id="gider-kat-list"></div>
        <div class="form-grid" style="margin-top:12px;grid-template-columns:1fr auto;">
          <input type="text" id="yeni-gider-kat" placeholder="Yeni gider kategorisi">
          <button class="btn" id="btn-yeni-gider-kat">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Gelir Kategorileri</div>
      <div class="card-body">
        <div class="list-manage" id="gelir-kat-list"></div>
        <div class="form-grid" style="margin-top:12px;grid-template-columns:1fr auto;">
          <input type="text" id="yeni-gelir-kat" placeholder="Yeni gelir kategorisi">
          <button class="btn" id="btn-yeni-gelir-kat">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Cariler <span style="font-weight:400;color:var(--text-3);font-size:12px;">(${DATA.cariler.length} kayıtlı)</span></div>
      <div class="card-body">
        <p style="font-size:12px;color:var(--text-2);margin:0 0 8px;">Gider/gelir ve ödeme-tahsilat kayıtlarında açıklama/cari alanına yazarken bu listeden öneri çıkar — aynı cariyi farklı yazımlarla girmeyi önler.</p>
        <input type="text" id="cari-arama" placeholder="Cari ara…" style="margin-bottom:8px;">
        <div class="list-manage" id="cari-list-manage"></div>
        <div class="form-grid" style="margin-top:12px;grid-template-columns:1fr auto;">
          <input type="text" id="yeni-cari" placeholder="Yeni cari adı">
          <button class="btn" id="btn-yeni-cari">Ekle</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head">Veri Yönetimi</div>
      <div class="card-body">
        <p style="font-size:12.5px;color:var(--text-2);margin:0 0 10px;">Tüm verileriniz bu tarayıcıda güvenle saklanır. Yedek almak isterseniz JSON olarak indirebilirsiniz.</p>
        <button class="btn btn-ghost" id="btn-export">Yedeği İndir (JSON)</button>
      </div>
    </div>
  `;

  const renderTagList = (id, arr, removeFn) => {
    document.getElementById(id).innerHTML = arr.map(x=>`<span class="tag-chip">${x}<button data-rm="${x}">×</button></span>`).join("");
    document.getElementById(id).querySelectorAll("[data-rm]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{ await removeFn(btn.dataset.rm); renderAll(); });
    });
  };
  renderTagList("sube-list", DATA.subeler, async (v)=>{ DATA.subeler = DATA.subeler.filter(x=>x!==v); await saveData(); });
  renderTagList("gider-kat-list", DATA.giderKategoriler, async (v)=>{ DATA.giderKategoriler = DATA.giderKategoriler.filter(x=>x!==v); await saveData(); });
  renderTagList("gelir-kat-list", DATA.gelirKategoriler, async (v)=>{ DATA.gelirKategoriler = DATA.gelirKategoriler.filter(x=>x!==v); await saveData(); });

  const cariRemoveFn = async (v)=>{ DATA.cariler = DATA.cariler.filter(x=>x!==v); await saveData(); renderCariDatalist(); };
  const renderCariManageList = (filtreMetni="") => {
    const q = filtreMetni.trim().toLocaleLowerCase("tr");
    const gosterilecek = q ? DATA.cariler.filter(c=>c.toLocaleLowerCase("tr").includes(q)) : DATA.cariler;
    const el = document.getElementById("cari-list-manage");
    el.innerHTML = gosterilecek.slice(0,200).map(x=>`<span class="tag-chip">${x}<button data-rm-cari="${x.replace(/"/g,'&quot;')}">×</button></span>`).join("")
      || '<div class="empty" style="padding:16px 0;">Eşleşen cari yok.</div>';
    if(gosterilecek.length>200){
      el.innerHTML += `<div class="row-sub" style="width:100%;margin-top:6px;">+ ${gosterilecek.length-200} kayıt daha — daraltmak için arayın.</div>`;
    }
    el.querySelectorAll("[data-rm-cari]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{ await cariRemoveFn(btn.dataset.rmCari); renderCariManageList(document.getElementById("cari-arama").value); });
    });
  };
  renderCariManageList();
  document.getElementById("cari-arama").addEventListener("input", (e)=> renderCariManageList(e.target.value));
  document.getElementById("btn-yeni-cari").addEventListener("click", async ()=>{
    const v = document.getElementById("yeni-cari").value.trim();
    if(v){ cariKaydet(v); await saveData(); document.getElementById("yeni-cari").value=""; renderCariManageList(document.getElementById("cari-arama").value); }
  });

  document.getElementById("btn-yeni-sube").addEventListener("click", async ()=>{
    const v = document.getElementById("yeni-sube").value.trim();
    if(v && !DATA.subeler.includes(v)){ DATA.subeler.push(v); await saveData(); renderAll(); }
  });
  document.getElementById("btn-yeni-gider-kat").addEventListener("click", async ()=>{
    const v = document.getElementById("yeni-gider-kat").value.trim();
    if(v && !DATA.giderKategoriler.includes(v)){ DATA.giderKategoriler.push(v); await saveData(); renderAll(); }
  });
  document.getElementById("btn-yeni-gelir-kat").addEventListener("click", async ()=>{
    const v = document.getElementById("yeni-gelir-kat").value.trim();
    if(v && !DATA.gelirKategoriler.includes(v)){ DATA.gelirKategoriler.push(v); await saveData(); renderAll(); }
  });
  document.getElementById("btn-export").addEventListener("click", ()=>{
    const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:"application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "kasa-plus-yedek.json"; a.click();
    URL.revokeObjectURL(url);
  });
}

/* ---------------- Başlat ---------------- */
(async function init(){
  await loadData();
  renderCariDatalist();
  renderAll();
})();
