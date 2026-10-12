# Docker ile çalıştırma

Docker Desktop veya Docker Engine + Compose gerekir. Bu image, Knowledge Canvas'ın **web sürümünü** sunar. Tauri masaüstü uygulamasını veya native dosya workspace'ini çalıştırmaz.

```sh
docker compose up --build -d --wait
```

Adresi açın: **http://127.0.0.1:8080**. Varsayılan bağlantı yalnız bu bilgisayardan erişilebilir. Günlük kullanımda aynı hostname ve portu kullanın.

Üstteki **Dil / Language** seçicisinden Türkçe/English seçin. Tercih bu browser/origin'de kalır; aynı adresteki diğer sekmeler seçimi izler. Not içerikleri çevrilmez. SDK menü çevirileri image içindeki yerel `/translations/` dosyalarından yüklenir.

```sh
docker compose ps
curl --fail http://127.0.0.1:8080/healthz
docker compose logs --tail=50 web
docker compose down
```

`/healthz` Nginx'in çalıştığını gösterir; tarayıcı arayüzü ve kayıt işlemleri ayrıca doğrulanmalıdır. Kod güncellendiğinde ilk komutu yeniden çalıştırın. `down` container'ı kaldırır; tarayıcı kayıtlarını silmez.

## Port ve lisans anahtarı

```sh
cp .env.docker.example .env.docker.local
# .env.docker.local içindeki portu / web lisans anahtarını düzenleyin.
docker compose --env-file .env.docker.local up --build -d --wait
```

`NOTEDRAW_PORT` varsayılan olarak `8080`'dir. Örneğin `NOTEDRAW_PORT=8081` kullanırsanız adres `http://127.0.0.1:8081` olur; bu farklı bir browser kayıt alanıdır.

`VITE_TLDRAW_LICENSE_KEY` Vite build sırasında JavaScript'e gömülen istemci anahtarıdır; sunucu sırrı değildir. Container'ın çalışma ortamına eklemek yeterli olmaz: anahtar değişince **image yeniden derlenmelidir**. Anahtar dosyası build context'ine alınmaz; yalnız belirtilen değer build argümanı olarak aktarılır. Web dağıtımının hostname'ini kapsayan geçerli lisans gerekir. Docker yapılandırması SDK lisans kontrolünü değiştirmez; yerel doğrulama üretim lisansı veya yayınlama kabulü değildir. Masaüstü lisans kararı D-028 ayrıca geçerlidir.

## Veriler ve taşıma

- Notlar, mantıksal klasörler, board'lar, görseller ve PDF baytları kullanıcının **tarayıcısındaki IndexedDB'de** kalır. Tema gibi tercihler localStorage'dadır. Nginx yalnız statik dosyaları sunar.
- Sunucuda not veritabanı, hesap, cihazlar arası eşitleme veya Docker volume'unda workspace saklama yoktur. Başka cihaz/tarayıcı aynı adresi açınca kendi kayıt alanını kullanır.
- Önceki Vite veya masaüstü oturumundan taşımak için “Workspace yedeği indir”, ardından Docker adresinde “Yedek yükle” kullanın. Yükleme mevcut workspace'i onayla değiştirir.
- Container yeniden oluşturmak aynı browser/origin'deki kayıtları korur. Tarayıcı/site verisini temizlemek kayıtları siler; düzenli workspace JSON yedeği alın.
- Gerçek `.md` klasör keşfi, disk çatışmaları, journal ve çöp klasörü Tauri sürümündedir; host klasörü mount etmek bunları web sürümünde etkinleştirmez.

## Image ve HTTP davranışı

[Docker multi-stage build](https://docs.docker.com/build/building/multi-stage/) ile Node 26 Alpine üzerinde `npm ci` ve mevcut `npm run build` çalışır; typecheck ve PDF.js CMap/font/WASM kopyalaması dahildir. Son image yalnız Nginx ve `dist/` içerir. Node/Rust araçları, yerel bağımlılıklar, `.tools/`, native build çıktıları ve workspace verileri taşınmaz. Taban image'lar çok mimarili manifest digest'leriyle sabittir; güncelleme gerektiğinde tag/digest birlikte yenilenmelidir.

Nginx root olmayan `nginx` kullanıcısıyla container içinde `8080` portunu dinler. Compose kök dosya sistemini salt okunur çalıştırır; geçici dosyalar `/tmp` tmpfs içindedir. Nginx SPA adreslerinde `index.html` döndürür; eksik JS/font/PDF.js kaynakları 404 verir. İçerik hash'i taşıyan `/assets/` dosyaları uzun süre cache edilir; `index.html` ve sabit isimli `/pdfjs/` kaynakları yeniden doğrulanır. Gzip ve doğru JS/font/WASM MIME tipleri kullanılır.

SDK'nın varsayılan font/ikon kaynakları CDN kullanabilir; Docker sürümü tam çevrimdışı kullanım garantisi sağlamaz.

## Sunucuda kullanım

Uzak kullanımda bu localhost servisini **HTTPS sağlayan reverse proxy** arkasına koyun. TLS ve domain yapılandırması bu yerel Compose dosyasına dahil değildir. Web Locks API güvenli bağlam gerektirir; localhost dışındaki düz HTTP adreslerinde güvenli yazma açılamaz. Hostname değişmesi browser kayıt alanını da değiştirir.

Compose kullanmadan:

```sh
docker build -t notedraw:local .
docker run --rm -p 127.0.0.1:8080:8080 \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --cap-drop ALL --security-opt no-new-privileges:true notedraw:local
```

Bu komut terminal açık kaldıkça çalışır; Ctrl+C ile kapanır. Yerel image derleme/çalıştırma, registry'ye push veya dış ortamda yayınlama yapmaz.
