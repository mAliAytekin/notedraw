# Geliştirme takibi

Son güncelleme: 9 Ekim 2026

## Mevcut durum

Faz 0–4 geliştirme kapsamı tamamlandı. Arama, wiki-link/backlink, hizalı Markdown tabloları, kaynak modunda matematik/KaTeX önizleme, klavye erişimi ve PNG/SVG export uygulandı. Tauri 2 ile gerçek UTF-8 notlar, board/manifest/assets/PDF dosyaları, workspace sınırı, writer lock, dış değişiklik seçimi ve journal kurtarma uygulandı. Native geliştirme smoke macOS'ta gerçek geçici workspace üzerinde geçti. Kullanıcı D-028 ile geliştirme modunu seçti; standalone lisanslı/imzalı dağıtım kabulü bekliyor. Browser formatları v1 kalır; gerçek dosya manifest'i `knowledge-canvas-files` v1 ve board dosyası `knowledge-canvas-document` v1'dir. Ayrıntılı çalışma/kurtarma: [desktop-workspace.md](desktop-workspace.md).

Docker web çalıştırma kapsamı da tamamlandı (D-032). Node/Nginx multi-stage image, Compose, build context filtresi ve yerel çalıştırma rehberi eklendi; native/browser veri modeli değişmedi. [Docker rehberi](docker.md).

Türkçe/İngilizce arayüz dili eklendi (D-033): üst menüden seçim, kalıcı browser tercihi, diğer sekmelere aktarım; gezgin/editör/arama/PDF/onay/kurtarma ve tuval araçları birlikte değişir. Dil oturumundaki 52 birim + 48 Chrome sonucu aşağıdadır; sonraki PDF ekinin güncel doğrulaması 56 birim + 52 Chrome senaryosudur.

PDF metin araçları eklendi (D-034): vurgulama, altını/üstünü çizme, işaretli metne tıklayarak veya sayfa listesinden kaldırma; native seçili metin veya araç düğmesinden sürükleyerek kaynak bilgili bağımsız Markdown kartı. İşaretler PDF baytlarından ayrı workspace metadata'sında kaydedilir ve tam yedeğe dahil edilir. Docker sürümü güncellendi.

Kaynaklar: [isterler](../knowledge_canvas_vibecoding_prompt.md), [faz planı](../knowledge_canvas_faz_plani.md), [değerlendirme](review.md), [karar kaydı](decisions.md).

| Faz | Durum | Tamamlanma kanıtı |
|---|---|---|
| 0 — Teknik doğrulama | Tamamlandı | Typecheck/build, 2 Vitest testi, 7 Chrome E2E senaryosu |
| 1 — Tek board MVP | Tamamlandı | Typecheck/build, toplam 25 Vitest testi ve 18 Chrome E2E senaryosu |
| 2 — Çoklu board / klasör / PDF okuma | Tamamlandı | Toplam 33 birim, 34 Chrome E2E; typecheck/build; production PDF smoke ve yerel asset HTTP kontrolleri |
| 3 — Masaüstü workspace | Geliştirme kapsamı tamamlandı; standalone lisansı ertelendi (D-028) | Typecheck/build, 41 Vitest + 10 Rust + 37 Chrome; gerçek macOS Tauri not/disk/çatışma/PDF/yeniden açılış smoke; debug `.app` derlendi |
| 4 — Günlük kullanım kalitesi | Tamamlandı | 52 Vitest + 12 Rust + 46 Chrome; native arama/KaTeX/tablo/PNG/SVG smoke ve 100 kart + 200 şekil ölçümü |
| 5 — İsteğe bağlı genişlemeler | Kapsam dışı; ayrı karar | — |

## Hazırlık ve Faz 0 geçiş koşulları

- [x] P0-01: Güncel resmi API ve lisans kontrolü; uyumlu paket sürümleri ve lockfile; README'de geliştirme/dağıtım koşulları.
- [x] P0-02: React/TypeScript/Vite üzerinde tldraw çizim araçları; native `markdown-card` shape, schema ve migration yaklaşımı.
- [x] P0-03: Kart seçme, sürükleme, resize, zoom/pan ve hareket/resize sonrası bağlı kalan ok.
- [x] P0-04: Çift tıkla kart içinde Tiptap; Türkçe metin, başlık ve liste; Escape ile çıkış ve içeriğin korunması.
- [x] P0-05: Metin seçimi kartı sürüklemez; Delete/Backspace, Ctrl/Cmd+A, undo, clipboard, yön tuşları ve IME canvas eylemine dönüşmez. Gerçek tarayıcı doğrulaması kaydedilir.

Faz 0 tamamlanmadan Faz 1 genişletmesine geçilmez.

## Faz 1 kabul listesi

### İçerik ve etkileşim

- [x] P1-01: Sabit Note/Board kimlikleri, revision/timestamps; Markdown yalnız Note'ta, konum ve geometri tldraw'da.
- [x] P1-02: “Yeni Markdown Kartı” görünür alan merkezinde yeni Note/kart oluşturur; save durumu ve tema düğmesi çalışır.
- [x] P1-03: Preview, kaynak ve rich-text modları; heading, paragraf, bold/italic, listeler, link, alıntı, fenced code ve Unicode fixture'ları.
- [x] P1-04: Desteklenmeyen sözdizimi mod değişiminde korunur; güvenli dönüşüm yoksa görünür sınırlama. Preview HTML çalıştırmaz ve güvensiz linkleri açmaz.
- [x] P1-05: Yalnız düzenlenen kartta aktif editör; kart içi scroll/wheel, dışarı tıklama ve Escape taslağı korur; kaynak ve rich-text undo davranışı doğrulanır.
- [x] P1-06: Kart çoğaltma aynı noteId'yi kullanır; iki kart eşzamanlı güncellenir. Kart silmek notu silmez; referanssız not politikası uygulanır.
- [x] P1-07: Bilinç Problemi / İşlevselcilik demosu yalnız boş ilk açılışta oluşturulur.

### Kalıcılık ve kurtarma

- [x] P1-08: Asenkron StorageAdapter ve IndexedDB; board/notlar tutarlı transaction ile kaydedilir; kullanılıyorsa asset baytları kalıcıdır.
- [x] P1-09: Yaklaşık 600 ms debounce, serialized writes ve revision kontrolü; eski kayıt yeniyi ezmez; “kaydedildi” yalnız commit sonrası görünür.
- [x] P1-10: Yazma hatasında dirty state ve taslak korunur; retry ve yeniden açılışta taslak kurtarma doğrulanır.
- [x] P1-11: Load envelope/shape doğrulaması; bozuk/yeni sürümlü veri sessizce sıfırlanmaz; eksik not görünür placeholder oluşturur.
- [x] P1-12: Reload metni, konumu, boyutu ve bağlı okları geri getirir; editör initialization/save döngüsü içeriği ezmez.
- [x] P1-13: Çoklu sekme yazma politikası uygulanır ve iki sekmeyle doğrulanır; pagehide/visibility için yalnız best-effort garanti belgelenir.

### Taşınabilirlik ve teslim

- [x] P1-14: Sürümlü tek board JSON export/import ve UTF-8 `.md` export; not/asset kapsamı belgelenir; round-trip doğrulanır.
- [x] P1-15: Import önce doğrulanır, değiştirme onayı alınır; flush/queue koordinasyonu ve transaction mevcut veriyi korur; geçersiz import zarar vermez.
- [x] P1-16: Typecheck, production build, anlamlı Vitest kontrolleri ve kritik Playwright/tarayıcı akışları çalıştırılır; çalıştırılamayanlar açıkça belirtilir.
- [x] P1-17: README gerçek komutları ve lisans notunu; architecture gerçek veri/kayıt akışını; progress sürümleri, Markdown destek matrisi, format sürümü ve bilinen sınırları içerir.

## Sonraki fazların geçiş kanıtları

- Faz 2: Klasör/board/not CRUD; rename/move sonrası sabit referanslar; ortak not; hızlı board geçişinde flush; doğrulamalı workspace yedeği ve çakışma kurtarma; sabit PDF panelinden Markdown nota yazma.
- Faz 3: Gerçek `.md`/`.board.json`/manifest/assets ve alınan karara göre PDF dosya entegrasyonu; workspace sınırı; güvenli yazma ve yarım işlem kurtarma; dış değişiklik conflict akışı; macOS çalıştırma/paketleme kanıtı.
- Faz 4: Arama ve ek Markdown dönüşümleri; wiki-link rename/delete kuralları; klavye erişimi; 100 kart + 200 şekille ölçüm; sunuluyorsa görsel export'ta HTML kart doğrulaması.
- Faz 5: Kullanıcı ayrıca kapsam belirlemeden uygulama yok.

### Faz 2 kabul listesi

- [x] P2-01: Mantıksal klasör ağacı; klasör/board/not create/rename/move; klasör döngüsü ve aynı parent altında klasör adı çakışması reddedilir.
- [x] P2-02: Rename/move sonrası sabit kimlikler ve referanslar; aynı not iki board'da paylaşılır, aktif düzenleme tek karttadır.
- [x] P2-03: Not gezginden seçilerek veya drag/drop ile tuvale eklenir; yeni içerik kopyası üretilmez.
- [x] P2-04: Board geçişi önce flush eder; serialized hızlı geçişler ve yavaş/hatalı commit senaryolarında metin korunur.
- [x] P2-05: Not/board/klasör delete onayı ve referans etkisi; kart/board silme ortak notları korur; not silme eksik-not kartı bırakır; son board sonrası boş sahne vardır.
- [x] P2-06: Sürümlü workspace yedeği bütün klasör/board/not/görsel/PDF/readers verisini kapsar; onaylı restore, iptal ve geçersiz/yeni sürüm ret mevcut veriyi korur.
- [x] P2-07: Faz 1 IndexedDB migration'ı kimlik/metin/sahne/timestamp kaybetmez; eski board yedeği yükleme desteklenir; değişmemiş belge export'u timestamp değiştirmez.
- [x] P2-08: Tek yazıcı sekme korunur; salt okunur sekmede board/PDF gezinmesi kayıtları değiştirmez.
- [x] P2-UI-01: Knowledge workspace metinli toolbar düğmesi ve panel başlığından açılıp kapanır; tercih reload ile korunur, tuval remount olmaz.
- [x] P2-09: Önceki Faz 0–1 regresyonları, yeni birim/E2E, production build ve PDF smoke geçti; README/mimari/karar/ilerleme güncellendi.

### Faz 2 PDF kabul listesi

- [x] P2-PDF-01: PDF uygulama içinde ekran koordinatlarında sabit panelde açılır; whiteboard pan/zoom paneli hareket ettirmez veya PDF ölçeğini değiştirmez.
- [x] P2-PDF-02: PDF açıkken tuvalde gezinme ve Markdown kartı düzenleme çalışır; PDF kaydırma/sayfa/zoom işlemleri whiteboard kamerasını değiştirmez.
- [x] P2-PDF-03: Temel sayfa gezinme, bağımsız zoom/scroll, mevcut metin katmanında seçme/kopyalama ve kapatma; yükleme/okuma hatasında mevcut board/notlar korunur.
- [x] P2-PDF-04: D-018 kararları sorulup kaydedilir; saklama/yedek/yeniden açılış ve board geçişi davranışı bu kararlara göre doğrulanır.

- [x] P2-PDF-05: PDF başlığından sürüklenir ve klavyeyle taşınır; whiteboard kamerasını değiştirmez. Konum her board için kayıtta/yedekte korunur; reload ve kapat/aç geri getirir. Sidebar/pencere değişiminde panel tuval sınırlarında kalır; eski konumsuz yedekler kabul edilir.

- [x] P2-PDF-06: PDF kenar/köşelerden ve klavyeyle boyutlandırılır; board/backup/reload/kapama sonrası boyut korunur. Karşı kenar sabit, minimum ve canvas sınırları uygulanır; iptal kayıt yapmaz. PDF zoom/sayfa/scroll, not ve kamera korunur; eski boyutsuz reader geçerlidir.

- [x] P2-PDF-07: Vurgula/altını çiz/üstünü çiz, çok satırlı normalized geometri, zoom/sayfa/reload/yedek ve işaret kaldırma. Kaynak PDF byte'ları değişmez; eski v1 kayıtlar desteklenir; aynı PDF'nin işaretleri bütün board'larda ortaktır.
- [x] P2-PDF-08: Native seçili metin ve “Tuvale sürükle” düğmesi ile drop koordinatında PDF adı/sayfa bilgili yeni Markdown kartı; tıklayarak merkezde ekleme. Alıntı literal metindir, aktif board klasörüne eklenir; readonly/bozuk drop veri değiştirmez; Türkçe/İngilizce araçlar.

### Faz 3 kabul listesi

- [x] P3-01: Tauri 2 native pencere, sistem folder seçici, son root tercihi; browser adapter ve önceki fazlar korunur.
- [x] P3-02: UTF-8 `.md`, ayrı `.board.json`, kimlik/yol manifest'i, gerçek görsel/PDF baytları; board/manifest'te Markdown gövdesi yoktur.
- [x] P3-03: Yeni dış `.md` açılış/Yenile keşfi ve filename title; stable ID/uygulama rename-move; browser JSON yedeğiyle taşıma.
- [x] P3-04: Root handle, traversal ve symlink engeli, native tek yazıcı lock; ikinci native okuyucu readonly, pending transaction yüklenmez.
- [x] P3-05: Same-parent atomic rename/fsync ve durable journal; manifest öncesi rollback/sonrası finalize; crash sonrası ayrı dış değişiklik ezilmez.
- [x] P3-06: Disk hash/token kontrolü; dirty state/taslak koruma; açık disk/yerel seçimi ve yerel yedek; otomatik merge yok.
- [x] P3-07: Kaldırılan not/board/PDF ve değişen önceki baytlar workspace trash'inde; klasördeki yönetilmeyen dosyalar korunur.
- [x] P3-08: Gerçek PDF/assets, per-board reader geometry/page/zoom; missing PDF geri yükleme ve tek taşınmış PDF yeniden bağlama codec kontrolleri.
- [x] P3-09: Native pencere kapanmadan flush; hata halinde pencere açık/yerel backup; draft monotonic, eski commit yeni draft'ı silmez.
- [x] P3-10: Typecheck, 41 Vitest, 10 gerçek Rust dosya testi, bütün 37 Chrome E2E; gerçek macOS native geliştirme smoke ve debug `.app` derleme.
- [ ] P3-DIST: Geçerli native tldraw anahtarıyla standalone tuval kabulü, imzalama/notarization. Kullanıcı kararıyla paketleme öncesine ertelendi; Faz 3 geliştirme kapsamının tamamlanması dağıtım hazır olduğu anlamına gelmez.

### Faz 4 kabul listesi

- [x] P4-01: Tüm notlarda başlık/içerik araması, Türkçe/harf normalizasyonu; sonuçtan mevcut board/karta gezinme, ortak not kimliğini koruma; kartı olmayan yazıcı notunu ekleme.
- [x] P4-02: TableKit GFM tabloları; hücre biçimleri/hizalama, satır/sütun ekleme-silme; güvenli dönüşüm guard’ı, mod geçişi/yeniden açılış ve kaynak koruması.
- [x] P4-03: Kullanıcı D-030 kararıyla KaTeX; inline/block matematik, yerel fontlar, matematikte kaynak editörü; unsafe kaynak komutları uzak istek açmaz.
- [x] P4-04: Wiki-link/backlink; isim, klasör yolu, alias/ID; not/klasör rename/move; belirsizlik, silinen hedef ve yeni aynı adlı not; kod/HTML/frontmatter/tablo ayırıcılarını koruma.
- [x] P4-05: Koyu tema, görünür odak, modal Tab/Shift+Tab tuzağı, Escape/odak dönüşü, Cmd/Ctrl+K ve mode tab ok/Home/End; metin kısayolları korunur.
- [x] P4-06: 100 kart + 200 şekil sahnesinde tek aktif Tiptap ve yalnız düzenlenen nota ait kart render’ı; SDK culling, metadata snapshot/memo/cache; ölçüm yöntemi ve sınırları saklanır.
- [x] P4-07: PNG/SVG kart başlığı, Türkçe, tablo, KaTeX ve normal şekiller; PNG note-body piksel kontrolü ve görsel inceleme. Native local-origin raster kart fallback’i çoklu/döndürülmüş kart transform’unu korur.
- [x] P4-08: Native Farklı Kaydet; aynı dizinde geçici/atomic yazma, iptal, hata/önceki dosyayı koruma; gerçek macOS SVG/PNG dosyaları ve native ekranlar.
- [x] P4-09: Typecheck, 52 Vitest, 12 Rust, tam 46 Chrome E2E, frontend/native build ve gerçek native/production smoke; README/mimari/karar/faz planı ve kalıcı kanıtlar güncellendi.

## Doğrulama kayıtları

**2026-10-08 — Faz 4:** 52 Vitest, 12 Rust dosya testi; tam Chrome kabul turu 46 senaryo. Kullanıcı D-029/030/031 kararları uygulandı. Arama başka board’daki mevcut karta gider, arama önizlemesindeki wiki-link paneli kapatarak hedefi gösterir. Not/klasör rename ve move kaynak linklerini günceller, silinen hedef ID’ye bağlı kırık kalır; aynı ad/yol çakışması yanlış hedef seçmez. Frontmatter/kod/HTML ve GFM hücre ayırıcıları korunur. Tiptap’ta hizalı tablo düzenleme, KaTeX kaynak/önizleme ve klavye odak sınırları doğrulandı.

Gerçek macOS Tauri geliştirme smoke ayrı geçici workspace üzerinde: kaynakta Türkçe/tablo/matematik/wiki-link yazma → yerel `.md` baytlarının eşitliği → native preview → Cmd+K ve `BILINC 42` araması → gelen link listesi → wiki ile tuvale dönme; açık/koyu panel ekranları incelendi. PNG ve SVG native Farklı Kaydet ile `/private/tmp` dosyalarına yazıldı. Native PNG başlık/tablo sağ hizalama/formül/link görsel olarak doğru; [kalıcı çıktı kanıtı](evidence/phase4-native-export.png). Native SVG’de 1 gömülü PNG, 0 foreignObject doğrulandı. WebKit’in positioned HTML/SVG hatası local-origin raster fallback ile giderildi; çoklu ve döndürülmüş kart browser fallback testi ve görsel incelemesi de geçti. Kullanıcının gerçek workspace’i değiştirilmedi.

Performans sahnesi 100 not kartı + 200 geo; 72 karakter (15 ms aralık), tek aktif Tiptap (max 1), yalnız “Ölçüm 0” kartının render’ı, StrictMode dahil 144 render. Input capture → bir sonraki requestAnimationFrame medyan **9,8 ms**, p95 **20,9 ms**. Ham sonuç ve ortam/sınırlar [phase4-performance.json](phase4-performance.json). Bu tamamlanmış paint veya kalıcı commit süresi değildir; tek yerel koşu, görünür alan dışı kartlarda SDK culling etkin. Büyük PDF, bütün sahnenin görünür olduğu uzak zoom, çok board ve export throughput ölçülmedi.

Üretim browser build’inde yeni tablo/KaTeX/wiki-link önizleme ve `URETIM BILINC` araması gerçek Chrome UI’da geçti; [arayüz kanıtı](evidence/phase4-production.png). Test köprüsü `undefined`, yerel KaTeX_Math-Italic/Main-Regular woff2 istekleri HTTP 200 doğrulandı. Chrome matematik testinde FontFaceSet.load/check ile gerçek KaTeX_Math font yüklemesi ayrıca geçti.

Frontend üretim build’i ve macOS arm64 debug `.app` build’i geçti (36,99 MiB); büyük JS chunk uyarısı sürüyor. `npm audit --omit=dev` sıfır açık; bütün KaTeX alt bağımlılıkları root 0.19.0 sürümüne override edildi. Native lisanslı standalone/imzalı dağıtım D-028 ile ertelenmiş durumda; geliştirme smoke paketlenmiş tuval lisans kabulü değildir.

**2026-10-08 — Faz 3:** `npm run typecheck`, `npm test` (41), `npm run desktop:test` (10), `npm run test:e2e` (37), frontend/native build geçti. Rust testleri gerçek geçici dosyalarla UTF-8/binary round-trip, rename/delete trash, hash çatışması, draft, crash recovery, native lock, readonly pending journal, traversal/symlink ve `.MD` keşif kapsamındadır. Chrome Faz 3 IPC mock'larını kullanır; native GUI yerine sunulmaz.

Gerçek macOS Tauri geliştirme penceresi ayrı geçici workspace'te: dış `Felsefe/Qualia.md` keşfi ve karta ekleme; native kaynak editöründe Türkçe metni yazıp gerçek dosyayı okuma; dış değişiklik/Yenile; gerçek `DISK_CONFLICT` modalı/yerel seçim ve eski disk metninin trash'te doğrulanması; native PDF seçici/render/byte eşitliği; sayfa 2, %125 zoom, panel hareket/boyut → pencere kapat/aç → aynı not/board/PDF/readers. Son reader geometry manifest'te `{x:1002,y:142}`, `{width:420,height:574}` görüldü. Kullanıcının gerçek root'u test verisi olarak değiştirilmedi.

Debug `.app` macOS arm64'te derlendi (yaklaşık 36 MB). Paketlenmiş native origin'de anahtarsız tldraw tuvali kapattı; SDK enforcement kaynakları ve native Console ile doğrulandı. Kullanıcı geliştirme modunda ilerlemeyi seçti (D-028). Anahtar prop'u/env örneği hazır, lisanslı standalone çalışması henüz doğrulanmadı.

Son kod üzerinde aşağıdaki kontroller geçti. E2E: macOS, sistem Google Chrome, 1280×850 viewport; yeni panel erişilebilirlik senaryosu ayrıca 800×650 kullanır. IME kanıtı CDP composition/commit ile sınırlıdır; fiziksel işletim sistemi IME ve diğer tarayıcılar doğrulanmadı.

| Tarih | Kabul ID / senaryo | Komut veya manuel adımlar | Sonuç / kanıt | Kalan sorun |
|---|---|---|---|---|
| 2026-10-08 | İster incelemesi | İki kaynak Markdown dosyası ve klasör içeriği incelendi | review.md ve decisions.md oluşturuldu | O aşamada teknik doğrulama yoktu |
| 2026-10-08 | P0-01 | Resmi API/lisans belgeleri, kurulu paket kaynakları, `npm ls --depth=0` | Uyumluluk kontrol edildi; package-lock.json üretildi | Üretim/dağıtım lisansı alınmadı; geliştirme prototipi |
| 2026-10-08 | P0-01–02 | `npm run typecheck`, `npm run build` | Başarılı | Büyük chunk uyarısı: JS 2.13 MB / gzip 641 KB |
| 2026-10-08 | P0-04 | `npm test` | 2/2 geçti: Türkçe başlık/paragraf/liste anlamsal round-trip; NoteStore no-op/revision | Kapsamlı Markdown matrisi Faz 1 |
| 2026-10-08 | P0-02–05 | `npm run test:e2e` | 7/7 geçti (11.0 sn); [senaryolar](../tests/phase0.spec.ts) | Chrome/CDP kapsamı; diğer tarayıcılar test edilmedi |
| 2026-10-08 | P0-04 görünüm | Playwright preview/editing ekran görüntüleri; editing görüntüsü görsel olarak incelendi | Kart içinde editör, biçim araçları ve bağlı ok görünür | Görüntüler geçici `test-results/` altında |
| 2026-10-08 | P1-01, 03–04, 08–11, 14–15 | `npm test` | 25/25 geçti; Markdown round-trip/koruma, NoteStore revision, gerçek adapter ile fake-indexeddb transaction ve kayıt kuyruğu | Gerçek tarayıcı storage ayrıca E2E ile doğrulandı |
| 2026-10-08 | P1-02, 05–07, 12 | `npm run test:e2e` | Reload ile metin/ad/konum/boyut/binding; ortak not, scroll, undo, IME; boş board reseed edilmez; merkezde kart; tema reload | Tek aktif editör, destekli source→rich initialization içeriği ezmez |
| 2026-10-08 | P1-06, 08, 14–15 | Aynı tam E2E turu | Silinen not saklama/yeniden ekleme, Unicode `.md`; görsel baytları dahil JSON indir/import/reload; geçersiz/yeni sürüm ret ve import iptali | Tek board formatı; camera/theme/session yedekte değil |
| 2026-10-08 | P1-09–11, 13 | Aynı tam E2E turu | Enjekte edilen commit hatasında dirty/taslak, hata sırasında yedek indir, retry; yeni taslak kurtarma; yeni schemaVersion ham kaydı korunur; iki sekmede tek yazıcı | Ani süreç kapanışında bekleyen son transaction için kesin garanti yok |
| 2026-10-08 | P1-16 | `npm run typecheck`, `npm test`, `npm run build`; son tam `npm run test:e2e` | Typecheck/build başarılı, 25/25 birim, 18/18 Chrome E2E (49,3 sn); [Faz 1 senaryoları](../tests/phase1.spec.ts) ve [Faz 0 regresyonları](../tests/phase0.spec.ts) | JS 2.154,37 KB / gzip 648,71 KB; büyük chunk uyarısı |
| 2026-10-08 | P1-17 | README/architecture/progress/decisions güncellemesi; editing ve dark ekran görüntülerinin görsel incelemesi | Güncel mimari, kararlar, format ve destek matrisi kaydedildi; açık/koyu arayüz incelendi | Geçici görüntüler `test-results/`; fiziksel OS IME, mobil, diğer tarayıcılar test edilmedi |
| 2026-10-08 | P2-01–04, 07, PDF-04 | `npm test` | 31/31 geçti; eski board migration, folder cycle/name/parent/ID kontrolleri, boş document, PDF reader referansları ve değişmemiş metadata | PDF gerçek parse/render ayrıca Chrome'da |
| 2026-10-08 | P2-01–08, PDF-01–04 | `npm run test:e2e` | 30/30 tam Chrome turu; 18 önceki faz + 12 Faz 2 senaryosu; [phase2.spec.ts](../tests/phase2.spec.ts) | Note drag DataTransfer sentetik; diğer akışlar gerçek pointer/klavye |
| 2026-10-08 | P2-04–07 | Aynı E2E turu | Yavaş commit'te queued board geçişi; hatalı flush'ta aynı board/metin; recursive delete/dış referans/iptal; eski storage kimlik/timestamp korunması | Not delete varsayımı D-019; user yanıtı gelirse güncellenir |
| 2026-10-08 | PDF-01–04 | Aynı E2E turu | PDF metin seç/kopyala, Markdown yaz, bağımsız scroll/pan/zoom, sabit panel, reload, board'a özel PDF/sayfa/zoom ve bayt yedeği; geçersiz PDF mevcut içeriği değiştirmez | Tarama PDF'lerinde OCR yok |
| 2026-10-08 | P2-09 | `npm run typecheck`, `npm run build` | Başarılı; PDF motor/reader ayrı chunk, aynı sürüm worker ve yerel kaynak kopyalama | Vite büyük chunk uyarısı |
| 2026-10-08 | P2-09 / production | Vite preview `127.0.0.1:4174`, ayrı Chrome context; gerçek PDF upload/render; yerel asset HTTP kontrolü | Worker HTTP 200, canvas 400×800/TextLayer; production test köprüsü kapalı; CMap/font/WASM HTTP 200 | Preview yayınlama değildir; geçici `phase2-production.png` |

| 2026-10-08 | P2-UI-01, P2-PDF-05 / regresyon | `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` | 32/32 birim, 32/32 tam Chrome E2E (1,5 dk); gerçek pointer ile PDF sürükle, klavye taşı, board/reload/kapama konumu; sidebar tercihi ve editör kimliği; dar pencere | Chrome/macOS; Vite büyük chunk uyarısı sürüyor |

| 2026-10-08 | P2-PDF-06 / tam regresyon | `npm run typecheck`, `npm test`, `npm run build`, `npm run test:e2e` | 33/33 birim; 34/34 Chrome E2E (1,7 dk); kenar/köşe/klavye resize, min/max/karşı kenar, iptal, per-board/reload/backup boyutu, bağımsız sayfa/zoom/scroll/kamera, pencere küçült/büyüt; `pdf-resizable.png` görsel incelemesi | Chrome/macOS; mevcut büyük chunk uyarısı |

## Oturum günlüğü ve sıradaki iş

**2026-10-09 — PDF üzerinde doğrudan kaldırma:** Kullanıcı çizgi/vurgu kaldırmayı istedi. Mevcut sayfa listesindeki × yoluna ek olarak PDF'de işaretli metne tek tıklama kaldırma araçlarını açar: Vurgulamayı kaldır / Alt çizgiyi kaldır / Üst çizgiyi kaldır. Aynı yerdeki türler ayrı kaldırılır; menü kapanabilir ve sayfa/zoom/PDF/selection değişiminde temizlenir. SVG pointer-transparent kalır; normalize hit-test, hareketsiz tek tık ve collapsed native seçim şartıyla metin seçme/çift tık/sürükleme korunur. Silme mevcut Runtime/kayıt yolunu kullanır; kaynak PDF ve alıntı notları değişmez. Salt okunur oturum kaldırma menüsünü açmaz, liste silmesi de devre dışıdır; TR/EN etiketleri vardır. D-034, README ve mimari güncellendi.

Typecheck ve Docker Linux arm64 production build/health başarılı. **14/14 ilgili Chrome testi (1,2 dk)** geçti: yeni doğrudan kaldırma/üst üste üç türde bağımsız silme, zoom, sayfa geçişinde menünün kapanması, reload sonrası silme ve not/PDF byte korunması; eski PDF seçim/kopyalama/sürükleme/yedek/reader hareket-boyut/kamera/sidebar ve iki dil regresyonları. Readonly doğrudan/liste silme kontrolü genişletildi. Önceki 56 birim ve 52 Chrome kaydı aşağıda; bu küçük UI ekinde bunların tam suite'i/Rust/native WebKit yeniden çalıştırılmadı. Ayrı production Chrome context'inde aynı üç tür doğrudan tıklama menüsünden kaldırıldı; reload sonrası işaretler silinmiş kaldı, alıntı kartı korundu. Test köprüsü kapalı, page error yok; [kaldırma menüsü kanıtı](evidence/pdf-remove-mark.png) incelendi. Docker container localhost:8080 üzerinde healthy kaldı.

**2026-10-09 — PDF işaretleme ve alıntı:** Kullanıcı işaretlemelerin kaynak PDF'den ayrı workspace'te saklanmasını seçti; D-034 kesinleşti. `src/pdf/annotations.ts`, `usePdfSelection`, SVG overlay ve sayfa işaret listesi; Runtime işaret ekle/sil ve alıntı notu oluşturma; canvas capture drop handler'ı uygulandı. Browser IndexedDB/tam JSON yedeği ve native `workspace.json` manifest'inde isteğe bağlı annotations alanı; v1 formatları değişmedi. Metin/rect/tarih/sayfa/tür/kimlik sınırları import/drop'ta doğrulanır. Native seçili metin kısa hold ile sürüklenir; düğme sürükleme ve tıklama alternatifidir. Markdown/wiki/HTML/math literal kaçırılır; mevcut not/PDF korunur. OCR veya işaretleri PDF içine gömen export eklenmedi.

Typecheck ve **56/56 Vitest** geçti; ortak filesystem codec testi manifest round-trip, eksik PDF metadata'sı ve orijinal PDF byte eşitliğini doğruladı. [Dört yeni Chrome kabul testi](../tests/pdf-annotations.spec.ts): gerçek native seçim/kopyalama, üç işaret ve duplicate önleme, zoom sonrası fiziksel geometri, sayfa/reload/JSON restore/silme, iki dil, pan/zoom sonrası gerçek pointer drop dünya koordinatı, tıklama ve kalıcılık, native text drag + MIME aktarımı, bozuk drop ve ikinci readonly sekme, iki satır/literal metin/board klasörü ve ortak PDF işaretleri. Tam **52 senaryoluk Chrome turunda 51 geçti**; eski görsel testinin İngilizce Media seçicisi Türkçe SDK menüsüne uymuyordu. Gerçek DOM'daki `tools.asset` kimliğiyle dil bağımsız düzeltildi; kalan senaryo tek başına yeniden çalıştırılıp geçti (**toplam 52 doğrulandı**). Ürün kodu bu test düzeltmesinde değişmedi. 100 kart/200 şekil: max 1 Tiptap, yalnız düzenlenen not render'ı; input-frame medyan 9,5 ms/p95 22,2 ms (önceki ölçüm sınırları).

Docker `compose up --build -d --wait`: Linux arm64 production build/health başarılı. Ayrı geçici Chrome context'inde test köprüsü kapalı; PDF TextLayer'dan üç işaret, araçtan gerçek sürükleme ile Markdown kartı, kaynak PDF byte eşitliği/işaret içeren JSON yedeği, English araçlar, readonly ikinci sekme ve container force-recreate + reload sonrası üç işaret/alıntı kartı kalıcılığı geçti. HTTP worker/font/CMap/WASM/cache/gzip/404/fallback kontrolleri geçti, page error yok. [Görsel kanıt](evidence/pdf-annotations.png) incelendi. Container localhost:8080'de healthy. Kullanıcının gerçek workspace'i test için değiştirilmedi; native Rust/WebKit bu frontend ekinde yeniden çalıştırılmadı, ortak native codec test edildi. README/mimari/masaüstü/faz planı/kararlar güncellendi; Faz 5 başlamadı.

**2026-10-09 — Dil desteği:** Kullanıcının Türkçe ve İngilizce menü isteği uygulandı (D-033). `src/i18n/en.json` tipli çeviri sözlüğü, `src/i18n/index.ts` external store ve LanguageSwitcher eklendi. Varsayılan Türkçe; `knowledge-canvas-language` localStorage'da cihaz/origin tercihidir, aynı origin'deki sekmeler storage event ile güncellenir. Workspace JSON formatı değişmedi; dil tercihi yedeğe eklenmez. Kullanıcı not/board/klasör adları ve Markdown/PDF içerikleri çevrilmez. Tuval SDK locale prop'u/user preference birlikte güncellenir; resmi 5.5.2 TR/EN dosyaları yerel sunulur, eksik iki TR anahtar tamamlandı. Bilinen UI açıklamaları çevrilir; bilinmeyen ham backend/SDK/validation ayrıntıları ve işletim sistemi dosya seçici dili aynı kapsamda değildir.

Typecheck ve **52 Vitest** başarılı. Tam **48 Chrome E2E (2,6 dk)** geçti; önceki 46 senaryo ve iki [dil kabul testi](../tests/language.spec.ts). Dil geçişinde mevcut tldraw editor/Tiptap DOM kimliği, canonical notlar, board document ve save revision değişmedi. English biçim araçları/etiketleri, create modalı, arama ve reload sonrası seçim; diğer salt okunur sekmede dil aktarımı; PDF panelinin sayfa/zoom/dosya baytları ile restore/resize etiketleri doğrulandı. 100 kart/200 şekil kontrolünde max 1 Tiptap, yalnız düzenlenen not render'ı korunuyor (input-frame medyan 10,9 ms/p95 22,5 ms; aynı önceki ölçüm sınırlamaları).

Docker `up --build -d --wait` ile Linux arm64 production build ve health başarılı. Ayrı gerçek Chrome context'inde Turkish→English menüler, gerçek PDF worker/text layer, tablolar/KaTeX, workspace yedeği ve readonly kontrolü; container force-recreate + reload sonrası hem içerik hem English tercihi korundu. Test köprüsü kapalı, page error yok; [English arayüz kanıtı](evidence/language-en.png) görsel olarak incelendi. Docker HTTP worker/font/CMap/WASM/cache/gzip/404/fallback kontrolleri tekrar geçti. Container `http://127.0.0.1:8080` üzerinde healthy olarak kaldı. Rust kodu değişmedi; önceki 12 Rust/native build sonucu korunur, bu oturumda native binary yeniden paketlenmedi. README/mimari/Docker/karar belgeleri güncellendi; Faz 5 başlamadı.

**2026-10-09 — Docker:** Kullanıcının Docker isteği uygulandı. `Dockerfile`, `.dockerignore`, `compose.yaml`, `.env.docker.example`, `docker/nginx.conf` ve [docker.md](docker.md) eklendi; README ve D-032 güncellendi. Resmi Node 26 Alpine/Nginx stable Alpine çok mimarili manifest digest'leri sabitlendi. Kilitli `npm ci`, typecheck/PDF asset kopyalama/production build Linux arm64 container içinde başarılı. Docker build context ilk derlemede 567,91 kB; `.tools/`, native hedefler, host node_modules, env dosyaları ve yerel workspace'ler taşınmadı. Runtime image yaklaşık **30,13 MB**, uygulama statikleri 9,3 MiB. İlk HTTP kontrolünde Nginx'in `.mjs` worker'ı octet-stream sunduğu görüldü; açık JavaScript MIME eşlemesi eklenip image yeniden derlendi.

`docker compose config --quiet`, `docker compose up --build -d --wait`, Nginx config kontrolü ve health başarılı. UID/GID 101 (`nginx`), salt okunur root, `/tmp` tmpfs, localhost:8080 bağlantısı doğrulandı. Gerçek HTTP ile SPA fallback, eksik statik kaynakların 404 olması, index/PDF kaynaklarının no-cache ve hash'li asset'lerin immutable olması, JS gzip, PDF module worker/KaTeX font/CMap/standart font/WASM 200 ve MIME tipleri kontrol edildi.

Ayrı, geçici Google Chrome browser context'inde production test köprüsü kapalı; Türkçe Markdown düzenleme, hizalı tablo, yerel KaTeX fontu/formül, workspace araması, gerçek PDF worker/text layer render, not/PDF içeren JSON yedeği ve ikinci sekmede salt okunur durum geçti. Aynı browser context'i açıkken `docker compose up --force-recreate --no-build -d --wait` ile container yeniden oluşturuldu; reload sonrası not, tablo/formül ve PDF yeniden açıldı. Page error yok; [görsel kanıt](evidence/docker-web.png) incelendi. Kullanıcının browser/masaüstü workspace'i test için değiştirilmedi. Son container `http://127.0.0.1:8080` üzerinde healthy olarak çalışıyor. Bu doğrulama arm64 yerel web kapsamındadır; amd64 image çalıştırma, HTTPS dış ortam ve üretim lisansı kabulü yapılmadı. Faz 5 başlamadı; önceki tam 52/12/46 test kaydı korunur, bu oturumda yeniden tam suite çalıştırılmadı.

**2026-10-08:** İsterler ve fazlar değerlendirildi. Kaynak belgeler korunarak üç takip dokümanı oluşturuldu. Kod veya bağımlılık eklenmedi.

**2026-10-08 — Faz 0:** React/Vite/tldraw/Tiptap uygulandı. İlk E2E turunda StrictMode nedeniyle yinelenen demo binding ve native klavye dinleyicisinin composition/Escape sırası düzeltildi. Testler native canvas hit-test ve asenkron ProseMirror seçim güncellemelerine göre düzenlendi. Son tam turda 7/7 E2E ve 2/2 birim testi geçti. README, architecture ve decisions güncellendi. Kullanıcının ayrı Faz 0 isteği doğrultusunda Faz 1 başlatılmadı.

**2026-10-08 — Faz 1:** Kullanıcı saklanan not listesinden yeniden karta eklemeyi, tek yazıcı sekmeyi, bağımsız not adını ve yalnız görsel asset kapsamını seçti; D-006/007/008/010 güncellendi. Markdown koruma kontrolü, üç mod, otomatik kayıt/kurtarma, yedek ve tema uygulandı. Test sırasında SDK’ya her render’da verilen boş video MIME dizisinin editör remount’una neden olduğu görüldü; sabit konfigürasyon ve workspace ömürlü save coordinator ile düzeltildi. Frame içinde bekleyen document değişiklikleri flush öncesi yakalanıyor; hata sırasında bellek yedeği de indirilebiliyor. Son tam testler ve görsel inceleme tamamlandı.

**2026-10-08 — yeni PDF isteri (planlama):** Whiteboard hareket ederken ekran üzerinde sabit kalan PDF'den okuyup Markdown kartına not yazma Faz 2 kapsamına eklendi. Gerçek dosya sistemi entegrasyonu Faz 3'te. O planlama adımında D-017 gereksinimi ve D-018 sorulacak kararları kaydetti; kod henüz değişmemişti. Aşağıdaki Faz 2 oturumunda uygulandı.

**2026-10-08 — Faz 2:** Kullanıcı PDF'lerin workspace/yedeğe dahil edilmesini, son sayfa/zoom'un hatırlanmasını ve her board'un kendi PDF'sini göstermesini seçti (D-018). Mantıksal folder/board/note CRUD, ortak notlar, serialized geçişler, workspace v1 migration/backup ve PDF.js okuyucu uygulandı. Klasör seçme ile aç/kapat ayrıldı; dynamic PDF import sırasında Vite'ın reload'u önceden optimize edilen dependency ile önlendi. Native document clipboard dinleyicisi PDF metin kopyalamayı engelliyordu; yalnız PDF clipboard olaylarının yayılımı ayrıldı. Snapshot okumalarının değişmemiş board timestamp'ını ilerletmesi önlendi. Referanslı not silme sorusuna yanıt gelmediği için güvenli eksik-not placeholder varsayımı D-019'a açıkça kaydedildi.

**2026-10-08 — Faz 2 arayüz ekleri:** Kullanıcı PDF panelini taşıma ve Knowledge workspace bölümünü açıp kapatma istedi (D-023). Kamera bağımsız fixed panel başlığından pointer capture ile taşınır; ok tuşları da desteklenir. Konum board bazında isteğe bağlı reader alanıdır; eski yedekler geçerlidir. Sidebar tercihi tarayıcıda tutulur; ResizeObserver paneli görünür tuval alanında tutar. Yeni iki E2E ve koordinat doğrulama birim testi eklendi; bütün regresyonlar geçti.

**2026-10-08 — PDF panel boyutu:** Kullanıcı panelin size'ını değiştirmeyi istedi (D-024). Sekiz kenar/köşe tutamacı, klavye boyutlandırma, board bazında isteğe bağlı size alanı ve yedek doğrulaması eklendi. Boyutlandırma PDF zoom'undan bağımsız; yerel taslak iptal edilebilir, bırakma tek reader güncellemesi yapar. 320×260 minimum ve tuval sınırı, küçük pencerede erişilebilirlik; pencere tekrar büyüdüğünde kayıtlı boyutu geri getirme uygulandı. 33 birim ve 34 tam Chrome E2E, typecheck/build geçti; boyutlandırılmış PDF arayüzü görsel olarak incelendi.

**Sıradaki somut iş:** Faz 0–4 tamamlandı. Faz 5, kullanıcı ayrıca kapsam belirlemeden başlatılmaz. Standalone paketleme öncesinde D-028 lisans kararı ve native anahtar kabulünü tamamla. Manuel yenileme, çöp restore UI ve dış filename rename davranışının mevcut sınırları desktop-workspace.md içindedir.

## Sürümler, format ve Markdown destek matrisi

React/React DOM 19.3.0; tldraw 5.5.2; Tiptap 3.31.4; react-markdown 10.1.0; marked 17.0.4; Vite 8.3.4; TypeScript 7.0.2; Vitest 5.0.3; Playwright 1.64.0; pdfjs-dist 6.4.299; KaTeX 0.19.0; remark-gfm 4.0.1 / remark-math 6.0.0 / rehype-katex 7.0.1; fake-indexeddb 6.2.5. Çözüm package-lock.json ile sabit; marked, Tiptap parser sürümüyle dedupe edilir.

Kalıcı format: `knowledge-canvas-workspace`, schemaVersion 1. workspaceId/title/timestamps, folders, boards, notes, activeBoardId, pdfs ve boardId bazında readers tek transaction envelope'unda. Eski `knowledge-canvas-board` v1 migration/import ve tek board export'u için korunur. Native görsel asset'leri board document store içinde ID/MIME/data URL baytları taşır; PDF baytları pdfs dizisindedir. Kamera/seçim/undo/tema dahil değildir. IndexedDB veritabanı `knowledge-canvas` v1, store `workspace`, anahtarlar `committed`/`draft`; DB sürümü değişmedi. Masaüstü gerçek dosya manifest’i `knowledge-canvas-files` v1, board document `knowledge-canvas-document` v1’dir; body yalnız `.md` dosyasında tutulur.

| Sözdizimi | Biçimli mod | Kaynak/önizleme davranışı ve kanıt |
|---|---|---|
| Heading, paragraf, Unicode | Destekli | Türkçe/Japonca/emoji fixture’ları; kaynak→rich yalnız açılışta metni değiştirmez |
| Bold/italic | Destekli | Anlamsal round-trip fixture’ı ve toolbar |
| Sıralı/sırasız, iç içe liste | Destekli | Ayrı fixture’lar; toolbar ve Chrome liste etkileşimi |
| Link ve başlık metadata’sı | Güvenli round-trip olursa | Link fixture’ı; preview güvensiz URL’yi filtreler |
| Alıntı | Destekli | Çok satırlı quote fixture’ı |
| Fenced code, dil etiketi, inline code | Destekli | TypeScript/shell fixture’ları; kod içindeki `$HOME`/`[[literal]]` korunur |
| GFM tabloları | Güvenli round-trip olursa destekli | Header/hücre biçimleri ve hizalama fixture’ları; satır/sütun araçları; Chrome mode/reload testi |
| Görev listesi | Kaynak moduna yönlendirilir | Kaynak korunur; GFM önizlemesi |
| Ham HTML ve yorum | Kaynak moduna yönlendirilir | Kaynak korunur; preview HTML çalıştırmaz |
| Wiki-link | Kaynak modunda düzenlenir | Önizlemede gezinme, backlink, rename/move/delete; kod ve frontmatter yeniden yazılmaz |
| Matematik | Kaynak modunda düzenlenir | Yerel KaTeX inline/block önizleme; kaynak tam korunur, trust false |
| Dipnot, frontmatter | Kaynak moduna yönlendirilir | Kaynak korunur; yapılandırılmış editör eklenmedi |
| Markdown içi görsel | Kaynak moduna yönlendirilir | Kaynak korunur; preview uzak görsel yerine yer tutucu gösterir |
| Diğer Markdown varyantları | Anlam karşılaştırmasına bağlı | Güvenli dönüşüm yoksa görünür açıklama ve kaynak korunması; evrensel round-trip garantisi yok |

Birim kanıtları [markdownSafety.test.ts](../src/editor/markdownSafety.test.ts) ve [storage.test.ts](../src/storage/storage.test.ts); gerçek tarayıcı kanıtları [phase1.spec.ts](../tests/phase1.spec.ts) içindedir. Biçimli düzenlemeden sonra Markdown yazım biçimi normalize edilebilir; yalnız mod açmak kaynak yazımını değiştirmez.

## Bilinen sınırlar

- Veriler browser/origin’e bağlıdır; `localhost`, `127.0.0.1` ve farklı portlar ayrı kayıt alanlarıdır. Tarayıcı verisi silme/kota/cihaz kaybına karşı JSON yedeği gerekir.
- 600 ms commit ve 80 ms taslak yazıları ile pagehide/visibility checkpoint’i asenkrondur; ani kapanışta son tamamlanmamış işlem kaybolabilir. Hata sırasında içerik bellekte korunur, taslak yazısının da başarısız olması mümkündür.
- Salt okunur sekme canlı senkronize olmaz; son commit için reload gerekir. Web Locks yoksa yazma açılmaz.
- Kaynak native undo ve biçimli Tiptap undo ayrı oturum geçmişleridir; mod/editör değişince sıfırlanır. İçerik korunur. Canvas undo not içeriğini geri almaz.
- PNG/JPEG/WebP/GIF/AVIF tuval görselleri 10 MB/dosya sınırıyla desteklenir; video/embed/SVG yoktur. Asset baytları JSON’u büyütür; normal import 100 MB sınırındadır.
- Masaüstünde gerçek dosya workspace'i ve `.md` keşfi vardır; browser Markdown dosya import'u, watcher yoktur. PNG/SVG export vardır; browser SVG `foreignObject` destekli görüntüleyici ister, native SVG kartları 2× raster kullanır. Uzun not kartın görünen alanında kırpılır, PDF paneli dahil değildir. Büyük export SDK/browser canvas sınırlarına bağlıdır. Workspace import mevcut veriyi onayla değiştirir; otomatik merge yoktur. Tek board yedeği klasörleri, PDF’leri ve diğer board’ları kapsamaz.
- PDF.js worker/font/CMap/WASM yerel paket kaynaklarıdır; SDK statik kaynakları CDN kullanabilir, tam çevrimdışı uygulama doğrulanmadı. PDF 50 MB/dosya; mevcut metin katmanıyla seçme/kopyalama, OCR/password UI yoktur. Son sayfa/zoom, panel ekran konumu ve boyutu kalıcı, pixel scroll offset oturumluk. Sidebar görünürlüğü tarayıcı tercihi, yedek kapsamında değil. Panel kapatma PDF baytlarını silmez. Not/PDF için sunucu/hesap yoktur.
- Ana JS yaklaşık 2.611 KB / gzip 785 KB; PDF motoru ayrı 430,09 KB / gzip 129,52 KB; worker 1.264,34 KB; yerel font/CMap/WASM 4,3 MB. Büyük chunk uyarısı vardır. Bütün workspace snapshot’ının kodlanması büyük PDF/çok board’da maliyetlidir; 100 kart + 200 şekil input-frame ölçümü [phase4-performance.json](phase4-performance.json) içindedir; büyük PDF/kayıt serialization ölçülmedi.
- Chrome/macOS testleri geçti; IME CDP composition/commit kanıtıyla sınırlı. Fiziksel işletim sistemi IME, mobil, Safari/Firefox test edilmedi.
- Native geliştirmede kaynak modüllerinin hot reload sırasında Runtime değişirse geçici `runtime.saver` initialization hatası görüldü; uygulamayı kapatıp `desktop:dev` yeniden başlatmak gerekir. Temiz açılış ve normal not/board akışları doğrulandı; HMR runtime yeniden bağlama ayrı iyileştirme olarak kaldı.
- Üretim/dağıtım lisansı alınmadı; kullanıcı geliştirme modunda ilerlemeyi seçti. Lisanssız standalone native tuval kapanır. İmzalı dağıtım, Linux/Windows masaüstü ve tam native WebKit regresyon suite'i doğrulanmadı. Lisans ve komutlar [README](../README.md), kayıt/veri akışı [architecture.md](architecture.md) içinde.

Her geliştirme oturumunda ilgili kutuları, kanıt tablosunu, bilinen sınırları ve sıradaki işi güncelle. “Kod yazıldı”, “test edildi” ve “faz tamamlandı” durumlarını birbirinin yerine kullanma.
