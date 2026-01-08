"use client"

/**
 * Global Error Boundary for Root Layout
 *
 * This component catches errors that occur in the root layout and sends them to PostHog.
 * It must include its own <html> and <body> tags since it replaces the root layout on error.
 *
 * Note: This component cannot use shared UI components or context providers since it
 * replaces the entire root layout. Styles are inlined to ensure they're available.
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors
 * @see https://posthog.com/docs/error-tracking/installation/nextjs
 */

import posthog from "posthog-js"
import { useEffect } from "react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Capture the exception in PostHog
    posthog.captureException(error, {
      error_boundary: "global",
      error_digest: error.digest,
    })
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Something Went Wrong</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              * { box-sizing: border-box; margin: 0; padding: 0; }
              body {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                font-family: system-ui, -apple-system, sans-serif;
                background: radial-gradient(ellipse 1200px 800px at center center,
                  rgba(255,218,30,0.5) 0%,
                  rgba(253,221,57,0.4) 20%,
                  rgba(249,230,136,0.3) 40%,
                  rgba(245,236,189,0.15) 60%,
                  rgba(242,242,242,0.05) 80%,
                  white 100%
                );
              }
              .container {
                text-align: center;
                padding: 2rem;
                max-width: 600px;
              }
              h1 {
                font-size: clamp(1.875rem, 5vw, 3.875rem);
                font-weight: 500;
                color: #000;
                margin-bottom: 1rem;
                line-height: 1.2;
              }
              p {
                font-size: 1.25rem;
                color: #171717;
                margin-bottom: 2rem;
                line-height: 1.4;
              }
              .buttons {
                display: flex;
                gap: 1rem;
                justify-content: center;
                flex-wrap: wrap;
              }
              button, a {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                height: 40px;
                padding: 0 1rem;
                font-size: 0.875rem;
                font-weight: 500;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.2s;
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
                background: white;
                color: #040404;
                border: 1px solid #bdbdbd;
              }
              .secondary:hover {
                background: #fafafc;
              }
              @media (prefers-color-scheme: dark) {
                body {
                  background: radial-gradient(ellipse 1200px 800px at center center,
                    rgba(255,218,30,0.3) 0%,
                    rgba(253,221,57,0.2) 20%,
                    rgba(249,230,136,0.15) 40%,
                    transparent 70%
                  ), #181921;
                }
                h1 { color: #fff; }
                p { color: #e5e5e5; }
                .primary {
                  background: #fcfaf7;
                  color: #1c1c1c;
                }
                .primary:hover {
                  background: #e0e0e0;
                }
                .secondary {
                  background: transparent;
                  color: #fcfaf7;
                  border-color: #404040;
                }
                .secondary:hover {
                  background: #2a2a2a;
                }
              }
            `,
          }}
        />
      </head>
      <body>
        <div className="container">
          <h1>Something Went Wrong</h1>
          <p>An unexpected error occurred. Please try again or contact support if the problem persists.</p>
          <div className="buttons">
            <button onClick={() => reset()} className="primary">
              Try Again
            </button>
            <a href="/" className="secondary">
              Go to Homepage
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
