# Kasa+ — Finansal Yönetim Paneli

Nişantaşı, Fulya, Maslak, Atölye, Beykent, S.beyli, Z.burnu, Depo ve Genel şubeleri için
gelir/gider, banka hesapları, cari takibi, ödeme-tahsilat ve şube karşılaştırma paneli.

## Dosya yapısı

- `index.html` — Sayfa iskeleti, stiller ve başlangıç verisi (seed data)
- `app.js` — Tüm uygulama mantığı (render, filtreler, düzenleme, dışa aktarma vb.)
- `sube-talep.html` / `talep-paneli.html` — Şube ürün talebi formu ve merkez paneli
- `ekip-paneli.html` + `ekip-paneli.js` — Ekip iletişim paneli (aşağıda)
- `apps-script/Code.gs` — Şube talepleri Web App'i
- `apps-script/EkipPaneli.gs` — Ekip paneli Web App'i (ayrı e-tablo, ayrı URL)

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
