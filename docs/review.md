# İsterler ve faz planı değerlendirmesi

Tarih: 8 Ekim 2026

## İncelenen kapsam

- [Ürün ve uygulama isterleri](../knowledge_canvas_vibecoding_prompt.md)
- [Faz planı](../knowledge_canvas_faz_plani.md)

İnceleme sırasında klasörde yalnız bu iki dosya vardı; uygulama kodu, paket tanımı, lockfile veya test bulunmuyordu. Bu çalışma doküman değerlendirmesidir. Paket API'leri, güncel lisans koşulları ve teknik uygulanabilirlik henüz doğrulanmadı. Kaynak belgelerdeki “kontrol tarihi” bağımsız doğrulama kanıtı olarak kabul edilmedi.

## Genel değerlendirme

Plan uygulanabilir bir başlangıç çerçevesi sunuyor. En riskli etkileşimi Faz 0'da doğrulamak, not içeriğini tuval kartından ayırmak ve gerçek dosya sistemini sonraya bırakmak doğru bağımlılık sırası. Kalıcılık, kurtarma ve veri kaybını önleme isterleri yalnız arayüz özellikleri kadar ayrıntılı ele alınmış.

Faz 1 küçük bir demo değil: üç içerik modu, kayıpsız dönüşüm, iki ayrı undo bağlamı, tutarlı kayıt ve yedekten geri yükleme içeriyor. Fazı aşağıdaki teslim dilimleriyle takip etmek daha güvenli. Faz 0'ın geçiş koşulları sağlanmadan kalıcılık ve geniş arayüz geliştirmesine geçilmemeli.

## Kapsam farkları ve önerilen yorum

Bu yorumlar kaynak belgeleri değiştirmez; uygulama sırasında karar kaydına bağlanmalıdır.

| Konu | Belgelerdeki durum | Önerilen yorum |
|---|---|---|
| Yedekleme | Prompt Faz 1'de tek board JSON import/export ister; plan yedeklemeyi ağırlıklı Faz 2'de anlatır. | Faz 1: tek board yedeği ve tek not `.md` export. Faz 2: tüm workspace, klasörler ve çakışma yönetimi. |
| Tema | Prompt Faz 1'de tema düğmesi ister; planda karanlık tema Faz 4'tedir. | Temel açık/koyu tema Faz 1; erişilebilirlik ve kapsamlı iyileştirmeler Faz 4. |
| Aktif editör | Prompt Faz 1'de yalnız düzenlenen kartta Tiptap ister; plan Faz 4'te tekrarlar. | İlk MVP'den itibaren tek aktif editör. Faz 4'te ölçüm ve optimizasyon. |
| Dosya yolları | Planın genel modelinde yol alanları vardır; prompt bunları sonraya bırakabilir. | Faz 0–1'de gerçek dosya yolu zorunlu değil. Faz 2 mantıksal klasör; Faz 3 workspace-relative dosya yolu. |
| Kayıp not ve bozuk veri | Plan bu davranışları Faz 2'de vurgular; prompt ilk MVP'de ister. | Faz 1'de kurtarılabilir hata ve eksik-not kartı gerekir. |

## Çözülmesi gereken tasarım boşlukları

| Konu | Risk / açık nokta | Öneri | En geç |
|---|---|---|---|
| Referanssız notlar | Kart silinince not kalır; yalnız referanslı notları içeren yedek bu notları dışarıda bırakabilir. Faz 1'de not gezgini yoktur. | Referanssız notları sakla; Faz 1 yedeğine dahil et ve yeniden karta bağlamak için küçük bir kurtarma yolu tanımla. | Faz 1 veri modeli/yedek |
| Birden fazla sekme | Tek yazma kuyruğu yalnız aynı uygulama instance'ındaki yarışı çözer. | MVP'de aynı veri alanı için tek yazıcı; diğer sekmede görünür salt okunur/engellenmiş düzenleme. Mekanizmayı teknik doğrulamada seç. | Faz 1 kalıcılık |
| Markdown dönüşümü | “Bilinmeyen sözdizimini koru” için hangi içerikte rich-text güvenlidir sorusu açık. | Destek matrisi ve fixture kümesi belirle. Güvenli dönüşmeyen notta kaynağı koru, rich-text geçişini açıklamayla sınırla; yalnız uyarı gösterip kayıplı kaydetme. | Faz 1 editör |
| Taslak ve committed veri | Kurtarılabilir taslakların revision ilişkisi ve yeniden açılış davranışı tanımlı değil. | Taslağı noteId ve temel revision ile ilişkilendir; daha yeni taslağı görünür kurtarma akışıyla sun. Taslak ile tam board kaydının göstergelerini karıştırma. | Faz 1 kalıcılık |
| Import ve bekleyen kayıt | Import öncesi doğrulama tek başına eski kuyruğun yeni veriyi ezmesini engellemez. | Düzenlemeyi bitir, flush et; başarısızsa değiştirme. Doğrulanmış içeriği transaction ile değiştir; eski işlerin yeni state'e yazmasını önle. | Faz 1 yedek |
| Asset kapsamı | SDK araçları görüntü eklemeye izin verirse geçici URL'ler kalıcı içerik sanılabilir. | Asset ekleme sunuluyorsa baytları, metadata'yı ve yedek round-trip'ini destekle. Desteklenmeyen ekleme yolunu açıkça sınırla. | Faz 1 kalıcılık |
| İçerik güvenliği | İçe alınan Markdown, HTML ve linklerin görüntüleme kuralları belirtilmiyor. | Ham HTML'yi çalıştırma; güvenli link protokolleri ve preview davranışını tanımla. Zararlı örnekleri dönüşüm/preview kontrollerine ekle. | Faz 1 preview/import |
| Başlık ve undo | Note.title ile ilk heading ilişkisi, kaynak modu undo'su ve mod değişiminde history davranışı açık değil. | Başlığı ayrı metadata olarak tutmayı öner; kaynak/rich-text/canvas undo sınırlarını belgele ve test et. | Faz 1 editör |
| Desktop çoklu dosya kaydı | Tek dosyanın atomic replace edilmesi manifest, board ve notlar için birlikte atomiklik sağlamaz. | Faz 3 tasarımında yarım kalan çoklu dosya işlemlerini journal/geri alma ile ele al; hata enjeksiyonuyla doğrula. | Faz 3 |

## Önerilen uygulama sırası

1. Resmi API/lisans ve paket uyumluluğu kontrolü; seçilen sürümler ve lockfile.
2. Faz 0: native kart, inline editör, olay/klavye koordinasyonu, ok bağlantısı. Tarayıcıda geçiş koşulunu doğrula.
3. Faz 1A: Note modeli, ortak içerik, Markdown modları, temel araç çubuğu ve tema.
4. Faz 1B: transaction, revision, serialized queue, taslak kurtarma, tek yazıcı politikası.
5. Faz 1C: doğrulamalı yedek, `.md` export, veri hataları ve kritik regresyon kontrolleri.
6. Faz 1 tamamlanma kanıtları kaydedildikten ve kullanıcı ilgili fazı istedikten sonra Faz 2 ve devamı.

Bu alt dilimler yeni ürün fazları değildir. Süre tahmini için Faz 0 bulguları ve paket uyumluluğu doğrulaması gerekir.

## Sonuç

Ürün hedefini veya teknoloji seçimini değiştirmeye gerek görünmüyor. Uygulamadan önce yukarıdaki kapsam yorumlarını ve veri bütünlüğü kararlarını görünür tutmak yeterli. Sonraki somut iş, geliştirme istendiğinde Faz 0'ın API kontrolü ve etkileşim prototipidir. Mevcut istekte uygulama geliştirmesi başlatılmadı.
