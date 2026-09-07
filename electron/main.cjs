// Electron main process — Arm Atlas desktop wrapper.
// CommonJS (.cjs) because package.json sets "type": "module".
const { app, BrowserWindow, Menu, dialog, shell, protocol, net } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

// Set to a hosted URL string to run the cloud build instead of the bundled files.
// Example: const REMOTE_URL = "https://arm-atlas.lovable.app";
const REMOTE_URL = null;

// The static build is served over a custom "app://" scheme instead of raw
// file:// — ES modules are blocked by CORS under file://, which would leave a
// blank window. This keeps the app fully offline (files still come from disk).
const APP_ORIGIN = "app://bundle";
const STATIC_DIR = path.join(__dirname, "..", "desktop-dist");

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function registerStaticProtocol() {
  protocol.handle("app", (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const resolved = path.join(STATIC_DIR, relative);
    // Prevent path traversal outside the bundled static directory.
    const safe = resolved.startsWith(STATIC_DIR) ? resolved : path.join(STATIC_DIR, "index.html");
    return net.fetch(pathToFileURL(safe).toString());
  });
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    backgroundColor: "#0c0f13",
    show: false,
    title: "Arm Atlas — Robotic Arm Kinematics Studio",
    icon: path.join(__dirname, "..", "build", process.platform === "win32" ? "icon.ico" : "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  if (REMOTE_URL) {
    // Live cloud mode: loads the hosted app (requires an internet connection).
    mainWindow.loadURL(REMOTE_URL);
  } else {
    // Offline mode (default): load the bundled static build from disk.
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }

  // Open any external link in the user's real browser, never in the app window.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac ? [{ role: "appMenu" }] : []),
    {
      label: "File",
      submenu: [
        { label: "Reload Simulation", accelerator: "CmdOrCtrl+R", role: "reload" },
        { type: "separator" },
        isMac ? { role: "close" } : { label: "Exit", accelerator: "Alt+F4", click: () => app.quit() },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { role: "front" }] },
    {
      label: "Help",
      submenu: [
        {
          label: "About Arm Atlas",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About Arm Atlas",
              message: `Arm Atlas ${app.getVersion()}`,
              detail:
                "3D Robotic Arm Kinematics Studio\nForward & inverse kinematics for 3–6 DOF chains.\n\n" +
                `Electron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
              buttons: ["OK"],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// Single instance only — focus the existing window instead of opening a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    registerStaticProtocol();
    buildMenu();
    createWindow();

    // macOS: re-create the window when the dock icon is clicked.
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  // Windows/Linux: quitting on last window close; macOS keeps the app alive.
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
