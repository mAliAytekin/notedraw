# Knowledge Canvas

Sonsuz tuval üzerinde çizimler ve kart içinde düzenlenebilen Markdown notları. **Faz 0–4 geliştirme kapsamı uygulandı:** klasörler, çoklu board, ortak notlar, otomatik kayıt/kurtarma, workspace yedeği, taşınabilir/boyutlandırılabilir PDF paneli ve Tauri ile gerçek dosya workspace'i bulunur. Başlık/içerik araması, wiki-link/backlink, Markdown tabloları, KaTeX ve PNG/SVG dışa aktarma eklendi. Kullanıcı kararıyla masaüstü geliştirme modunda ilerliyor; standalone lisansı paketleme öncesinde kararlaştırılacak.

## Çalıştırma

Node.js 22.13+ gerekir; geliştirme doğrulaması Node 26.8.1 / npm 11.19.0 ile yapıldı.

```sh
npm ci
npm run dev
```

Vite'ın yazdığı yerel adresi açın (varsayılan `http://127.0.0.1:5173`). Veriler tarayıcı ve origin'e bağlıdır: `localhost` ile `127.0.0.1`, ayrıca farklı portlar farklı kayıt alanlarıdır. Günlük kullanımda aynı adresi kullanın.

`dev` ve `build`, PDF.js font/CMap/WASM kaynaklarını kurulu paketten `public/pdfjs/` dizinine kopyalar. Worker Vite tarafından paketlenir; PDF okuyucu için harici CDN gerekmez. Üretilen `public/pdfjs/` sürüm kontrolüne dahil edilmez.

## Docker ile çalıştırma

```sh
docker compose up --build -d --wait
```

**http://127.0.0.1:8080** adresini açın. Docker web sürümünü sunar; notlar/PDF'ler tarayıcıda saklanır, Tauri'nin gerçek dosya workspace'i bu sürümde yoktur. Önceki verileri workspace JSON yedeğiyle taşıyın. Port, lisans, durdurma ve sunucuda HTTPS kullanımı: [Docker rehberi](docs/docker.md).

## Kullanım

Üst menüdeki **Dil / Language** seçicisinden **Türkçe** veya **English** seçin. Gezgin, not editörü, PDF paneli, onay/kurtarma pencereleri ve tuval araçları anında değişir. Varsayılan Türkçe; tercih bu browser/origin'de hatırlanır ve aynı origin'deki diğer sekmelere aktarılır. Not, klasör, board adları ve Markdown/PDF içerikleri çevrilmez. Dil tercihi workspace JSON yedeğine dahil değildir.

Masaüstü için Rust stable ve macOS Command Line Tools kurulu olmalı:

```sh
npm run desktop:dev
```

Workspace klasörünü sistem seçicisinden seçin; Markdown dosyaları açılışta ve “Yenile” ile bulunur. `.md`, `.board.json`, görseller ve PDF'ler gerçek dosyalardır. Dış değişiklikte disk/yerel sürüm seçimi, silinen dosyalar için workspace içinde çöp klasörü vardır. Tarayıcı kayıtlarını workspace JSON yedeğiyle taşıyın. [Masaüstü komutları, dosya formatı ve kurtarma](docs/desktop-workspace.md).

`npm run desktop:build` macOS debug `.app` üretir. Lisanssız pakette tldraw tuvali kapanır; günlük geliştirme için `desktop:dev` kullanın. Geçerli native anahtar desteği `.env.example` içinde hazırdır. İmzalı dağıtım henüz yapılmadı.

- Soldaki gezginde “+ Klasör”, “+ Board”, “+ Not” kullanın. Yeni öğe seçili klasöre eklenir; “Tüm workspace” kökü seçer. Klasör adı seçer/açar, yanındaki ok açıp kapatır. Üstteki “☷ Workspace” düğmesi gezgini gizler/gösterir; panel başlığındaki `‹` de kapatır. Açık/kapalı tercihi bu tarayıcıda hatırlanır.
- Öğenin `⋯` düğmesi adını ve hedef klasörünü değiştirir. Kimlikler ve ortak not bağlantıları korunur. `×` silme öncesi etkilenen içeriği gösterir ve onay ister.
- Board adına tıklayarak geçin. Geçiş önce mevcut değişiklikleri kaydeder; kayıt başarısızsa mevcut board'da kalır. Board silmek ortak notları silmez; son board silinirse boş board oluşturulur.
- Notu gezginden tuvale sürükleyin veya notun adına/`＋` düğmesine tıklayın. Aynı notu birden fazla board'a ekleyebilirsiniz; düzenleme tüm kartlarda paylaşılır.
- “Yeni Markdown Kartı” görünür alanın merkezinde kart açar. Tek tık seçer, sürükleme taşır, köşelerden resize yapılır. Kartı çift tıklayarak düzenleyin; not adı Markdown başlığından bağımsızdır.
- “Notlarda ara” veya Ctrl/Cmd+K bütün workspace'te başlık ve içerik arar. Türkçe harf/büyük-küçük harf farkını tolere eder; yazılan tüm sözcükler eşleşmelidir. ↓ ile sonuçlara geçin, ↑/↓ gezin, Enter notun kartını gösterir; başka board'daysa oraya geçer. Kartı olmayan not mevcut board'a eklenir. Arama paneli notun wiki-link metnini ve gelen bağlantılarını gösterir.
- Kaynakta `[[Not adı]]`, `[[Klasör/Not adı]]` veya `[[Hedef|Görünen ad]]` yazın; önizlemede tıklayarak hedefe gidin. Aynı ad belirsizse klasör yolu gerekir; aynı yolda da çakışıyorsa arama panelindeki ID bağlantısını kullanın. Not/klasör rename ve move bağlantıları günceller. Silinen not kırık bağlantı olarak görünür; yeni aynı adlı nota bağlanmaz. Kartın “Bu nota bağlantılar” bölümü gelen bağlantıları gösterir.
- Biçimli modda tablo düğmesi 3×2 tablo ekler. Hücredeyken satır/sütun ekleme-silme ve tablo silme araçları açılır. Markdown tablo hizalaması ve hücre biçimleri korunur; desteklenmeyen karmaşık içerik kaynak modunda kalır.
- `$E=mc^2$` satır içi, ayrı satırlardaki `$$` blok matematik gösterir. KaTeX yerel fontlarla önizleme yapar; matematik içeren not kaynak modunda düzenlenir.
- “PNG indir” / “SVG indir” mevcut board'un bütün şekillerini ve kartların görünen içeriğini aktarır; PDF paneli dahil değildir. Masaüstünde yerel Farklı Kaydet penceresi açılır. PNG raster; browser SVG kartları HTML içerir, masaüstü SVG kartları görsele gömülür, diğer şekiller vektördür. Tam ve düzenlenebilir veri yedeği için workspace JSON kullanın.
- Biçimli, Kaynak ve Önizleme sekmelerini kullanın. Güvenli biçimli dönüşümü olmayan içerik kaynak modunda korunur; arayüz nedenini gösterir.
- Escape veya tuvalde boş alana tıklama düzenlemeyi bitirir; değişiklikler IndexedDB'ye otomatik kaydedilir. Gösterge sonucu bildirir; hata durumunda “Tekrar dene” bulunur.
- Pencerelerde Tab/Shift+Tab içeride gezinir, Esc iptal eder ve odağı geri verir. Markdown modu sekmelerinde sağ/sol ok, Home/End çalışır.
- Metin seçimi, Delete/Backspace, kopyala/kes/yapıştır ve Ctrl/Cmd+A/Z editörde çalışır. Editör dışında undo tuval geçmişini kullanır. Editörde tekerlek kart içeriğini kaydırır; dışında SDK pan/zoom davranışı geçerlidir.
- A ile ok, R ile kutu, D ile serbest çizim aracını kullanın. Örnek ok kart taşındığında/boyutlandırıldığında bağlı kalır.
- Kartı çoğaltmak aynı notu paylaşır; kart silmek notu silmez. Gezgin veya “Notlar” listesinden saklanan not yeniden karta eklenebilir.
- Notu silme işlemi, onay ekranında onu kullanan board'ları/kart sayısını gösterir. Kartlar “Not bulunamadı” uyarısıyla kalır. Klasör silme alt klasör/board/notları da kaldırır; diğer board'lardaki etkilenen kartlar önceden belirtilir.
- PNG/JPEG/WebP/GIF/AVIF görseller tuvale sürüklenebilir/yapıştırılabilir; sınır 10 MB/dosya. Görsel baytları kayıt ve JSON yedeğine dahildir; video desteklenmez.
- “PDF aç” yerel PDF'yi workspace'e kopyalar (en fazla 50 MB). Panelin “PDF OKUMA · Sürükle” başlığını sürükleyerek yerini değiştirin; başlık odaktayken ok tuşları da taşır (Shift ile daha büyük adım). Whiteboard pan/zoom yaparken PDF ekran üzerinde sabit kalır. PDF ve whiteboard kaydırma/zoom işlemleri bağımsızdır; PDF'nin metin katmanı varsa seçip kopyalayabilirsiniz.
- PDF panelinin kenarlarını veya sağ alt köşesindeki tutamacı sürükleyerek genişliğini/yüksekliğini değiştirin. Tutamaç odaktayken ok tuşları da boyutlandırır; Shift daha büyük adım kullanır. Paneli boyutlandırmak PDF yakınlaştırmasını veya whiteboard kamerasını değiştirmez.
- Her board kendi son PDF'sini, sayfasını, yakınlaştırmasını, panel konumunu ve boyutunu hatırlar. Paneli kapatmak dosyayı silmez; “PDF göster” veya PDF seçicisinden yeniden açabilirsiniz. Pencere veya workspace bölümü değiştiğinde panel görünür tuval alanında tutulur.
- PDF metnini seçip **Vurgula**, **Altını çiz** veya **Üstünü çiz** kullanın. İşaretler workspace'te ayrı saklanır; kaynak PDF değişmez. Aynı PDF'yi açan board'lar aynı işaretleri görür. PDF’de işaretli metne tıklayıp **Vurgulamayı kaldır**, **Alt çizgiyi kaldır** veya **Üst çizgiyi kaldır** kullanın. **Bu sayfadaki işaretler** listesinden × ile de kaldırabilirsiniz.
- Seçili metni kısa süre basılı tutup board'a sürükleyin veya **Tuvale sürükle** düğmesini sürükleyin. Bırakılan yerde PDF adı/sayfa bilgili yeni Markdown not kartı oluşur; düğmeye tıklamak da görünür alan merkezinde kart ekler. Alıntı bağımsız nottur; mevcut kart veya PDF metni değişmez. Taranmış PDF'lerde metin katmanı yoksa seçim/OCR yoktur.
- “Workspace yedeği indir” bütün klasörleri, board'ları, ortak/saklanan notları, görselleri, PDF baytlarını/işaretlemelerini ve board'a özel okuma konumlarını içerir. **Tam yedek için bunu kullanın.**
- “Board yedeği indir” yalnız mevcut board, bütün notlar ve o board'un görsellerini eski Faz 1 formatında verir; diğer board'ları, klasörleri veya PDF'leri içermez. Kart editöründeki `.md indir` bir notu UTF-8 Markdown olarak indirir.
- “Yedek yükle” workspace veya eski tek board yedeğini önce doğrular, ardından **bütün mevcut workspace'i değiştirmek** için onay ister. Kimlik çakışmalarında da açık değiştirme uygulanır; otomatik birleştirme yoktur. İptal/geçersiz dosya mevcut veriyi değiştirmez. Eski board yedeği yüklenirse tek board'lu workspace oluşturulur.
- Tema aynı tarayıcıda korunur. İkinci sekme salt okunur açılır; board'lar arasında gezilebilir. Yazıcı sekmeyi kapattıktan sonra diğer sekmeyi yeniden yükleyerek düzenleyebilirsiniz.

Kayıt yaklaşık 600 ms bekleme ile, taslak checkpoint'i yaklaşık 80 ms aralıkla yapılır. Daha yeni taslak bulunursa yeniden açılışta kurtarma seçimi sunulur; bozuk veya desteklenmeyen sürümde kayıt sessizce sıfırlanmaz. Kayıt hatası sürerken de bellekteki güncel workspace'in yedeği indirilebilir. Ani süreç kapanışında tamamlanmamış son yazı kaybolabilir; tarayıcı/site verisini temizlemek kayıtları siler. Düzenli workspace yedeği alın.

Browser sürümündeki IndexedDB ve mantıksal klasörler gerçek dosya sistemi erişiminden farklıdır. Masaüstü sürümü seçilen workspace'te gerçek dosyalarla çalışır; dış değişiklikler “Yenile” ile alınır, watcher yoktur.

## Doğrulama komutları

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run desktop:test
```

9 Ekim 2026 PDF metin araçlarının tam web doğrulaması: **56 birim testi, 52 Chrome senaryosu, typecheck ve Docker production build doğrulandı.** PDF işaretleme/alıntı, iki dil, kayıt/yedek ve salt okunur kontrolleri geçti; production Chrome'da container yeniden oluşturulduktan sonra işaretler/alıntı kartı korundu. Tam test turu ve görsel testinin dil bağımsız seçici düzeltmesi [ilerleme kaydında](docs/progress.md). Önceki Faz 4 doğrulamasında ayrıca **12 Rust dosya testi ve native build** başarılıydı; bu frontend ekinde native Rust/WebKit yeniden çalıştırılmadı, ortak filesystem codec test edildi. Chrome Faz 3 testleri native IPC'yi taklit eder; önceki gerçek Tauri smoke ayrı yapılmıştı.

E2E sistemde **Google Chrome** kurulu olmasını ve `127.0.0.1:4173` portunun boş olmasını gerektirir. Playwright Vite sunucusunu test modunda başlatıp kapatır. Ekran görüntüsü/trace dosyaları geçici `test-results/` altındadır. Build uygulamayı yayınlamaz ve üretim lisansı sağlamaz.

PDF üzerinde doğrudan işaret kaldırma ekinde ayrıca **14 ilgili Chrome testi**, typecheck ve Docker production build geçti. Yeni test, üç işaret türünü ayrı kaldırmayı, reload sonrası silmeyi ve native metin seçimini doğrular.

## Kapsam ve sınırlar

- Biçimli mod: başlık/paragraf, bold/italic, sıralı/sırasız ve iç içe listeler, link, alıntı, fenced/inline code, Unicode ve GFM tabloları. Görev listesi, HTML/yorum, wiki-link, dipnot, matematik, frontmatter ve Markdown içi görseller kaynak modunda korunur. [Destek matrisi](docs/progress.md) ayrıntılıdır.
- Önizleme HTML çalıştırmaz, güvensiz URL'leri filtreler; Markdown görsellerini uzaktan indirmek yerine yer tutucu gösterir. Tuval görselleri bağımsız asset'lerdir.
- Yalnız aktif kartta Tiptap vardır. Kaynak native undo ve biçimli Tiptap history ayrı oturumlardır; mod/editör değişince sıfırlanır, içerik korunur. Board geçişi canvas history'yi de sıfırlar.
- Kalıcı kayıt/tam yedek `knowledge-canvas-workspace` v1; eski `knowledge-canvas-board` v1 yüklenebilir. İlk açılışta eski IndexedDB board kaydı kimlik/içerik korunarak taşınır. Kamera, seçim, undo ve tema yedeğe dahil değildir.
- Markdown dosyası keşfi ve gerçek dosya sistemi masaüstünde vardır; browser dosya import'u, watcher yoktur. Browser SVG, HTML `foreignObject` desteği olan görüntüleyici gerektirir; masaüstünde kartlar 2× raster olarak SVG’ye gömülür. Uzun notlar kartın görünen alanında kırpılır. PDF mevcut metin katmanını kullanır; OCR/password arayüzü içermez. Şifreli veya okunamayan PDF hatası gösterilir; notlar/board korunur. Yedek yükleme sınırı 100 MB'dır.
- Salt okunur sekme canlı senkronize olmaz; güncellemeler için reload gerekir. PDF gezinmesi bu sekmede oturumluk kalır. Web Locks yoksa güvenli yazma açılmaz.
- PDF.js kaynakları yereldir; SDK'nın varsayılan font/ikon kaynakları CDN kullanabilir. Tam çevrimdışı uygulama doğrulanmadı. Notlar ve PDF'ler için sunucu/hesap kullanılmaz.
- Ana JS yaklaşık 2,61 MB (gzip 785 KB); ayrı PDF motoru 430 KB (gzip 130 KB), worker 1,26 MB; yerel PDF kaynakları 4,3 MB. Vite büyük chunk uyarısı verir. Bütün workspace snapshot'ını kodlamak büyük PDF/çok sayıda board'da maliyetlidir; 100 kart + 200 şekil ölçümü ve sınırları [performans kaydında](docs/phase4-performance.json).
- Chrome ve macOS Tauri geliştirme smoke geçti; IME CDP composition/commit ile sınırlı. Fiziksel işletim sistemi IME, mobil, Linux/Windows masaüstü ve Safari/Firefox doğrulanmadı. Native WebKit temel not/PDF smoke kapsamındadır; tam Chrome suite native WebKit'te çalıştırılmadı.

## Paketler ve lisans

8 Ekim 2026: React 19.3.0, tldraw 5.5.2, Tiptap 3.31.4, react-markdown 10.1.0, marked 17.0.4, pdfjs-dist 6.4.299, KaTeX 0.19.0, remark-gfm 4.0.1, remark-math 6.0.0, rehype-katex 7.0.1, Vite 8.3.4, TypeScript 7.0.2, Vitest 5.0.3, Playwright 1.64.0; IndexedDB testleri fake-indexeddb 6.2.5. Sürümler package.json ve package-lock.json ile sabit.

[tldraw lisans açıklamasına](https://tldraw.dev/community/license) göre varsayılan koşullar geliştirme kullanımı içindir. Üretim için uygun, geçerli trial/commercial/hobby lisansı ve anahtarı gerekir. Kişisel kullanım otomatik muafiyet değildir. Lisans kontrolü/SDK işaretleri kaldırılmadı; uygulama yayınlanmadı.

Kullanılan Tiptap paketleri [MIT lisanslıdır](https://github.com/ueberdosis/tiptap/blob/main/LICENSE.md); ücretli cloud dönüşüm servisi yoktur. [Markdown desteği](https://tiptap.dev/docs/editor/markdown) beta'dır; her sözdizimi için kayıpsız dönüşüm garantisi verilmez.

PDF okuyucu Mozilla [PDF.js API'sini](https://mozilla.github.io/pdf.js/examples/) kullanır. pdfjs-dist ve uyarlanan text-layer CSS [Apache-2.0 lisanslıdır](https://github.com/mozilla/pdf.js/blob/master/LICENSE); worker/font/CMap/WASM aynı sabit paket sürümündendir.

## Proje belgeleri

- [Faz planı](knowledge_canvas_faz_plani.md)
- [İsterler](knowledge_canvas_vibecoding_prompt.md)
- [İlerleme ve doğrulama kanıtları](docs/progress.md)
- [Kararlar](docs/decisions.md)
- [Uygulanan mimari](docs/architecture.md)
- [Masaüstü workspace ve kurtarma](docs/desktop-workspace.md)
- [Docker ile çalıştırma](docs/docker.md)
- [İlk değerlendirme](docs/review.md)
