# CSV Crypt Web

Browser UI for [csv-crypt](https://github.com/life-research/csv-crypt). It
encrypts a CSV file line by line: column 1 stays readable, all other columns
are encrypted into column 2. The file format is identical to the CLI
(v0.5), so both tools can read each other's files.

It also encrypts Excel files (`.xlsx`): the result is an `.xlsx` file with
the same sheets, and decryption gives an `.xlsx` file again (see
[Excel files](#excel-files)).

The app takes only files with the extension `.csv`, `.txt` (Excel's
"Unicode Text") or `.xlsx`. For other files, it shows a warning and keeps
the previous selection (`src/lib/file-names.ts`).

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

### Official Windows build

The official Windows build is one standalone executable, without installer.
CI builds it on a GitHub-hosted Windows runner for each tag `vX.Y.Z`
(workflow `build-windows.yml`). Before CI accepts the executable, it checks:

- The tag, `package.json` and `src-tauri/Cargo.toml` have the same version
  (`node scripts/check-version.js vX.Y.Z`).
- The executable's metadata has this version, the product name, the
  publisher and the copyright from `src-tauri/tauri.conf.json`.
- The executable needs no Visual C++ runtime and no WebView2 loader DLL.
  It uses the Universal C runtime, which is part of Windows 10 and later.
- The app starts, opens its window and shows the heading of its page.

CI also keeps a screenshot of the start test for 7 days. The workflow
also runs for pull requests that change the desktop app, and on the
Actions page ("Run workflow") for any branch.

The workflow run keeps `csv-crypt-X.Y.Z-windows-x64.exe` and its `.sha256`
file as an artifact. Only tag builds have this name. Builds of pull requests
and manual starts are not official: their name contains the commit, for
example `csv-crypt-X.Y.Z-dev.3f2a9c1-windows-x64.exe`. The release build
uses no cache from earlier runs.

### SBOM

The artifact also contains `csv-crypt-X.Y.Z-windows-x64.cdx.json`, a
CycloneDX 1.6 SBOM of the executable. It lists only what the executable
contains:

- npm: the packages in the bundle of build C. `rollup-plugin-sbom` records
  them during `npm run build:desktop` (`build-desktop/cyclonedx/bom.json`).
  Build tools such as ESLint or Vitest are not in it.
- Cargo: the crates for `x86_64-pc-windows-msvc`, without build-time
  dependencies (`cargo cyclonedx --no-build-deps`). Crates for other
  platforms are not in it.

CI merges both parts with `cyclonedx merge`, validates the result and checks
it with `node scripts/check-sbom.js <file> <version>`.

### Releases

1. Set the new version in `package.json` and `src-tauri/Cargo.toml`.
2. Push a tag `vX.Y.Z`. The workflow `Release` builds and checks the
   executable and creates a **draft** GitHub release with:
   - `csv-crypt-X.Y.Z-windows-x64.exe`
   - `csv-crypt-X.Y.Z-windows-x64.exe.sha256`
   - `csv-crypt-X.Y.Z-windows-x64.exe.intoto.jsonl` (SLSA provenance)
   - `csv-crypt-X.Y.Z-windows-x64.cdx.json` (SBOM)
3. A maintainer reviews the draft, edits the generated release notes and
   publishes it by hand.

While the repository is private, the release has no provenance: Sigstore
writes each signature to the public Rekor log, which would make the names
of the repository public.

To verify a downloaded executable:

```sh
sha256sum -c csv-crypt-X.Y.Z-windows-x64.exe.sha256
slsa-verifier verify-artifact csv-crypt-X.Y.Z-windows-x64.exe \
  --provenance-path csv-crypt-X.Y.Z-windows-x64.exe.intoto.jsonl \
  --source-uri github.com/life-research/csv-crypt-app \
  --source-tag vX.Y.Z
```

[slsa-verifier](https://github.com/slsa-framework/slsa-verifier) checks
that the executable was built by this repository's workflow from the tag.
The provenance does not replace Windows code signing: Windows still shows
the SmartScreen warning.

The executable needs the WebView2 runtime. Windows 11 and up-to-date
Windows 10 include it. Without it, the app does not start.

The icon in `src-tauri/icons/` is a placeholder. To change it, run
`npx tauri icon <1024px.png|svg>`.

## Development

Prerequisites: Node 24 (at least 24.15.0) with npm 11, the same as in CI.
`package.json` enforces this (`engines`, with `engine-strict` in `.npmrc`):
npm 10 writes a different `package-lock.json`, and `npm ci` in CI then fails.

```sh
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests (vitest)
npm run test:e2e     # builds A and B, browser tests with Playwright (Chrome)
npm run check        # svelte-check
npm run lint
npm run format:check
```

## Excel files

The app tells an `.xlsx` file from a CSV file by its first bytes (ZIP
signature), not by its name. It processes all sheets of the file:

- **Encrypt:** each sheet keeps its name. Column 1 stays readable, column 2
  holds the other columns, encrypted. Each row has the same format as a
  line of an encrypted CSV file, so a sheet exported as CSV decrypts with
  the CLI (`test/cross-check.test.ts` checks this).
- **Decrypt:** gives an `.xlsx` file with the same sheets.

Each cell is encrypted as the value stored in the file, not as the text that
Excel shows (`src/lib/xlsx/cells.ts`):

| Cell in Excel               | Encrypted text                       |
| --------------------------- | ------------------------------------ |
| Text `00123`                | `00123`                              |
| Number 1234,5               | `1234.5` (as stored)                 |
| Date 15.03.2023 (with time) | `2023-03-15` (`2023-03-15T10:30:05`) |
| WAHR / FALSCH               | `TRUE` / `FALSE`                     |
| Formula                     | its calculated result                |
| Error such as `#DIV/0!`     | the app stops with a message         |

Decryption restores numbers, dates and booleans only for text in exactly
this form. All other text stays text, for example `00123` or `1234,5`.

Limits:

- Formatting, formulas, merged cells, comments and charts are lost. Only
  the values stay.
- A number with a format such as `00000` loses its leading zeros: `123`
  shows as `00123` in Excel, but the stored value is `123`. Store such IDs
  as text.
- Text that looks like a number becomes a number after decryption: a text
  cell `123` gives the number 123.
- Legacy `.xls` files (Excel 97–2003) are not supported. Save them as
  `.xlsx` in Excel.

The app reads and writes `.xlsx` files with `read-excel-file` and
`write-excel-file`, both through their `universal` import, which starts no
Web Worker (the CSP and `file://` would block it).

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
