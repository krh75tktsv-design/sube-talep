# Kasa+ — Finansal Yönetim Paneli

Nişantaşı, Fulya, Maslak, Atölye, Beykent, S.beyli, Z.burnu, Depo ve Genel şubeleri için
gelir/gider, banka hesapları, cari takibi, ödeme-tahsilat ve şube karşılaştırma paneli.

## Dosya yapısı

- `index.html` — Sayfa iskeleti, stiller ve başlangıç verisi (seed data)
- `maliyet-paneli.html` — Ürün maliyet ve kârlılık analizi (aşağıda)
- `app.js` — Tüm uygulama mantığı (render, filtreler, düzenleme, dışa aktarma vb.)
- `sube-talep.html` / `talep-paneli.html` — Şube ürün talebi formu ve merkez paneli
- `ekip-paneli.html` + `ekip-paneli.js` — Ekip iletişim paneli (aşağıda)
- `milli-saraylar.html` / `milli-saraylar-paneli.html` — Milli Saraylar talep formu ve paneli
- `apps-script/Code.gs` — Şube talepleri Web App'i
- `apps-script/EkipPaneli.gs` — Ekip paneli Web App'i (ayrı e-tablo, ayrı URL)
- `apps-script/MilliSaraylar.gs` — Milli Saraylar Web App'i (ayrı e-tablo, ayrı URL)
- `filo.html` + `apps-script/FiloPaneli.gs` — Sevkiyat araçları paneli (aşağıda; ayrı e-tablo, ayrı URL)

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
  şifre girilir, ürünlerin karşısına miktar yazılır. Ürün arama,
  "gönderdiklerimi göster" ve şifre değiştirme var. **Ek not alanı yok**
  (2026-09-22'de kaldırıldı); panel ve form, eski not kayıtlarını
  göstermeye devam eder.
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
  yaparsanız `muhasebe` kendiliğinden güncellenir. Değeri sıfır olan hücrede
  `0` yazmaz, boş görünür: formül `IF(...=0,"",...)` biçimindedir. Bunun için
  özel sayı biçimi **kullanılmıyor**; denendi ve iki sorun çıktı — sayı
  biçimini Numbers gibi bazı programlar yok sayıyor, Türkçe ayarda ise
  `#,##0.###` gibi bir biçim ondalık olmasa bile sayının sonuna virgül
  basıyor (`15,`). Üç sayfa da `General` biçimde.
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
- Şube notları Excel'e girmez; panelde ve CSV'de kalır. Form artık not
  göndermiyor, ama eski kayıtlar panelde görünmeye devam ediyor.
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
- 4 haneli şifre iç ekip için yeterli bir ayrımdır, gerçek bir güvenlik
  katmanı değildir: Web App URL'sini bilen biri şube listesini görebilir
  ve şifre deneyebilir.

Giriş bir kez yapılır, tarayıcı hatırlar; telefona PWA olarak kurulunca
her açılışta şifre sormaz. "Çıkış" düğmesi hatırlananı siler.

### Roller

`Subeler` sekmesindeki `Rol` sütunu üç değer alır:

| Rol | Ne yapabilir |
|---|---|
| `sube` | Kendi formunu doldurur, yalnızca kendi gönderdiklerini görür. Giriş ekranındaki şube listesinde görünen tek rol budur. |
| `merkez` | Paneli tam yetkiyle açar: tüm kayıtlar, Excel/CSV, yazdırma ve **▦ E-Tablo** düğmesi. Talep gönderemez. |
| `izleyici` | Paneli **salt okunur** açar: Excel/CSV, yazdırma. E-Tablo düğmesi gizlidir ve sunucu da adresi vermez. Talep gönderemez. `Kapsam` sütunu doluysa yalnızca oradaki şubeleri görür. |

#### Panele yeni kişi ekleme

`Subeler` sekmesine bir satır yazmak yeterli, kod değişmez:

| Şube | Şifre | Rol | Aktif | Kapsam |
|---|---|---|---|---|
| Bir Kişi | (6 haneli) | izleyici | evet | |
| Başka Kişi | (6 haneli) | izleyici | evet | SAAT |
| Çok şubeli kişi | (6 haneli) | izleyici | evet | SAAT, HAREM |

> Gerçek şifreler yalnızca e-tabloda durur; bu depo herkese açık olduğu
> için buraya örnek olarak bile yazılmaz.

- İlk sütun şube adı yerine kişi adı olabilir; kod sütunları konuma göre
  okur, başlığı değiştirmek de güvenlidir.
- Şifreyi **6 haneli ve kimseyle aynı olmayacak** şekilde verin. Panel girişi
  tek kutudur (ad sorulmaz), kişiyi şifreden bulur; aynı şifre iki kişideyse
  giriş bilerek reddedilir ve uyarı verir.
- Birinin erişimini kesmek için `Aktif` sütununa `hayir` yazın; satırı
  silmeniz gerekmez.
- **İzleyiciye E-Tablo adresi verilmez**, çünkü o e-tabloda `Subeler`
  sekmesi — yani tüm şifreler — duruyor. Düğmeyi gizlemek yalnızca arayüz
  nezaketi; asıl engel `etabloUrl` işleminin `merkez` şartıdır.

#### Kapsam sütunu (5. sütun)

Bir kişinin yalnızca belirli şubeleri görmesi için `Kapsam` sütununa şube
adını yazın. Birden fazla şube virgülle ayrılır: `SAAT, HAREM`.

- **Boş bırakılırsa kapsam yok** demektir; kişi bütün şubeleri görür.
  Mevcut `merkez` satırı boş kalmalı.
- Kapsam hem panelde hem **Excel ve CSV'de** geçerlidir: `dağılım` sayfası
  16 değil yalnızca izin verilen şube kadar sütun çıkarır.
- Süzme **sunucuda** yapılır; kapsam dışındaki veri tarayıcıya hiç
  gönderilmez. Panelde sütunu gizlemek tek başına yeterli olmazdı.
- Şube adını `Subeler` sekmesindeki yazımla **birebir aynı** yazın
  (`SAAT`, `HAREM`, `LİMON` gibi). Eşleşmeyen bir ad yazılırsa panel boş
  kalmaz, "Kapsamdaki şu ad hiçbir şubeyle eşleşmiyor" uyarısı verir.
- Kapsam yetkiyi **genişletmez**: kapsamlı bir izleyici yine talep
  gönderemez ve e-tablo adresini alamaz.
- **Şube başına tek hesap** kurmak için ilk sütuna da şube adını yazın
  (`HAREM | … | izleyici | evet | HAREM`). O şubedeki herkes aynı şifreyi
  kullanır, kişi kişi satır açmaya gerek kalmaz. Aynı ad `sube` rolüyle
  zaten listede olduğu için `Subeler` sekmesinde iki kez görünür; doğrulama
  (ad + şifre) çifti üzerinden yapıldığından bu bir sorun değildir, form
  hesabı ve izleyici hesabı birbirine karışmaz.
- Kapsam, hesabın adıyla birebir aynıysa panel başlığında tekrar yazılmaz.
- `Rol`, `Aktif` ve `Kapsam` hücrelerinde **büyük/küçük harf önemli değil**:
  `izleyici`, `İzleyici`, `İZLEYİCİ` hepsi aynı; `Hayır` da `hayir` gibi
  kapatır. (JavaScript'in `toLowerCase()`'i Türkçe `İ`'yi düz `i`'ye
  çevirmiyor; `anahtar()` yardımcısı bu yüzden var. Bu olmadan `İzleyici`
  yazılan satır hiçbir yerde görünmüyordu.)

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

## Filo Paneli (`filo.html`)

Şubelere sevkiyat yapan kendi araçlarımızın km, yakıt, bakım, belge ve gider
takibi. Tek adres, iki ekran: giriş yapanın rolüne göre açılır.

- **Şoför** — yalnızca kendisine verilen araçları görür. Büyük düğmelerle km,
  yakıt, arıza bildirimi ve HGS girer; kendi kaydını 24 saat içinde düzeltir.
  Gider toplamlarını ve diğer araçları göremez.
- **Yönetici (lojistik)** — Özet (açık arızalar, yaklaşan bakım, muayene,
  trafik sigortası ve kasko bitişleri), Araçlar, Kayıtlar (CSV), Giderler
  (aylık, araç bazında ₺/km ve lt/100 km) ve Kişiler (şoför ekleme, PIN, araç atama).

**Güzergâh** sekmesi: yönetici durakları (atölye, şubeler) adresleriyle bir kez
tanımlar, sık kullanılan sıraları "hazır güzergâh" olarak kaydeder ve her gün
araç başına durak sırası planlar ("önceki günün planını kopyala" ile). Plan km'si
Google Haritalar'dan hesaplanır; durak arası mesafe bir kez bulunup `Mesafeler`
sekmesinde saklanır (yanlışsa oradan düzeltilir). Yapılan yol = günün en yüksek
km okuması − önceki okuma; fark %10 / 8 km içinde yeşil, %25'e kadar sarı,
üstü kırmızı. Dünkü sapmalar Özet'e düşer. Şoför o günün planını görür,
"Haritada aç" ile Google Haritalar'da durak sırasıyla açar.

Plana **adrese teslimat** da eklenebilir (özel tasarım pasta vb.): müşteri,
adres, telefon, teslim saati ve şoföre not. Tek seferlik durak olarak
`Duraklar` sekmesine `Tur = teslimat` ile yazılır, km hesabına girer. Şoför yalnızca
kendi planındaki teslimatların adres ve telefonunu görür, "Teslim edildi" ile
işaretler (saat ve kişi kaydedilir).

Giriş: listeden isim + PIN (şoför 4–8, yönetici 6–8 rakam). Üst üste 5 yanlış
PIN o ismi 15 dakika kilitler. Veri `Filo Paneli` e-tablosunda (Kisiler,
Araclar, Kayitlar); sayfa koduna veri gömülü değil. Silinen kayıt e-tabloda
kalır, `Silindi` sütunu işaretlenir.

Telefona uygulama olarak kurulur (`filo.webmanifest`, `ikon/filo-*.png`; service
worker yok, her açılışta güncel sürüm gelir).

Kurulum adımları `apps-script/FiloPaneli.gs` dosyasının başında. Kod
değiştiğinde **Dağıt › Dağıtımları yönet › kalem › Sürüm: Yeni sürüm › Dağıt**
(“Yeni dağıtım” URL'yi değiştirir, şoförlerin bağlantısı kırılır).

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

## Maliyet Paneli (`maliyet-paneli.html`)

Ürün maliyeti ve kârlılık analizi. Tek dosya, `localStorage` ile çalışır,
kurulum gerektirmez. `maliyet fatura klasörü` altındaki Excel tablolarından
aktarılan **34 reçete (7'si yarı mamul) ve 79 hammadde** ile birlikte gelir.

### Maliyet nasıl hesaplanır

```
Parti maliyeti = Hammadde + İşçilik + Genel gider
Birim maliyet  = Parti maliyeti / (Parti çıkan × (1 - üretim firesi))
Atölye fiyatı  = Birim maliyet × (1 + hedef marj %)     ← marj maliyet ÜZERİNE eklenir
Mağaza fiyatı  = Atölye fiyatı × 2                      ← sabit kural, ayarı yok
```

Atölye fiyatı iki yönden kurulabilir: marj girilirse fiyat hesaplanır, fiyat
girilirse marj geri hesaplanır. İkincisinde maliyet arttıkça marj erir — fiyat
listesi sabitken kârlılığın nasıl değiştiğini görmenin yolu budur. Mevcut 25
ürün sabit fiyat modundadır (atölye fiyatı = raf fiyatı ÷ 2).

Mağaza çarpanı koddaki `MAGAZA_CARPANI` sabitinde durur; firmanın kuralı
değişirse orası değişir, panelde ayarlanacak bir alan yoktur.

- **Hammadde** — girdinin fireli tutarı. Hammadde fiyatı kg/lt/adet başına
  KDV hariç girilir; reçetede gram/ml olarak kullanılır.
- **İşçilik** — parti üretim süresi (dk) × saatlik işçilik maliyeti.
- **Genel gider** — iki yöntem: aylık gideri aylık üretim dakikasına bölmek
  (doğru olan) veya hammadde maliyetinin yüzdesi (kaba).

### Yarı mamul zinciri

Bir reçete başka bir reçeteyi girdi olarak alabilir: pastalar ganajı,
pandispanyayı ve sosu yarı mamul olarak kullanır. Ganajın içindeki bir
hammaddenin fiyatı değiştiğinde ganajı kullanan **bütün** pastaların maliyeti
kendiliğinden güncellenir — Excel'de bu, sayfa sayfa elle kopyalanan bir
sayıydı. Reçete kaydedilirken döngü (A → B → A) denetlenir ve engellenir.

Yarı mamuller reçetede "yarı mamul" olarak işaretlenir; satılmadıkları için
marj ortalamasına ve zarar sayacına girmezler.

### Bilinmesi gerekenler

- Veriler yalnızca açıldığı tarayıcıda saklanır. **Ayarlar > Tam Yedek (JSON)**
  ile düzenli yedek alın; başka bilgisayara taşımanın da yolu budur.
- Reçete, hammadde ve analiz tabloları ayrı ayrı CSV olarak indirilebilir
  (noktalı virgül ayraçlı, Excel'de doğrudan açılır).
- Hammaddeleri **Toplu Ekle** ile Excel'den kopyala-yapıştır girebilirsiniz:
  `Ad · Birim · Fiyat · Fire % · Tedarikçi`. Aynı adlı hammadde varsa fiyatı
  güncellenir, reçete bağları korunur.
- Genel gider **yüzde yöntemiyle** yüklenir: aylık gider ÷ aylık hammadde alımı.
  Oran, Ayarlar'dan girilen aylık genel gider ve hammadde alım tutarına göre
  otomatik hesaplanır. Bu oran yalnızca gerçek hammadde girdilerine bindirilir
  — yarı mamulden gelen tutar kendi payını zaten taşır, toplam üzerinden
  hesaplamak zincirin her katında aynı gideri yeniden yüklerdi.
- Atölye personel maliyeti bu oranın içindedir; bu yüzden saatlik işçilik
  **0** bırakılmıştır. İkisini birden kullanmak aynı maaşı iki kez yükler.
- **Ayarlar > Atölye Kâr / Zarar**: aylık mağaza cirosu girilince atölyenin aylık
  kâr/zararını ve başa baş noktasını verir (atölye geliri = ciro ÷ 2).
- **Önerilen fiyat sütunları**: iki ayrı sütun, ikisi de Ayarlar'dan değişir —
  `oneriMarj` (%20) maliyet üzerine eklenip **Önerilen Atölye**'yi,
  `oneriMagazaMarj` (%35) onun üzerine eklenip **Önerilen Mağaza**'yı verir.
  Raf fiyatı önerinin altındaysa kırmızı, kaç lira eksik olduğu da yazılır.
  Bu zincir sabit ×2 kuralından bağımsızdır; ×2 mevcut durumu, öneri sütunları
  hedeflenen durumu gösterir.
- **Maliyet kırılımı zinciri kapsar**: yarı mamulden gelen tutar kendi içindeki
  hammadde/işçilik/genel gider oranlarına ayrıştırılıp ilgili sütuna yazılır.
  Aksi halde ganaj kullanan bir pastanın genel gideri "hammadde" sütununda
  saklanır ve satırlar birbiriyle tutarsız görünürdü.
- **Reçeteler > Süreleri Gir**: bütün reçetelerin üretim süresi tek ekrandan
  girilir. Süre **adam-dakika**dır — 3 kişi 20 dakika çalışıyorsa 60. Paralel
  çalışılan bir atölyede duvar saati süresi işçiliği doğru ölçmez.

### Veri nerede durur

Panel verisi claude.ai'de yayınlanan Artifact'te **bulut depolamada** tutulur
(`db` capability, tek belge: `panel/veri`). Hangi cihazdan açılırsa açılsın
aynı veri görünür; bir cihazdaki değişiklik diğerlerine canlı yansır
(`onSnapshot`). Tarayıcı deposu çevrimdışı yedek olarak korunur.

Bulut kullanılamadığında (yerel dosyadan açıldığında, erişim iptal
edildiğinde) panel eskisi gibi yalnızca tarayıcı deposuyla çalışır; kenar
çubuğu ve Ayarlar > Veri bölümü hangi modda olunduğunu gösterir. Bulut boşken
ilk açılan cihazın verisi yukarı taşınır.

**Not:** `db` bildiren bir Artifact herkese açık paylaşılamaz — yalnızca
kuruluş içi, oturum açmış kullanıcılar erişebilir. Bu panel için istenen
davranış budur.

### Dosya ile yayın arasındaki ilişki

`maliyet-paneli.html` tam bir HTML dosyasıdır, çift tıklayınca açılır. Aynı panel
claude.ai'de bir Artifact olarak da yayınlanır; oraya gönderilirken `<!DOCTYPE>`,
`<html>`, `<head>`, `<body>` etiketleri ve `<meta>`'lar çıkarılır (Artifact kendi
iskeletini ekler), `<title>` de kısa ada indirilir. İkisi **ayrı veri deposu**
kullanır: birinde girilen fiyat diğerine yansımaz, taşımak için JSON yedeği alın.
- Tablolar veriye göre sadeleşir: işçilik/genel gider girilmediyse maliyet
  bileşeni sütunları, fire tanımlanmadıysa fire sütunları gizlenir. Veri
  girilince kendiliğinden geri gelirler.
