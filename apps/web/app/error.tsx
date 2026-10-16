"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <h1>Bir şeyler ters gitti.</h1>
      <p>İşlem tamamlanamadı. Tekrar deneyebilirsiniz.</p>
      <button onClick={reset}>Tekrar dene</button>
    </main>
  );
}
