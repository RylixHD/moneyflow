"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { motion } from "framer-motion";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Bell,
  ChartNoAxesCombined,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Wallet,
  X,
  Pencil,
  Repeat2,
  Tags,
  User,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "./ui/button";
import { Analytics } from "./analytics";
type Row = Record<string, any>;
const nav = [
  ["dashboard", "Genel bakış", "Overview", LayoutDashboard],
  ["transactions", "İşlemler", "Transactions", ArrowLeftRight],
  ["budgets", "Bütçeler", "Budgets", ChartNoAxesCombined],
  ["accounts", "Hesaplarım", "Accounts", Wallet],
  ["goals", "Birikim hedefleri", "Savings goals", Target],
  ["subscriptions", "Abonelikler", "Subscriptions", CreditCard],
  ["recurring", "Tekrarlayan işlemler", "Recurring", Repeat2],
  ["categories", "Kategoriler", "Categories", Tags],
  ["ai", "AI finans asistanı", "AI assistant", Sparkles],
  ["reports", "Raporlar", "Reports", ChartNoAxesCombined],
  ["notifications", "Bildirimler", "Notifications", Bell],
  ["profile", "Profil", "Profile", User],
  ["settings", "Ayarlar", "Settings", Settings],
] as const;
const colors = [
  "#a78bfa",
  "#34d399",
  "#60a5fa",
  "#fbbf24",
  "#f472b6",
  "#fb923c",
];
async function api(path: string, method = "GET", data?: unknown) {
  const res = await fetch(`/api/${path}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.message || "İşlem tamamlanamadı.");
  return result;
}
const today = () => new Date().toISOString().slice(0, 10);
const iso = (value: string) => new Date(`${value}T12:00:00Z`).toISOString();
function Logo() {
  return (
    <Link href="/" className="logo">
      <span>
        <ChartNoAxesCombined size={22} />
      </span>
      moneyflow<span className="logo-dot">.</span>
    </Link>
  );
}
function Empty({
  text = "Henüz kayıt yok. İlk kaydını ekleyerek başla.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <CircleDollarSign size={34} />
      <p>{text}</p>
    </div>
  );
}
export default function MoneyFlow() {
  const pathname = usePathname(),
    router = useRouter(),
    page = pathname.split("/")[1] || "landing";
  const [user, setUser] = useState<Row | null>(null),
    [snap, setSnap] = useState<Row | null>(null),
    [currency, setCurrency] = useState("TRY"),
    [month, setMonth] = useState(today().slice(0, 7)),
    [toast, setToast] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [sidebar, setSidebar] = useState(false),
    [modal, setModal] = useState<Row | null>(null),
    [busy, setBusy] = useState(false),
    [tx, setTx] = useState<Row>({ items: [], total: 0, page: 1 }),
    [filters, setFilters] = useState({
      search: "",
      from: "",
      to: "",
      min: "",
      max: "",
      kind: "",
      page: 1,
    }),
    [selected, setSelected] = useState<string[]>([]),
    [history, setHistory] = useState<Row[]>([]);
  const en = snap?.settings?.locale === "en",
    t = (tr: string, eng: string) => (en ? eng : tr);
  const fmt = (v: any, c = currency) =>
    new Intl.NumberFormat(en ? "en-US" : "tr-TR", {
      style: "currency",
      currency: c,
      maximumFractionDigits: 2,
    }).format(Number(v || 0));
  const publicPage = [
    "landing",
    "login",
    "register",
    "forgot",
    "verify",
    "reset",
  ].includes(page);
  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 5000);
  };
  const query = useCallback(
    () =>
      new URLSearchParams(
        Object.entries({ ...filters, currency })
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, String(v)]),
      ).toString(),
    [filters, currency],
  );
  const refresh = useCallback(async () => {
    const [s, rows] = await Promise.all([
      api(`snapshot?currency=${currency}&month=${month}`),
      api(`transactions?${query()}`),
    ]);
    setSnap(s);
    setTx(rows);
    document.documentElement.dataset.theme = s.settings?.theme || "dark";
    document.documentElement.lang = s.settings?.locale || "tr";
  }, [currency, month, query]);
  useEffect(() => {
    if (publicPage) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    api("auth/me")
      .then((u) => {
        if (active) {
          setUser(u);
          setCurrency(u.settings?.currency || "TRY");
        }
      })
      .catch(() => router.replace("/login"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [publicPage, router]);
  useEffect(() => {
    if (user && !publicPage) {
      setError("");
      refresh().catch((e) => setError(e.message));
    }
  }, [user, publicPage, refresh]);
  useEffect(() => {
    if (user && page === "ai")
      api("ai")
        .then(setHistory)
        .catch((e) => setError(e.message));
  }, [user, page]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !publicPage) {
        e.preventDefault();
        setModal({ type: "transactions" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [publicPage]);
  async function action(fn: () => Promise<unknown>, message = "Kaydedildi.") {
    setBusy(true);
    try {
      await fn();
      await refresh();
      notify(message);
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function authSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      if (page === "login") {
        await api("auth/login", "POST", form);
        router.push("/dashboard");
      } else if (page === "register") {
        const r = await api("auth/register", "POST", form);
        setError(r.message);
      } else if (page === "forgot") {
        const r = await api("auth/request-token", "POST", {
          email: form.email,
          kind: form.kind,
        });
        setError(r.message);
      } else {
        const token = new URLSearchParams(window.location.search).get("token");
        const r = await api("auth/consume-token", "POST", {
          token,
          kind: page === "verify" ? "verify" : "reset",
          password: form.password,
        });
        setError(r.message);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveRecord(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const data: Row = Object.fromEntries(new FormData(e.currentTarget));
    const type = modal.type;
    for (const field of [
      "date",
      "deadline",
      "nextDate",
      "nextPayment",
      "fxDate",
    ])
      if (data[field]) data[field] = iso(data[field]);
    if (type === "transactions") {
      data.tags = data.tags
        ? data.tags
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean)
        : [];
      for (const key of [
        "categoryId",
        "destinationId",
        "fxRate",
        "fxSource",
        "fxDate",
      ])
        if (!data[key]) data[key] = null;
    }
    if (type === "budgets") data.rollover = data.rollover === "on";
    if (type === "subscriptions" || type === "recurring")
      data.active = data.active === "on";
    const path =
      type === "transactions"
        ? `transactions${modal.item ? "/" + modal.item.id : ""}`
        : type === "contribute"
          ? `goals/${modal.item.id}/contribute`
          : `resources/${type}${modal.item ? "/" + modal.item.id : ""}`;
    if (
      await action(() =>
        api(path, modal.item && type !== "contribute" ? "PATCH" : "POST", data),
      )
    )
      setModal(null);
  }
  function field(
    name: string,
    label: string,
    type = "text",
    required = true,
    options?: { value: string; label: string }[],
  ) {
    const item = modal?.item;
    const value =
      item?.[name] ??
      (
        {
          currency,
          month,
          date: today(),
          deadline: today(),
          nextDate: today(),
          nextPayment: today(),
          kind: modal?.type === "accounts" ? "BANK" : "EXPENSE",
          period: "MONTHLY",
          opening: "0",
        } as Row
      )[name] ??
      "";
    return (
      <label key={name}>
        {label}
        {options ? (
          <select name={name} defaultValue={value} required={required}>
            {!required && <option value="">—</option>}
            {options.map((o) => (
              <option value={o.value} key={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            name={name}
            type={type}
            step={type === "number" ? "0.01" : undefined}
            min={type === "number" && name !== "opening" ? "0.01" : undefined}
            defaultValue={
              type === "date"
                ? String(value).slice(0, 10)
                : name === "tags" && Array.isArray(value)
                  ? value.join(",")
                  : value
            }
            required={required}
            maxLength={type === "text" ? 100 : undefined}
          />
        )}
      </label>
    );
  }
  const currencies = ["TRY", "USD", "EUR"].map((value) => ({
    value,
    label: value,
  }));
  function recordFields() {
    if (!modal || !snap) return null;
    const type = modal.type;
    const accounts = snap.accounts.map((a: Row) => ({
        value: a.id,
        label: `${a.name} (${a.currency})`,
      })),
      categories = snap.categories.map((a: Row) => ({
        value: a.id,
        label: a.name,
      }));
    return (
      <>
        {["accounts", "categories", "goals", "subscriptions"].includes(type) &&
          field("name", t("Ad", "Name"))}
        {type === "accounts" && (
          <>
            {field("kind", t("Hesap türü", "Account type"), "text", true, [
              { value: "BANK", label: "Banka / Bank" },
              { value: "CASH", label: "Nakit / Cash" },
              { value: "WALLET", label: "Cüzdan / Wallet" },
              { value: "SAVINGS", label: "Birikim / Savings" },
            ])}
            {field(
              "opening",
              t("Açılış bakiyesi", "Opening balance"),
              "number",
            )}
          </>
        )}
        {type === "categories" &&
          field(
            "icon",
            t("İkon (emoji veya kısa ad)", "Icon (emoji or short name)"),
            "text",
            false,
          )}
        {["accounts", "budgets", "goals", "subscriptions"].includes(type) &&
          field(
            "currency",
            t("Para birimi", "Currency"),
            "text",
            true,
            currencies,
          )}
        {["transactions", "recurring"].includes(type) && (
          <>
            {field("description", t("Açıklama", "Description"))}
            {field("kind", t("İşlem türü", "Type"), "text", true, [
              { value: "EXPENSE", label: "Gider / Expense" },
              { value: "INCOME", label: "Gelir / Income" },
              ...(type === "transactions"
                ? [{ value: "TRANSFER", label: "Transfer" }]
                : []),
            ])}
            {field("accountId", t("Hesap", "Account"), "text", true, accounts)}
          </>
        )}
        {["transactions", "budgets"].includes(type) &&
          field(
            "categoryId",
            t("Kategori", "Category"),
            "text",
            type === "budgets",
            categories,
          )}
        {[
          "transactions",
          "budgets",
          "subscriptions",
          "recurring",
          "contribute",
        ].includes(type) && field("amount", t("Tutar", "Amount"), "number")}
        {type === "transactions" && (
          <>
            {field("date", t("Tarih", "Date"), "date")}
            {field(
              "tags",
              t("Etiketler (virgülle ayır)", "Tags (comma separated)"),
              "text",
              false,
            )}
            <details className="full">
              <summary>
                {t(
                  "Transfer ve döviz bilgileri",
                  "Transfer and exchange details",
                )}
              </summary>
              {field(
                "destinationId",
                t("Hedef hesap", "Destination account"),
                "text",
                false,
                accounts,
              )}
              {field(
                "fxRate",
                t("Dönüşüm kuru", "Exchange rate"),
                "text",
                false,
              )}
              {field(
                "fxSource",
                t("Kur kaynağı", "Rate source"),
                "text",
                false,
              )}
              {field("fxDate", t("Kur tarihi", "Rate date"), "date", false)}
            </details>
          </>
        )}
        {type === "budgets" && (
          <>
            {field("month", t("Ay", "Month"), "month")}
            <label className="check">
              <input
                type="checkbox"
                name="rollover"
                defaultChecked={modal.item?.rollover ?? true}
              />
              {t("Yeni aya otomatik taşı", "Renew each month")}
            </label>
          </>
        )}
        {type === "goals" && (
          <>
            {field("target", t("Hedef tutar", "Target amount"), "number")}
            {field("deadline", t("Hedef tarihi", "Target date"), "date")}
          </>
        )}
        {["subscriptions", "recurring"].includes(type) && (
          <>
            {field("period", t("Periyot", "Period"), "text", true, [
              { value: "MONTHLY", label: "Aylık / Monthly" },
              { value: "YEARLY", label: "Yıllık / Yearly" },
            ])}
            {field(
              type === "subscriptions" ? "nextPayment" : "nextDate",
              t("Sonraki tarih", "Next date"),
              "date",
            )}
            <label className="check">
              <input
                type="checkbox"
                name="active"
                defaultChecked={modal.item?.active ?? true}
              />
              {t("Aktif", "Active")}
            </label>
          </>
        )}
        {type === "contribute" && (
          <p className="full muted">
            {t(
              "Katkı, hedef takibidir; hesap bakiyesinden para düşmez. Para taşımak için ayrıca hesaplar arası transfer ekleyin.",
              "Contributions track your goal; they do not debit an account. Record an account transfer separately.",
            )}
          </p>
        )}
      </>
    );
  }
  const chart = (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={snap?.trend.map((r: Row) => ({
          ...r,
          income: Number(r.income),
          expense: Number(r.expense),
        }))}
      >
        <defs>
          <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 5"
          vertical={false}
          stroke="var(--line)"
        />
        <XAxis
          dataKey="month"
          tick={{ fill: "#8b91a7", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => v.slice(5)}
        />
        <YAxis
          tick={{ fill: "#8b91a7", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
        />
        <Tooltip
          contentStyle={{
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 12,
          }}
          formatter={(v: any) => fmt(v)}
        />
        <Area
          type="monotone"
          dataKey="income"
          name={t("Gelir", "Income")}
          stroke="#34d399"
          fill="url(#income)"
          strokeWidth={3}
        />
        <Area
          type="monotone"
          dataKey="expense"
          name={t("Gider", "Expense")}
          stroke="#a78bfa"
          fill="transparent"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
  function txTable() {
    return tx.items.length ? (
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <input
                  aria-label="Tümünü seç"
                  type="checkbox"
                  checked={
                    tx.items.length > 0 && selected.length === tx.items.length
                  }
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? tx.items.map((r: Row) => r.id) : [],
                    )
                  }
                />
              </th>
              <th>{t("İşlem", "Transaction")}</th>
              <th>{t("Kategori", "Category")}</th>
              <th>{t("Hesap", "Account")}</th>
              <th>{t("Tarih", "Date")}</th>
              <th className="right">{t("Tutar", "Amount")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {tx.items.map((r: Row) => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={`${r.description} seç`}
                    checked={selected.includes(r.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, r.id]
                          : selected.filter((x) => x !== r.id),
                      )
                    }
                  />
                </td>
                <td>
                  <span className={`tx-icon ${r.kind.toLowerCase()}`}>
                    {r.kind === "INCOME" ? (
                      <ArrowDownLeft size={17} />
                    ) : r.kind === "TRANSFER" ? (
                      <ArrowLeftRight size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </span>
                  <strong>{r.description}</strong>
                  {r.tags.length > 0 && (
                    <small className="tags">{r.tags.join(" · ")}</small>
                  )}
                </td>
                <td>
                  <span className="badge">
                    {r.category?.name ??
                      (r.kind === "TRANSFER" ? "Transfer" : "—")}
                  </span>
                </td>
                <td>{r.account.name}</td>
                <td>
                  {new Date(r.date).toLocaleDateString(en ? "en-US" : "tr-TR")}
                </td>
                <td
                  className={`right amount ${r.kind === "INCOME" ? "positive" : ""}`}
                >
                  {r.kind === "INCOME" ? "+" : r.kind === "EXPENSE" ? "−" : ""}
                  {fmt(r.amount, r.account.currency)}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    aria-label="Düzenle"
                    onClick={() => setModal({ type: "transactions", item: r })}
                  >
                    <Pencil size={14} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <Empty />
    );
  }
  if (page === "landing")
    return (
      <div className="landing">
        <header>
          <Logo />
          <div className="row">
            <Link href="/login">Giriş yap</Link>
            <Link className="button primary" href="/register">
              Ücretsiz başla <ArrowUpRight size={16} />
            </Link>
          </div>
        </header>
        <main>
          <div className="eyebrow">
            <span className="status-dot" /> PARAN SENİN. KONTROL DE ÖYLE.
          </div>
          <h1>
            Bugünü yönet.
            <br />
            <span>Geleceğine yer aç.</span>
          </h1>
          <p>
            Gelirlerin, harcamaların ve hayallerin.
            <br />
            Finansal hayatının tamamı, tek bir sakin çalışma alanında.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/register">
              Kendi akışını oluştur <ArrowRight size={18} />
            </Link>
            <Link className="button outline" href="/login">
              Hesabıma giriş yap
            </Link>
          </div>
          <div className="hero-visual">
            <div className="mini-top">
              <Logo />
              <span className="badge">Kişisel finans çalışma alanı</span>
            </div>
            <div className="hero-grid">
              <div>
                <span className="muted">DAHA FAZLA NETLİK</span>
                <h2>
                  Her kuruşun
                  <br />
                  bir yönü olsun.
                </h2>
                <p>
                  Hesaplarını birleştir. Bütçeni planla.
                  <br />
                  Hedeflerine adım adım yaklaş.
                </p>
                <div className="hero-bars">
                  {[30, 48, 39, 65, 51, 78, 69, 90, 75, 100, 86, 115].map(
                    (h, i) => (
                      <i key={i} style={{ height: h }} />
                    ),
                  )}
                </div>
              </div>
              <div className="hero-cards">
                <div>
                  <Wallet />
                  <strong>Hesapların bir arada</strong>
                  <small>TRY · USD · EUR</small>
                </div>
                <div>
                  <Target />
                  <strong>Hayallerine bir plan</strong>
                  <small>Birikim hedefleri ve ilerleme takibi</small>
                </div>
                <div>
                  <Sparkles />
                  <strong>Verilerinden içgörü</strong>
                  <small>İzninle çalışan AI asistanı</small>
                </div>
              </div>
            </div>
          </div>
          <div className="features">
            {[
              [
                ShieldCheck,
                "Verilerin sana ait",
                "Güvenli oturumlar ve kişisel veri kontrolü.",
              ],
              [
                ChartNoAxesCombined,
                "Net bir finansal resim",
                "Bütçeler, raporlar ve nakit akışı bir arada.",
              ],
              [
                Target,
                "Küçük adımlar, büyük hedefler",
                "Birikimlerini görünür, hedeflerini ulaşılır kıl.",
              ],
            ].map(([Icon, title, desc]: any) => (
              <article key={title}>
                <Icon />
                <h3>{title}</h3>
                <p>{desc}</p>
              </article>
            ))}
          </div>
        </main>
        <footer>
          © {new Date().getFullYear()} MoneyFlow · Daha bilinçli bir finansal
          yaşam.
        </footer>
      </div>
    );
  if (publicPage)
    return (
      <div className="auth-page">
        <Logo />
        <section className="auth-card">
          <span className="eyebrow">KENDİ AKIŞINA HOŞ GELDİN</span>
          <h1>
            {
              (
                {
                  login: "Tekrar merhaba.",
                  register: "Yeni bir başlangıç.",
                  forgot: "Hesabına geri dön.",
                  verify: "E-postanı doğrula.",
                  reset: "Yeni şifreni belirle.",
                } as Row
              )[page]
            }
          </h1>
          <p className="muted">Finansal hayatını birlikte düzene koyalım.</p>
          <form onSubmit={authSubmit}>
            {page === "register" && (
              <label>
                Ad soyad
                <input
                  name="name"
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
            )}
            {["register", "login", "forgot"].includes(page) && (
              <label>
                E-posta
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </label>
            )}
            {["register", "login", "reset"].includes(page) && (
              <label>
                Şifre
                <input
                  name="password"
                  type="password"
                  required
                  minLength={12}
                  maxLength={128}
                  autoComplete={
                    page === "login" ? "current-password" : "new-password"
                  }
                />
                <small>En az 12 karakter.</small>
              </label>
            )}
            {page === "forgot" && (
              <label>
                İşlem
                <select name="kind">
                  <option value="reset">Şifre sıfırlama</option>
                  <option value="verify">
                    Doğrulama e-postasını yeniden gönder
                  </option>
                </select>
              </label>
            )}
            <Button disabled={busy}>
              {busy
                ? "İşleniyor…"
                : page === "login"
                  ? "Giriş yap"
                  : page === "register"
                    ? "Hesap oluştur"
                    : page === "verify"
                      ? "E-postamı doğrula"
                      : "Gönder"}
              <ArrowRight size={16} />
            </Button>
          </form>
          {error && (
            <p role="status" className="notice">
              {error}
            </p>
          )}
          <div className="auth-links">
            <Link href="/login">Giriş yap</Link>
            <Link href="/register">Kayıt ol</Link>
            <Link href="/forgot">Şifremi unuttum</Link>
          </div>
        </section>
        <small className="muted">
          Banka şifresi veya kart bilgisi istenmez.
        </small>
      </div>
    );
  const title = nav.find((n) => n[0] === page);
  return (
    <div className="app-shell">
      <aside className={sidebar ? "sidebar open" : "sidebar"}>
        <Logo />
        <div className="workspace">
          <div className="avatar">{user?.name?.[0] ?? "M"}</div>
          <div>
            <strong>{t("Kişisel alanım", "Personal space")}</strong>
            <small>MoneyFlow Workspace</small>
          </div>
        </div>
        <small className="nav-label">{t("ÇALIŞMA ALANI", "WORKSPACE")}</small>
        <nav>
          {nav.map(([slug, tr, eng, Icon]) => (
            <Link
              className={page === slug ? "active" : ""}
              href={`/${slug}`}
              key={slug}
              onClick={() => setSidebar(false)}
            >
              <Icon size={18} />
              {en ? eng : tr}
              {slug === "ai" && <span className="tiny-badge">AI</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure">
            <ShieldCheck size={16} />
            {t("Kontrol her zaman sende.", "Always in your control.")}
          </div>
          <button
            onClick={async () => {
              await api("auth/logout", "POST");
              setUser(null);
              router.push("/login");
            }}
          >
            <LogOut size={16} />
            {t("Çıkış yap", "Sign out")}
          </button>
        </div>
      </aside>
      {sidebar && <div className="scrim" onClick={() => setSidebar(false)} />}
      <div className="main-shell">
        <header className="topbar">
          <div className="row">
            <Button
              variant="ghost"
              className="mobile-menu"
              onClick={() => setSidebar(!sidebar)}
              aria-label="Menü"
            >
              <Menu />
            </Button>
            <span className="breadcrumb">
              {t("Çalışma alanım", "Workspace")} <ChevronRight size={13} />{" "}
              <b>{title?.[en ? 2 : 1] ?? "MoneyFlow"}</b>
            </span>
          </div>
          <div className="row">
            <span className="live">
              <span className="status-dot" />
              {t("Kişisel finans", "Personal finance")}
            </span>
            <Button
              variant="ghost"
              aria-label="Tema değiştir"
              onClick={() => {
                if (snap)
                  action(() =>
                    api("settings", "PATCH", {
                      ...snap.settings,
                      userId: undefined,
                      theme:
                        snap.settings?.theme === "light" ? "dark" : "light",
                    }),
                  );
              }}
            >
              {snap?.settings?.theme === "light" ? (
                <Moon size={18} />
              ) : (
                <Sun size={18} />
              )}
            </Button>
            <Link href="/notifications" className="bell">
              <Bell size={18} />
              {snap?.notifications.some((n: Row) => !n.read) && <i />}
            </Link>
            <Link
              href="/profile"
              className="avatar"
              style={
                snap?.settings?.avatarUrl
                  ? {
                      backgroundImage: `url(${JSON.stringify(snap.settings.avatarUrl)})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
              aria-label={t("Profil", "Profile")}
            >
              {snap?.settings?.avatarUrl ? "" : (user?.name?.[0] ?? "M")}
            </Link>
          </div>
        </header>
        <main className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {page === "dashboard"
                  ? t(
                      "FİNANSAL KONTROL MERKEZİN",
                      "YOUR FINANCIAL COMMAND CENTER",
                    )
                  : "MONEYFLOW / " + page.toUpperCase()}
              </div>
              <h1>
                {page === "dashboard"
                  ? `${t("Merhaba", "Hello")}, ${user?.name?.split(" ")[0] ?? "…"} 👋`
                  : title?.[en ? 2 : 1]}
              </h1>
              <p>
                {page === "dashboard"
                  ? t(
                      "Paranın nereye gittiğini bil. Bir sonraki adımını güvenle at.",
                      "Know where your money goes. Take your next step with confidence.",
                    )
                  : t(
                      "Finansal hayatının her detayı, kontrolün altında.",
                      "Every detail of your financial life, in your control.",
                    )}
              </p>
            </div>
            <div className="row controls">
              <select
                aria-label="Para birimi"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.value}>{c.value}</option>
                ))}
              </select>
              <input
                aria-label="Ay"
                type="month"
                value={month}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
              <Button
                onClick={() =>
                  setModal({
                    type: [
                      "accounts",
                      "budgets",
                      "goals",
                      "subscriptions",
                      "recurring",
                      "categories",
                    ].includes(page)
                      ? page
                      : "transactions",
                  })
                }
              >
                <Plus size={17} />
                {t("Yeni kayıt", "Add new")}
              </Button>
            </div>
          </div>
          {error && (
            <div className="notice" role="alert">
              {error}{" "}
              <Button
                variant="outline"
                onClick={() =>
                  refresh()
                    .then(() => setError(""))
                    .catch((e) => setError(e.message))
                }
              >
                {t("Tekrar dene", "Retry")}
              </Button>
            </div>
          )}
          {loading || !snap ? (
            <div className="loading">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          ) : (
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {["dashboard", "reports"].includes(page) && (
                <>
                  <div className="stats">
                    {[
                      [
                        t("Toplam bakiye", "Total balance"),
                        snap.totals.balance,
                        Wallet,
                        "balance",
                      ],
                      [
                        t("Bu ayki gelir", "Monthly income"),
                        snap.totals.income,
                        ArrowDownLeft,
                        "income",
                      ],
                      [
                        t("Bu ayki gider", "Monthly expenses"),
                        snap.totals.expense,
                        ArrowUpRight,
                        "expense",
                      ],
                      [
                        t("Net nakit akışı", "Net cash flow"),
                        snap.totals.net,
                        ChartNoAxesCombined,
                        "net",
                      ],
                    ].map(([label, value, Icon, kind]: any) => (
                      <article className={`stat ${kind}`} key={kind}>
                        <div>
                          <span>{label}</span>
                          <Icon size={18} />
                        </div>
                        <strong>{fmt(value)}</strong>
                        <small>
                          {kind === "income" || kind === "expense"
                            ? (() => {
                                const prev = Number(
                                  snap.totals[
                                    kind === "income"
                                      ? "previousIncome"
                                      : "previousExpense"
                                  ],
                                );
                                return prev
                                  ? `${(((Number(value) - prev) / prev) * 100).toFixed(1)}% ${t("önceki aya göre", "vs previous month")}`
                                  : t(
                                      "Önceki ay karşılaştırması yok",
                                      "No previous month comparison",
                                    );
                              })()
                            : kind === "balance"
                              ? t(
                                  "Seçili para birimindeki hesaplar",
                                  "Accounts in selected currency",
                                )
                              : t(
                                  "Gelir − gider · transferler hariç",
                                  "Income − expense · excludes transfers",
                                )}
                        </small>
                      </article>
                    ))}
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel cashflow">
                      <div className="panel-head">
                        <div>
                          <h2>{t("Nakit akışın", "Your cash flow")}</h2>
                          <p>
                            {t(
                              "Son 12 ayın gelir ve gider görünümü",
                              "Income and expenses over the last 12 months",
                            )}
                          </p>
                        </div>
                        <span className="badge">{currency}</span>
                      </div>
                      {chart}
                      <div className="legend">
                        <span>
                          <i style={{ background: colors[1] }} />
                          {t("Gelir", "Income")}
                        </span>
                        <span>
                          <i style={{ background: colors[0] }} />
                          {t("Gider", "Expense")}
                        </span>
                      </div>
                    </section>
                    <section className="panel">
                      <div className="panel-head">
                        <h2>{t("Harcama dağılımı", "Spending breakdown")}</h2>
                        <span className="badge">{month}</span>
                      </div>
                      {snap.spending.length ? (
                        <>
                          <div className="donut">
                            <ResponsiveContainer width="100%" height={185}>
                              <PieChart>
                                <Pie
                                  data={snap.spending.map((r: Row) => ({
                                    ...r,
                                    value: Number(r.amount),
                                  }))}
                                  dataKey="value"
                                  innerRadius={58}
                                  outerRadius={79}
                                  paddingAngle={4}
                                  stroke="none"
                                >
                                  {snap.spending.map((r: Row, i: number) => (
                                    <Cell
                                      key={r.name}
                                      fill={colors[i % colors.length]}
                                    />
                                  ))}
                                </Pie>
                                <Tooltip
                                  formatter={(v: any) => fmt(v)}
                                  contentStyle={{
                                    background: "var(--card)",
                                    borderColor: "var(--line)",
                                    borderRadius: 12,
                                  }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                            <div className="donut-center">
                              <small>{t("TOPLAM", "TOTAL")}</small>
                              <b>{fmt(snap.totals.expense)}</b>
                            </div>
                          </div>
                          <div className="category-list">
                            {snap.spending.map((r: Row, i: number) => (
                              <div key={r.name}>
                                <span>
                                  <i
                                    style={{
                                      background: colors[i % colors.length],
                                    }}
                                  />
                                  {r.name}
                                </span>
                                <strong>{fmt(r.amount)}</strong>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Empty
                          text={t(
                            "Bu ay henüz harcama yok.",
                            "No expenses this month.",
                          )}
                        />
                      )}
                    </section>
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel">
                      <div className="panel-head">
                        <h2>{t("Bütçene sadık kal", "Stay on budget")}</h2>
                        <Link href="/budgets">
                          {t("Tümünü gör", "View all")} ↗
                        </Link>
                      </div>
                      {snap.budgets.length ? (
                        snap.budgets.slice(0, 4).map((b: Row) => (
                          <div className="budget-line" key={b.id}>
                            <div>
                              <strong>{b.category.name}</strong>
                              <span>
                                {fmt(b.spent)} <small>/ {fmt(b.amount)}</small>
                              </span>
                            </div>
                            <div className="progress">
                              <i
                                style={{
                                  width: `${Math.min(100, (Number(b.spent) / Number(b.amount)) * 100)}%`,
                                  background:
                                    Number(b.spent) > Number(b.amount)
                                      ? "#fb7185"
                                      : undefined,
                                }}
                              />
                            </div>
                            <small>
                              {Math.round(
                                (Number(b.spent) / Number(b.amount)) * 100,
                              )}
                              % ·{" "}
                              {fmt(
                                Math.max(0, Number(b.amount) - Number(b.spent)),
                              )}{" "}
                              {t("kaldı", "remaining")}
                            </small>
                          </div>
                        ))
                      ) : (
                        <Empty />
                      )}
                    </section>
                    <section className="panel insight-panel">
                      <div className="ai-icon">
                        <Sparkles />
                      </div>
                      <span className="eyebrow">MONEYFLOW INTELLIGENCE</span>
                      <h2>
                        {t(
                          "Rakamların ötesini gör.",
                          "See beyond the numbers.",
                        )}
                      </h2>
                      <p>
                        {t(
                          "Harcama alışkanlıklarını anla, bütçene yeni bir bakış açısı kazan. Finansal özetlerin, izninle AI asistanına dönüşsün.",
                          "Understand your spending and find a new perspective on your budget. Share your summaries with your AI assistant, only with your permission.",
                        )}
                      </p>
                      <Link className="button outline" href="/ai">
                        {t("Asistanına sor", "Ask your assistant")}{" "}
                        <ArrowUpRight size={16} />
                      </Link>
                      <span className="muted">
                        {t("Toplam hedef birikimi", "Total goal savings")}:{" "}
                        {fmt(snap.totals.savings)}
                      </span>
                    </section>
                  </div>
                </>
              )}
              {["dashboard", "transactions"].includes(page) && (
                <section className="panel transactions-panel">
                  <div className="panel-head">
                    <div>
                      <h2>{t("Son işlemler", "Recent transactions")}</h2>
                      <p>
                        {tx.total}{" "}
                        {t(
                          "kayıt · seçili para birimi",
                          "records · selected currency",
                        )}
                      </p>
                    </div>
                    <div className="row">
                      {selected.length > 0 && (
                        <Button
                          variant="destructive"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(`${selected.length} kayıt silinsin mi?`)
                            )
                              action(() =>
                                api("transactions/delete", "POST", {
                                  ids: selected,
                                }),
                              ).then(() => setSelected([]));
                          }}
                        >
                          <Trash2 size={15} />
                          {selected.length}
                        </Button>
                      )}
                      <a
                        className="button outline"
                        href={`/api/export/csv?${query()}`}
                      >
                        <Download size={15} /> CSV
                      </a>
                    </div>
                  </div>
                  {page === "transactions" && (
                    <>
                      <div className="filters">
                        <label className="search">
                          <Search size={16} />
                          <input
                            placeholder={t(
                              "İşlem ara…",
                              "Search transactions…",
                            )}
                            value={filters.search}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                search: e.target.value,
                                page: 1,
                              })
                            }
                          />
                        </label>
                        {(["from", "to"] as const).map((k) => (
                          <label key={k}>
                            {k === "from"
                              ? t("Başlangıç", "From")
                              : t("Bitiş", "To")}
                            <input
                              type="date"
                              value={filters[k]}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  [k]: e.target.value,
                                  page: 1,
                                })
                              }
                            />
                          </label>
                        ))}
                        {(["min", "max"] as const).map((k) => (
                          <label key={k}>
                            {k === "min" ? "Min" : "Max"}
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={filters[k]}
                              onChange={(e) =>
                                setFilters({
                                  ...filters,
                                  [k]: e.target.value,
                                  page: 1,
                                })
                              }
                            />
                          </label>
                        ))}
                        <label>
                          {t("Tür", "Type")}
                          <select
                            value={filters.kind}
                            onChange={(e) =>
                              setFilters({
                                ...filters,
                                kind: e.target.value,
                                page: 1,
                              })
                            }
                          >
                            <option value="">{t("Tümü", "All")}</option>
                            <option value="INCOME">
                              {t("Gelir", "Income")}
                            </option>
                            <option value="EXPENSE">
                              {t("Gider", "Expense")}
                            </option>
                            <option value="TRANSFER">Transfer</option>
                          </select>
                        </label>
                      </div>
                      <details className="import">
                        <summary>{t("CSV içe aktar", "Import CSV")}</summary>
                        <p className="muted">
                          {t(
                            "Dışa aktarılan CSV biçimini kullanın. Hesap ve kategori kimlikleri size ait olmalı. En fazla 1000 satır; aktarım tek parça halinde kaydedilir.",
                            "Use the exported CSV format. Account and category IDs must belong to you. Maximum 1,000 rows, imported atomically.",
                          )}
                        </p>
                        <input
                          aria-label="CSV dosyası"
                          type="file"
                          accept=".csv"
                          disabled={busy}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file)
                              await action(
                                async () =>
                                  api("import", "POST", {
                                    csv: await file.text(),
                                  }),
                                t("İçe aktarıldı.", "Imported."),
                              );
                            e.target.value = "";
                          }}
                        />
                      </details>
                    </>
                  )}
                  {txTable()}
                  <div className="pagination">
                    <span>
                      {t("Sayfa", "Page")} {filters.page} /{" "}
                      {Math.max(1, Math.ceil(tx.total / 25))}
                    </span>
                    <div className="row">
                      <Button
                        variant="ghost"
                        disabled={filters.page === 1}
                        onClick={() => {
                          setSelected([]);
                          setFilters({ ...filters, page: filters.page - 1 });
                        }}
                      >
                        <ChevronLeft size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={filters.page * 25 >= tx.total}
                        onClick={() => {
                          setSelected([]);
                          setFilters({ ...filters, page: filters.page + 1 });
                        }}
                      >
                        <ChevronRight size={16} />
                      </Button>
                    </div>
                  </div>
                </section>
              )}
              {[
                "accounts",
                "budgets",
                "goals",
                "subscriptions",
                "recurring",
                "categories",
              ].includes(page) && (
                <div className="resource-grid">
                  {snap[page].length ? (
                    snap[page].map((r: Row, i: number) => (
                      <article
                        className={`panel resource-card ${page === "accounts" ? "account-card" : ""}`}
                        key={r.id}
                      >
                        <div className="panel-head">
                          <span
                            className="resource-icon"
                            style={{ color: colors[i % colors.length] }}
                          >
                            {page === "categories" ? (
                              r.icon
                            ) : page === "goals" ? (
                              <Target />
                            ) : (
                              <Wallet />
                            )}
                          </span>
                          <div className="row">
                            <Button
                              variant="ghost"
                              onClick={() => setModal({ type: page, item: r })}
                              aria-label="Düzenle"
                            >
                              <Pencil size={15} />
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label="Sil"
                              onClick={() => {
                                if (
                                  confirm(
                                    t(
                                      "Bu kayıt silinsin mi?",
                                      "Delete this record?",
                                    ),
                                  )
                                )
                                  action(() =>
                                    api(`resources/${page}/${r.id}`, "DELETE"),
                                  );
                              }}
                            >
                              <Trash2 size={15} />
                            </Button>
                          </div>
                        </div>
                        <h2>{r.name ?? r.category?.name ?? r.description}</h2>
                        {page === "accounts" && (
                          <>
                            <span className="muted">
                              {r.kind} · {r.currency}
                            </span>
                            <div className="big-number">
                              {fmt(r.balance, r.currency)}
                            </div>
                            <small className="muted">
                              {t("Hesap kimliği", "Account ID")}: {r.id}
                            </small>
                          </>
                        )}
                        {page === "categories" && (
                          <small className="muted">ID: {r.id}</small>
                        )}
                        {page === "budgets" && (
                          <>
                            <div className="big-number">
                              {fmt(r.spent, r.currency)}{" "}
                              <small>/ {fmt(r.amount, r.currency)}</small>
                            </div>
                            <div className="progress">
                              <i
                                style={{
                                  width: `${Math.min(100, (Number(r.spent) / Number(r.amount)) * 100)}%`,
                                }}
                              />
                            </div>
                            <p>
                              {Math.round(
                                (Number(r.spent) / Number(r.amount)) * 100,
                              )}
                              % · {r.month}
                            </p>
                            {Number(r.spent) > Number(r.amount) && (
                              <span className="negative">
                                {t("Bütçe aşıldı", "Budget exceeded")}
                              </span>
                            )}
                          </>
                        )}
                        {page === "goals" && (
                          <>
                            <div className="big-number">
                              {fmt(r.saved, r.currency)}
                            </div>
                            <p className="muted">
                              {t("Hedef", "Target")}:{" "}
                              {fmt(r.target, r.currency)} ·{" "}
                              {r.deadline.slice(0, 10)}
                            </p>
                            <p className="muted">
                              {t("Tahmini tamamlanma", "Estimated completion")}:{" "}
                              {r.estimatedDate
                                ? r.estimatedDate.slice(0, 10)
                                : "—"}
                              <br />
                              <small>
                                {t(
                                  "Geçmiş katkı hızı sürerse; en az 30 günlük gözlem varsayılır.",
                                  "Assumes historical contribution pace continues, with a minimum 30-day observation window.",
                                )}
                              </small>
                            </p>
                            <div className="progress">
                              <i
                                style={{
                                  width: `${Math.min(100, (Number(r.saved) / Number(r.target)) * 100)}%`,
                                }}
                              />
                            </div>
                            <p>
                              {Math.round(
                                (Number(r.saved) / Number(r.target)) * 100,
                              )}
                              % ·{" "}
                              {fmt(
                                Math.max(0, Number(r.target) - Number(r.saved)),
                                r.currency,
                              )}{" "}
                              {t("kaldı", "remaining")}
                            </p>
                            <Button
                              variant="outline"
                              onClick={() =>
                                setModal({ type: "contribute", item: r })
                              }
                            >
                              <Plus size={16} />
                              {t("Birikim ekle", "Add contribution")}
                            </Button>
                          </>
                        )}
                        {["subscriptions", "recurring"].includes(page) && (
                          <>
                            <div className="big-number">
                              {fmt(
                                r.amount,
                                r.currency ??
                                  snap.accounts.find(
                                    (a: Row) => a.id === r.accountId,
                                  )?.currency,
                              )}
                              <small>
                                {" "}
                                /{" "}
                                {r.period === "YEARLY"
                                  ? t("yıl", "year")
                                  : t("ay", "month")}
                              </small>
                            </div>
                            <p className="muted">
                              {t("Sonraki tarih", "Next date")}:{" "}
                              {(r.nextPayment ?? r.nextDate).slice(0, 10)}
                            </p>
                            {page === "subscriptions" && (
                              <p>
                                {t("Yıllık maliyet", "Annual cost")}:{" "}
                                {fmt(
                                  Number(r.amount) *
                                    (r.period === "MONTHLY" ? 12 : 1),
                                  r.currency,
                                )}
                              </p>
                            )}
                            <span className="badge">
                              {r.active
                                ? t("Aktif", "Active")
                                : t("Pasif", "Inactive")}
                            </span>
                          </>
                        )}
                      </article>
                    ))
                  ) : (
                    <section className="panel full">
                      <Empty />
                    </section>
                  )}
                </div>
              )}
              {page === "reports" && (
                <Analytics
                  daily={snap.daily ?? []}
                  currency={currency}
                  en={en}
                />
              )}
              {page === "reports" && (
                <section className="panel">
                  <h2>
                    {t("Raporunu yanında götür", "Take your report with you")}
                  </h2>
                  <p className="muted">
                    {t(
                      "Tarih aralığını seç. Tüm çıktılar seçili para birimindeki gerçek işlemlerden oluşturulur.",
                      "Choose a date range. Exports contain actual transactions in the selected currency.",
                    )}
                  </p>
                  <div className="row">
                    {(["from", "to"] as const).map((k) => (
                      <label key={k}>
                        {k === "from"
                          ? t("Başlangıç", "From")
                          : t("Bitiş", "To")}
                        <input
                          type="date"
                          value={filters[k]}
                          onChange={(e) =>
                            setFilters({ ...filters, [k]: e.target.value })
                          }
                        />
                      </label>
                    ))}
                    {["csv", "xlsx", "pdf"].map((format) => (
                      <a
                        className="button outline"
                        key={format}
                        href={`/api/export/${format}?${query()}`}
                      >
                        <Download size={16} />
                        {format.toUpperCase()}
                      </a>
                    ))}
                  </div>
                  <p>
                    {t("Tasarruf oranı", "Savings rate")}:{" "}
                    {Number(snap.totals.income) > 0
                      ? (
                          (Number(snap.totals.net) /
                            Number(snap.totals.income)) *
                          100
                        ).toFixed(1) + "%"
                      : "—"}
                  </p>
                </section>
              )}
              {page === "ai" && (
                <section className="panel assistant">
                  <div className="ai-icon">
                    <Sparkles />
                  </div>
                  <h2>
                    {t(
                      "Finansal hayatını konuşalım.",
                      "Let’s talk about your finances.",
                    )}
                  </h2>
                  <p className="muted">
                    {t(
                      "Yalnızca seçili dönemin toplamları, kategori harcamaları ve trendleri paylaşılır. İşlem açıklamaları ve kimlik bilgileri gönderilmez. Günlük sınır: 10 istek.",
                      "Only period totals, category spending and trends are shared. Transaction descriptions and identity details are excluded. Daily limit: 10 requests.",
                    )}
                  </p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const question = String(
                        new FormData(form).get("question"),
                      );
                      setBusy(true);
                      try {
                        await api("ai", "POST", { question, currency, month });
                        setHistory(await api("ai"));
                        form.reset();
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <textarea
                      name="question"
                      required
                      minLength={3}
                      maxLength={1000}
                      placeholder={t(
                        "Bu ay daha fazla biriktirmek için ne yapabilirim?",
                        "How can I save more this month?",
                      )}
                    />
                    <Button disabled={busy}>
                      <Sparkles size={17} />
                      {busy
                        ? t("Analiz ediliyor…", "Analyzing…")
                        : t("Asistana sor", "Ask assistant")}
                    </Button>
                  </form>
                  {history.map((h) => (
                    <article className="chat-item" key={h.id}>
                      <strong>{h.question}</strong>
                      <p>{h.answer}</p>
                      <small className="muted">
                        {new Date(h.createdAt).toLocaleString()}
                      </small>
                    </article>
                  ))}
                </section>
              )}
              {page === "notifications" && (
                <section className="panel">
                  {snap.notifications.length ? (
                    snap.notifications.map((n: Row) => (
                      <div
                        className={`notification ${n.read ? "read" : ""}`}
                        key={n.id}
                      >
                        <Bell size={19} />
                        <div>
                          <p>{n.message}</p>
                          <small className="muted">
                            {new Date(n.createdAt).toLocaleString()}
                          </small>
                        </div>
                        {!n.read && (
                          <Button
                            variant="ghost"
                            aria-label="Okundu işaretle"
                            onClick={() =>
                              action(() =>
                                api(`notifications/${n.id}`, "PATCH", {}),
                              )
                            }
                          >
                            <Check size={18} />
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <Empty
                      text={t(
                        "Her şey sakin. Yeni bildirim yok.",
                        "All quiet. No new notifications.",
                      )}
                    />
                  )}
                </section>
              )}
              {page === "settings" && (
                <section className="panel settings-panel">
                  <h2>{t("Sana göre MoneyFlow", "Make MoneyFlow yours")}</h2>
                  <form
                    key={JSON.stringify(snap.settings)}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const d: Row = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      d.notifications = d.notifications === "on";
                      d.aiConsent = d.aiConsent === "on";
                      await action(() => api("settings", "PATCH", d));
                    }}
                  >
                    <label>
                      {t("Tema", "Theme")}
                      <select name="theme" defaultValue={snap.settings?.theme}>
                        <option value="dark">Koyu / Dark</option>
                        <option value="light">Açık / Light</option>
                      </select>
                    </label>
                    <label>
                      {t("Dil", "Language")}
                      <select
                        name="locale"
                        defaultValue={snap.settings?.locale}
                      >
                        <option value="tr">Türkçe</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <label>
                      {t("Varsayılan para birimi", "Default currency")}
                      <select
                        name="currency"
                        defaultValue={snap.settings?.currency}
                      >
                        {currencies.map((c) => (
                          <option key={c.value}>{c.value}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t(
                        "Profil fotoğrafı HTTPS bağlantısı",
                        "Profile photo HTTPS URL",
                      )}
                      <input
                        name="avatarUrl"
                        type="url"
                        defaultValue={snap.settings?.avatarUrl}
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="notifications"
                        defaultChecked={snap.settings?.notifications}
                      />
                      {t("Uygulama içi bildirimler", "In-app notifications")}
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="aiConsent"
                        defaultChecked={snap.settings?.aiConsent}
                      />
                      {t(
                        "Özet finansal verilerimin OpenAI ile paylaşılmasına izin veriyorum.",
                        "I consent to sharing financial summaries with OpenAI.",
                      )}
                    </label>
                    <Button disabled={busy}>
                      {t("Tercihleri kaydet", "Save preferences")}
                    </Button>
                  </form>
                  <hr />
                  <h2>{t("Veri kontrolü", "Data controls")}</h2>
                  <a
                    className="button outline"
                    href="/api/personal-data"
                    download="moneyflow-personal-data.json"
                  >
                    <Download size={16} />
                    {t("Tüm verilerimi indir", "Download all my data")}
                  </a>
                  <details className="delete-account">
                    <summary>
                      {t(
                        "Hesabımı kalıcı olarak sil",
                        "Permanently delete my account",
                      )}
                    </summary>
                    <p>
                      {t(
                        "Bu işlem geri alınamaz. Tüm finansal kayıtların silinir.",
                        "This cannot be undone. All financial records will be deleted.",
                      )}
                    </p>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (
                          !confirm(
                            t(
                              "Tüm veriler silinecek. Devam edilsin mi?",
                              "All data will be deleted. Continue?",
                            ),
                          )
                        )
                          return;
                        try {
                          await api(
                            "delete-account",
                            "POST",
                            Object.fromEntries(new FormData(e.currentTarget)),
                          );
                          setUser(null);
                          router.push("/");
                        } catch (e) {
                          notify((e as Error).message);
                        }
                      }}
                    >
                      <label>
                        {t("Şifren", "Your password")}
                        <input type="password" name="password" required />
                      </label>
                      <Button variant="destructive">
                        {t("Hesabı ve verileri sil", "Delete account and data")}
                      </Button>
                    </form>
                  </details>
                </section>
              )}
              {page === "profile" && (
                <section className="panel settings-panel">
                  <h2>{t("Profil bilgilerin", "Your profile")}</h2>
                  <p className="muted">{user?.email}</p>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const data: Row = Object.fromEntries(
                        new FormData(e.currentTarget),
                      );
                      if (!data.newPassword) {
                        delete data.newPassword;
                        delete data.currentPassword;
                      }
                      setBusy(true);
                      try {
                        await api("profile", "PATCH", data);
                        if (data.newPassword) {
                          setUser(null);
                          router.push("/login");
                        } else {
                          setUser(await api("auth/me"));
                          notify(t("Profil güncellendi.", "Profile updated."));
                        }
                      } catch (e) {
                        notify((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <label>
                      {t("Ad soyad", "Full name")}
                      <input
                        name="name"
                        defaultValue={user?.name}
                        required
                        maxLength={100}
                      />
                    </label>
                    <label>
                      {t(
                        "Mevcut şifre (değiştirmek için)",
                        "Current password (to change)",
                      )}
                      <input
                        type="password"
                        name="currentPassword"
                        autoComplete="current-password"
                      />
                    </label>
                    <label>
                      {t(
                        "Yeni şifre (isteğe bağlı)",
                        "New password (optional)",
                      )}
                      <input
                        type="password"
                        name="newPassword"
                        minLength={12}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </label>
                    <Button disabled={busy}>
                      {t("Profili güncelle", "Update profile")}
                    </Button>
                  </form>
                </section>
              )}
              {!title && (
                <Empty
                  text={t(
                    "Sayfa bulunamadı. Menüden bir sayfa seçin.",
                    "Page not found. Choose a page from the menu.",
                  )}
                />
              )}
            </motion.div>
          )}
          <footer className="app-footer">
            MoneyFlow ·{" "}
            {t(
              "Daha bilinçli bir finansal yaşam.",
              "A more mindful financial life.",
            )}
            <span>Ctrl / ⌘ + Enter: {t("Yeni işlem", "New transaction")}</span>
          </footer>
        </main>
      </div>
      <Dialog.Root
        open={!!modal}
        onOpenChange={(open) => !open && setModal(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <div className="panel-head">
              <Dialog.Title>
                {modal?.type === "contribute"
                  ? t("Birikim ekle", "Add contribution")
                  : modal?.item
                    ? t("Kaydı düzenle", "Edit record")
                    : t("Yeni kayıt oluştur", "Create new record")}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" aria-label="Kapat">
                  <X size={20} />
                </Button>
              </Dialog.Close>
            </div>
            <Dialog.Description className="muted">
              {t(
                "Bilgiler güvenli şekilde hesabına kaydedilir.",
                "Details are saved securely to your account.",
              )}
            </Dialog.Description>
            <form onSubmit={saveRecord} className="record-form">
              {recordFields()}
              <div className="full form-actions">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setModal(null)}
                >
                  {t("Vazgeç", "Cancel")}
                </Button>
                <Button disabled={busy}>
                  {busy ? t("Kaydediliyor…", "Saving…") : t("Kaydet", "Save")}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Kapat" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
