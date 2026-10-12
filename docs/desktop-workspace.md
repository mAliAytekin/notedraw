# Masaüstü workspace — Faz 3

Tarih: 8 Ekim 2026. Kullanıcı kararıyla geliştirme modunda ilerleniyor; standalone dağıtım lisansı paketleme öncesinde kararlaştırılacak.

## Çalıştırma

Node.js 22.13+, Rust stable ve macOS Command Line Tools gerekir. Bu oturum Node 26.8.1, Rust 1.99.0 ve macOS arm64 üzerinde doğrulandı. Proje içindeki `.tools/cargo` / `.tools/rustup` varsa `scripts/desktop.mjs` bunları kullanır; başka makinelerde standart Cargo kullanılır. `.tools` üretilmiş yerel araçlardır, proje kaynağının parçası değildir.

```sh
npm ci
npm run desktop:dev
```

Tauri yerel Vite sunucusunu `http://127.0.0.1:1420` üzerinde başlatır. Native pencere gerçek dosya adapter'ını kullanır. Workspace klasörünü sistem seçicisinden seçin; sonraki açılış son klasörü hatırlar. Boş klasör tek boş board ile açılır. Tarayıcıdaki IndexedDB kayıtları kendiliğinden aktarılmaz: tarayıcıdan workspace yedeği indirin, masaüstünde “Yedek yükle” kullanın.

`npm run desktop:build` debug `.app` üretir: `src-tauri/target/debug/bundle/macos/Knowledge Canvas.app`. Bu bir dağıtım hazır sürümü değildir; imzalama/notarization yapılmadı. Paketlenmiş `tauri://localhost` ortamında kurulu tldraw SDK lisans olmadan tuvali kapatır. Native kullanımını kapsayan geçerli anahtar ileride `.env.local` içinde `VITE_TLDRAW_LICENSE_KEY` ile derlenebilir; örnek `.env.example` içindedir. Anahtar istemciye derlenir. SDK lisans kontrolleri ve işaretleri değiştirilmedi. [Resmi lisans koşulları](https://tldraw.dev/community/license), [anahtar kullanımı](https://tldraw.dev/sdk-features/license-key).

## Dosya düzeni

```text
Workspace/
  .knowledge-canvas/
    workspace.json
    writer.lock
    last-good.json
    draft.json                 # daha yeni taslak varsa
    journal.json               # işlem sürerken / kurtarma beklerken
    transactions/<işlem-id>/   # staging ve before kopyaları
    trash/<işlem-id>/          # değişen veya kaldırılan eski kullanıcı dosyaları
  Felsefe/
    Qualia.md                  # dışarıdan bulunan ad korunur
    Ontoloji--<board-id>.board.json
    Bilinç--<note-id>.md        # uygulamada oluşturulan ad
  assets/
    <board-id>-<asset-id>.png
    reading--<pdf-id>.pdf
```

`workspace.json`: `knowledge-canvas-files` / schemaVersion 1. Not/board kimlikleri, adları, klasör ilişkileri, relative yolları ve SHA-256 hash'leri; PDF metadata ve board bazlı reader ayarları içerir. Markdown gövdesi ve board document'i manifest içinde tekrar saklanmaz. `.board.json`: `knowledge-canvas-document` / schemaVersion 1; boardId ve native tldraw document; kart yalnız noteId taşır, görsel src relative asset yoludur. PDF/görseller gerçek byte dosyalarıdır. JSON yedeği bunların hepsini baytlarıyla taşır.

`.md` dosyaları UTF-8 kaynak metindir. Açılışta ve “Yenile” ile iç içe klasörlerde bulunan yeni Markdown dosyaları içe alınır; adı dosya adından gelir, ilk heading adı değiştirmez. Gizli klasörler ve symlink'ler taranmaz; `assets/` binary dosyalar için ayrılmıştır. Yeni bir `.board.json` veya PDF'yi diske koymak otomatik import değildir; board kayıtları manifest tarafından yönetilir, PDF “PDF aç” ile eklenir.

Uygulama rename/move işlemlerinde kimlikleri korur. Dışarıdan bir notun dosya yolunu değiştirmek ilk sürümde eski notun eksik, yeni yolun yeni not olarak bulunmasına neden olur; kartlar eski kimliği eksik-not placeholder olarak korur. Eski dosyayı aynı yola geri koymak veya yeni notu karta bağlamak mümkündür. Klasör rename/move/delete sonrası eski boş fiziksel klasörler kalabilir; içindeki yönetilmeyen dosyalar korunur.

## Kayıt, dış değişiklik ve kurtarma

Yazıcı uygulama workspace ömrü boyunca advisory dosya kilidi tutar. Aynı root'u açan ikinci uygulama salt okunurdur; “Yenile” güncel sürümü okur. Yarım işlem sürerken tutarsız dosya grubunu yüklemek yerine tekrar deneme hatası gösterilir. Kilit VS Code gibi dış editörleri durdurmaz.

Her kayıt önce okunan disk token'ını doğrular; staging hazırlanınca yeniden, her değişen dosya yazılmadan önce eski hash kontrol edilir. Dış değişiklikte kayıt durur, yerel içerik ve checkpoint korunur. “Yenile” temiz durumda disk sürümünü yükler; yerel dirty durumda veya `DISK_CONFLICT` hatasında açık seçim sunar: **Disk sürümünü yükle** veya **Yerel sürümü koru**. Otomatik birleştirme yoktur; karar öncesi yerel JSON yedeği indirilebilir. Manuel yenileme vardır, watcher yoktur. Hash kontrolleri dış editörlerle işletim sistemi seviyesinde tek transaction garantisi sağlamaz; çok kısa eşzamanlı dış yazma aralığı yine mümkündür.

Dosya yazıları aynı parent içinde temporary file → fsync → rename → parent fsync kullanır. Çoklu dosya kayıtlarında dayanıklı journal ve before/after kopyaları bulunur; **manifest en son yazılır**. Manifest commit noktasına ulaşılmadıysa yeniden açılış eski grubu geri yükler; ulaşıldıysa yeni grubu koruyup işlemi tamamlar. Süreç durduktan sonra dışarıda ayrıca değişmiş dosya varsa kurtarma onu ezmez; açılış hatası ve korunmuş transaction kopyaları bırakır. Bu durumda root'un tamamını kopyalayarak koruyun; journal'ı elle silerek uygulamayı yazmaya zorlamayın.

`last-good.json` son tam workspace'in kurtarma/yedek kopyasıdır; canonical düzenleme kaynağı değildir. `draft.json` daha yeni yerel workspace'i tutar; daha eski kayıt yeni taslağı temizleyemez. Normal pencere kapatma önce flush eder; başarısızsa pencere açık kalır ve yerel yedek/geri dönme seçenekleri sunar. Cmd+Q, zorla sonlandırma ve ani güç kesilmesi pencere kapatma akışını atlayabilir; son tamamlanmamış checkpoint için mutlak garanti yoktur.

Silinen/taşınan/değiştirilen yönetilen dosyaların önceki baytları `.knowledge-canvas/trash/<işlem-id>/<eski-relative-yol>` altında saklanır; `.transaction.json` eski/yeni hash'leri belirtir. Çöp otomatik boşaltılmaz; boyutu zamanla büyüyebilir. İlk sürümde çöp için uygulama içi restore ekranı yoktur: notu çöp içinden görünür klasöre **kopyalayın**, “Yenile” yeni not olarak bulur. Bütün kimlik/board referanslarını geri almak için tam workspace JSON yedeğini kullanın. Önceki board dosyasını tek başına kopyalamak manifest/ref restore işlemi değildir. PDF panelini kapatmak dosyayı silmez; workspace yedeği ile değiştirme sırasında kapsamdan çıkan PDF de çöp kuralına uyar.

Eksik PDF son tam kaydın baytlarıyla yedekte korunur; reader açık hata ve “Son kayıttan geri yükle” seçeneği gösterir. Aynı baytlar `assets/` altında tek başka PDF yolunda bulunursa aynı PDF kimliğiyle yeniden bağlanır. Okuma sayfası, zoom, açık durum, panel konumu ve boyutu board bazında korunur. Eksik görsel veya bozuk/yeni sürümlü manifest/board görünür hata verir; sessizce sıfırlanmaz.

Dosya erişimi Rust `cap-std` root handle'ıyla sınırlıdır; absolute/`..`/backslash ve symlink erişimleri reddedilir. Frontend genel filesystem yetkisi almaz. Son root tercihi Tauri'nin app-config dizinindedir; testlerde ayrı ayar root'u kullanılmıştır. Tarama sınırları: 64 klasör derinliği, 10.000 tanınan dosya, toplam 256 MB; PDF açma 50 MB, görsel 10 MB, JSON import 100 MB. Metadata kurtarma ve çöp kopyaları canonical tarama toplamına dahil değildir.

## Doğrulama

```sh
npm run typecheck
npm test
npm run desktop:test
npm run test:e2e
npm run desktop:build
```

41 Vitest, 10 gerçek dosya/Rust ve 37 Chrome E2E geçti. `tests/phase3.spec.ts` native IPC'yi taklit ederek frontend seçme/yenileme/iki çatışma seçimi/readonly akışını doğrular; gerçek Tauri testi yerine sunulmaz.

macOS native geliştirme smoke ayrı geçici workspace'te: dış Markdown keşfi → karta ekleme → kaynakta Türkçe yazma → gerçek `.md` baytlarını okuma → dış metin düzenleme → Yenile → yerel/disk çatışması → yerel seçimi → disk eski baytlarının çöpte korunması; PDF sistem seçicisinden açma → byte eşitliği → sayfa 2 / %125 / panel hareket-boyut kaydı → pencere kapat/aç → not, board, PDF ve reader geri geldi. Kullanıcının gerçek workspace'i test verisi olarak kullanılmadı.

Standalone debug `.app` derlendi; lisanssız pakette tuvalin kapanması gözlendi. Kullanıcı D-028 ile geliştirme modunu seçti. İmzalı dağıtım ve geçerli native anahtarla standalone kabul ayrı, henüz tamamlanmamış iştir.

## PDF işaretlemeleri

D-034 ile vurgulama/altını çizme/üstünü çizme kayıtları PDF baytlarından ayrı, `workspace.json` manifest'inde `pdfs[].annotations` alanındadır. Sayfa numarası, seçilen metin, tür, kimlik/tarih ve normalize satır dikdörtgenleri saklanır; aynı PDF'nin işaretleri bütün board'larda görünür. Kaydetmek kaynak `.pdf` dosyasını değiştirmez. Tam workspace JSON yedeği işaretlemeleri de taşır; eski işaretsiz v1 kayıtlar desteklenir. Eksik PDF'nin metadata'sı/işaretleri korunur. Board'a bırakılan alıntı aktif board klasöründe ayrı UTF-8 `.md` notu olur; PDF adı ve sayfa kaynağı içerir. PDF içine gömülmüş işaretli PDF export'u yoktur. Ortak filesystem codec round-trip testi manifest ve PDF byte ayrımını doğrular; bu ek için native WebKit etkileşimi yeniden çalıştırılmadı.

## Faz 4 dışa aktarma

PNG, SVG, JSON ve `.md` indirme düğmeleri native Farklı Kaydet seçicisini açar. Yalnız seçilen hedefe yazılır; iptal mevcut içeriği değiştirmez. Native SVG'de Markdown/KaTeX kartları 2× raster görseller olarak gömülür, tuval çizimleri vektör kalır; WebKit positioned HTML konumlandırma hatası bu şekilde giderilir. PDF paneli görsel export'a dahil değildir. JSON workspace yedeği bütün kaynak Markdown ve PDF baytlarını korur.
