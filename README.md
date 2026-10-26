# CSV Crypt Web

Browser UI for [csv-crypt](https://github.com/life-research/csv-crypt). It
encrypts a CSV file line by line: column 1 stays readable, all other columns
are encrypted into column 2. The file format is identical to the CLI
(v0.5), so both tools can read each other's files.

All encryption runs in the browser (Web Crypto API). The data never leaves
the computer. A Content Security Policy blocks all network requests.

## Builds

| Build | Command                 | Output                        | Use                         |
| ----- | ----------------------- | ----------------------------- | --------------------------- |
| A     | `npm run build`         | `build/`                      | Static web app (nginx, K8s) |
| B     | `npm run build:single`  | `build-single/csv-crypt.html` | One file, opens via file:// |
| C     | `npm run build:desktop` | `build-desktop/`              | Frontend of the desktop app |

Build B also writes `csv-crypt.html.sha256`. Distribute the file only from
one trusted place, together with its checksum.

The browser needs a secure context: HTTPS for build A (or `localhost`),
file:// for build B.

## Desktop app (Tauri)

`src-tauri/` wraps build C in a desktop app for Windows and macOS. The app
has no file system access. It can only save files through the native
"Save as" dialog (command `save_file` in `src-tauri/src/save.rs`).
Tauri sets the same CSP as the web builds, plus the IPC to the Rust side
(`test/tauri-config.test.ts` checks this).

Prerequisites: [Rust](https://rustup.rs) and the
[Tauri system packages](https://v2.tauri.app/start/prerequisites/).

```sh
npm run desktop:dev            # app window with hot reload (Linux/macOS/Windows)
npm run desktop:build:windows  # NSIS installer, cross-compiled on Linux
npm run desktop:build:macos    # .dmg, only on a Mac
cd src-tauri && cargo test     # Rust unit tests
```

Cross-compile for Windows on Linux (Debian/Ubuntu):

```sh
sudo apt install clang lld llvm nsis
rustup target add x86_64-pc-windows-msvc
cargo install --locked cargo-xwin
```

Output: `src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/`.
The installer installs per user (no admin rights). It needs WebView2,
which Windows 10 and 11 include.

The icon in `src-tauri/icons/` is a placeholder. To change it, run
`npx tauri icon <1024px.png|svg>`.

## Development

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run test:e2e     # builds A and B, browser tests with Playwright (Chrome)
npm run check        # svelte-check
npm run lint
npm run format:check
```

## Compatibility with the CLI

`test/fixtures/cli/` contains files made by the original jar with the test
key in `test/fixtures/key.txt` (from the CLI's own tests; never use it for
real data). The unit tests check that this app decrypts them to the same
bytes, and that it encrypts to the same bytes for the same IV.

```sh
npm run fixtures      # regenerate fixtures (needs Java; jar from CSV_CRYPT_JAR or GitHub)
npm run cross-check   # encrypt with this app, decrypt with the jar
```

### Format

- Key: 32 random bytes, hex. Bytes 0–15: HMAC-SHA256 key, bytes 16–31: AES-128 key.
- Column 2: `Base64(iv ‖ ciphertext ‖ tag)`, AES-128-CBC with PKCS#7 padding,
  `tag = HMAC-SHA256(iv ‖ ciphertext)[0..16]` (no AAD, unlike RFC 7518).
- Plaintext: CBOR indefinite-length array of the columns 2…n as text strings,
  with Jackson's length rules (see `src/lib/crypto/cbor.ts`).

### Differences to the CLI

- The separator is detected automatically (comma, semicolon or tab).
- Input without BOM that is not valid UTF-8 is read as Windows-1252
  (German Excel "CSV (Trennzeichen-getrennt)"). The CLI reads it as UTF-8.
- Decrypted output defaults to the Excel format (UTF-16LE, BOM, tab), like
  `--out-optimize-win`.

## License

Copyright © 2026 Leipzig Research Centre for Civilization Diseases (LIFE)

Licensed under the [Apache License, Version 2.0](LICENSE).
