const path = require("path");
const { spawn } = require("child_process");
const { app, BrowserWindow, Menu, session, ipcMain, net } = require("electron");

let mainWindow = null;
let pyProcess = null;

const IS_DEV = !app.isPackaged;
const PY_PORT = 8000;

// Chỉ cho phép tải tile từ ESRI
const ALLOWED_TILE_HOSTS = new Set([
  "server.arcgisonline.com",
  "services.arcgisonline.com",
  "basemaps.arcgis.com",
]);

/* ---------------- Python Backend ---------------- */

function killPython() {
  if (!pyProcess) return;

  if (process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pyProcess.pid), "/T", "/F"]);
  } else {
    pyProcess.kill("SIGTERM");
  }

  pyProcess = null;
}

function startPythonBackend() {
  if (!IS_DEV) return;

  const pythonExecutable = path.join(
    __dirname,
    "../backend/myenv/Scripts/python.exe",
  );

  pyProcess = spawn(
    pythonExecutable,
    [
      "-m",
      "uvicorn",
      "src.main:app",
      "--host",
      "127.0.0.1",
      "--port",
      String(PY_PORT),
    ],
    {
      cwd: path.join(__dirname, "../backend"),
    },
  );

  pyProcess.stdout.on("data", (d) => {
    console.log(`[Python stdout]: ${d}`);
  });

  pyProcess.stderr.on("data", (d) => {
    console.error(`[Python stderr]: ${d}`);
  });

  pyProcess.on("error", (err) => {
    console.error("[Python] spawn error:", err);
  });

  pyProcess.on("exit", (code, signal) => {
    console.log(`[Python] exited code=${code} signal=${signal}`);
    pyProcess = null;
  });
}

/* ---------------- CSP ---------------- */

function applyCSP() {
  const TILE_HOSTS = [
    "https://server.arcgisonline.com",
    "https://services.arcgisonline.com",
    "https://basemaps.arcgis.com",
  ].join(" ");

  const PROD_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILE_HOSTS}`,
    "font-src 'self' data:",
    `connect-src 'self' http://127.0.0.1:${PY_PORT} http://localhost:${PY_PORT} ${TILE_HOSTS}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  const DEV_CSP = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${TILE_HOSTS}`,
    "font-src 'self' data:",
    `connect-src 'self' ws://localhost:5173 http://127.0.0.1:${PY_PORT} http://localhost:${PY_PORT} ${TILE_HOSTS}`,
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [IS_DEV ? DEV_CSP : PROD_CSP],
      },
    });
  });
}

/* ---------------- ESRI TILE IPC ---------------- */

ipcMain.handle("fetch-esri-tile", async (event, tileUrl) => {
  try {
    // Không cho renderer truy cập URL tùy ý
    if (typeof tileUrl !== "string" || tileUrl.length > 2048) {
      throw new Error("Invalid tile URL");
    }

    const parsedUrl = new URL(tileUrl);

    if (
      parsedUrl.protocol !== "https:" ||
      !ALLOWED_TILE_HOSTS.has(parsedUrl.hostname) ||
      (!/^\/ArcGIS\/rest\/services\/[^?#]+\/tile\/\d+\/\d+\/\d+\/?$/i.test(
        parsedUrl.pathname,
      ) &&
        !/^\/ArcGIS\/rest\/services\/[^?#]+\/MapServer\/tile\/\d+\/\d+\/\d+\/?$/i.test(
          parsedUrl.pathname,
        ))
    ) {
      throw new Error("ESRI tile URL not allowed");
    }

    const request = net.request({
      method: "GET",
      url: parsedUrl.toString(),
    });

    const result = await new Promise((resolve, reject) => {
      request.on("response", (response) => {
        const chunks = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        response.on("end", () => {
          const buffer = Buffer.concat(chunks);

          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`ESRI HTTP ${response.statusCode}`));
            return;
          }

          resolve({
            data: buffer,
            contentType: response.headers["content-type"]?.[0] || "image/jpeg",
          });
        });

        response.on("error", reject);
      });

      request.on("error", reject);
      request.end();
    });

    return {
      success: true,
      data: result.data,
      contentType: result.contentType,
    };
  } catch (error) {
    console.error("[ESRI TILE ERROR]", error);

    return {
      success: false,
      error: error.message,
    };
  }
});

/* ---------------- Window ---------------- */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, "assets/logo.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

/* ---------------- Lifecycle ---------------- */

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  applyCSP();
  startPythonBackend();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  killPython();
});
