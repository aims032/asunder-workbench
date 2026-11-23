// WHERE THE APP GETS TRANSMISSION PACKS FROM.
//
// null = downloading is switched off, and the app works exactly as before.
//
// To try it with the pretend server on your Mac (media/README.md):
//   browser preview on the same Mac:   'http://localhost:8787'
//   a phone on the same Wi-Fi:         the "On a phone" address the pretend
//                                      server prints, like 'http://192.168.1.20:8787'
// Once the real one is set up on Cloudflare:
//   'https://asunder-media.<your-account>.workers.dev'
//
// No slash at the end.

export const MEDIA_SERVER_URL: string | null = null;

/** How long to wait for the server before deciding there's no signal, in milliseconds. */
export const CATALOG_TIMEOUT_MS = 10_000;
