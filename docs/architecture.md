# Faz 4 mimarisi

Tarih: 9 Ekim 2026. Browser ve Tauri aynı domain/Runtime/kayıt kuyruğunu kullanır; storage adapter çalışma ortamına göre seçilir. Gerçek dosya formatı, recovery ve çalışma komutları [desktop-workspace.md](desktop-workspace.md) içindedir.

## Arayüz dili

`src/i18n/index.ts` `tr`/`en` tercihini küçük bir external store ile yönetir; React bileşenleri `useLocale` / `useSyncExternalStore` üzerinden değişikliği alır. Türkçe kaynak anahtarları ve tipli İngilizce sözlük `en.json` içindedir; parametreler düz metin olarak yerleştirilir. `LanguageSwitcher`, üst menü ve workspace açma/kurtarma ekranlarında yer alır. `knowledge-canvas-language` localStorage anahtarı geçersiz veya okunamıyorsa Türkçe kullanılır; yazma hatasında oturum tercihi çalışır. Storage event diğer sekmeleri günceller; `document.documentElement.lang` seçime uyar.

Dil değişimi yeni Runtime, tldraw editor veya Tiptap oluşturmaz; not/board/PDF/readers veya save revision değiştirmez. Tiptap textbox etiketi mevcut DOM üzerinde güncellenir. Tldraw `locale` prop'u ve `editor.user.updateUserPreferences({ locale })` aynı tercihe bağlıdır. SDK'nın sabit 5.5.2 TR/EN asset'leri `public/translations/` altında yerel sunulur; eksik iki TR key tamamlandı. Bu değişiklik SDK'nın font/ikon CDN bağımlılığını kaldırmaz.

Not/board/klasör adları ve Markdown/PDF içerikleri kullanıcı verisi olarak korunur. UI dili workspace yedeğinde bulunmaz; tema gibi browser/origin tercihidir. Bilinen arayüz açıklamaları çevrilir; sözlükte olmayan ham backend/SDK/validation hata ayrıntıları özgün mesaj olarak kalır. İşletim sisteminin yerel dosya seçici düğmeleri işletim sisteminin dilini kullanır.

## Masaüstü adapter ve transaction

`main.tsx` gerçek Tauri ortamında `DesktopApp`, browser'da `App` açar. `DesktopApp` native folder seçme/son root açma ve pencere close-request flush akışını yönetir. `TauriAdapter` snapshot'ı doğrulayarak Runtime'a workspace verir; `fileWorkspace.ts` canonical domain ile gerçek `.md` / `.board.json` / manifest / binary assets arasında encode/decode yapar. Browser `IndexedDbAdapter` davranışı korunur; native writer yetkisi Rust root kilidinden gelir.

Rust `Workspace` seçilmiş canonical root'u `cap-std::Dir` handle'ıyla açar. Frontend genel fs/path erişimi almaz. Mutasyonlar backend mutex altında sırayla çalışır. fs2 advisory writer lock ikinci native uygulamayı readonly yapar. Relative yollar ve symlink'ler denetlenir. Snapshot SHA-256 token'ı okunmuş bütün tanınan dosyaları kapsar; commit aynı baseline'ı doğrular. Manuel reload/çatışma çözümü SaveCoordinator kuyruğunda pending commit'leri bekler; valid disk sürümü seçilmeden metadata baseline'ı değiştirilmez. Disk seçimi taslağı kaldırıp domain/sahneyi hydrate eder; yerel seçimi iki revision'ın üstüne çıkarak yazılır. İki seçenek açık kullanıcı eylemidir.

Çoklu dosya journal'ı before/after byte kopyalarıyla dayanıklıdır. Her dosya aynı parent geçici dosyasıyla atomic rename edilir; manifest son yazılır. Yeniden açılış manifest hash'ine göre rollback/finalize yapar; üçüncü dış sürüm varsa overwrite yerine kurtarma hatası ve before kopyaları bırakır. Değişen/kaldırılan önceki kullanıcı dosyaları trash'e alınır. `last-good.json` ve daha yeni `draft.json` kurtarma amaçlı tam envelope kopyalarıdır; normal düzenleme kaynağı not için `.md`, board için `.board.json` olmaya devam eder. Böylece board/manifest içinde ikinci Markdown kopyası yoktur.

Eksik PDF son iyi backup byte'larıyla modelde `missing: true` kalır; reader dosyayı sessizce yeniden yazmaz ve açık restore düğmesi sunar. `assets/` altında aynı baytlı tek taşınmış PDF yeniden bağlanır. Reader geometry/page/zoom board bazında manifest ve JSON yedeğinde korunur. Dış `.md` keşfi ilk save'de stable ID/filename kaydeder; uygulama rename/move işlemleri ID'yi korur. Dosya taraması watcher kullanmaz.

`VITE_TLDRAW_LICENSE_KEY` SDK prop'una geçirilir. Paketlenmiş native ortamda anahtar eksikse açık bilgi gösterilir; SDK kendi enforcement'ını uygulamaya devam eder. Kullanıcı D-028 ile localhost Tauri geliştirme akışını seçti; standalone lisanslı dağıtım kabulü ayrı iştir.

## Veri sahipliği ve kimlikler

`NoteStore` sabit noteId, bağımsız title, Markdown, folderId, revision ve timestamp tutar. Aynı metni tekrar vermek revision artırmaz. `useSyncExternalStore` kartları günceller; aynı not farklı board'larda paylaşılır. Native `markdown-card` yalnız `noteId`, `w`, `h` taşır; konum/çizim/binding/asset kayıtlarını tldraw yönetir. Not içeriğinin ikinci düzenlenebilir kopyası shape'te yoktur.

`WorkspaceStore` workspace metadata, Folder kayıtları, Board snapshot'ları, activeBoardId, PDF dosyaları ve boardId'ye göre reader durumlarını tutar. Runtime capture sırasında canonical notları NoteStore'dan alır. Her board bağımsız native document snapshot'ıdır; SDK içinde bir board için tek page vardır. Folder `{folderId, parentId, name}` kayıtları mantıksaldır; görünen yol parent zincirinden türetilir. Rename/move kimlikleri değiştirmez. Klasör döngüsü ve aynı parent altında aynı adlı klasör engellenir.

Board metadata `{boardId, folderId, title, createdAt, updatedAt, document}` içerir. Değişmemiş document'i okumak/export etmek metadata zaman damgasını değiştirmez. Board kameraları yalnız oturumda ayrı Map'te tutulur; kamera/seçim/undo/tema yedek kapsamına girmez. Tema ayrı localStorage tercihidir.

Kart silmek notu silmez. Board silmek ortak notları silmez. Notun kalıcı silinmesi etkilenen board'lar ve kart sayısıyla onaylanır; kartlar eksik-not placeholder olarak kalır. Klasör silme bütün alt klasör/board/notları kaldırır, dışarıdaki not referanslarını onay ekranında gösterir. Son board silinirse boş board oluşturulur; demo yeniden eklenmez.

## Açılış, geçiş ve kayıt

`Runtime` origin'e bağlı `knowledge-canvas-writer` Web Lock'u alır. Bir sekme yazar, diğerleri son commit'i salt okunur açar. Salt okunur sekmede board/PDF gezinmesi mümkündür ve oturumluk kalır. Canlı senkronizasyon yoktur; güncel kayıt veya yazıcı sahipliği için reload gerekir. Web Locks yoksa güvenli yazma açılmaz.

IndexedDB veritabanı `knowledge-canvas` v1, object store `workspace`, anahtarlar `committed` ve `draft` değişmedi. Faz 1 `knowledge-canvas-board` v1, yüklemede workspace'e çevrilir; board/not/shape kimlikleri, içerik, timestamp ve asset baytları korunur. Yazıcı sekme daha yeni revision ile yeni formatı kaydeder; salt okunur sekme migration yazmaz. Native snapshot SDK migration/validation yolundan geçer. Henüz eski custom shape prop şeması yoktur; sonraki prop değişiklikleri sürümlü migration gerektirir.

`StorageAdapter` load/save/checkpoint/discardDraft/replace sözleşmesidir; eski board ve yeni workspace envelope'larını taşıyabilir. `SaveCoordinator<T>` tek Promise kuyruğunda global monoton revision kullanır: yaklaşık 600 ms commit debounce, 80 ms draft throttle. Board/not/PDF/readers bir envelope transaction'ında tutarlı kaydedilir. Adapter eski/eşit revision'ın yeniyi ezmesini ve eski commit'in yeni taslağı silmesini engeller. “Kaydedildi” yalnız güncel revision'ın transaction'ı tamamlanınca görünür.

Document listener kamera/session değişikliklerini kaydetmez. Not/workspace değişiklikleri aynı koordinatöre gider. Flush frame içinde bekleyen document değişikliklerini de alır. Board geçişleri ayrı serialized transition kuyruğundadır: editörü tamamla → düzenlemeyi geçici kilitle → mevcut workspace'i flush et → aktif board'u değiştir/hydrate et → canvas history'yi temizle → yeni durumu flush et. İlk flush başarısızsa mevcut board'da kalır; içerik/dirty state korunur. Hızlı ardışık geçişler önceki işlemi bekler.

StrictMode mount'ları tek Runtime/boot Promise ve workspace ömürlü koordinatörü paylaşır. Browser demosu yalnız kayıt olmayan ilk açılışta oluşturulur. Örnek Bilinç Problemi kartı, İşlevselcilik kutusu ve bağlı oktur; ikinci İşlevselcilik notu gezginde bulunur. Kaydedilmiş boş board demo ile doldurulmaz. Masaüstünde yeni root tek boş board ve keşfedilen notlarla açılır; demo eklenmez.

## Workspace yedeği ve kurtarma

```text
{ format: "knowledge-canvas-workspace", schemaVersion: 1, revision,
  workspaceId, title, createdAt, updatedAt, activeBoardId,
  folders: [{ folderId, parentId, name }],
  boards: [{ boardId, folderId, title, createdAt, updatedAt, document }],
  notes: [{ noteId, folderId, title, markdown, revision, createdAt, updatedAt }],
  pdfs: [{ pdfId, name, data, pageCount, createdAt }],
  readers: { [boardId]: { pdfId, page, zoom, open } } }
```

`validateWorkspace` format/sürüm, kimlik tekilliği, folder parent döngüleri, parent referansları, aktif board ve PDF reader referanslarını denetler. Her document `validateEnvelope` ile native SDK schema, parent shape zinciri, binding uçları ve asset referansları üzerinden doğrulanır. Eksik notlar kurtarılabilir placeholder olarak kabul edilir. Görseller izin verilen raster data URL; PDF'ler PDF header/base64 biçimi ve metadata üzerinden doğrulanır. Gerçek PDF parse/render hataları ayrıca okuyucuda görünür biçimde ele alınır.

Tam workspace yedeği bütün notları, board'ları, klasörleri, native görsel baytlarını, PDF baytlarını ve okuma durumlarını kapsar. Görsel asset ID/MIME/data URL, her board'un document store'undadır. Tuval dosyaları PNG/JPEG/WebP/GIF/AVIF ve 10 MB/dosya; video/embed/uzak URL asset ekleme kapalıdır.

Normal import sınırı 100 MB. Önce dosya doğrulanır, board/not/PDF sayıları ve tüm workspace'in değişeceği gösterilir; kimlik çakışmaları otomatik birleştirilmez. Kullanıcı açık değiştirmeyi onaylayınca geçiş/kayıt kuyruğu flush edilir, atomik replace tamamlanır, sonra bellek/sahne değiştirilir. Geçersiz dosya/iptal mevcut veriye dokunmaz. Eski board yedeği import'u tek board'lu workspace oluşturur; diğer mevcut board'lar da onay kapsamında değişir. Board export yalnız mevcut sahneyi ve bütün notları içerir; klasör/PDF/diğer board'lar için tam yedek değildir. `.md indir` UTF-8 kaynak kopyasıdır.

Hata dirty revision'ı ve bellekteki içeriği korur; retry ve hata sürerken bellekten yedek indirme vardır. Daha yeni draft için “Taslağı kurtar”/“Son tam kaydı aç” seçenekleri sunulur. Bozuk/yeni sürümlü veri sessiz silinmez; ham kayıt indirilebilir, geçerli yedek açık onayla yüklenebilir. Pagehide/visibility checkpoint'i best-effort'tur; asenkron yazının ani kapanışta bitmesi garanti edilmez. Tarayıcı veri temizleme/kota/cihaz kaybına karşı workspace yedeği gerekir.

## Sabit PDF okuma paneli

Panel tldraw'ın kamera dönüşümü uygulanan DOM'unun dışında, canvas bölümünde `position: fixed` ile konumlanan sibling katmandır. Canvas pan/zoom paneli veya PDF ölçeğini değiştirmez; panel tuvalin kalan alanını kapatmaz. Başlıktaki taşıma düğmesi pointer capture ile sürüklenir; ok tuşları 10 px, Shift+ok 20 px taşır. Dört kenar ve dört köşe aynı pointer capture akışıyla boyutlandırılır; sağ alt köşede görünür tutamaç vardır. Boyutlandırma karşı kenarı sabit tutar; normal minimum 320×260 px, maksimum görünür canvas alanıdır. Canvas daha küçükse minimum da erişilebilir alana uyar. Her tutamaç klavyeyle aynı adımlarda ayarlanır; yön tuşları PDF sayfa gezinmesine taşınmaz. `usePanelPosition` ekran koordinatlarını canvas sınırlarına kısıtlar; ResizeObserver ve window resize ile sidebar/pencere değişiminde görünür tutar. Taşıma/boyutlandırma sırasında yerel React state, bırakıldığında konum/boyut için tek reader güncellemesi kullanılır; pointer cancel/lost capture işlem taslağını iptal eder; her pointer hareketinde PDF baytları kaydedilmez.

Her board'un son PDF/sayfa/zoom/open durumu ve isteğe bağlı `position: {x, y}` ekran koordinatları ve `size: {width, height}` panel boyutu `readers[boardId]` içinde, dosya baytları ortak `pdfs` dizisinde tutulur. Eski konumsuz/boyutsuz v1 yedekleri geçerlidir; varsa koordinatlar sonlu ve sıfır veya pozitif, boyutlar sonlu ve pozitif olmalıdır. Boyutlandırma PDF sayfa/zoom/scroll durumunu veya not/tuval verisini değiştirmez. Pencere küçüldüğünde görünür geometri kısıtlanır; kaydedilmiş tercih ezilmez ve pencere büyüyünce geri gelir. Board değişiminde yeni board'un kendi reader durumu açılır. Yeni PDF eklemek aynı board'un panel konumunu ve boyutunu korur. Kapalı panel dosyayı silmez. Workspace gezgini toolbar'daki metinli düğmeyle veya kendi başlığından kapatılır; görünürlük tercihi `knowledge-canvas-explorer` localStorage anahtarında cihaz tercihi olarak tutulur, workspace yedeğine eklenmez. Aç/kapat tldraw editörünü yeniden oluşturmaz.

`pdfEngine` yerel dosyanın boyutunu/header'ını denetler, PDF.js ile parse eder; başarılıysa dosyanın byte'larını application/pdf data URL olarak Runtime'a verir. 50 MB sınırı vardır. Yükleme sırasında board değişirse açma hedefi başlangıçtaki boardId'dir; hedef silindiyse veri eklenmez. PDF.js parse için buffer'ı worker'a transfer eder; kalıcı data URL orijinal File'dan üretilir.

`PdfReader` tek sayfa canvas ve seçilebilir TextLayer oluşturur. Sayfa/zoom değişince bekleyen render/text işleri iptal edilir; PDF kimliği/baytları değişince veya panel kapanınca loading task/worker kaynakları temizlenir. Canvas piksel çözünürlüğü devicePixelRatio en fazla 2 kullanır. Yeni sayfa/zoom'da panel scroll'u sıfırlanır; son sayfa ve zoom kalıcıdır, pixel scroll offset kalıcı değildir.

PDF klavye olayları canvas için handled işaretlenir. SDK document seviyesinde clipboard dinlediği için yalnız PDF panelinin copy/cut/paste yayılımı durdurulur; tarayıcı metin kopyalama varsayılanı korunur. Wheel doğal panel scroll'u kullanır ve tuval dinleyicilerine ulaşmaz. PDF okuma/parse hatası mevcut not veya board'u değiştirmez; şifre arayüzü/OCR yoktur.

`usePdfSelection` yalnız mevcut PDF'nin tamamlanmış TextLayer'ındaki native Selection/Range'i okur. Çok satırlı `getClientRects()` sayfa sınırına kırpılır ve 0–1 sayfa koordinatlarına çevrilir; yinelenen aynı satır dikdörtgenleri birleştirilir. PDF kimliği/baytları, sayfa veya zoom değişiminde hazır render eşleşmeden araçlar açılmaz. `pdfs[].annotations` isteğe bağlı metadata'sı annotationId/kind/page/text/rects/createdAt içerir; orijinal PDF baytlarından ayrıdır. SVG overlay kamera dönüşümünün dışında kalır; highlight dikdörtgeni, underline/strike sabit kalınlıklı çizgi kullanır. SVG pointer-transparent kalır. PDF sayfasındaki hareketsiz tek tık, normalize metin dikdörtgenlerine hit-test yapıp kaldırma araçlarını açar; metin seçimi/çift tık/sürükleme bu menüyü açmaz. Aynı konumdaki türler ayrı kaldırılır; sayfa/zoom/PDF/selection değişimi menüyü temizler. Silme mevcut Runtime kaydını kullanır ve kaynak PDF/notları değiştirmez. Sayfa listesi × ile alternatif silme yoludur. İşaretler PDF düzeyinde ortaktır; eski v1 yedekler geçerlidir. Geometri, benzersiz kimlik, tarih, sayfa, metin ve adet sınırları import'ta doğrulanır (20.000 karakter/seçim, 500 dikdörtgen, 2.000 işaret/PDF).

Native seçili metin ve sürükleme düğmesi `application/x-knowledge-pdf-selection` + `text/plain` taşır. Canvas capture drop handler'ı bu MIME'ı SDK'nın genel text drop'undan önce işler; PDF paneline veya salt okunur tuvale bırakma not oluşturmaz. Payload ve mevcut PDF doğrulanır, `screenToPage` bırakma konumunu dünya koordinatına dönüştürür. Runtime, Markdown noktalaması kaçırılmış çok satırlı blockquote ve PDF adı/sayfa kaynağıyla bağımsız not oluşturur; aktif board klasörüne ekler ve native kart akışını kullanır. Düğmeye tıklamak aynı işlemi viewport merkezinde yapar. İşaretleme ve alıntı ayrı işlemlerdir; birinin silinmesi diğerini değiştirmez. İki dil ve tek yazıcı kilidi korunur. İşaretlerin PDF dosyasına gömülmesi/dışa aktarımı bu kapsamda yoktur.

PDF.js 6.4.299 core/reader dinamik import ile ayrı chunk'lardır; worker aynı paketten Vite URL import'u ile paketlenir. `scripts/copy-pdf-assets.mjs` cmaps/standard_fonts/wasm dizinlerini dev/build öncesi public'e kopyalar; lisans dosyaları korunur. PDF kaynakları harici CDN gerektirmez. [Resmi API örneği](https://mozilla.github.io/pdf.js/examples/) ve kurulu paket TypeScript/API/CSS kaynakları kontrol edildi.

## Markdown ve olay koordinasyonu

Aktif kartta Tiptap belge modeli geçicidir; `onUpdate` canonical Markdown'ı yazar. Yalnız açılış/mod değişimi metni serialize ederek ezmez. Biçimli düzenleme Markdown yazımını normalize edebilir; anlam koruma fixture'larla doğrulanır. Kaynak textarea doğrudan metni tutar; ad ilk heading'den bağımsızdır.

`markdownSafety` izin verilen token'ları ve parse/serialize öncesi-sonrası anlamı karşılaştırır. Güvenli dönüşüm yoksa kaynak moduna yönlendirir ve açıklama gösterir. Preview ham HTML'yi atlar, güvensiz URL'leri filtreler; linkler noopener/noreferrer ile açılır. Markdown görselleri uzak ağdan çekilmez, yer tutucu gösterilir. Destek matrisi progress.md içindedir.

Native shape Rectangle2d hit-test/binding, resizeBox minimum 240×180, edit/resize/bind/scroll yeteneklerini kullanır. SDK editingShapeId yalnız bir aktif editör açar. Pointer markEventAsHandled metin seçimini korur; klavye capture işaretlemesi native container listener'dan önce çalışır. Normal Escape complete eder, composition Escape etmez. Yalnız aktif editörde wheel yayılımı durdurulur, native scroll korunur.

Kaynak native undo, rich Tiptap history, editör dışında SDK history kullanılır. Mod/editör değişince metin history, board geçişinde canvas history sıfırlanır; not içeriği korunur.

## Arama, bağlantılar ve matematik

`domain/knowledge.ts` unified/remark AST üzerinden wiki-link ve matematiği ayırt eder. Kod, normal URL, ham HTML, kaçırılmış parantez ve frontmatter rename işleminde korunur. Ad/klasör yolu tek hedefe çözülür; belirsiz hedef sessizce seçilmez. Aynı yolda çakışma için stable ID bağlantısı vardır. NoteStore rename/move/create ve Runtime klasör işlemleri, çözülen hedefi koruyarak kaynak linklerini günceller. Delete hedeflerini ID’ye sabitlenmiş görünür kırık bağlantıya çevirir; yeni aynı adlı nota yanlış bağlanmaz. Board/manifest formatına ikinci bir bağlantı veritabanı eklenmedi.

Başlık/içerik araması bellek içindeki canonical notları tarar; Türkçe/harf/diakritik normalizasyonu ve tüm sözcüklerin eşleşmesi kullanılır. KnowledgePanel önizleme, bağlantı metni, backlink ve mevcut kartın board’una gezinme sunar. Kart yoksa yazıcı yeni referans ekler; salt okunur kullanıcı yalnız mevcut kartlara gider. Modal kapanınca odak geri gelir; Tab tuzağı ve Esc iptali, seçici mode tab’larında ok/Home/End desteği vardır.

Tiptap TableKit hizalı GFM tablolarını anlam doğrulamasıyla düzenler. KaTeX 0.19.0 / remark-math kaynak modunda yazılan matematiği önizler; fontlar Vite asset’leridir. `trust: false`, `maxSize: 20`, `maxExpand: 1000` uygulanır. Ham HTML/uzak Markdown resim davranışı korunur.

NoteStore içerik güncellemelerinde metadata katalog snapshot’ını değiştirmez. NotePreview memo ve noteId seçimi, başka not kartlarının yazarken yeniden render edilmesini önler. Backlink parser sonuçları immutable Note nesnesine göre WeakMap’te tutulur. SDK görünür alan culling’i kullanılır; ikinci bir sanallaştırma katmanı yoktur. Test modundaki performanceProbe input olayından bir sonraki requestAnimationFrame’e süreyi, aktif editör sayısını ve kart render sayılarını gözlemler. Bu paint tamamlanma veya kalıcı kayıt süresi değildir; üretimde ölçüm dinleyicisi/test köprüsü açılmaz.

## Board görsel export

MarkdownCardShapeUtil.toSvg, canonical nota erişerek HTML preview üretir; SDK özel export root’una RuntimeContext açıkça verilir. SDK stilleri/fontları/resource baytlarını gömer. `exportBoard` bütün mevcut şekiller için SVG üretir; PNG 2× raster dönüşümüdür. Native WebKit, dönüştürülmüş SVG içindeki positioned HTML’yi yanlış konumlandırdığı için kartlar önce local-origin SVG’de 2× PNG’ye çevrilir, aynı transform altında SVG image olarak yerleştirilir. Native SVG’de kartlar raster, kalan şekiller vektördür. Browser SVG HTML foreignObject kullanır; bunu desteklemeyen görüntüleyicide kartlar görünmeyebilir.

Browser Blob download kullanır. Tauri `export_save` frontend’den yalnız ad/bayt alır; hedef yol native Farklı Kaydet seçicisinden gelir. Aynı parent geçici dosya, fsync ve rename kullanılır; başarısız yazıda eski dosya korunur. İptal normal sonuçtur, hata görünürdür. Bu kullanıcı seçimi export dosyası içindir; workspace fs sınırı genişletilmez. JSON/.md/kurtarma yedekleri aynı native kaydetme akışını kullanır.

## Kod ve kanıt haritası

| Yol | Sorumluluk |
|---|---|
| `src/app/App.tsx` | Toolbar/tema, tam ve board yedeği, onay/kurtarma, PDF açma, note drop |
| `src/app/Runtime.ts` | Boot/migration, kayıt/transition, ortak not/board CRUD, PDF/readers |
| `src/domain/Workspace.ts` | Workspace modeli, mantıksal folder ağacı ve boş native document |
| `src/domain/NoteStore.ts`, `Board.ts` | Canonical notlar ve board envelope |
| `src/explorer/Explorer.tsx` | Klasör ağacı, create/rename/move, referanslı silme onayları |
| `src/storage/*` | Async adapter, revision kuyruğu, doğrulama, Web Lock |
| `src/app/DesktopApp.tsx`, `DesktopControls.tsx` | Native root seçimi/kapatma, manuel reload ve çatışma seçimi |
| `src-tauri/src/*` | Root-scoped dosya motoru, native komutlar, writer lock, journal/trash ve Rust testleri |
| `src/pdf/*`, `scripts/copy-pdf-assets.mjs` | Worker/renderer/text layer, yerel PDF kaynakları |
| `src/canvas/*`, `src/editor/*` | Native kart, üç Markdown modu, preview ve olay sınırları |
| `src/**/*.test.ts` | Markdown, IndexedDB, workspace migration/döngü/referans invariant'ları |
| `tests/phase0.spec.ts`, `phase1.spec.ts`, `phase2.spec.ts`, `phase3.spec.ts`, `phase4.spec.ts` | Chrome etkileşim, kalıcılık, CRUD, geçiş, PDF, yedek ve native IPC mock akışları |

Test modundaki `window.__phase0` SDK state gözlemi ve storage hata/taslak enjeksiyonu içindir; production'da açılmaz. Kullanıcı akışları gerçek pointer/klavye ile, note drag testi sentetik DataTransfer olaylarıyla yürütülür. Chrome production smoke testi worker/canvas/TextLayer ve test köprüsünün kapalı olduğunu doğruladı. Yerel CMap/font/WASM HTTP kaynakları 200 döndü. Fiziksel OS IME/mobil/diğer tarayıcılar ve tam çevrimdışı SDK doğrulanmadı.

## Resmi kaynaklar

- [Native custom shape](https://tldraw.dev/examples/custom-shape)
- [Editable shape](https://tldraw.dev/examples/editable-shape)
- [Olay koordinasyonu](https://tldraw.dev/examples/event-blocker)
- [Shape migrations](https://tldraw.dev/examples/shape-with-migrations)
- [Tiptap React](https://tiptap.dev/docs/editor/getting-started/install/react)
- [Tiptap Markdown](https://tiptap.dev/docs/editor/markdown/getting-started/installation)
- [PDF.js](https://mozilla.github.io/pdf.js/examples/)
