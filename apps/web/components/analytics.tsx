"use client";
import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "./ui/button";
type Daily = { date: string; income: string; expense: string };
export function Analytics({
  daily,
  currency,
  en,
}: {
  daily: Daily[];
  currency: string;
  en: boolean;
}) {
  const [period, setPeriod] = useState("month"),
    [report, setReport] = useState<any>(null),
    [error, setError] = useState("");
  const fmt = (value: any) =>
    new Intl.NumberFormat(en ? "en-US" : "tr-TR", {
      style: "currency",
      currency,
    }).format(Number(value));
  useEffect(() => {
    const until = new Date(),
      from = new Date(until);
    if (period === "week") from.setUTCDate(from.getUTCDate() - 6);
    else if (period === "year") {
      from.setUTCMonth(0);
      from.setUTCDate(1);
    } else from.setUTCDate(1);
    let active = true;
    setError("");
    fetch(
      `/api/report?currency=${currency}&from=${from.toISOString().slice(0, 10)}&to=${until.toISOString().slice(0, 10)}`,
    )
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.message);
        if (active) setReport(data);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [currency, period]);
  return (
    <>
      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <div>
            <h2>
              {en ? "Daily income and expenses" : "Günlük gelir ve giderler"}
            </h2>
            <p>
              {daily[0]?.date.slice(0, 7)} · {currency}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={daily.map((d) => ({
              ...d,
              income: Number(d.income),
              expense: Number(d.expense),
            }))}
          >
            <CartesianGrid
              vertical={false}
              stroke="var(--line)"
              strokeDasharray="3 5"
            />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => v.slice(-2)}
              tick={{ fill: "#8c93a7", fontSize: 10 }}
            />
            <YAxis tick={{ fill: "#8c93a7", fontSize: 10 }} />
            <Tooltip
              formatter={(v: any) => fmt(v)}
              contentStyle={{
                background: "var(--card)",
                borderColor: "var(--line)",
                borderRadius: 10,
              }}
            />
            <Bar
              dataKey="income"
              name={en ? "Income" : "Gelir"}
              fill="#45d6a2"
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="expense"
              name={en ? "Expenses" : "Gider"}
              fill="#a78bfa"
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>
      <section className="panel" style={{ marginBottom: 22 }}>
        <div className="panel-head">
          <h2>
            {en
              ? "Period report · through today"
              : "Dönem raporu · bugüne kadar"}
          </h2>
          <div className="row">
            {[
              ["week", en ? "7 days" : "7 gün"],
              ["month", en ? "Month" : "Ay"],
              ["year", en ? "Year" : "Yıl"],
            ].map(([key, label]) => (
              <Button
                key={key}
                variant={period === key ? "default" : "outline"}
                onClick={() => setPeriod(key)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        {error ? (
          <p role="alert">{error}</p>
        ) : report ? (
          <>
            <div className="stats">
              {[
                [en ? "Income" : "Gelir", fmt(report.income)],
                [en ? "Expenses" : "Gider", fmt(report.expense)],
                [en ? "Net flow" : "Net akış", fmt(report.net)],
                [
                  en ? "Savings rate" : "Tasarruf oranı",
                  report.savingsRate === null ? "—" : `${report.savingsRate}%`,
                ],
              ].map(([label, value]) => (
                <div key={label} className="stat">
                  <div>{label}</div>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
            <p className="muted">
              {en ? "Highest spending day" : "En çok harcanan gün"}:{" "}
              {report.highestDay?.date ?? "—"}{" "}
              {report.highestDay ? `· ${fmt(report.highestDay.amount)}` : ""}
            </p>
            <div className="category-list">
              {report.categories.map((c: any) => (
                <div key={c.name}>
                  <span>{c.name}</span>
                  <strong>{fmt(c.amount)}</strong>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="muted">{en ? "Loading…" : "Yükleniyor…"}</p>
        )}
      </section>
    </>
  );
}
