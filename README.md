# Kasa+ — Finansal Yönetim Paneli

Nişantaşı, Fulya, Maslak, Atölye, Beykent, S.beyli, Z.burnu, Depo ve Genel şubeleri için
gelir/gider, banka hesapları, cari takibi, ödeme-tahsilat ve şube karşılaştırma paneli.

## Dosya yapısı

- `index.html` — Sayfa iskeleti, stiller ve başlangıç verisi (seed data)
- `app.js` — Tüm uygulama mantığı (render, filtreler, düzenleme, dışa aktarma vb.)

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
