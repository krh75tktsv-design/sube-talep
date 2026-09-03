# Kasa+ — Finansal Yönetim Paneli

Nişantaşı, Fulya, Maslak, Atölye, Beykent, S.beyli, Z.burnu, Depo ve Genel şubeleri için
gelir/gider, banka hesapları, cari takibi, ödeme-tahsilat ve şube karşılaştırma paneli.

## Dosya yapısı

- `index.html` — Sayfa iskeleti, stiller ve başlangıç verisi (seed data)
- `app.js` — Tüm uygulama mantığı (render, filtreler, düzenleme, dışa aktarma vb.)
- `sube-talep.html` / `talep-paneli.html` — Şube ürün talebi formu ve merkez paneli
- `ekip-paneli.html` + `ekip-paneli.js` — Ekip iletişim paneli (aşağıda)
- `milli-saraylar.html` / `milli-saraylar-paneli.html` — Milli Saraylar talep formu ve paneli
- `apps-script/Code.gs` — Şube talepleri Web App'i
- `apps-script/EkipPaneli.gs` — Ekip paneli Web App'i (ayrı e-tablo, ayrı URL)
- `apps-script/MilliSaraylar.gs` — Milli Saraylar Web App'i (ayrı e-tablo, ayrı URL)

## Ekip Paneli

~30 kişilik ekibin (üretim, sevkiyat, satış, sipariş alma, yönetim)
haberleşmesi için dört bölümlü tek sayfa:

- **Duyurular** — yönetici yayınlar, hedef birim seçilebilir, öncelik
  (normal / önemli / acil) verilebilir. Herkes "Okudum" der; yönetici
  kimin okuyup okumadığını kartın üzerinde görür.
- **Mesajlar** — "Genel" + her birim için ayrı kanal. Birim içi ve
  birimler arası yazışma. Herkes kendi mesajını, yönetici her mesajı silebilir.
- **Görevler** — kişiye veya birime iş atama, son tarih, açık / devam /
  bitti durumu. Süresi geçen görev kırmızı işaretlenir.
- **Devir notu** — vardiya sonunda birimin bıraktığı not, tarih ve birim
  bazlı arşiv.

Giriş: listeden isim + kişiye özel 4 haneli PIN. Tarayıcı hatırlar,
her açılışta tekrar sorulmaz. Kişi ekleme/çıkarma ve rol (yonetici/uye)
Google E-Tablo'daki `Kisiler` sekmesinden yapılır — kod değişmez.

### Kurulum

Kurulum tamamlandı: Web App dağıtıldı ve URL'si `ekip-paneli.js`
içindeki `APPS_SCRIPT_URL` sabitine yazıldı.

Sıfırdan tekrar kurmak gerekirse adım adım anlatım
`apps-script/EkipPaneli.gs` dosyasının en üstünde. `.gs` dosyasını
değiştirdiğinizde **Dağıt > Dağıtımları yönet > kalem > Sürüm: Yeni
sürüm > Dağıt** demeyi unutmayın; yoksa değişiklik canlıya çıkmaz
(URL aynı kalır).

### Bilinmesi gerekenler

- Panel **anlık değil**: yeni mesaj/duyuru ortalama 45 saniye içinde
  görünür (sekme öne geldiğinde hemen tazelenir). Gerçek zamanlı
  bildirim için Firebase'e geçmek gerekir.
- 4 haneli PIN **iç ekip için** yeterli bir ayrımdır, gerçek bir
  güvenlik katmanı değildir: Web App URL'sini bilen biri isim listesini
  görebilir ve PIN deneyebilir. Panelde maaş, banka vb. hassas bilgi
  paylaşmayın.
- Silinen kayıtlar e-tablodan gerçekten silinmez, `Silindi` sütunu
  işaretlenir — yanlışlıkla silineni o hücreyi boşaltarak geri alırsınız.
- Mesajlar 90, devir notları 180 gün sonra gece temizliğinde silinir
  (`SAKLAMA_GUN` sabitinden değiştirilebilir).

## Milli Saraylar Talep Formu

16 Milli Saraylar şubesinin (HAREM, KAFE, SAAT, KÜÇÜKSU, IHLAMUR, ŞEKER,
MASLAK, ÇEŞMİ, ABRAH, LİMON, BEYLER, ÇAMLICA, MECİDİYE, YILDIZ, AYNALI,
KASKAT) 33 kalemlik ürün listesinden talep göndermesi için ayrı bir sistem.
Şube Talepleri ve Ekip Paneli'nden **tamamen bağımsız**: kendi e-tablosu,
kendi Web App URL'si. Biri bozulursa diğeri etkilenmez.

- `milli-saraylar.html` — şube personelinin doldurduğu form. Şube seçilir,
  şifre girilir, ürünlerin karşısına miktar yazılır. Ek not alanı, ürün
  arama, "gönderdiklerimi göster" ve şifre değiştirme var.
- `milli-saraylar-paneli.html` — merkezin gördüğü panel. Tarih aralığı
  seçilir; ürün × şube matrisi, şube ve genel toplamlar, talep göndermeyen
  şubeler, şube notları. Excel (.xlsx) ve CSV indirme, yatay yazdırma düzeni.

### Excel çıktısı

"Excel İndir (.xlsx)" düğmesi, elde kullanılan `CUMARTESİ-1.xlsx`
düzeninde iki sayfalık bir dosya üretir (ExcelJS 4.4.0, CDN'den yüklenir —
internet gerekir):

- **`dağılım`** — ham matris. A1'de gün adı + tarih (sarı zeminli, birleşik),
  2. satırda ÜRÜNLER + 16 şube, sonrasında ürünler. Boş hücreler boş
  bırakılır (0 yazılmaz), yatay A4, ilk sütun dondurulmuş. Listeden
  çıkarılmış ama eski kayıtlarda geçen bir ürün kaybolmaz — tablonun
  sonuna eklenir ve `muhasebe`'de kendi satırını alır.
- **`muhasebe`** — aynı veri, muhasebe için gruplanmış 27 satır. Hücreler
  `dağılım`'a **canlı formülle** bağlıdır: `dağılım`'da elle bir düzeltme
  yaparsanız `muhasebe` kendiliğinden güncellenir.
- **`toplam`** — her ürünün 16 şube toplamı, tek sütun
  (`SUM('dağılım'!B3:Q3)`). O da `dağılım`'a canlı bağlı.

Gruplama `MUHASEBE_SATIRLARI` sabitinde durur; ör. CHEESCAKE ÇEŞİTLERİ =
DİLİM FRAMBUAZ CHEES + DİLİM LİMONLU CHEES, MUHALLEBİ ÇEŞİTLERİ = ÇİLEKLİ +
OREO + MUZLU MUHALLEBİ, MEYVALI PASTA = HASBAHÇE + MOİS PASTA + KIRMIZI
MEYVALI. Ürün listesine ekleme yaparsanız bu sabite de eklemeyi unutmayın —
eklenmemiş bir ürün `muhasebe`'de kendi satırı olarak çıkar, kaybolmaz.

Bilinmesi gerekenler:

- `toplam` sayfası, elde eklenen `PAZARTESİ-2026-08-31.xlsx` düzenine göre
  yapıldı; ürün adları `dağılım` ile aynı yazımda tutuldu.
- Örnek dosyadaki `İlk bölüm toplam` ve `TOPLAM USTA` sayfaları üretilmez;
  ikisi de `dağılım`'dan türeyen toplamlardı ve elde bakımsız kalmışlardı
  (eksik ürün, yanlış satıra bakan formül, silinmiş formüller).
- Şube notları Excel'e girmez; panelde ve CSV'de kalır.
- Ürün adları Excel'de ve formda birebir aynıdır; ayrı bir görünen-ad
  eşlemesi yoktur. Adlardaki çift boşluk (`TİRAMİSU  (dilim)`,
  `UNSUZ  ÇİKOLATA PASTA`) bilerek korunur — elde kullanılan Excel
  dosyalarındaki yazımla eşleşsin diye.
- `apps-script/MilliSaraylar.gs` — iki sayfayı besleyen Web App.
  Sekmeler: `Talepler` (kayıtlar), `Subeler` (şube, şifre, rol, aktif) ve
  `Gorunurluk` (hangi ürün hangi şubede gizli).

### Şube bazlı ürün görünürlüğü

Bazı ürünler bazı şubelerde satılmıyor. `Gorunurluk` sekmesinde satırlar
ürün, sütunlar şube; bir hücreye **`yok`** yazılırsa o ürün o şubenin
formunda hiç görünmez — aramada da çıkmaz, yanlışlıkla gönderilemez.

- Değişiklik e-tablodan yapılır: hücreye `yok` yaz ya da sil. Kod değişmez,
  dağıtım yenilemek gerekmez, şube formu bir sonraki açılışta görür.
- **Panel ve Excel bundan etkilenmez.** `dağılım` yine 34 satır × 16 sütun
  tam ızgara; gizli olan hücre sadece boş görünür.
- Liste alınamazsa (internet/sunucu sorunu) hiçbir ürün gizlenmez, form tüm
  ürünlerle çalışır. Eksik gösterip şubeyi ürünsüz bırakmaktansa fazla
  göstermek yeğdir; yanlış giren talep panelde görülür.
- Sekmeyi ilk kez kurmak için `gorunurlukKur` fonksiyonu bir kez
  çalıştırılır (2026-09-03'te işaretlenen tabloyu yazar). Sekme zaten varsa
  hiçbir şey yapmaz — elle yapılan değişiklikleri ezmez.

### Şifreler

Talep yapan personel sayısı fazla olduğu için her şube panele **kendi
şifresiyle** girer. Şifreler bilerek kodun içinde değil, **Google
E-Tablo'nun `Subeler` sekmesinde** tutulur:

- Bu depo GitHub'da herkese açık; koda yazılan bir şifreyi isteyen herkes
  okuyabilirdi. Şifreler tarayıcıya da hiç gönderilmez — doğrulama
  yalnızca Apps Script tarafında yapılır.
- Şube ekleme/çıkarma, şifre değiştirme, bir şubeyi kapatma (`Aktif`
  sütununa `hayir`) e-tablodan yapılır; kod değişmez.
- `Subeler` sekmesindeki **MERKEZ** satırı panelin şifresidir, şubelere
  verilmez. Yalnızca `rol` sütunu `merkez` olan hesap tüm şubelerin
  kayıtlarını görebilir; bir şube yalnızca kendi gönderdiklerine erişir.
- 4 haneli şifre iç ekip için yeterli bir ayrımdır, gerçek bir güvenlik
  katmanı değildir: Web App URL'sini bilen biri şube listesini görebilir
  ve şifre deneyebilir.

Giriş bir kez yapılır, tarayıcı hatırlar; telefona PWA olarak kurulunca
her açılışta şifre sormaz. "Çıkış" düğmesi hatırlananı siler.

### Kurulum

Adım adım anlatım `apps-script/MilliSaraylar.gs` dosyasının en üstünde.
Özetle: yeni e-tablo > Apps Script'e dosyayı yapıştır > `kurulum`
fonksiyonunu çalıştır (16 şube + MERKEZ için rastgele şifre üretir) >
Web App olarak dağıt > çıkan URL'yi **iki HTML dosyasındaki**
`APPS_SCRIPT_URL` sabitine yapıştır.

`.gs` dosyasını değiştirdiğinde **Dağıt > Dağıtımları yönet > kalem >
Sürüm: Yeni sürüm > Dağıt** demeyi unutma; yoksa değişiklik canlıya
çıkmaz (URL aynı kalır).

### Bilinmesi gerekenler

- Ürün listesi iki dosyada birden duruyor: formda `URUNLER`, panelde
  `URUN_SIRA`. Ürün eklerken/çıkarırken ikisini de güncelle — panelde
  eksik kalan bir ürün kaybolmaz, tablonun sonuna eklenir.
- **Ürün adı aynı zamanda e-tabloya yazılan anahtardır.** Bir ürünü yeniden
  adlandırırsan eski kayıtlar eski adla kalır ve panelde ayrı satır gibi
  görünür. `MilliSaraylar.gs` içindeki `urunAdlariniGuncelle` fonksiyonu bu
  iş için: `ESKI_YENI_URUN` eşlemesini güncelleyip fonksiyonu Apps Script
  editöründen bir kez çalıştır (dağıtım yenilemek gerekmez). 2026-08-30'daki
  yeniden adlandırmanın eşlemesi orada duruyor.
- Aynı talep iki kez gönderilirse iki kez kaydedilir; panel ikisini
  toplayarak gösterir. Yanlış kaydı düzeltmek için panelin "▦ E-Tablo"
  düğmesiyle e-tabloyu açıp satırı düzelt, sonra "Yenile"ye bas.
- Talepler ertesi gün için girildiği varsayılır: hem formdaki tarih hem
  panelin tarih aralığı varsayılan olarak **yarını** gösterir.
- `kurulumTetikleyiciOlustur` fonksiyonunu bir kez çalıştırırsan her
  akşam 22:00'de ertesi gün için talep göndermemiş şubeleri mail atar
  (opsiyonel).

## Yerelde çalıştırma

`index.html` dosyasını doğrudan Safari/Chrome'da açmanız yeterli — sunucu gerekmez.
Veriler tarayıcının `localStorage`'ında saklanır.

## Claude Code ile devam etmek için önerilen ilk adımlar

1. Bu klasörü Claude Code'da açın (`claude` komutunu bu klasörde çalıştırın ya da
   Claude Desktop'ta Code sekmesinden klasörü seçin).
2. Şunu isteyebilirsiniz:
   > "Bu klasörü git ile takip et, ilk commit'i at."
3. Ardından geliştirmeye kaldığımız yerden devam edebilirsiniz — örneğin:
   > "Personel Ödemeleri sayfasını da ekleyelim" (Excel'deki bu sayfa henüz taşınmadı)
4. Yayınlamak için:
   > "Bu projeyi GitHub'a yükle ve GitHub Pages ile yayınla"

## Bilinen sınırlamalar / devam eden işler

- Veriler cihaza/tarayıcıya özel (localStorage) — cihazlar arası senkron yok.
  Çoklu cihaz senkronizasyonu için bir bulut veritabanı (örn. Firebase) entegrasyonu gerekir.
- Excel'deki "Personel Ödemeleri" sayfası (personel bazlı maaş/ödeme özeti,
  Giderler'deki "Personel Adı" sütunundan türetiliyor) henüz uygulamaya taşınmadı.
- Grafikler Chart.js CDN'ine bağlı (internet gerektirir); CDN erişilemezse
  ilgili grafik alanları boş kalabilir — bu yüzden çoğu yerde tablo ile
  yedeklenmiş durumda.

## Renk / tasarım dili

- Koyu lacivert (`--ink`) kenar çubuğu, kağıt tonu (`--paper`) arka plan
- Gelir: teal yeşili (`--income`), Gider: kiremit kırmızısı (`--expense`)
- Vurgu rengi: pirinç/altın tonu (`--brass`)
- Her şubenin sabit bir rengi var (`SUBE_RENK` dizisi, `app.js` içinde)
