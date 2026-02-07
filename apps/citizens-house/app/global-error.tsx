"use client"

/**
 * Global Error Boundary for Root Layout
 *
 * This component catches errors that occur in the root layout.
 * It must include its own <html> and <body> tags since it replaces the root layout on error.
 *
 * Note: This component cannot use shared UI components, Tailwind, or context providers
 * since it replaces the entire root layout. All styles are inlined.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 */

export default function GlobalError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <head>
        <title>Something Went Wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              @font-face {
                font-family: 'FK Grotesk';
                src: url('/fonts/FKGrotesk-Regular.woff2') format('woff2');
                font-weight: 400;
                font-style: normal;
                font-display: swap;
              }
              @font-face {
                font-family: 'FK Grotesk';
                src: url('/fonts/FKGrotesk-Medium.woff2') format('woff2');
                font-weight: 500;
                font-style: normal;
                font-display: swap;
              }
              * { box-sizing: border-box; margin: 0; padding: 0; }
              html, body {
                height: 100%;
                font-family: 'FK Grotesk', system-ui, -apple-system, sans-serif;
              }
              body {
                background: #fff;
              }
              .page {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
              }
              .hero {
                position: relative;
                height: 320px;
                overflow: hidden;
              }
              .gradient {
                position: absolute;
                inset: 0;
                pointer-events: none;
                background: radial-gradient(ellipse 500px 320px at center 30%,
                  rgba(255,218,30,0.4) 0%,
                  rgba(253,221,57,0.3) 25%,
                  rgba(249,230,136,0.2) 45%,
                  rgba(245,236,189,0.14) 60%,
                  rgba(242,242,242,0.06) 75%,
                  transparent 100%
                );
              }
              .stars {
                position: absolute;
                top: 100px;
                left: min(calc(50% + 360px), calc(100% - 200px));
                width: 372px;
                height: 246px;
                pointer-events: none;
                color: #FFDA1E;
              }
              .content {
                position: relative;
                display: flex;
                flex-direction: column;
                gap: 16px;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 0 48px;
                z-index: 10;
              }
              h1 {
                font-size: 36px;
                line-height: 44px;
                font-weight: 500;
                color: #000;
                text-align: center;
              }
              p {
                font-size: 22px;
                line-height: 30px;
                font-weight: 400;
                color: #000;
                text-align: center;
              }
              .buttons {
                display: flex;
                gap: 16px;
                justify-content: center;
                padding: 40px 24px;
              }
              button, a {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 48px;
                padding: 0 24px;
                font-size: 16px;
                font-weight: 500;
                font-family: inherit;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.15s, border-color 0.15s;
                text-decoration: none;
              }
              .primary {
                background: #040404;
                color: #d8d8d8;
                border: none;
              }
              .primary:hover {
                background: #1c1c1c;
              }
              .secondary {
                background: #fff;
                color: #040404;
                border: 1px solid #bdbdbd;
              }
              .secondary:hover {
                background: #fafafc;
                border-color: #a0a0a0;
              }
              @media (min-width: 768px) {
                .hero { height: 400px; }
                .gradient {
                  background: radial-gradient(ellipse 650px 420px at center 30%,
                    rgba(255,218,30,0.4) 0%,
                    rgba(253,221,57,0.3) 25%,
                    rgba(249,230,136,0.2) 45%,
                    rgba(245,236,189,0.14) 60%,
                    rgba(242,242,242,0.06) 75%,
                    transparent 100%
                  );
                }
                .stars { top: 120px; }
                .content { padding: 0 24px; }
                h1 { font-size: 62px; line-height: 72px; }
                .buttons { padding: 60px 0; }
              }
              @media (prefers-color-scheme: dark) {
                body { background: #181921; }
                .gradient {
                  background: radial-gradient(ellipse 500px 320px at center 30%,
                    rgba(255,218,30,0.28) 0%,
                    rgba(253,221,57,0.2) 30%,
                    rgba(249,230,136,0.14) 55%,
                    transparent 80%
                  );
                }
                .stars { color: rgba(255,218,30,0.3); }
                h1 { color: #fff; }
                p { color: #fff; }
                .primary {
                  background: #fcfaf7;
                  color: #1c1c1c;
                }
                .primary:hover { background: #e8e8e8; }
                .secondary {
                  background: transparent;
                  color: #fcfaf7;
                  border-color: #404040;
                }
                .secondary:hover {
                  background: #2a2a2a;
                  border-color: #555;
                }
              }
              @media (min-width: 768px) and (prefers-color-scheme: dark) {
                .gradient {
                  background: radial-gradient(ellipse 650px 420px at center 30%,
                    rgba(255,218,30,0.28) 0%,
                    rgba(253,221,57,0.2) 30%,
                    rgba(249,230,136,0.14) 55%,
                    transparent 80%
                  );
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="page">
          <section className="hero">
            <div className="gradient" />
            <div className="stars">
              <svg
                viewBox="0 0 372 246"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{ width: "100%", height: "100%" }}
              >
                <path
                  d="M186 0L189.5 82.5L246 41L203.5 97.5L286 101L203.5 104.5L246 161L189.5 119.5L186 202L182.5 119.5L126 161L168.5 104.5L86 101L168.5 97.5L126 41L182.5 82.5L186 0Z"
                  fill="currentColor"
                />
                <path
                  d="M60 80L62 120L90 96L70 126L110 128L70 130L90 160L62 136L60 176L58 136L30 160L50 130L10 128L50 126L30 96L58 120L60 80Z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <path
                  d="M312 80L314 120L342 96L322 126L362 128L322 130L342 160L314 136L312 176L310 136L282 160L302 130L262 128L302 126L282 96L310 120L312 80Z"
                  fill="currentColor"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div className="content">
              <h1>Something Went Wrong</h1>
              <p>An error occurred while loading this page. Please try again.</p>
            </div>
          </section>
          <section className="buttons">
            <button onClick={() => reset()} className="primary">
              Try Again
            </button>
            <a href="/" className="secondary">
              Go Home
            </a>
          </section>
        </div>
      </body>
    </html>
  )
}
