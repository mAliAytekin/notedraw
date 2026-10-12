# Knowledge Canvas — Fazlandırılmış Geliştirme Planı

Tarih: 8 Ekim 2026

## 1. Ürün hedefi

Excalidraw benzeri sonsuz bir whiteboard üzerinde kutu, ok ve serbest çizimlerle birlikte gerçek Markdown notları oluşturmak ve düzenlemek. Markdown kartı tuvalin içinde sürüklenir, boyutlandırılır ve diğer nesnelere oklarla bağlanır. Çift tıklayınca kartın içinde yazılır; ayrı bir not ekranına geçmek gerekmez.

Klasörler altında birden fazla whiteboard ve Markdown notu bulunur. Aynı not farklı whiteboard'larda gösterilebilir. Öncelikli kullanım: felsefe kavram haritaları, AI araştırmaları ve oyun tasarımı notları.

## 2. Teknoloji ve kapsam

| Alan | Seçim | Karar |
|---|---|---|
| Arayüz | React + TypeScript + Vite | Küçük tek uygulama |
| Whiteboard | tldraw | Markdown için özel React shape |
| Kart editörü | Tiptap + açık kaynak Markdown desteği | Temel biçimler; ham Markdown modu |
| İlk kalıcı kayıt | IndexedDB | Tarayıcı prototipi; gerçek klasör değildir |
| Masaüstü | Tauri 2 | Daha sonra gerçek yerel workspace |
| Dosyalar | UTF-8 `.md`, sürümlü `.board.json`, assets | Taşınabilir kullanıcı verisi |
| Stil | Basit CSS veya Tailwind | Mevcut projeyle tutarlı olan |
| Test | Vitest ve Playwright | Veri bütünlüğü ve kritik etkileşimler |

İlk sürümde backend, hesap, bulut, eşzamanlı işbirliği, AI, MCP ve grafik veritabanı yok. Çizim motoru sıfırdan yazılmaz. Masaüstü aşamasına kadar browser ile yerel dosya sistemi birbirine karıştırılmaz.

### Lisans ve API kontrolü

Uygulamaya başlamadan tldraw ve Tiptap'ın güncel resmi belgeleri, paket uyumluluğu ve lisansları kontrol edilir; kullanılan sürümler lockfile ile sabitlenir. tldraw SDK varsayılan lisansı geliştirme kullanımına izin verir; üretim/dağıtım için uygun lisans anahtarı ve koşulları değerlendirilir. Kişisel kullanımın otomatik olarak sınırsız ücretsiz olduğu varsayılmaz. Lisans engeli varsa çalışan geliştirme prototipi korunur; motor değişikliği ayrı karar olarak sunulur.

## 3. Veri modeli: not ile kartı ayır

- **Note:** sabit `noteId`, başlık, workspace-relative dosya yolu, Markdown içerik ve revision.
- **MarkdownCard:** tldraw shape kimliği, `noteId`, genişlik/yükseklik ve görünüm özellikleri. Konum tldraw tarafından yönetilir.
- **Board:** sabit `boardId`, başlık, yol, tldraw document snapshot ve şema sürümü.
- **Folder:** sabit kimlik, parent kimliği, ad ve relative path.
- **Asset:** sabit kimlik, relative path, MIME type.

Markdown metni her kartta ayrı kopyalanmaz. Notun tek doğruluk kaynağı vardır. Kartı silmek notu silmez. Not silmek ise onu kullanan kartlar için açık onay ve referans yönetimi gerektirir. Rename/move sırasında noteId değişmez.

Desktop workspace örneği:

```text
MyKnowledge/
  .knowledge-canvas/workspace.json
  Felsefe/
    Ontoloji/
      Bilinc.md
      Ontoloji.board.json
  AI Research/
  Game Design/
  assets/
```

Workspace manifest not kimliklerini yollara eşler. Board snapshot kart referanslarını ve çizimleri tutar; Markdown gövdesi `.md` dosyasında kalır. Browser export ise board, notlar, manifest ve asset'leri içeren sürümlü bir yedek paketidir. Bu format Obsidian `.canvas` veya Excalidraw dosyası olarak tanıtılmaz.

## 4. Fazlar

| Faz | Çıktı | Tamamlanma ölçütü |
|---|---|---|
| 0 | Teknik doğrulama | Aynı tuvalde düzenlenen Markdown shape |
| 1 | Tek board MVP | Kart, çizim, autosave, yeniden açma |
| 2 | Klasörlü browser uygulaması ve PDF okuma | Çoklu board, ortak notlar, yedekleme, sabit PDF panelinden not alma |
| 3 | Yerel masaüstü workspace | Tauri ile gerçek dosyalar |
| 4 | Günlük kullanım kalitesi | Arama, bağlantılar, performans |
| 5 | İsteğe bağlı genişlemeler | AI/MCP/sync ayrı kapsam |

### Faz 0 — En zor etkileşimi doğrula

React/Vite kur; tldraw tuvaline `markdown-card` custom shape ekle. Kart içinde Tiptap ile Türkçe başlık, paragraf ve liste düzenle. Seçme/sürükleme ile yazma modlarını ayır. Kart ok bağlantısı kabul etsin; zoom ve pan sırasında yerinde kalsın.

Kabul: Çift tıklama yazma moduna girer, Escape düzenlemeyi bitirir. Yazarken harfler, Backspace, Delete, Ctrl/Cmd+A ve undo canvas komutuna dönüşmez. Metin seçmek kartı sürüklemez. Ok kart hareket ettiğinde bağlı kalır. Bu faz tamamlanmadan klasör veya Tauri ekleme.

### Faz 1 — Tek whiteboard MVP

Yeni not kartı ekleme; başlık, paragraf, kalın/italik, listeler, link, alıntı ve fenced code destekle. Ok, kutu ve serbest çizimler SDK araçlarıyla çalışsın. Kartta preview, rich-text ve ham Markdown modu olsun. Tablo ve matematik bu fazda zorunlu değildir; desteklenmeyen Markdown sessizce dönüştürülmesin.

IndexedDB'ye board ve notları kaydet. Yaklaşık 600 ms debounce; serialized write queue; revision takibi; kaydediliyor/kaydedildi/hata göstergesi. Board değiştirmeden flush yap. Ani sekme/işlem kapanışında son debounce aralığı için mutlak garanti verme; recoverable draft yaklaşımı kullan. Başarısız kayıtta dirty state korunur.

Kabul: Kartı düzenle, taşı, boyutlandır, okla bağla, sayfayı yeniden aç; metin ve sahne geri gelsin. Eski yazma sonucu yeni metni ezmesin. Editör dışındayken Delete kartı kaldırır, notu kaldırmaz. Ham Markdown içe/dışa aktarım fixture'ları anlamsal olarak doğrulansın.

### Faz 2 — Klasörler, çoklu board, PDF okuma ve taşınabilir yedek

Solda klasör ağacı; klasör/board/not oluşturma, rename, move ve onaylı delete. Browser klasörleri uygulama içindeki mantıksal kayıtlardır. Notu tuvale sürükleyerek veya seçerek ekle. Aynı not iki board'da ve aynı board'da iki kartta görünsün; düzenleme bütün görünümlere yansısın. Not tek kart silinince kaybolmasın.

Workspace export/import ekle; şema sürümü, doğrulama, asset'ler, çakışma yönetimi ve kurtarma. Bilinmeyen/bozuk format mevcut workspace üzerine yazılmasın. Not referansı bulunamazsa kurtarılabilir eksik-not kartı göster.

Kabul: Felsefe/Ontoloji klasörü altında board ve not oluştur; rename/move sonrası bağlantılar çalışsın. Export edip temiz workspace'e import et; metinler, oklar, kartlar ve asset'ler açılsın. Hızlı board geçişleri son metni kaybetmesin.

**8 Ekim 2026 — ek kullanıcı isteri: sabit PDF okuma paneli.** Kullanıcı PDF'yi uygulama içinde whiteboard üzerinde açıp okurken tuvaldeki Markdown kartlarına not yazabilmeli. PDF paneli ekran koordinatlarında sabit kalır; whiteboard pan/zoom işlemleri PDF'nin konumunu veya ölçeğini değiştirmez. Panel tuval kamerasından bağımsız bir uygulama katmanında yer alır ve açıkken tuvalde gezinme/düzenleme kullanılabilir kalır.

Temel PDF açma, sayfa gezinme, bağımsız kaydırma/zoom, mevcut metin katmanında seçme/kopyalama ve paneli kapatma Faz 2 kapsamındadır. PDF üzerindeki pointer/wheel/klavye/clipboard işlemleri tuvale taşınmamalı; Markdown editörünün metin kısayolları korunmalı. PDF yükleme/okuma hatası notları veya board'u değiştirmemeli. Faz 2 geliştirmesinde kullanıcıya sorulan D-018 kararları: PDF dosyaları workspace'e ve yedeğe dahil edilir; son sayfa/zoom hatırlanır; her board kendi son PDF'sini gösterir.

**8 Ekim 2026 — ek arayüz isteri:** PDF paneli başlığından kullanıcı tarafından taşınabilir; whiteboard pan/zoom yaparken seçilen ekran konumu sabit kalır. Panel konumu board bazında hatırlanır ve pencere daraldığında erişilebilir alana kısıtlanır. Soldaki Knowledge workspace bölümü görünür bir aç/kapat kontrolüne sahip olur; görünürlük tercihi tarayıcıda hatırlanır. Tuval veya notlar aç/kapat sırasında yeniden oluşturulmaz.

**8 Ekim 2026 — ek boyutlandırma isteri:** PDF panelinin genişlik ve yüksekliği kenar/köşelerden değiştirilebilir. Boyut board bazında hatırlanır ve workspace yedeğine dahil edilir. Boyutlandırma PDF yakınlaştırmasını, sayfasını, kaydırmasını veya whiteboard kamerasını değiştirmez; minimum boyut ve tuval sınırları korunur. Eski boyutsuz yedekler desteklenir.

Ek kabul: PDF açıkken bir Markdown kartına not yaz → whiteboard'u pan/zoom yap → PDF panelinin ekran konumu ve PDF zoom'u aynı kalsın → PDF içinde kaydır/sayfa değiştir → whiteboard kamerası aynı kalsın → nota geri dön; metin ve mevcut kayıt davranışı korunsun. Çoklu board geçişlerinde açık PDF davranışı ve PDF kalıcılığı, alınan karara göre ayrıca doğrulansın.

### Faz 3 — Tauri ve gerçek dosya sistemi

**8 Ekim 2026 — uygulama ve kullanıcı kararları:** Faz 3 geliştirme kapsamı uygulandı; macOS native geliştirme smoke ve debug `.app` derleme doğrulandı. Dış `.md` açılış/Yenile ile otomatik keşfedilir ve adı filename'den gelir (D-025). Çatışmada disk/yerel sürüm açık seçilir, otomatik merge yoktur (D-026). Kaldırılan dosyalar workspace trash'inde korunur (D-027). Kullanıcı şimdilik geliştirme modunu seçti; paketleme öncesinde tldraw native lisansı ayrıca kararlaştırılacak (D-028). Standalone lisanslı/imzalı dağıtım henüz tamamlanmadı. [Kanıtlar](docs/progress.md), [dosya/kurtarma kılavuzu](docs/desktop-workspace.md).

Storage adapter'ı Tauri implementasyonuyla değiştir. Workspace seçme, `.md` okuma/yazma, `.board.json`, manifest ve assets. Yalnız seçilen workspace'e erişim ver; path traversal ve symlink ile dışarı çıkmayı engelle. Yazmada aynı dizine temporary file ve platforma uygun atomic replace yaklaşımı kullan; başarısız kayıtta son iyi dosyayı koru.

Dışarıdan değişen dosyalar için revision/hash veya mtime kontrolü; dirty editör varsa sessiz overwrite yerine conflict akışı. İlk masaüstü sürümünde manuel yenileme yeterli; watcher sonra eklenebilir. Taşıma/yeniden adlandırma sırasında manifest güncelleme hatası için recovery journal veya geri alma uygula.

Faz 2'deki sabit PDF panelini masaüstüne taşı. PDF saklama/referans kararı doğrultusunda gerçek workspace dosyaları ve manifest ile bütünleştir; eksik/taşınmış PDF ve yeniden açılış davranışını doğrula. Dosya erişimi aynı workspace sınırlarına uymalı. Temel PDF okuma özelliği Tauri geçişini beklemez.

Kabul: Uygulamayı kapat/aç; gerçek not ve board geri gelsin. `.md` VS Code'da okunabilsin. Dışarıda değiştirilen not görünür biçimde algılansın. Yazma hatasında veri kaybolmasın. Mac hedefinde çalıştırma/paketleme doğrulaması yapılsın; Linux ortamında yapılmayan macOS doğrulaması yapılmış gibi raporlanmasın.

### Faz 4 — Günlük kullanım kalitesi

**8 Ekim 2026 — uygulandı:** Başlık/içerik araması, wiki-link/backlink, tablo düzenleme, KaTeX kaynak/önizleme, klavye erişimi ve PNG/SVG export eklendi. Kullanıcı rename bağlantılarının güncellenmesini/silmede görünür kırık bağlantı kalmasını (D-029), KaTeX kaynak editörünü (D-030), kartları doğru gösteren PNG+SVG’yi (D-031) seçti. Native SVG’de kartlar 2× raster gömülür, diğer şekiller vektör kalır; browser SVG HTML foreignObject kullanır. [Kabul/test/performans kanıtları](docs/progress.md), [kararlar](docs/decisions.md).

Not başlığı/içeriğinde basit arama, desteklenen Markdown tabloları, isteğe bağlı KaTeX, wiki-link/backlink, karanlık tema ve klavye erişimi. Yalnız düzenlenen kartta aktif Tiptap instance; diğer kartlarda hafif preview. Görünür alan dışı kartlar için SDK yeteneklerinden yararlan. Ölçüm yapmadan karmaşık optimizasyon ekleme.

PNG/SVG board export destekleniyorsa özel HTML kartların gerçekten çıktıya girdiğini doğrula; başarısızsa bunu desteklenmiş özellik olarak gösterme. Workspace export esas kayıpsız yedek olarak kalır.

Kabul: 100 not kartı ve 200 basit şekilli test sahnesinde düzenleme sırasında bütün editörlerin yeniden render edilmediğini ölç. Markdown özelliklerinin kaynak ↔ editör dönüşümünü doğrula. Wiki-link silme/rename davranışını belgele.

**9 Ekim 2026 — PDF metin araçları (D-034):** Faz 2 PDF özelliği tamamlanmış fazlar sonrası kullanıcı isteğiyle genişletildi: vurgulama, altını/üstünü çizme; seçili metni veya “Tuvale sürükle” düğmesini whiteboard'a bırakınca kaynak PDF adı/sayfa bilgili bağımsız Markdown kartı. İşaretler kaynak PDF değiştirilmeden workspace metadata'sında ayrı saklanır ve tam yedeğe dahil edilir. Sayfa/zoom/panel/kamera değişiminde konum korunur; aynı PDF'yi açan board'lar aynı işaretleri görür. Silme, tek yazıcı politikası ve eski yedek uyumu korunur. Bu ek Faz 5'i başlatmaz.

### Faz 5 — Ayrı karar gerektiren genişlemeler

Seçili notları LLM'e gönderme, kaynaklı özetler, önerilen kavram bağlantıları, MCP erişimi ve cloud sync. Temel uygulama veri bütünlüğü sağlandıktan sonra planlanır. Sync için conflict/version modeli; AI için veri gönderim kapsamı ve kullanıcı tarafından seçilen sağlayıcı gerekir.

## 5. Kod düzeni

```text
src/
  app/
  canvas/MarkdownCardShapeUtil.tsx
  editor/
  explorer/
  domain/
  storage/StorageAdapter.ts
  storage/IndexedDbAdapter.ts
  storage/TauriAdapter.ts
  assets/
  tests/
docs/architecture.md
docs/progress.md
README.md
```

Bu bir yönlendirmedir; gereksiz katman veya plugin framework kurma. Storage ve domain kodu React bileşenlerinden ayrılır. Board state için tldraw store kullanılır; ikinci bir paralel shape store kurulmaz.

## 6. Vibe coding çalışma yöntemi

İlk oturum yalnız Faz 0–1'i uygular. Sonraki oturumlarda “Faz 2'yi uygula” gibi açık hedef verilir. Her fazda çalışan sonuç, kritik kabul senaryoları, yapılan kontroller ve kalan sınırlar `docs/progress.md` içine yazılır. Çalışan önceki faz bozulursa yeni özellikten önce düzelt.

Örnek smoke senaryosu: Ontoloji board'u aç → Bilinç Problemi kartı ekle → qualia notu yaz → İşlevselcilik kutusuna ok bağla → kartı taşı → yeniden aç → aynı notu ikinci board'a ekle → değişikliği iki board'da gör.

## 7. Resmi başvuru kaynakları

Kontrol tarihi: 8 Ekim 2026. Geliştirme başladığında güncel API ve koşulları tekrar doğrula.

- Custom shape: https://tldraw.dev/examples/custom-shape
- Shape modeli: https://tldraw.dev/docs/shapes
- tldraw lisansı: https://tldraw.dev/community/license
- Tiptap Markdown: https://tiptap.dev/docs/editor/markdown
- Markdown kurulumu: https://tiptap.dev/docs/editor/markdown/getting-started/installation
- Tauri: https://v2.tauri.app/
