// The app never talks to any server. The CSP enforces this.
// Web builds put it into a meta tag (SvelteKit); the desktop build gives it
// to Tauri (src-tauri/tauri.conf.json), which must also allow its IPC.
export const cspDirectives = {
  'default-src': ['none' as const],
  'script-src': ['self' as const],
  'style-src': ['self' as const],
  'img-src': ['self' as const, 'data:' as const],
  'connect-src': ['none' as const],
  'form-action': ['none' as const],
  'base-uri': ['none' as const],
  'object-src': ['none' as const],
};

/** The only connections the desktop app needs: Tauri's IPC to the Rust side. */
export const tauriIpcSources = ['ipc:', 'http://ipc.localhost'];
