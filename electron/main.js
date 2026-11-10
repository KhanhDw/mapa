const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let mainWindow = null;
let pyProcess = null;

function startPythonBackend() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // Trong môi trường dev, dùng python từ môi trường ảo backend hiện tại
    const pythonExecutable = path.join(
      __dirname,
      "../backend/myenv/Scripts/python.exe",
    );
    const scriptPath = path.join(__dirname, "../backend/src/main.py");

    pyProcess = spawn(
      pythonExecutable,
      [
        "-m",
        "uvicorn",
        "src.main:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
      ],
      {
        cwd: path.join(__dirname, "../backend"),
      },
    );
  } else {
    // Khi đã build thành file .exe (Production), Python và các package sẽ được đóng gói bên trong resource của app
    // (Bạn sẽ cấu hình đóng gói python bằng electron-builder ở bước sau)
  }

  pyProcess.stdout.on("data", (data) => {
    console.log(`[Python stdout]: ${data}`);
  });

  pyProcess.stderr.on("data", (data) => {
    console.error(`[Python stderr]: ${data}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools(); // Mở F12 khi dev
  } else {
    mainWindow.loadFile(path.join(__dirname, "../frontend/dist/index.html"));
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();
});

// Khi tắt app thì đồng thời tắt luôn tiến trình python chạy ngầm
app.on("window-all-closed", () => {
  if (pyProcess) {
    pyProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
