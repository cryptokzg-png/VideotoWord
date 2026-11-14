# VideotoWord – YouTube → E-kitap (Android APK)

## Hedef
YouTube linkini yapıştır (veya YouTube'dan "Paylaş" ile gönder) → altyazı çekilir → kitap sayfalarına dönüştürülür → uygulama içinde okunur, EPUB/PDF olarak dışa aktarılır. **Yapay zekâ yok**, kurallara dayalı üretim. Referans: "Kriptoya Giriş ve Güvenlik" e-kitabı (okuyucu tasarımı).

## Teknoloji
- Expo (React Native) + TypeScript, Android APK (`eas build`)
- Yerel SQLite (kütüphane, yer imleri, ilerleme), çevrimdışı okuma
- Altyazı: `youtube-transcript` benzeri istek; engellenirse küçük bir Cloudflare Worker proxy
- Çıktı: EPUB (JSZip), PDF (expo-print)
- Sayfa çevirme efekti: Reanimated + Skia / react-native-page-flip

## Referans kitaptan alınan özellikler
**Okuyucu**
- Üst çubuk: İçindekiler · kitap adı · Kapat
- Araçlar: Ara · Tam sayfa · Sayfaya git · Yer imi · Gece modu · Tam ekran (Test: sonraki sürüm)
- Alt çubuk: Önceki / Sonraki + "47 / 48" göstergesi
- Kâğıt görünümlü sayfa, kıvrılan sayfa çevirme animasyonu
- Yakınlaştırma modu: −, +, Sığdır, iki parmakla yakınlaştırma, çift dokunuş; çubuklar gizlenir, sadece "Büyüt" ve "Menü" kalır
- Son okunan sayfadan devam

**Sayfa tasarımı**
- Üstte kitap adı (küçük, büyük harf), bölüm etiketi (mor), serif başlık, gradyan çizgi
- Bloklar: uyarı kutusu, renkli başlıklı tablo, kalın vurgu
- **Özet Kartı** sayfası: gradyan başlık, "Modül X / N", numaralı anahtar fikirler, anahtar terim etiketleri, "Sık yapılan hata" kutusu

## Yapay zekâsız üretim kuralları
1. Altyazı temizliği: zaman damgası, `[Müzik]` vb., tekrar eden satırlar silinir
2. Paragraflama: cümle sonu + zamanlama boşluklarına göre
3. Bölümler: videonun chapter'ları; yoksa süreye göre eşit parçalar
4. Sabit sayfalama: metin sayfa boyutuna göre sayfalara bölünür
5. Özet Kartı (otomatik, basit): bölümün en sık geçen anahtar kelimeleri → terim etiketleri; cümleler arasından ilk/uzun cümleler → anahtar fikirler (kullanıcı düzenleyebilir)
6. Kapak: video küçük resmi + başlık + kanal adı
7. Uyarı kutusu / tablo: kullanıcı düzenleyicide elle ekler

## Ekranlar
1. **Kütüphane (ana):** link kutusu, kitap kartları, arama
2. **Dönüştürme:** adım adım ilerleme, iptal, tekrar dene
3. **Kitap detay:** kapak, bölümler, ilerleme, Oku / Dışa aktar / Sil
4. **Okuyucu:** yukarıdaki özellikler
5. **Düzenleyici:** başlık, bölüm, kutu/tablo ekleme
6. **Ayarlar:** tema, yazı tipi, stil

## Aşamalar
1. **MVP:** Expo iskeleti, link → altyazı → temizlik → bölümler → kütüphane + basit okuyucu
2. **Okuyucu cilası:** sayfa çevirme, yakınlaştırma, gece modu, yer imi, arama, içindekiler
3. **Özet Kartı + düzenleyici + EPUB/PDF çıktı**
4. **Paylaş menüsü entegrasyonu, playlist, APK yayını**

## Açık sorular
- Altyazı doğrudan telefondan çekilebiliyor mu (prototipte test edilecek)
- Test/sınav özelliği (yapay zekâsız mümkün değil): sonraya
- Sadece Android mi, kullanıcı sadece sen mi?
