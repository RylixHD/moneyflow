# MoneyFlow

**Kişisel finansın için sakin, net ve güvenli bir çalışma alanı.**

MoneyFlow; gelir, gider, hesap, bütçe, birikim hedefi ve abonelikleri PostgreSQL üzerinde saklayan, Türkçe öncelikli bir full-stack uygulamadır. Dashboard, yeni işlemlerden sonra gerçek API verileriyle güncellenir. Banka bağlantısı veya kart bilgisi toplamaz.

![MoneyFlow dashboard — sentetik demo verileri](docs/screenshots/dashboard.png)

## Özellikler

- Argon2id şifreleme; HttpOnly/SameSite oturum çerezi; üretimde Secure; e-posta doğrulama, şifre sıfırlama ve tüm oturumları iptal eden şifre değiştirme.
- Gelir/gider CRUD, etiket, hesap ve özel kategori seçimi; açıklama/tarih/tutar/tür filtreleri, sayfalama, toplu silme.
- TRY, USD ve EUR hesapları; ondalık para saklama; hesaplar arası transfer. Döviz transferinde kur, kaynak ve tarih zorunludur. Farklı para birimleri toplam bakiyede karıştırılmaz.
- Aylık kategori bütçeleri, yeni ay yenileme, %50/%75/%90/%100 bildirimleri.
- Birikim hedefleri, katkılar, ilerleme ve açık varsayımlı tamamlanma tahmini. Katkılar hedef kaydıdır; otomatik hesap borçlandırması değildir.
- Aylık/yıllık abonelikler, yıllık maliyet ve yaklaşan ödeme bildirimleri. Abonelik takibi ödeme yapmaz; ödeme tarihini düzenleyerek ilerletin.
- Tekrarlayan gelir/giderler: PostgreSQL advisory lock ve benzersiz tekrar anahtarı ile idempotent işleme. API ayaktayken 15 dakikalık görev ve dashboard erişiminde catch-up. Her geçişte kural başına en fazla 120 dönem işlenir.
- Günlük ve 12 aylık grafikler, kategori dağılımı, haftalık/aylık/yıllık dönem raporları, tasarruf oranı, en yüksek harcama günü.
- Atomik CSV içe aktarma (1000 satır), CSV/Excel/PDF dışa aktarma (10000 kayıt). Excel formül enjeksiyonuna karşı metinler kaçışlanır. PDF Türkçe karakterleri destekler.
- OpenAI Responses API asistanı: açık kullanıcı izni, yalnızca özet veriler, sunucu tarafı anahtar, kullanıcı başına günlük 10 istek. API yapılandırılmadıysa açıklayıcı hata.
- Koyu/açık tema, TR/EN çalışma alanı, responsive tasarım, klavye kısayolu, erişilebilir diyaloglar, bildirim merkezi, profil fotoğrafı URL’si, veri dışa aktarma ve hesap silme.

## Teknoloji ve mimari

Next.js 16 / React 19 / TypeScript strict / Tailwind CSS 4 / Radix tabanlı shadcn tarzı Button / Framer Motion / Recharts / Lucide.

NestJS 11 / Node.js 22 LTS / Prisma 6 / PostgreSQL 17 / Zod / Argon2 / Nodemailer. Redis ilk sürüm için gerekli değil. Tek API örneği hedeflenmiştir; yatay ölçekleme öncesinde in-memory rate limiter paylaşımlı depoya taşınmalıdır.

```text
apps/web/             Next.js uygulaması, sayfa kabuğu ve bileşenler
apps/api/src/auth.ts  Oturum, doğrulama ve parola akışları
apps/api/src/api.ts   Kullanıcıya kapsamlanmış REST uçları
apps/api/src/ledger.ts Finansal sorgular, transferler ve tekrar işleme
apps/api/src/jobs.ts  Zamanlanmış hatırlatıcılar ve bakım
prisma/              Şema, sürümlü SQL migration ve sentetik seed
tests/               Birim ve gerçek PostgreSQL/API entegrasyon testleri
assets/              OFL lisanslı Noto Sans PDF yazı tipi
infra/               Nginx/TLS yapılandırması
.github/workflows/   CI ve elle tetiklenen VDS dağıtımı
```

Bağımlılıklar kök pakette tutulur; Windows’ta npm workspace symlink izni gerekmez. Alt paketler yalnızca uygulama metaverisidir. Komutları depo kökünde çalıştırın.

## Windows yerel kurulum

Gereksinimler: Node.js 22 LTS, Git, Docker Desktop (Linux containers) veya çalışan PostgreSQL 17.

```powershell
git clone https://github.com/RylixHD/moneyflow.git
cd moneyflow
Copy-Item .env.example .env
# .env içindeki POSTGRES_PASSWORD ve DATABASE_URL parolalarını eşleştirin.
npm ci
docker compose --profile dev up -d db mailpit
npm run db:generate
npm run db:migrate
npm run dev
```

Uygulama: `http://localhost:3000`. Yerel e-postalar: `http://localhost:8025`. Mailpit yalnızca geliştirme içindir; kayıt doğrulama bağlantısını buradan açabilirsiniz. API `4000` portundadır; tarayıcı API çağrıları Next.js üzerinden aynı origin ile gider.

PostgreSQL zaten kuruluysa Docker adımını atlayın ve `DATABASE_URL` değerini düzenleyin. SMTP yoksa örnek veriyle giriş yapabilirsiniz; yeni kullanıcı kayıtları için SMTP gerekir.

### Sentetik örnek veri

```powershell
$env:DEMO_PASSWORD='Kendi-en-az-12-karakterli-demo-sifreniz'
npm run db:seed
```

Demo e-postası: `demo@moneyflow.example`. Parola ortamdan alınır, depoda sabit demo şifresi yoktur. Seed mevcut demoyu değiştirmez ve `NODE_ENV=production` ortamında çalışmaz. Ekran görüntülerindeki tüm hesaplar ve tutarlar sentetiktir.

### Kontroller

```powershell
npm run lint
npm run typecheck
npm test
# Entegrasyon testleri için ayrı bir moneyflow_test veritabanı oluşturun.
$env:DATABASE_URL='postgresql://moneyflow:PAROLA@localhost:5432/moneyflow_test'
npm run db:migrate
npm run test:integration
npm run build
npm audit --omit=dev --audit-level=high
```

Entegrasyon testleri gerçek API süreci başlatır; test kullanıcılarını oluşturur ve siler. Adında `moneyflow_test` olmayan veritabanında çalışmayı reddeder. Gerçek finansal veri bulunan bir veritabanını testlere vermeyin.

## Yapılandırma

| Değişken                            | Kullanım                                                            |
| ----------------------------------- | ------------------------------------------------------------------- |
| `DATABASE_URL`                      | PostgreSQL bağlantısı                                               |
| `POSTGRES_PASSWORD`                 | Compose PostgreSQL parolası; URL için güvenli rastgele hex önerilir |
| `APP_ORIGIN`                        | Tam frontend origin; üretimde `https://finance.example.com`         |
| `API_URL`                           | Next.js proxy hedefi; varsayılan `http://localhost:4000`            |
| `SMTP_HOST/PORT/USER/PASSWORD/FROM` | Doğrulama ve sıfırlama e-postaları                                  |
| `OPENAI_API_KEY`                    | Yalnızca sunucuda AI erişimi                                        |
| `OPENAI_MODEL`                      | Erişiminiz olan Responses API modeli                                |

Kullanıcı, Ayarlar’dan AI veri paylaşımını açmalıdır. İşlem açıklaması, e-posta veya hesap kimliği modele gönderilmez; kullanıcı sorusu, kategori adları ve finansal toplamlar gönderilir. Model yanıtları tahmin içerir; deterministik raporların yerine geçmez. Gerçek sağlayıcı çağrısı API anahtarı olmadan doğrulanamaz.

## Linux VDS / HTTPS

1. Depoyu `/opt/moneyflow` altında klonlayın, `.env` oluşturun. Güçlü PostgreSQL parolası, gerçek SMTP ve HTTPS `APP_ORIGIN` girin.
2. Alan adını VDS’ye yönlendirin. Güvenilir CA sertifikasının tam zincirini `infra/certs/fullchain.pem`, anahtarını `infra/certs/privkey.pem` olarak yerleştirin. Bu klasör Git tarafından yok sayılır. Sertifika yenilemesini sunucuda otomatikleştirin.
3. `docker compose build && docker compose up -d` çalıştırın. Migration servisi başarıyla bitmeden API başlamaz. Nginx 80’i HTTPS’e yönlendirir, TLS 1.2/1.3 ve HSTS kullanır.
4. Güvenlik duvarında yalnızca gereken SSH/80/443 portlarını açın. PostgreSQL portu loopback’e bağlıdır; API ve web portları dışarı yayımlanmaz.
5. Günlükler: `docker compose logs --tail=100 api web nginx`. Günlüklerde finansal veri veya API anahtarı yazdırmayın.

GitHub Actions `CI` lint/typecheck/test/build/audit çalıştırır. `Deploy to VDS` iş akışı **manuel** tetiklenir; `production` environment ve `VDS_HOST`, `VDS_USER`, `VDS_SSH_KEY`, `VDS_KNOWN_HOSTS` secrets gerekir. SSH host anahtarı sabitlenir. Sunucu erişimi ve sertifika olmadan dağıtım yapılmış sayılmaz.

## Yedekleme ve geri yükleme

VDS üzerinde günlük `pg_dump` alın, şifreli ayrı konumda saklayın ve 30 günlük saklama politikasını uygulayın. Örnek (Linux):

```bash
mkdir -p backups
docker compose exec -T db pg_dump -U moneyflow -d moneyflow -Fc > "backups/moneyflow-$(date +%F).dump"
```

Geri yüklemeyi önce boş bir doğrulama veritabanında deneyin. Üretimde önce bakım penceresi ve güncel yedek oluşturun; uygulama yazmalarını durdurduktan sonra:

```bash
docker compose stop api web
docker compose exec -T db pg_restore -U moneyflow -d moneyflow --clean --if-exists < backups/CHOSEN-BACKUP.dump
docker compose start api web
```

Kullanıcının hesap silmesi canlı veriyi kalıcı siler; mevcut çevrimdışı yedekler saklama süresi sonunda temizlenir. Yedeklere erişimi sınırlandırın; geri yükleme sırasında silme taleplerini yeniden uygulayın.

## Sınırlar ve yayın öncesi doğrulama

- Bu sürüm manuel finans takibi içindir. Banka entegrasyonu, gerçek ödeme, yatırım işlemi ve isteğe bağlı 2FA dahil değildir.
- Arayüz çalışma alanı TR/EN destekler; başlangıç/kayıt ekranları ve sunucu doğrulama mesajları Türkçe önceliklidir.
- Bildirimler uygulama içindedir; e-posta/push haftalık özet dağıtımı yoktur. E-posta yalnızca kimlik akışlarında kullanılır.
- Bütçe önerileri AI üzerinden üretilir; model erişimi ve kota sağlayıcı hesabına bağlıdır.
- Docker/VDS, SMTP teslimi ve gerçek AI çağrısı kendi hedef ortamınızda doğrulanmalıdır. “Production-ready” etiketi bağımsız güvenlik incelemesinin yerine kullanılmamıştır.

## Kaynaklar

[NestJS güvenlik](https://docs.nestjs.com/security/authentication), [Prisma transactions](https://www.prisma.io/docs/orm/v6/prisma-client/queries/transactions), [OpenAI metin üretimi](https://developers.openai.com/api/docs/guides/text).

MIT lisansı. Noto Sans kendi [OFL lisansı](assets/OFL.txt) kapsamındadır.
