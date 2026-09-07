# Arm Atlas — Desktop App (Electron + electron-builder)

The desktop app wraps the same kinematics dashboard in a native window and runs
fully offline: the UI is bundled as static files loaded from disk (`file://`).

## Files

| Path                          | Purpose                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `electron/main.cjs`           | Main process: window (1400×900, min 1024×768), menu, lifecycle |
| `electron/preload.cjs`        | Isolated bridge (`window.desktop`), no Node in the renderer |
| `desktop/`                    | Standalone SPA entry + Vite config (`base: "./"`)          |
| `desktop-dist/`               | Static build the app loads offline (generated)              |
| `electron-builder.yml`        | Installer targets: Windows nsis + portable, macOS dmg, Linux AppImage |
| `build/`                      | `icon.ico`, `icon.icns`, `icon.png`                        |
| `dist-desktop/`               | Generated installers                                        |

## 1. Install dependencies

```sh
npm install
npm install --save-dev electron electron-builder
```

## 2. Run locally (development)

```sh
npm run desktop:build   # builds desktop-dist/
npm start               # launches Electron on that build
```

Or, to develop against the hot-reloading Vite server, run `npm run dev` and set
`REMOTE_URL = "http://localhost:8080"` at the top of `electron/main.cjs`.

## 3. Build installers

```sh
npm run build:win     # -> dist-desktop/ArmAtlas-1.0.0-x64-exe.exe (NSIS installer) + portable .exe
npm run build:mac     # -> dist-desktop/Arm Atlas-1.0.0.dmg   (run on macOS)
npm run build:linux   # -> dist-desktop/Arm Atlas-1.0.0.AppImage
npm run build:desktop # current platform, all configured targets
```

Every command runs the static build first, then electron-builder.
macOS `.dmg` must be produced on macOS (Apple's tooling is required for
signing/notarization); Windows targets cross-compile from macOS/Linux with Wine.

## 4. Icons

Drop `icon.ico` (Windows), `icon.icns` (macOS) and `icon.png` (Linux) into
`build/`. See `build/README.md` for sizes.

## 5. Loading a live cloud URL instead of local files

In `electron/main.cjs`:

```js
const REMOTE_URL = "https://arm-atlas.lovable.app"; // instead of null
```

`null` keeps the offline `loadFile()` path, which is the recommended default.
