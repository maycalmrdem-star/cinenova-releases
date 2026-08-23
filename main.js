const { app, BrowserWindow, session, ipcMain, dialog, Menu, Tray } = require('electron');
const path = require('path');
const { ElectronBlocker } = require('@cliqz/adblocker-electron');
const fetch = require('cross-fetch');
const { autoUpdater } = require('electron-updater');

// ── Auto Updater Config ──────────────────────────────────────
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

// Performance flags
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling');

// ── Window State Persistence ─────────────────────────────────
function getWindowState() {
    try {
        const state = require('fs').readFileSync(
            path.join(app.getPath('userData'), 'window-state.json'), 'utf-8'
        );
        return JSON.parse(state);
    } catch { return null; }
}

function saveWindowState(win) {
    try {
        const bounds = win.getBounds();
        const state = { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, maximized: win.isMaximized() };
        require('fs').writeFileSync(
            path.join(app.getPath('userData'), 'window-state.json'),
            JSON.stringify(state)
        );
    } catch { }
}

let mainWindow = null;
let settingsWindow = null;

function createSettingsWindow() {
    if (settingsWindow) {
        settingsWindow.focus();
        return;
    }

    settingsWindow = new BrowserWindow({
        width: 420,
        height: 380,
        resizable: false,
        title: 'CineNova - الإعدادات',
        icon: path.join(__dirname, 'icon.png'),
        backgroundColor: '#0a0d14',
        autoHideMenuBar: true,
        parent: mainWindow,
        modal: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    settingsWindow.setMenu(null);
    settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(getSettingsHTML())}`);
    settingsWindow.on('closed', () => { settingsWindow = null; });
}

function getSettingsHTML() {
    const version = app.getVersion();
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<title>الإعدادات</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: #0a0d14;
    color: #e8eaf0;
    padding: 28px;
    user-select: none;
  }
  .header {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 28px;
    padding-bottom: 18px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .logo { font-size: 28px; }
  .title { font-size: 1.3rem; font-weight: 700; color: #e50914; }
  .subtitle { font-size: 0.8rem; color: #888; margin-top: 2px; }
  .section {
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 14px;
  }
  .section-title {
    font-size: 0.75rem;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 0;
  }
  .label { font-size: 0.92rem; color: #ccc; }
  .value { font-size: 0.85rem; color: #e50914; font-weight: 600; }
  .btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 10px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .btn-update {
    background: linear-gradient(135deg, #e50914, #b00710);
    color: white;
  }
  .btn-update:hover { background: linear-gradient(135deg, #ff1a1a, #cc0a0a); transform: translateY(-1px); }
  .btn-update:disabled { background: #333; color: #666; cursor: not-allowed; transform: none; }
  .status {
    margin-top: 12px;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.83rem;
    text-align: center;
    display: none;
  }
  .status.info { background: rgba(0,122,255,0.15); border: 1px solid rgba(0,122,255,0.3); color: #5ac8fa; display: block; }
  .status.success { background: rgba(52,199,89,0.15); border: 1px solid rgba(52,199,89,0.3); color: #34c759; display: block; }
  .status.error { background: rgba(229,9,20,0.15); border: 1px solid rgba(229,9,20,0.3); color: #ff6b6b; display: block; }
  .spinner { animation: spin 1s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">🎬</div>
  <div>
    <div class="title">CineNova</div>
    <div class="subtitle">إعدادات التطبيق</div>
  </div>
</div>

<div class="section">
  <div class="section-title">معلومات الإصدار</div>
  <div class="row">
    <span class="label">الإصدار الحالي</span>
    <span class="value">v${version}</span>
  </div>
  <div class="row">
    <span class="label">البيئة</span>
    <span class="value">Windows</span>
  </div>
</div>

<div class="section">
  <div class="section-title">التحديثات</div>
  <button class="btn btn-update" id="checkBtn" onclick="checkUpdate()">
    🔄 التحقق من التحديثات
  </button>
  <div class="status" id="status"></div>
</div>

<script>
const { ipcRenderer } = require('electron');

function checkUpdate() {
  const btn = document.getElementById('checkBtn');
  const status = document.getElementById('status');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner">⟳</span> جاري الفحص...';
  status.className = 'status info';
  status.textContent = 'جاري البحث عن تحديثات...';

  ipcRenderer.send('check-for-updates');
}

ipcRenderer.on('update-status', (event, msg) => {
  const btn = document.getElementById('checkBtn');
  const status = document.getElementById('status');
  btn.disabled = false;
  btn.innerHTML = '🔄 التحقق من التحديثات';
  status.className = 'status ' + msg.type;
  status.textContent = msg.text;
});
</script>
</body>
</html>`;
}

function createWindow() {
    const savedState = getWindowState();

    mainWindow = new BrowserWindow({
        width: savedState?.width || 1280,
        height: savedState?.height || 800,
        x: savedState?.x,
        y: savedState?.y,
        minWidth: 900,
        minHeight: 600,
        icon: path.join(__dirname, 'icon.png'),
        title: 'CineNova',
        backgroundColor: '#04060b',
        autoHideMenuBar: true,
        show: false,
        webPreferences: {
            webSecurity: true,
            contextIsolation: true,
            nodeIntegration: false,
            allowRunningInsecureContent: false,
            sandbox: true,
            webviewTag: true
        }
    });

    mainWindow.setMenu(null);

    if (savedState?.maximized) mainWindow.maximize();

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('close', () => saveWindowState(mainWindow));

    // ── AD BLOCKER ────────────────────────────────────────────
    ElectronBlocker.fromPrebuiltAdsAndTracking(fetch).then((blocker) => {
        blocker.enableBlockingInSession(session.defaultSession);
    });

    const ALLOWED_POPUP_HOSTS = [
        'cinenova.netlify.app', 'cinaa.netlify.app',
        'themoviedb.org', 'www.themoviedb.org',
        'youtube.com', 'www.youtube.com'
    ];
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const { hostname, protocol } = new URL(url);
            const allowed = (protocol === 'https:') &&
                ALLOWED_POPUP_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
            return allowed ? { action: 'allow' } : { action: 'deny' };
        } catch {
            return { action: 'deny' };
        }
    });

    mainWindow.loadURL('https://cinaa.netlify.app');

    // Inject Settings button & ad-hide CSS
    mainWindow.webContents.on('did-finish-load', () => {
        mainWindow.webContents.insertCSS(`
            [class*="ad-"], [class*="ads-"], [id*="ad-"], [id*="ads-"],
            [class*="banner"], [class*="sponsor"], [class*="popup"],
            iframe[src*="ads"], iframe[src*="pop"],
            .ad-notice, .ad-overlay, .ad-container,
            div[data-ad], div[data-ads] {
                display: none !important;
                visibility: hidden !important;
                height: 0 !important;
                width: 0 !important;
                overflow: hidden !important;
            }
            /* Settings button */
            #cn-settings-btn {
                position: fixed;
                bottom: 22px;
                left: 22px;
                z-index: 99999;
                background: rgba(15,18,28,0.92);
                backdrop-filter: blur(12px);
                border: 1px solid rgba(255,255,255,0.1);
                color: #e8eaf0;
                border-radius: 50%;
                width: 44px;
                height: 44px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                font-size: 18px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                transition: all 0.2s;
            }
            #cn-settings-btn:hover {
                background: rgba(229,9,20,0.2);
                border-color: rgba(229,9,20,0.4);
                transform: scale(1.1) rotate(30deg);
            }
        `);

        mainWindow.webContents.executeJavaScript(`
            if (!document.getElementById('cn-settings-btn')) {
                const btn = document.createElement('button');
                btn.id = 'cn-settings-btn';
                btn.title = 'الإعدادات';
                btn.innerHTML = '⚙️';
                btn.onclick = () => {
                    window.electronAPI && window.electronAPI.openSettings
                        ? window.electronAPI.openSettings()
                        : fetch('cinenova://settings').catch(() => {});
                };
                document.body.appendChild(btn);
            }
        `).catch(() => {});
    });
}

// ── IPC: Settings button & manual update check ───────────────
ipcMain.on('check-for-updates', (event) => {
    autoUpdater.checkForUpdates().catch((err) => {
        event.reply('update-status', { type: 'error', text: 'فشل الاتصال: ' + err.message });
    });
});

// ── Auto Updater Events ──────────────────────────────────────
autoUpdater.on('checking-for-update', () => {
    settingsWindow?.webContents.send('update-status', { type: 'info', text: 'جاري البحث عن تحديثات...' });
});

autoUpdater.on('update-available', (info) => {
    settingsWindow?.webContents.send('update-status', {
        type: 'info',
        text: `يتوفر تحديث جديد (v${info.version}) — جاري التحميل تلقائياً...`
    });
});

autoUpdater.on('update-not-available', () => {
    settingsWindow?.webContents.send('update-status', { type: 'success', text: 'أنت تستخدم أحدث إصدار ✓' });
});

autoUpdater.on('error', (err) => {
    settingsWindow?.webContents.send('update-status', { type: 'error', text: 'خطأ: ' + err.message });
});

autoUpdater.on('update-downloaded', (info) => {
    settingsWindow?.webContents.send('update-status', {
        type: 'success',
        text: `تم تحميل v${info.version} — سيتم التثبيت عند الإغلاق`
    });

    dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'CineNova - تحديث جاهز',
        message: `تم تحميل الإصدار الجديد v${info.version}\nهل تريد إعادة التشغيل الآن لتثبيته؟`,
        buttons: ['إعادة التشغيل الآن', 'لاحقاً'],
        defaultId: 0,
        cancelId: 1
    }).then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall();
    });
});

// ── Open Settings via app protocol ───────────────────────────
app.on('open-url', (event, url) => {
    if (url === 'cinenova://settings') {
        event.preventDefault();
        createSettingsWindow();
    }
});

// Keyboard shortcut: Ctrl+, to open settings
app.on('web-contents-created', (_, contents) => {
    contents.on('before-input-event', (event, input) => {
        if (input.control && input.key === ',') {
            createSettingsWindow();
        }
    });
});

app.whenReady().then(() => {
    createWindow();

    // Check for updates 5 seconds after launch
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch(() => {});
    }, 5000);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
