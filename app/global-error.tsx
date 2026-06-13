"use client";

/**
 * Global error page (500) for MCPGuardian.
 * This is the last-resort error boundary rendered when the root layout itself fails.
 * It must include its own <html> and <body> tags since the root layout may not render.
 * 
 * Wrapped in a try/catch at the render level to prevent infinite error loops
 * if the error page itself fails to render (Requirement 21.7).
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  try {
    return (
      <html lang="en">
        <body
          style={{
            margin: 0,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "hsl(222 50% 4%)",
            color: "hsl(210 40% 98%)",
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: "1rem",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              maxWidth: "28rem",
            }}
          >
            {/* Brand logo - inline SVG to avoid import failures */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                marginBottom: "2rem",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="hsl(217 91% 60%)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
              </svg>
              <span style={{ fontSize: "1.25rem" }}>
                MCP
                <span style={{ color: "hsl(217 91% 60%)" }}>Guardian</span>
              </span>
            </div>

            {/* Error heading */}
            <h1
              style={{
                fontSize: "2.25rem",
                fontWeight: 700,
                margin: "0 0 1rem 0",
                lineHeight: 1.2,
              }}
            >
              Something went wrong
            </h1>

            {/* Description (≤ 150 chars) */}
            <p
              style={{
                color: "hsl(215 20% 65%)",
                fontSize: "1rem",
                margin: "0 0 2rem 0",
                lineHeight: 1.6,
              }}
            >
              An unexpected error occurred. Please try reloading the page. If the problem persists, contact support.
            </p>

            {/* Try again button - full page reload */}
            <button
              onClick={() => {
                try {
                  window.location.reload();
                } catch {
                  // If reload fails, attempt reset as fallback
                  reset();
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "0.375rem",
                padding: "0.75rem 1.5rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "white",
                backgroundColor: "hsl(217 91% 60%)",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.opacity = "1";
              }}
            >
              Try again
            </button>
          </div>
        </body>
      </html>
    );
  } catch {
    // Fallback: if the error page itself fails to render,
    // return the absolute minimum HTML to prevent infinite error loops (Req 21.7)
    return (
      <html lang="en">
        <body
          style={{
            margin: 0,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#0a0b14",
            color: "#f8fafc",
            fontFamily: "sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1>Something went wrong</h1>
            <p>Please reload the page.</p>
          </div>
        </body>
      </html>
    );
  }
}
