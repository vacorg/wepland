# wepland

iPhone'un kamerasını Linux'ta **sanal bir web kamerasına** çevirir. Telefon Safari'den bağlanır, görüntü bilgisayardaki küçük bir pencerede önizlenir ve `wepland` adlı sanal kamera olarak Discord, OBS, Zoom gibi uygulamalarda seçilebilir.

> **Durum: geliştirme aşamasında.** Bu, anlık bir ihtiyaç için yaklaşık 10 dakikada hızlıca hazırlanmış basit bir uygulamadır. Çalışır ama cilalanmış bir ürün değildir: hatalar, eksikler ve pürüzler olabilir. Kimlik doğrulaması yoktur (aşağıdaki güvenlik notuna bak). Önerilere ve katkılara açıktır.

```
iPhone Safari ──WebRTC──▶ wepland penceresi (Chrome) ──JPEG/WebSocket──▶ Node sunucusu ──ffmpeg──▶ /dev/video10 ("wepland")
```

## Özellikler

- Ön/arka kamera ve ek lensler (ultra geniş vb.) arasında geçiş
- Telefonun flaşını bilgisayardan açıp kapatma
- Çıkış boyutu seçimi: 1280×720, Full HD, dikey 720×1280, kare 720×720
- Döndürme, yakınlaştırma ve sürükleyerek kırpma
- Pencere kapanınca sunucu ve kamera yayını da kapanır

## Gereksinimler

- Linux (Wayland veya X11)
- [Node.js](https://nodejs.org/) ve `npm`
- `ffmpeg` ve `openssl`
- `google-chrome`
- `v4l2loopback` çekirdek modülü (Ubuntu/Debian: `sudo apt install v4l2loopback-dkms`)
- Telefon ve bilgisayar **aynı yerel ağda**

## Kurulum ve çalıştırma

```bash
git clone <bu-deponun-adresi>
cd wepland
./start.sh
```

`start.sh` ilk çalıştırmada bağımlılıkları kurar (`npm install`), `/dev/video10` yoksa sanal kamera modülünü yükler (yönetici parolası sorar) ve sunucuyu ile pencereyi açar. Pencerede telefon için adres görünür.

1. Telefonda Safari'den `https://<bilgisayarın-IP'si>:8443/phone` adresini aç.
2. Kendinden imzalı sertifika uyarısını geçip **Başlat**'a dokun ve kamera iznini ver. Sayfa açık kalmalı, ekran kilitlenmemeli.
3. Bilgisayardaki pencereden **Kamera seçimi**'ni kullan.
4. Discord/OBS'te kamera olarak **wepland**'ı seç.

### Sanal kamerayı kalıcı yapmak (isteğe bağlı)

Her açılışta modülün hazır olması ve Discord gibi uygulamalarda takılmaması için:

```bash
echo 'options v4l2loopback devices=1 video_nr=10 card_label=wepland exclusive_caps=1 max_buffers=8' | sudo tee /etc/modprobe.d/wepland.conf
echo v4l2loopback | sudo tee /etc/modules-load.d/v4l2loopback.conf
```

Ayarı hemen uygulamak için (açık uygulamaları kapattıktan sonra): `sudo modprobe -r v4l2loopback && sudo modprobe v4l2loopback`.

## Yapılandırma

| Ayar | Varsayılan | Açıklama |
|------|-----------|----------|
| `WEPLAND_CAM` (ortam değişkeni) | `/dev/video10` | Görüntünün yazılacağı v4l2 cihazı |
| Port | `8443` | `server.js` içindeki `PORT` |

Kendinden imzalı sertifika ilk çalıştırmada `cert/` klasörüne üretilir ve bilgisayarın yerel IP'si değişirse yenilenir. **Bu klasör depoya girmez**, özel anahtar içerir.

## Güvenlik notu

Sunucu `0.0.0.0` üzerinde dinler ve **kimlik doğrulaması yoktur**: aynı ağdaki biri telefon ya da izleyici olarak bağlanabilir. Yalnızca güvendiğin ağlarda kullan, 8443 portunu internete açma. Pencere, sadece bu uygulamaya ayrılmış ayrı bir Chrome profiliyle ve kendi sertifikan için sertifika uyarısını yok sayarak açılır (`--ignore-certificate-errors`); bu profilde başka siteye girme.

## Sorun giderme

- **Discord/OBS'te kamera görünmüyor:** `/dev/video10` var mı? `ls /dev/video10`. Yoksa modülü yükle (yukarıya bak).
- **Görüntü donuyor veya kasıyor:** Çıkış boyutunu 1280×720'ye düşür, `max_buffers=8` ayarını uygula, Discord'u yeniden başlat.
- **Telefon bağlanmıyor:** İkisi de aynı ağda mı, güvenlik duvarı 8443'ü engelliyor mu kontrol et.
- **Wayland'de pencere küçülünce kayboluyor:** `~/.local/share/applications/wepland.desktop` içindeki `StartupWMClass=wepland` olmalı.

## Proje yapısı

```
server.js          HTTPS + WebSocket sunucusu, sinyalleşme, ffmpeg ile v4l2'ye yazma
public/viewer.html bilgisayar penceresi: önizleme, ayarlar, kare gönderme
public/phone.html  telefon sayfası: kamera yakalama, WebRTC
start.sh           modülü yükler, sunucuyu ve Chrome uygulama penceresini başlatır
```
