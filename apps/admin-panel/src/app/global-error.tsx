"use client"

import { useEffect } from "react"

// This replaces the ENTIRE root layout (app/layout.tsx) when the root
// layout itself is what threw -- so it ships its own <html>/<body> and
// deliberately doesn't depend on anything the root layout provides
// (globals.css, the query/tooltip providers, fonts): those could be
// exactly what's broken. Inline styles only, on purpose.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#0b0f17",
          color: "#f4f4f5",
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 400, padding: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a1a1aa", margin: "0 0 24px", lineHeight: 1.6 }}>
            The application hit an unexpected error and couldn&apos;t recover
            on its own.
          </p>
          <button
            onClick={reset}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              border: "1px solid #3f3f46",
              background: "#27272a",
              color: "#f4f4f5",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
