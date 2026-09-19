// Response headers that keep other pages from framing the village or loading anything into it.
//
// Framing is the one that matters: a framed village passes every Host and Origin check, since
// it is the village's own page, so any website could hide it under a decoy and borrow your
// clicks on Archive, Send or Start.

/** The dev server's: Vite writes its own page as it serves it, so no script policy there. */
export const DEV_HEADERS = {
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
}

// The built page runs only its own files. Inline styles, because the HUD sets `style=` on
// elements; `data:` images, because the favicon is one.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ')

/** The built app's, on every response. */
export const HEADERS = {
  ...DEV_HEADERS,
  'Content-Security-Policy': CSP,
  'Referrer-Policy': 'no-referrer',
  // Nothing here is for another site to load, not even as an <img> or a <script>.
  'Cross-Origin-Resource-Policy': 'same-origin',
}
