"use client"; // Error boundaries must be Client Components

// The last line of defence: the root layout itself failed. Must render its own
// <html>/<body> (it replaces the layout), so it can't lean on globals.css.
export default function GlobalError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif", background: "#f4f7fc", color: "#171534" }}>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 420, width: "100%", background: "#fff", borderRadius: 18, padding: 28, textAlign: "center", boxShadow: "0 16px 44px -22px rgba(20,33,58,.5)" }}>
            <div style={{ fontSize: 38 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: "8px 0" }}>Something went wrong loading the app</h1>
            <p style={{ fontSize: 13.5, color: "#5b6472", lineHeight: 1.55 }}>
              Please try again.{error.digest ? ` If it keeps happening, quote ${error.digest}.` : ""}
            </p>
            <button type="button" onClick={() => unstable_retry()} style={{ marginTop: 16, border: 0, borderRadius: 999, background: "#1d3a8f", color: "#fff", padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
