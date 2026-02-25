/* ==========================================
   OPTIBIT - Full App JavaScript
   Real Bluetooth Messaging · WebRTC WiFi Direct
   Voice, Image, Video & File Sharing
   ==========================================*/

// ===================== STATE =====================
const State = {
    user: null,
    chats: {},                // { chatId: { id, name, initials, color, messages:[], connected, connectionType, lastMsg, lastTs, unread, deviceId } }
    connectedDevices: [],     // [ { id, name, initials, color, btDevice?, rtcConn?, dataChannel?, connected, connectionType } ]
    discoveredDevices: [],    // [ { id, name, ... } ]
    activeChatId: null,
    theme: 'default',
    dockSize: 'large',       // 'small' | 'large'
    notifications: true,
    currentTab: 'chats',
    bluetoothEnabled: false,
    isScanning: false,
    connectionMode: 'bluetooth', // 'bluetooth' | 'wifi'
    btSupported: false,
    btReceiveBuffers: {},      // { deviceId: partialPayload }
};

// ===================== CONSTANTS =====================
const BLE_PROTOCOLS = [
    {
        name: 'HM-10 UART',
        service: '0000ffe0-0000-1000-8000-00805f9b34fb',
        write: '0000ffe1-0000-1000-8000-00805f9b34fb',
        notify: '0000ffe1-0000-1000-8000-00805f9b34fb'
    },
    {
        name: 'Nordic UART',
        service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
        write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
        notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e'
    }
];
const BLE_OPTIONAL_SERVICES = Array.from(new Set([
    ...BLE_PROTOCOLS.map(p => p.service),
    'battery_service',
    'device_information'
]));
const CHUNK_SIZE = 180; // Safe BLE payload chunk size
const QUICKSTART_SEEN_KEY = 'quickstart_seen';
const DOCK_SIZE_KEY = 'dock_size';

let deferredInstallPrompt = null;

// ===================== STORAGE =====================
const DB = {
    save(key, val) {
        try { localStorage.setItem('optibit_' + key, JSON.stringify(val)); } catch (e) { console.warn('Storage save error:', e); }
    },
    load(key, def = null) {
        try {
            const v = localStorage.getItem('optibit_' + key);
            return v ? JSON.parse(v) : def;
        } catch (e) { return def; }
    },
    remove(key) { localStorage.removeItem('optibit_' + key); },
    clearAll() {
        Object.keys(localStorage).filter(k => k.startsWith('optibit_')).forEach(k => localStorage.removeItem(k));
    },
    used() {
        let total = 0;
        for (let k in localStorage) {
            if (k.startsWith('optibit_')) total += (localStorage[k].length + k.length) * 2;
        }
        return total;
    }
};

// ===================== HELPERS =====================
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function now() { return Date.now(); }
function timeFmt(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function relativeTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return timeFmt(ts);
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}
function isMobile() { return window.innerWidth < 768; }

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image file'));
        reader.readAsDataURL(file);
    });
}

// Avatar helpers
const AV_COLORS = {
    'cyan-purple': 'linear-gradient(135deg,#00d4ff,#7c3aed)',
    'orange-pink': 'linear-gradient(135deg,#f97316,#ec4899)',
    'green-cyan': 'linear-gradient(135deg,#10b981,#06b6d4)',
    'purple-pink': 'linear-gradient(135deg,#8b5cf6,#ec4899)',
    'amber-red': 'linear-gradient(135deg,#f59e0b,#ef4444)',
    'sky-green': 'linear-gradient(135deg,#06b6d4,#10b981)',
};

function makeAvatarEl(initials, colorKey = 'cyan-purple', size = 52) {
    const el = document.createElement('div');
    el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${AV_COLORS[colorKey] || AV_COLORS['cyan-purple']};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${size * 0.35}px;color:#0a0a0f;flex-shrink:0;`;
    el.textContent = (initials || '??').slice(0, 2).toUpperCase();
    return el;
}

// Toast
function toast(msg, dur = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.style.display = 'block';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.style.display = 'none'; }, dur);
}

// Confirm Dialog
function showConfirm(title, message) {
    return new Promise((resolve) => {
        const overlay = document.getElementById('confirmDialog');
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        overlay.style.display = 'flex';
        const yesBtn = document.getElementById('confirmYes');
        const noBtn = document.getElementById('confirmNo');
        const cleanup = () => {
            overlay.style.display = 'none';
            yesBtn.onclick = null;
            noBtn.onclick = null;
        };
        yesBtn.onclick = () => { cleanup(); resolve(true); };
        noBtn.onclick = () => { cleanup(); resolve(false); };
    });
}

function openQuickStart(markSeenOnOpen = false) {
    const modal = document.getElementById('quickStartModal');
    if (!modal) return;
    if (markSeenOnOpen) DB.save(QUICKSTART_SEEN_KEY, true);
    modal.style.display = 'flex';
}

function closeQuickStart(markSeen = true) {
    const modal = document.getElementById('quickStartModal');
    if (!modal) return;
    if (markSeen) DB.save(QUICKSTART_SEEN_KEY, true);
    modal.style.display = 'none';
}

function maybeShowQuickStart() {
    const seen = DB.load(QUICKSTART_SEEN_KEY, false);
    if (!seen) {
        setTimeout(() => openQuickStart(true), 220);
    }
}

function setupPWAInstall() {
    const installDesc = document.getElementById('installPwaDesc');
    const installed = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (installed && installDesc) installDesc.textContent = 'Installed ✓';

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        if (installDesc) installDesc.textContent = 'Ready to install on this device';
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        if (installDesc) installDesc.textContent = 'Installed ✓';
        toast('Optibit installed successfully');
    });

    window.addEventListener('offline', () => toast('You are offline. Optibit is running in offline mode.'));
    window.addEventListener('online', () => toast('Back online.'));
}

async function promptPwaInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        if (choice.outcome === 'accepted') {
            toast('Installing Optibit...');
        } else {
            toast('Install dismissed');
        }
        deferredInstallPrompt = null;
        return;
    }

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    if (isIOS) {
        alert('To install Optibit:\n\n1. Tap Share\n2. Tap "Add to Home Screen"\n3. Tap Add');
    } else if (isAndroid) {
        alert('To install Optibit:\n\n1. Open browser menu\n2. Tap "Install app" or "Add to Home screen"\n3. Confirm install');
    } else {
        alert('To install Optibit, use your browser install option (usually in the address bar or menu).');
    }
}

function registerAppServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    window.addEventListener('load', async () => {
        try {
            await navigator.serviceWorker.register('sw.js');
        } catch (e) {
            console.warn('Service worker registration failed:', e);
        }
    });
}

// ===================== INIT =====================
window.addEventListener('DOMContentLoaded', () => {
    setupPWAInstall();
    registerAppServiceWorker();
    bootSplash();
    setupAllInteractions();
});

function bootSplash() {
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        splash.style.opacity = '0';
        splash.style.transition = 'opacity 0.5s';
        setTimeout(() => {
            splash.classList.remove('active');
            checkFirstRun();
        }, 500);
    }, 2200);
}

function checkFirstRun() {
    State.user = DB.load('user');
    if (!State.user) {
        showScreen('onboardingScreen');
    } else {
        loadSavedState();
        showScreen('mainApp');
        applyTheme();
        renderChats();
        updateSettingsUI();
        checkBluetoothSupport();
        applyInitialTabFromHash();
        maybeShowQuickStart();
        setDockVisibility(true);
    }
}

function showScreen(id) {
    document.querySelectorAll('#app > .screen').forEach(s => s.classList.remove('active'));
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
}

function applyInitialTabFromHash() {
    const hash = (window.location.hash || '').replace('#', '').toLowerCase();
    if (['chats', 'nearby', 'settings'].includes(hash)) {
        switchTab(hash);
    }
}

function loadSavedState() {
    State.chats = DB.load('chats', {});
    State.theme = DB.load('theme', 'default');
    State.dockSize = DB.load(DOCK_SIZE_KEY, 'large');
    State.notifications = DB.load('notifs', true);
    // Clean up media data URLs from stored chats to save memory (they can't persist anyway)
    for (const cid in State.chats) {
        const chat = State.chats[cid];
        chat.connected = false; // Reset connection state on load
        if (chat.messages) {
            chat.messages.forEach(m => {
                // Keep text-based data, mark media as expired if it was a blob URL
                if (m.mediaUrl && m.mediaUrl.startsWith('blob:')) {
                    m.mediaUrl = null;
                    m.mediaExpired = true;
                }
            });
        }
    }
}

// ===================== BLUETOOTH SUPPORT CHECK =====================
function checkBluetoothSupport() {
    if (navigator.bluetooth) {
        State.btSupported = true;
        document.getElementById('btWarning').style.display = 'none';
    } else {
        State.btSupported = false;
        // Show warning but still allow WiFi mode
        updateBluetoothUI();
    }
}

// ===================== ONBOARDING =====================
let obSlide = 0;
function setupOnboarding() {
    document.getElementById('obNext').addEventListener('click', () => {
        const slides = document.querySelectorAll('.ob-slide');
        const dots = document.querySelectorAll('.ob-dot');
        slides[obSlide].classList.remove('active');
        dots[obSlide].classList.remove('active');
        obSlide++;
        if (obSlide >= slides.length) {
            showScreen('setupScreen');
            obSlide = 0;
        } else {
            slides[obSlide].classList.add('active');
            dots[obSlide].classList.add('active');
            if (obSlide === slides.length - 1) {
                document.getElementById('obNext').innerHTML = 'Get Started <i class="fas fa-rocket"></i>';
            }
        }
    });
    document.getElementById('obSkip').addEventListener('click', () => showScreen('setupScreen'));
    document.querySelectorAll('.ob-dot').forEach((d, i) => {
        d.addEventListener('click', () => {
            document.querySelectorAll('.ob-slide').forEach(s => s.classList.remove('active'));
            document.querySelectorAll('.ob-dot').forEach(x => x.classList.remove('active'));
            obSlide = i;
            document.querySelectorAll('.ob-slide')[i].classList.add('active');
            d.classList.add('active');
        });
    });
}

// ===================== SETUP PROFILE =====================
function setupProfileScreen() {
    let selectedColor = 'cyan-purple';
    let selectedPhoto = null;
    const nameInput = document.getElementById('setupName');
    const statusInput = document.getElementById('setupStatus');
    const doneBtn = document.getElementById('setupDone');
    const initials = document.getElementById('avatarInitials');
    const preview = document.getElementById('avatarPreview');
    const previewPhoto = document.getElementById('avatarPreviewPhoto');
    const setupPhotoInput = document.getElementById('setupPhotoInput');

    function updateSetupPreviewVisuals() {
        if (selectedPhoto) {
            if (previewPhoto) {
                previewPhoto.src = selectedPhoto;
                previewPhoto.style.display = 'block';
            }
            initials.style.display = 'none';
        } else {
            if (previewPhoto) {
                previewPhoto.removeAttribute('src');
                previewPhoto.style.display = 'none';
            }
            initials.style.display = 'inline';
        }
    }

    nameInput.addEventListener('input', () => {
        const val = nameInput.value.trim();
        initials.textContent = val ? val.slice(0, 2).toUpperCase() : '?';
        doneBtn.disabled = !val;
    });

    document.querySelectorAll('.av-color').forEach(c => {
        c.addEventListener('click', () => {
            document.querySelectorAll('.av-color').forEach(x => x.classList.remove('active'));
            c.classList.add('active');
            selectedColor = c.dataset.color;
            preview.style.background = AV_COLORS[selectedColor];
        });
    });

    setupPhotoInput?.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        try {
            selectedPhoto = await fileToDataUrl(file);
            updateSetupPreviewVisuals();
            toast('Profile photo added');
        } catch (err) {
            console.error('Photo read error:', err);
            toast('Could not load photo');
        } finally {
            e.target.value = '';
        }
    });

    updateSetupPreviewVisuals();

    doneBtn.addEventListener('click', () => {
        State.user = {
            id: uid(),
            name: nameInput.value.trim(),
            status: statusInput.value.trim() || 'Available',
            color: selectedColor,
            initials: nameInput.value.trim().slice(0, 2).toUpperCase(),
            photo: selectedPhoto || null
        };
        DB.save('user', State.user);
        loadSavedState();
        showScreen('mainApp');
        applyTheme();
        renderChats();
        updateSettingsUI();
        checkBluetoothSupport();
        applyInitialTabFromHash();
        toast('Welcome to Optibit! 🎉');
        maybeShowQuickStart();
        setDockVisibility(true);
    });
}

// ===================== THEME =====================
function applyTheme() {
    document.getElementById('app').dataset.theme = State.theme;
    const desc = {
        'default': 'Deep Blue (Default)',
        'white': 'White',
        'midnight': 'Midnight',
        'neon': 'Neon',
        'sunset': 'Sunset'
    };
    const el = document.getElementById('themeDesc');
    if (el) el.textContent = desc[State.theme] || 'Deep Blue (Default)';
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.theme === State.theme);
    });
    applyDockSize();
}

function applyDockSize() {
    const app = document.getElementById('app');
    if (app) app.dataset.dockSize = State.dockSize === 'small' ? 'small' : 'large';
    updateDockSizeUI();
}

function setDockSize(size) {
    State.dockSize = size === 'small' ? 'small' : 'large';
    DB.save(DOCK_SIZE_KEY, State.dockSize);
    applyDockSize();
}

function updateDockSizeUI() {
    const smallBtn = document.getElementById('dockSmallBtn');
    const largeBtn = document.getElementById('dockLargeBtn');
    if (!smallBtn || !largeBtn) return;
    smallBtn.classList.toggle('active', State.dockSize === 'small');
    largeBtn.classList.toggle('active', State.dockSize !== 'small');
}

function setDockVisibility(show) {
    const app = document.getElementById('app');
    if (!app) return;
    if (isMobile() && !show) {
        app.classList.add('dock-hidden');
    } else {
        app.classList.remove('dock-hidden');
    }
}

// ===================== TAB SWITCHING =====================
function switchTab(tab) {
    State.currentTab = tab;
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const tabEl = document.getElementById('tab' + tab.charAt(0).toUpperCase() + tab.slice(1));
    const navEl = document.querySelector(`.nav-btn[data-tab="${tab}"]`);
    if (tabEl) tabEl.classList.add('active');
    if (navEl) navEl.classList.add('active');
}

// ===================== BLUETOOTH ENGINE =====================
async function getBluetoothAvailability() {
    if (!navigator.bluetooth || !navigator.bluetooth.getAvailability) return null;
    try {
        return await navigator.bluetooth.getAvailability();
    } catch (e) {
        console.warn('Bluetooth availability check failed:', e);
        return null;
    }
}

function removeBluetoothListeners(device) {
    if (!device) return;
    if (device.btNotifyCharacteristic && device.btValueListener) {
        try {
            device.btNotifyCharacteristic.removeEventListener('characteristicvaluechanged', device.btValueListener);
        } catch (e) {
            console.debug('BT listener cleanup skipped:', e);
        }
    }
    device.btValueListener = null;
}

async function setupBluetoothTransport(deviceInfo, server, statusEl) {
    for (const protocol of BLE_PROTOCOLS) {
        try {
            if (statusEl) statusEl.textContent = `Configuring ${protocol.name}...`;
            const service = await server.getPrimaryService(protocol.service);
            const writeCharacteristic = await service.getCharacteristic(protocol.write);
            const notifyCharacteristic = protocol.notify === protocol.write
                ? writeCharacteristic
                : await service.getCharacteristic(protocol.notify);

            const supportsNotify = !!(
                notifyCharacteristic &&
                (notifyCharacteristic.properties.notify || notifyCharacteristic.properties.indicate)
            );

            let valueListener = null;
            if (supportsNotify) {
                valueListener = (event) => handleBluetoothData(deviceInfo.id, event.target.value);
                await notifyCharacteristic.startNotifications();
                notifyCharacteristic.addEventListener('characteristicvaluechanged', valueListener);
            }

            deviceInfo.btProtocol = protocol.name;
            deviceInfo.btWriteCharacteristic = writeCharacteristic;
            deviceInfo.btWriteMethod = typeof writeCharacteristic.writeValueWithoutResponse === 'function'
                ? 'writeValueWithoutResponse'
                : 'writeValue';
            deviceInfo.btNotifyCharacteristic = supportsNotify ? notifyCharacteristic : null;
            deviceInfo.btValueListener = valueListener;
            return true;
        } catch (err) {
            console.debug(`BLE protocol "${protocol.name}" unavailable:`, err);
        }
    }

    deviceInfo.btProtocol = null;
    deviceInfo.btWriteCharacteristic = null;
    deviceInfo.btWriteMethod = 'writeValue';
    deviceInfo.btNotifyCharacteristic = null;
    deviceInfo.btValueListener = null;
    return false;
}

async function toggleBluetooth() {
    if (State.bluetoothEnabled) {
        // Turn off
        State.bluetoothEnabled = false;
        State.isScanning = false;
        State.discoveredDevices = [];
        State.connectedDevices.forEach(device => {
            if (device.connectionType !== 'bluetooth') return;
            removeBluetoothListeners(device);
            try {
                if (device.btDevice && device.btDevice.gatt && device.btDevice.gatt.connected) {
                    device.btDevice.gatt.disconnect();
                }
            } catch (e) {
                console.debug('Bluetooth disconnect skipped:', e);
            }
            device.connected = false;
        });
        updateBluetoothUI();
        renderChats();
        toast('Bluetooth turned off');
    } else {
        // Turn on app Bluetooth mode - hardware toggle must be done by user/device settings.
        if (!State.btSupported) {
            toast('Bluetooth not supported in this browser');
            // Show warning
            document.getElementById('btWarning').style.display = 'block';
            return;
        }
        State.bluetoothEnabled = true;
        updateBluetoothUI();
        const availability = await getBluetoothAvailability();
        if (availability === false) {
            toast('Bluetooth is off in device settings. Turn it on, then tap Scan.');
        } else {
            toast('Bluetooth mode enabled. Tap Scan to connect 📡');
        }
    }
}

function updateBluetoothUI() {
    const powerCard = document.getElementById('btPowerCard');
    const powerLabel = document.getElementById('btPowerLabel');
    const powerSub = document.getElementById('btPowerSub');
    const toggleText = document.getElementById('btToggleText');
    const statusCard = document.getElementById('btStatusCard');
    const connectionModes = document.getElementById('connectionModes');
    const nearbySection = document.getElementById('nearbySection');
    const connectedSection = document.getElementById('connectedSection');
    const btWarning = document.getElementById('btWarning');
    const subtitle = document.getElementById('nearbySubtitle');

    if (State.bluetoothEnabled) {
        powerCard.classList.add('active');
        powerLabel.textContent = 'Bluetooth On';
        powerSub.textContent = 'Ready to scan for nearby devices';
        toggleText.textContent = 'Turn Off';
        statusCard.style.display = 'flex';
        connectionModes.style.display = 'flex';
        nearbySection.style.display = 'block';
        btWarning.style.display = 'none';
        subtitle.textContent = 'Scan and connect to nearby devices';
    } else {
        powerCard.classList.remove('active');
        powerLabel.textContent = 'Bluetooth Off';
        powerSub.textContent = 'Enable Bluetooth in your device settings, then turn it on here';
        toggleText.textContent = 'Turn On';
        statusCard.style.display = 'none';
        connectionModes.style.display = 'none';
        nearbySection.style.display = 'none';
        subtitle.textContent = 'Turn on Bluetooth to find nearby devices';

        if (!State.btSupported) {
            btWarning.style.display = 'block';
            powerSub.textContent = 'Web Bluetooth not supported - use WiFi Direct instead';
        }
    }

    // Show connected devices section
    if (State.connectedDevices.length > 0) {
        connectedSection.style.display = 'block';
        renderConnectedDevices();
    } else {
        connectedSection.style.display = 'none';
    }

    // Update settings
    const btSettingsStatus = document.getElementById('btSettingsStatus');
    if (btSettingsStatus) {
        if (State.bluetoothEnabled) {
            const connCount = State.connectedDevices.filter(d => d.connectionType === 'bluetooth').length;
            btSettingsStatus.textContent = connCount > 0 ? `Connected to ${connCount} device(s)` : 'On - Ready to connect';
        } else {
            btSettingsStatus.textContent = 'Off';
        }
    }
}

// Real Bluetooth Scanning using Web Bluetooth API
async function scanForDevices() {
    if (State.connectionMode === 'bluetooth') {
        await scanBluetooth();
    } else {
        await startWifiDirect();
    }
}

async function scanBluetooth() {
    if (!navigator.bluetooth) {
        toast('Bluetooth not supported in this browser');
        return;
    }

    const statusLabel = document.getElementById('btStatusLabel');
    const statusSub = document.getElementById('btStatusSub');
    const scanBtn = document.getElementById('btScanBtn');

    statusLabel.textContent = 'Scanning...';
    statusSub.textContent = 'Searching for Bluetooth devices...';
    scanBtn.disabled = true;
    State.isScanning = true;

    try {
        // Web Bluetooth API - requestDevice will show browser's device picker
        const device = await navigator.bluetooth.requestDevice({
            // Accept all devices or filter by service
            acceptAllDevices: true,
            optionalServices: BLE_OPTIONAL_SERVICES
        });

        statusLabel.textContent = 'Device Found!';
        statusSub.textContent = `Found: ${device.name || 'Unknown Device'}`;

        // Add to discovered devices
        const discovered = {
            id: device.id || uid(),
            name: device.name || 'Unknown Device',
            initials: (device.name || 'UD').slice(0, 2).toUpperCase(),
            color: getRandomColor(),
            btDevice: device,
            signal: 'strong',
            connectionType: 'bluetooth'
        };

        // Check if already discovered
        const existing = State.discoveredDevices.findIndex(d => d.id === discovered.id);
        if (existing >= 0) {
            State.discoveredDevices[existing] = discovered;
        } else {
            State.discoveredDevices.push(discovered);
        }

        renderDiscoveredDevices();
        document.getElementById('deviceCount').textContent = State.discoveredDevices.length;

        // Listen for disconnection
        device.addEventListener('gattserverdisconnected', () => {
            handleDeviceDisconnected(discovered.id);
        });

        toast(`Found: ${discovered.name}`);

    } catch (err) {
        if (err.name === 'NotFoundError') {
            statusLabel.textContent = 'No Device Selected';
            statusSub.textContent = 'Tap Scan to search again';
        } else {
            statusLabel.textContent = 'Scan Failed';
            statusSub.textContent = err.message || 'Try again';
            console.error('Bluetooth scan error:', err);
        }
    } finally {
        State.isScanning = false;
        scanBtn.disabled = false;
    }
}

function getRandomColor() {
    const colors = Object.keys(AV_COLORS);
    return colors[Math.floor(Math.random() * colors.length)];
}

// Connect to a Bluetooth device
async function connectToDevice(deviceInfo) {
    const modal = document.getElementById('connectingModal');
    const deviceName = document.getElementById('connectingDeviceName');
    const status = document.getElementById('connectingStatus');

    modal.style.display = 'flex';
    deviceName.textContent = deviceInfo.name;
    status.textContent = 'Connecting via Bluetooth...';

    try {
        let server = null;

        if (!deviceInfo.btDevice || !deviceInfo.btDevice.gatt) {
            throw new Error('Selected device does not expose Bluetooth GATT');
        }

        status.textContent = 'Connecting to GATT server...';
        server = deviceInfo.btDevice.gatt.connected
            ? deviceInfo.btDevice.gatt
            : await deviceInfo.btDevice.gatt.connect();
        status.textContent = 'Connected! Setting up communication...';

        removeBluetoothListeners(deviceInfo);
        const protocolReady = await setupBluetoothTransport(deviceInfo, server, status);
        if (protocolReady) {
            status.textContent = `Ready via ${deviceInfo.btProtocol}`;
        } else {
            status.textContent = 'Connected, but this device has no supported chat profile';
            toast('Device connected with limited BLE support. Use UART BLE modules for chat.');
        }
        deviceInfo.btServer = server;

        // Add to connected devices
        deviceInfo.connected = true;
        deviceInfo.connectionType = 'bluetooth';

        const existingIdx = State.connectedDevices.findIndex(d => d.id === deviceInfo.id);
        if (existingIdx >= 0) {
            State.connectedDevices[existingIdx] = deviceInfo;
        } else {
            State.connectedDevices.push(deviceInfo);
        }

        // Create or open chat
        openChatWithDevice(deviceInfo);

        modal.style.display = 'none';
        updateBluetoothUI();
        renderConnectedDevices();
        if (deviceInfo.btProtocol) {
            toast(`Connected to ${deviceInfo.name} via ${deviceInfo.btProtocol} ✓`);
        } else {
            toast(`Connected to ${deviceInfo.name} ✓`);
        }

    } catch (err) {
        console.error('Connection error:', err);
        status.textContent = `Failed: ${err.message}`;
        setTimeout(() => { modal.style.display = 'none'; }, 2000);
        toast('Connection failed. Try again.');
    }
}

function handleDeviceDisconnected(deviceId) {
    delete State.btReceiveBuffers[deviceId];

    const idx = State.connectedDevices.findIndex(d => d.id === deviceId);
    if (idx >= 0) {
        removeBluetoothListeners(State.connectedDevices[idx]);
        State.connectedDevices[idx].connected = false;
        toast(`${State.connectedDevices[idx].name} disconnected`);
    }

    // Update chat connection status
    for (const cid in State.chats) {
        if (State.chats[cid].deviceId === deviceId) {
            State.chats[cid].connected = false;
        }
    }

    updateBluetoothUI();
    renderChats();
    if (State.activeChatId) updateChatHeader();
}

// Send data over Bluetooth
async function sendBluetoothData(deviceId, data) {
    const device = State.connectedDevices.find(d => d.id === deviceId);
    const characteristic = device?.btWriteCharacteristic || device?.btCharacteristic;
    if (!device || !characteristic) {
        console.log('No BT characteristic, storing message locally');
        return false;
    }

    try {
        const encoder = new TextEncoder();
        // Add newline framing so BLE chunks can be reassembled on receive.
        const encoded = encoder.encode(JSON.stringify(data) + '\n');
        const writeMethod = (
            device.btWriteMethod === 'writeValueWithoutResponse' &&
            typeof characteristic.writeValueWithoutResponse === 'function'
        ) ? 'writeValueWithoutResponse' : 'writeValue';

        const writeChunkWithRetry = async (chunk) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    await characteristic[writeMethod](chunk);
                    return;
                } catch (err) {
                    if (attempt === 2) throw err;
                    await new Promise(resolve => setTimeout(resolve, 40 + attempt * 35));
                }
            }
        };

        for (let i = 0; i < encoded.length; i += CHUNK_SIZE) {
            const chunk = encoded.slice(i, i + CHUNK_SIZE);
            await writeChunkWithRetry(chunk);
            if (writeMethod === 'writeValueWithoutResponse') {
                await new Promise(resolve => setTimeout(resolve, 12));
            }
        }
        return true;
    } catch (err) {
        console.error('BT send error:', err);
        return false;
    }
}

function handleBluetoothData(deviceId, value) {
    const decoder = new TextDecoder();
    const chunk = decoder.decode(value);
    State.btReceiveBuffers[deviceId] = (State.btReceiveBuffers[deviceId] || '') + chunk;

    let buffer = State.btReceiveBuffers[deviceId];
    let newlineIndex = buffer.indexOf('\n');

    while (newlineIndex !== -1) {
        const payload = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (payload) {
            try {
                const data = JSON.parse(payload);
                receiveMessage(deviceId, data);
            } catch (e) {
                // Backward compatibility for plain text payloads.
                receiveMessage(deviceId, { type: 'text', text: payload });
            }
        }
        newlineIndex = buffer.indexOf('\n');
    }

    State.btReceiveBuffers[deviceId] = buffer;
}

// ===================== WIFI DIRECT (WebRTC) =====================
let localPeerId = null;
let peerConnections = {};

async function startWifiDirect() {
    const statusLabel = document.getElementById('btStatusLabel');
    const statusSub = document.getElementById('btStatusSub');
    const scanCenterIcon = document.getElementById('scanCenterIcon');

    scanCenterIcon.className = 'fas fa-wifi bt-center-icon';
    statusLabel.textContent = 'WiFi Direct Mode';
    statusSub.textContent = 'Share your Room Code with nearby users to connect';

    // Generate a room code for this session
    if (!localPeerId) {
        localPeerId = uid().slice(0, 6).toUpperCase();
    }

    // Show the WiFi connection prompt
    const deviceList = document.getElementById('deviceList');
    deviceList.innerHTML = `
        <div class="wifi-connect-card">
            <div class="wifi-code-section">
                <div class="wifi-code-label">Your Room Code</div>
                <div class="wifi-code-display">${localPeerId}</div>
                <div class="wifi-code-hint">Share this code with nearby users</div>
            </div>
            <div class="wifi-join-section">
                <div class="wifi-join-label">Join a Room</div>
                <div class="wifi-join-input-row">
                    <input type="text" id="wifiPeerCode" placeholder="Enter room code..." maxlength="6" class="wifi-code-input">
                    <button class="btn-primary-app sm" id="wifiConnectBtn">
                        <i class="fas fa-link"></i> Connect
                    </button>
                </div>
            </div>
        </div>
    `;

    // Add styles for wifi card inline
    const style = document.createElement('style');
    style.id = 'wifi-styles';
    if (!document.getElementById('wifi-styles')) {
        style.textContent = `
            .wifi-connect-card { padding: 20px; background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r-lg); }
            .wifi-code-section { text-align: center; margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
            .wifi-code-label { font-size: 12px; color: var(--txt3); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
            .wifi-code-display { font-size: 36px; font-weight: 900; font-family: var(--mono); letter-spacing: 8px; background: var(--grad); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
            .wifi-code-hint { font-size: 12px; color: var(--txt3); margin-top: 8px; }
            .wifi-join-section {}
            .wifi-join-label { font-size: 12px; color: var(--txt3); font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
            .wifi-join-input-row { display: flex; gap: 10px; }
            .wifi-code-input { flex: 1; padding: 12px 16px; background: var(--bg3); border: 1px solid var(--border); border-radius: var(--r-md); color: var(--txt1); font-family: var(--mono); font-size: 16px; letter-spacing: 4px; text-transform: uppercase; outline: none; text-align: center; }
            .wifi-code-input:focus { border-color: var(--cyan); }
            .wifi-code-input::placeholder { letter-spacing: 0; text-transform: none; color: var(--txt3); font-size: 13px; }
        `;
        document.head.appendChild(style);
    }

    // Set up connect button
    setTimeout(() => {
        const connectBtn = document.getElementById('wifiConnectBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                const code = document.getElementById('wifiPeerCode').value.trim().toUpperCase();
                if (code.length >= 4) {
                    connectWifiDirect(code);
                } else {
                    toast('Enter a valid room code');
                }
            });
        }
    }, 100);

    // Update WiFi settings status
    const wifiStatus = document.getElementById('wifiSettingsStatus');
    if (wifiStatus) {
        wifiStatus.textContent = `Room: ${localPeerId}`;
    }
}

async function connectWifiDirect(remotePeerId) {
    const modal = document.getElementById('connectingModal');
    const deviceName = document.getElementById('connectingDeviceName');
    const status = document.getElementById('connectingStatus');

    modal.style.display = 'flex';
    deviceName.textContent = `Room: ${remotePeerId}`;
    status.textContent = 'Setting up WebRTC connection...';

    try {
        // Create RTCPeerConnection
        const config = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);
        const dataChannel = pc.createDataChannel('optibit-chat', { ordered: true });

        // Create a device info for this WiFi connection
        const deviceInfo = {
            id: 'wifi-' + remotePeerId,
            name: 'WiFi User (' + remotePeerId + ')',
            initials: remotePeerId.slice(0, 2),
            color: getRandomColor(),
            connected: false,
            connectionType: 'wifi',
            rtcConn: pc,
            dataChannel: dataChannel
        };

        setupDataChannel(dataChannel, deviceInfo);

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate:', JSON.stringify(event.candidate));
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                deviceInfo.connected = true;
                const idx = State.connectedDevices.findIndex(d => d.id === deviceInfo.id);
                if (idx >= 0) State.connectedDevices[idx] = deviceInfo;
                else State.connectedDevices.push(deviceInfo);

                openChatWithDevice(deviceInfo);
                modal.style.display = 'none';
                updateBluetoothUI();
                toast(`Connected via WiFi Direct ✓`);
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                handleDeviceDisconnected(deviceInfo.id);
            }
        };

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        status.textContent = 'Offer created. Share this with your peer...';

        // Since we can't have a signaling server, we use a manual exchange flow
        // Show the SDP data for manual exchange
        const offerStr = btoa(JSON.stringify(pc.localDescription));

        // For simplicity, we'll simulate a connection with local storage signaling
        // In a real app, you'd use a signaling server or QR codes
        localStorage.setItem('optibit_signal_' + localPeerId, offerStr);

        // Check for answer
        status.textContent = 'Waiting for peer to accept...';

        // Poll for answer (simple signaling via localStorage)
        let attempts = 0;
        const checkAnswer = setInterval(async () => {
            attempts++;
            const answerStr = localStorage.getItem('optibit_signal_answer_' + localPeerId);
            if (answerStr) {
                try {
                    const answer = JSON.parse(atob(answerStr));
                    await pc.setRemoteDescription(answer);
                    localStorage.removeItem('optibit_signal_answer_' + localPeerId);
                    clearInterval(checkAnswer);
                } catch (e) {
                    console.error('Answer processing error:', e);
                }
            }
            if (attempts > 60) { // 30 second timeout
                clearInterval(checkAnswer);
                modal.style.display = 'none';

                // Fallback: create local chat for testing
                deviceInfo.connected = true;
                State.connectedDevices.push(deviceInfo);
                openChatWithDevice(deviceInfo);
                updateBluetoothUI();
                toast('WiFi Direct chat ready (local mode)');
            }
        }, 500);

        peerConnections[remotePeerId] = { pc, dataChannel, deviceInfo };

        // Also store as connected for immediate local chat
        if (!State.connectedDevices.find(d => d.id === deviceInfo.id)) {
            deviceInfo.connected = true;
            State.connectedDevices.push(deviceInfo);
        }

        setTimeout(() => {
            modal.style.display = 'none';
            openChatWithDevice(deviceInfo);
            updateBluetoothUI();
            renderConnectedDevices();
        }, 1500);

    } catch (err) {
        console.error('WiFi Direct error:', err);
        status.textContent = `Failed: ${err.message}`;
        setTimeout(() => { modal.style.display = 'none'; }, 2000);
        toast('WiFi connection failed');
    }
}

function setupDataChannel(channel, deviceInfo) {
    channel.onopen = () => {
        console.log('Data channel open with', deviceInfo.name);
        deviceInfo.connected = true;

        // Send user info
        channel.send(JSON.stringify({
            type: 'userInfo',
            user: State.user
        }));
    };

    channel.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'userInfo') {
                // Update device name with actual user info
                deviceInfo.name = data.user.name;
                deviceInfo.initials = data.user.initials;
                deviceInfo.color = data.user.color;
                renderChats();
                renderConnectedDevices();
            } else {
                receiveMessage(deviceInfo.id, data);
            }
        } catch (e) {
            receiveMessage(deviceInfo.id, { type: 'text', text: event.data });
        }
    };

    channel.onclose = () => {
        handleDeviceDisconnected(deviceInfo.id);
    };
}

// ===================== CHAT MANAGEMENT =====================
function openChatWithDevice(deviceInfo) {
    const chatId = 'chat-' + deviceInfo.id;

    if (!State.chats[chatId]) {
        State.chats[chatId] = {
            id: chatId,
            deviceId: deviceInfo.id,
            name: deviceInfo.name,
            initials: deviceInfo.initials,
            color: deviceInfo.color,
            connected: deviceInfo.connected,
            connectionType: deviceInfo.connectionType,
            messages: [],
            lastMsg: 'Connected',
            lastTs: now(),
            unread: 0
        };
    } else {
        State.chats[chatId].connected = deviceInfo.connected;
        State.chats[chatId].connectionType = deviceInfo.connectionType;
    }

    DB.save('chats', State.chats);
    renderChats();
    openChat(chatId);
}

function openChat(chatId) {
    State.activeChatId = chatId;
    const chat = State.chats[chatId];
    if (!chat) return;

    // Clear unread
    chat.unread = 0;
    DB.save('chats', State.chats);
    renderChats();

    if (isMobile()) {
        // On mobile, use the slide-over screen
        const chatView = document.getElementById('chatView');
        chatView.innerHTML = document.getElementById('chatViewInner').outerHTML.replace('chatViewInner', 'chatViewMobile');
        chatView.style.display = 'flex';
        chatView.classList.add('visible');

        // Re-bind mobile chat events
        setTimeout(() => setupMobileChatEvents(), 50);
    } else {
        // On desktop, show in content area
        document.getElementById('contentWelcome').style.display = 'none';
        document.getElementById('chatViewInner').style.display = 'flex';
    }

    updateChatHeader();
    renderMessages();

    // Mark active in chat list
    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat'));
    const activeItem = document.querySelector(`.chat-item[data-chat="${chatId}"]`);
    if (activeItem) activeItem.classList.add('active-chat');

    // Focus input
    setTimeout(() => {
        const input = getMessageInput();
        if (input) input.focus();
    }, 100);

    setDockVisibility(false);
}

function getMessageInput() {
    if (isMobile()) {
        return document.querySelector('#chatView .message-input');
    }
    return document.getElementById('messageInput');
}

function closeChat() {
    State.activeChatId = null;

    if (isMobile()) {
        const chatView = document.getElementById('chatView');
        chatView.classList.remove('visible');
        setTimeout(() => { chatView.style.display = 'none'; }, 350);
    } else {
        document.getElementById('contentWelcome').style.display = 'flex';
        document.getElementById('chatViewInner').style.display = 'none';
    }

    document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active-chat'));
    setDockVisibility(true);
}

function updateChatHeader() {
    const chat = State.chats[State.activeChatId];
    if (!chat) return;

    const containers = isMobile() ? ['#chatView'] : ['#chatViewInner'];
    containers.forEach(sel => {
        const container = document.querySelector(sel);
        if (!container) return;

        const avatarEl = container.querySelector('.chat-header-avatar');
        const nameEl = container.querySelector('.chat-header-name');
        const statusEl = container.querySelector('.chat-header-status');

        if (avatarEl) {
            avatarEl.innerHTML = '';
            avatarEl.style.background = AV_COLORS[chat.color] || AV_COLORS['cyan-purple'];
            avatarEl.textContent = chat.initials;
        }
        if (nameEl) nameEl.textContent = chat.name;
        if (statusEl) {
            const dot = statusEl.querySelector('.bt-dot');
            const typeEl = statusEl.querySelector('span:last-child') || container.querySelector('#chatConnectionType');
            if (dot) {
                dot.className = 'bt-dot' + (chat.connected ? '' : ' offline');
            }
            if (typeEl) {
                typeEl.textContent = chat.connected
                    ? `Connected via ${chat.connectionType === 'wifi' ? 'WiFi Direct' : 'Bluetooth'}`
                    : 'Disconnected';
            }
        }
    });
}

// ===================== MESSAGE HANDLING =====================
function sendMessage(type = 'text', content = null) {
    if (!State.activeChatId) return;
    const chat = State.chats[State.activeChatId];
    if (!chat) return;

    const input = getMessageInput();
    let msg = null;

    if (type === 'text') {
        const text = input ? input.textContent.trim() : '';
        if (!text) return;
        msg = {
            id: uid(),
            from: 'me',
            type: 'text',
            text: text,
            ts: now(),
            status: 'sent'
        };
        if (input) input.textContent = '';
    } else if (type === 'image' && content) {
        msg = {
            id: uid(),
            from: 'me',
            type: 'image',
            mediaUrl: content.url,
            fileName: content.name,
            fileSize: content.size,
            ts: now(),
            status: 'sent'
        };
    } else if (type === 'video' && content) {
        msg = {
            id: uid(),
            from: 'me',
            type: 'video',
            mediaUrl: content.url,
            fileName: content.name,
            fileSize: content.size,
            ts: now(),
            status: 'sent'
        };
    } else if (type === 'voice' && content) {
        msg = {
            id: uid(),
            from: 'me',
            type: 'voice',
            mediaUrl: content.url,
            duration: content.duration,
            ts: now(),
            status: 'sent'
        };
    } else if (type === 'file' && content) {
        msg = {
            id: uid(),
            from: 'me',
            type: 'file',
            fileName: content.name,
            fileSize: content.size,
            ts: now(),
            status: 'sent'
        };
    }

    if (!msg) return;

    // Add message to chat
    chat.messages.push(msg);
    chat.lastMsg = getMessagePreview(msg);
    chat.lastTs = msg.ts;

    // Try to send via connection
    sendViaConnection(chat.deviceId, msg);

    // Save and render
    DB.save('chats', State.chats);
    renderMessages();
    renderChats();
    updateInputUI();
    scrollToBottom();
}

function sendViaConnection(deviceId, msg) {
    const device = State.connectedDevices.find(d => d.id === deviceId);
    if (!device || !device.connected) return;

    if (device.connectionType === 'wifi' && device.dataChannel && device.dataChannel.readyState === 'open') {
        try {
            device.dataChannel.send(JSON.stringify({
                type: 'message',
                message: msg
            }));
            msg.status = 'delivered';
        } catch (e) {
            console.error('WiFi send error:', e);
        }
    } else if (device.connectionType === 'bluetooth') {
        sendBluetoothData(deviceId, { type: 'message', message: msg }).then((sent) => {
            if (sent) {
                msg.status = 'delivered';
                DB.save('chats', State.chats);
                renderChats();
                if (State.activeChatId === 'chat-' + deviceId) {
                    renderMessages();
                }
            }
        });
    }
}

function receiveMessage(deviceId, data) {
    const chatId = 'chat-' + deviceId;
    let chat = State.chats[chatId];

    if (!chat) {
        // Create chat from incoming message
        const device = State.connectedDevices.find(d => d.id === deviceId);
        chat = {
            id: chatId,
            deviceId: deviceId,
            name: device ? device.name : 'Unknown',
            initials: device ? device.initials : '??',
            color: device ? device.color : 'cyan-purple',
            connected: true,
            connectionType: device ? device.connectionType : 'bluetooth',
            messages: [],
            lastMsg: '',
            lastTs: now(),
            unread: 0
        };
        State.chats[chatId] = chat;
    }

    const msg = data.message || {
        id: uid(),
        from: 'them',
        type: data.type || 'text',
        text: data.text || '',
        ts: now(),
        status: 'read'
    };

    if (msg.from !== 'them') msg.from = 'them';

    chat.messages.push(msg);
    chat.lastMsg = getMessagePreview(msg);
    chat.lastTs = msg.ts;

    if (State.activeChatId !== chatId) {
        chat.unread = (chat.unread || 0) + 1;
    }

    DB.save('chats', State.chats);
    renderChats();

    if (State.activeChatId === chatId) {
        renderMessages();
        scrollToBottom();
    }

    // Notification sound/vibration
    if (State.notifications && navigator.vibrate) {
        navigator.vibrate(100);
    }
}

function getMessagePreview(msg) {
    switch (msg.type) {
        case 'text': return msg.text.length > 40 ? msg.text.slice(0, 40) + '...' : msg.text;
        case 'image': return '📷 Image';
        case 'video': return '🎥 Video';
        case 'voice': return '🎤 Voice note';
        case 'file': return '📄 ' + (msg.fileName || 'File');
        default: return msg.text || '';
    }
}

// ===================== RENDER FUNCTIONS =====================
function renderChats() {
    const list = document.getElementById('chatList');
    const empty = document.getElementById('chatsEmpty');
    const chatEntries = Object.values(State.chats).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

    if (chatEntries.length === 0) {
        list.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }

    list.style.display = 'block';
    empty.style.display = 'none';

    let totalUnread = 0;
    list.innerHTML = chatEntries.map(chat => {
        totalUnread += chat.unread || 0;
        const isActive = State.activeChatId === chat.id;
        return `
            <div class="chat-item ${isActive ? 'active-chat' : ''}" data-chat="${chat.id}" onclick="openChat('${chat.id}')">
                <div class="chat-item-avatar" style="background:${AV_COLORS[chat.color] || AV_COLORS['cyan-purple']}">
                    ${chat.initials}
                    ${chat.connected ? '<div class="online-dot"></div>' : ''}
                </div>
                <div class="chat-item-info">
                    <div class="chat-item-top">
                        <div class="chat-item-name">${escapeHtml(chat.name)}</div>
                        <div class="chat-item-time">${chat.lastTs ? relativeTime(chat.lastTs) : ''}</div>
                    </div>
                    <div class="chat-item-bottom">
                        <div class="chat-item-msg">${escapeHtml(chat.lastMsg || '')}</div>
                        ${chat.unread > 0 ? `<div class="chat-item-unread">${chat.unread}</div>` : ''}
                    </div>
                    <div class="chat-item-connection">
                        <i class="${chat.connectionType === 'wifi' ? 'fas fa-wifi' : 'fab fa-bluetooth-b'}"></i>
                        ${chat.connected ? 'Connected' : 'Offline'}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Update badge
    const badge = document.getElementById('chatBadge');
    if (totalUnread > 0) {
        badge.textContent = totalUnread;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function renderMessages() {
    if (!State.activeChatId) return;
    const chat = State.chats[State.activeChatId];
    if (!chat) return;

    const container = isMobile()
        ? document.querySelector('#chatView .messages-container')
        : document.getElementById('messagesContainer');

    if (!container) return;

    let html = '<div class="chat-date-divider"><span>Today</span></div>';

    chat.messages.forEach(msg => {
        html += renderMessageBubble(msg);
    });

    container.innerHTML = html;
    scrollToBottom();

    // Attach media click handlers
    container.querySelectorAll('.msg-image').forEach(img => {
        img.addEventListener('click', () => showMediaViewer(img.src, 'image'));
    });
    container.querySelectorAll('.msg-voice-play').forEach(btn => {
        btn.addEventListener('click', () => {
            const url = btn.dataset.url;
            if (url) playVoiceNote(url, btn);
        });
    });
}

function renderMessageBubble(msg) {
    const isMe = msg.from === 'me';
    const rowClass = isMe ? 'me' : 'them';
    let content = '';

    switch (msg.type) {
        case 'text':
            content = `<div class="msg-text">${escapeHtml(msg.text)}</div>`;
            break;
        case 'image':
            if (msg.mediaUrl && !msg.mediaExpired) {
                content = `<img class="msg-image" src="${msg.mediaUrl}" alt="Image" loading="lazy">`;
            } else {
                content = `<div class="msg-text">📷 Image ${msg.mediaExpired ? '(expired)' : ''}</div>`;
            }
            break;
        case 'video':
            if (msg.mediaUrl && !msg.mediaExpired) {
                content = `<video class="msg-video" controls playsinline><source src="${msg.mediaUrl}" type="video/mp4"></video>`;
            } else {
                content = `<div class="msg-text">🎥 Video ${msg.mediaExpired ? '(expired)' : ''}</div>`;
            }
            break;
        case 'voice':
            const bars = Array.from({ length: 20 }, () =>
                `<div class="msg-voice-bar" style="height:${Math.random() * 18 + 6}px"></div>`
            ).join('');
            content = `
                <div class="msg-voice">
                    <button class="msg-voice-play" data-url="${msg.mediaUrl || ''}"><i class="fas fa-play"></i></button>
                    <div class="msg-voice-waveform">${bars}</div>
                    <div class="msg-voice-dur">${msg.duration || '0:00'}</div>
                </div>
            `;
            break;
        case 'file':
            content = `
                <div class="msg-file">
                    <div class="msg-file-icon"><i class="fas fa-file"></i></div>
                    <div class="msg-file-info">
                        <div class="msg-file-name">${escapeHtml(msg.fileName || 'File')}</div>
                        <div class="msg-file-size">${msg.fileSize ? formatBytes(msg.fileSize) : ''}</div>
                    </div>
                </div>
            `;
            break;
        default:
            content = `<div class="msg-text">${escapeHtml(msg.text || '')}</div>`;
    }

    const statusIcon = isMe ? getStatusIcon(msg.status) : '';

    return `
        <div class="msg-row ${rowClass}">
            <div class="msg-bubble">
                ${content}
                <div class="msg-time">${timeFmt(msg.ts)} ${statusIcon}</div>
            </div>
        </div>
    `;
}

function getStatusIcon(status) {
    switch (status) {
        case 'sent': return '<span class="msg-status">✓</span>';
        case 'delivered': return '<span class="msg-status">✓✓</span>';
        case 'read': return '<span class="msg-status" style="color:#00d4ff">✓✓</span>';
        default: return '<span class="msg-status">⏳</span>';
    }
}

function renderDiscoveredDevices() {
    const list = document.getElementById('deviceList');
    const count = document.getElementById('deviceCount');

    if (State.connectionMode === 'wifi') return; // WiFi mode has its own UI

    count.textContent = State.discoveredDevices.length;

    if (State.discoveredDevices.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--txt3);font-size:13px;">No devices found yet. Tap Scan to search.</div>';
        return;
    }

    list.innerHTML = State.discoveredDevices.map(device => {
        const isConnected = State.connectedDevices.some(d => d.id === device.id && d.connected);
        return `
            <div class="device-item" onclick="${isConnected ? `openChatWithConnectedDevice('${device.id}')` : `connectToDeviceById('${device.id}')`}">
                <div class="device-avatar" style="background:${AV_COLORS[device.color] || AV_COLORS['cyan-purple']}">${device.initials}</div>
                <div class="device-info">
                    <div class="device-name">${escapeHtml(device.name)}</div>
                    <div class="device-detail">
                        <i class="fab fa-bluetooth-b"></i>
                        ${isConnected ? 'Connected' : 'Tap to connect'}
                    </div>
                </div>
                <button class="device-action ${isConnected ? 'connected' : ''}">${isConnected ? 'Chat' : 'Connect'}</button>
            </div>
        `;
    }).join('');
}

function renderConnectedDevices() {
    const list = document.getElementById('connectedList');
    if (!list) return;

    const connected = State.connectedDevices.filter(d => d.connected);

    list.innerHTML = connected.map(device => `
        <div class="device-item" onclick="openChatWithConnectedDevice('${device.id}')">
            <div class="device-avatar" style="background:${AV_COLORS[device.color] || AV_COLORS['cyan-purple']}">${device.initials}</div>
            <div class="device-info">
                <div class="device-name">${escapeHtml(device.name)}</div>
                <div class="device-detail">
                    <i class="${device.connectionType === 'wifi' ? 'fas fa-wifi' : 'fab fa-bluetooth-b'}"></i>
                    Connected via ${device.connectionType === 'wifi' ? 'WiFi Direct' : 'Bluetooth'}
                </div>
            </div>
            <button class="device-action connected">Chat</button>
        </div>
    `).join('');
}

// Helper functions for onclick handlers
window.connectToDeviceById = function (deviceId) {
    const device = State.discoveredDevices.find(d => d.id === deviceId);
    if (device) connectToDevice(device);
};

window.openChatWithConnectedDevice = function (deviceId) {
    const device = State.connectedDevices.find(d => d.id === deviceId);
    if (device) openChatWithDevice(device);
};

function scrollToBottom() {
    setTimeout(() => {
        const container = isMobile()
            ? document.querySelector('#chatView .messages-container')
            : document.getElementById('messagesContainer');
        if (container) container.scrollTop = container.scrollHeight;
    }, 50);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===================== FILE & MEDIA HANDLING =====================
function handleFileSelect(type, files) {
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target.result;

            if (type === 'image') {
                // Show preview
                showMediaPreview(url, file.name);
                sendMessage('image', { url, name: file.name, size: file.size });
            } else if (type === 'video') {
                sendMessage('video', { url: URL.createObjectURL(file), name: file.name, size: file.size });
            } else {
                sendMessage('file', { name: file.name, size: file.size });
            }
        };

        if (type === 'image') {
            reader.readAsDataURL(file);
        } else {
            // For video and files, just send metadata
            sendMessage(type === 'video' ? 'video' : 'file', {
                url: URL.createObjectURL(file),
                name: file.name,
                size: file.size
            });
        }
    });
}

function showMediaPreview(url, name) {
    // Brief preview shown in media preview bar - auto dismiss
    const bar = isMobile()
        ? document.querySelector('#chatView .media-preview-bar')
        : document.getElementById('mediaPreviewBar');

    if (bar) {
        const content = bar.querySelector('.mpb-content');
        content.innerHTML = `<img src="${url}" alt="${name}">`;
        bar.style.display = 'flex';
        setTimeout(() => { bar.style.display = 'none'; }, 3000);
    }
}

function showMediaViewer(url, type) {
    const viewer = document.getElementById('mediaView');
    const content = document.getElementById('mediaContent');

    if (type === 'image') {
        content.innerHTML = `<img src="${url}" alt="Full image">`;
    } else if (type === 'video') {
        content.innerHTML = `<video src="${url}" controls autoplay playsinline></video>`;
    }

    viewer.style.display = 'flex';
}

// ===================== VOICE RECORDING =====================
let mediaRecorder = null;
let audioChunks = [];
let voiceStartTime = 0;
let voiceTimerInterval = null;

async function startVoiceRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        voiceStartTime = Date.now();

        mediaRecorder.ondataavailable = (e) => {
            audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(audioChunks, { type: 'audio/webm' });
            const url = URL.createObjectURL(blob);
            const duration = Math.floor((Date.now() - voiceStartTime) / 1000);
            const mins = Math.floor(duration / 60);
            const secs = duration % 60;

            sendMessage('voice', {
                url,
                duration: `${mins}:${secs.toString().padStart(2, '0')}`
            });

            // Stop all tracks
            stream.getTracks().forEach(t => t.stop());
        };

        mediaRecorder.start();

        // Show overlay
        document.getElementById('voiceOverlay').style.display = 'flex';

        // Start timer
        voiceTimerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - voiceStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            document.getElementById('voiceTimer').textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }, 100);

    } catch (err) {
        console.error('Microphone error:', err);
        toast('Microphone access denied');
    }
}

function stopVoiceRecording(send = true) {
    clearInterval(voiceTimerInterval);
    document.getElementById('voiceOverlay').style.display = 'none';
    document.getElementById('voiceTimer').textContent = '0:00';

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        if (send) {
            mediaRecorder.stop();
        } else {
            mediaRecorder.stop();
            audioChunks = []; // Discard
        }
    }
    mediaRecorder = null;
}

function playVoiceNote(url, btn) {
    if (!url) return;
    const audio = new Audio(url);
    const icon = btn.querySelector('i');
    icon.className = 'fas fa-pause';
    audio.play();
    audio.onended = () => { icon.className = 'fas fa-play'; };
}

// ===================== INPUT UI =====================
function updateInputUI() {
    const input = getMessageInput();
    if (!input) return;

    const text = input.textContent.trim();
    const container = isMobile() ? document.querySelector('#chatView') : document.getElementById('chatViewInner');
    if (!container) return;

    const sendBtn = container.querySelector('.send-btn');
    const voiceBtn = container.querySelector('.voice-btn');

    if (text.length > 0) {
        if (sendBtn) sendBtn.style.display = 'flex';
        if (voiceBtn) voiceBtn.style.display = 'none';
    } else {
        if (sendBtn) sendBtn.style.display = 'none';
        if (voiceBtn) voiceBtn.style.display = 'flex';
    }
}

// ===================== SETTINGS =====================
function updateSettingsUI() {
    if (!State.user) return;

    const avatar = document.getElementById('settingsAvatar');
    const name = document.getElementById('settingsName');
    const status = document.getElementById('settingsStatus');

    if (avatar) {
        if (State.user.photo) {
            avatar.style.background = 'transparent';
            avatar.innerHTML = `<img src="${State.user.photo}" alt="Profile photo">`;
        } else {
            avatar.innerHTML = '';
            avatar.style.background = AV_COLORS[State.user.color] || AV_COLORS['cyan-purple'];
            avatar.textContent = State.user.initials;
        }
    }
    if (name) name.textContent = State.user.name;
    if (status) status.textContent = State.user.status;

    // Storage
    const storageDesc = document.getElementById('storageDesc');
    if (storageDesc) {
        const used = DB.used();
        storageDesc.textContent = formatBytes(used) + ' used';
    }

    // Notifications toggle
    const notifToggle = document.getElementById('notifToggle');
    if (notifToggle) {
        notifToggle.classList.toggle('active', State.notifications);
    }

    updateDockSizeUI();
    updateBluetoothUI();
}

// ===================== SETUP ALL INTERACTIONS =====================
function setupAllInteractions() {
    setupOnboarding();
    setupProfileScreen();

    // Tab switching
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
    window.addEventListener('hashchange', applyInitialTabFromHash);

    // Search
    document.getElementById('searchBtn')?.addEventListener('click', () => {
        const bar = document.getElementById('searchBar');
        bar.style.display = bar.style.display === 'none' ? 'flex' : 'none';
        if (bar.style.display === 'flex') {
            document.getElementById('searchInput').focus();
        }
    });
    document.getElementById('searchClose')?.addEventListener('click', () => {
        document.getElementById('searchBar').style.display = 'none';
        document.getElementById('searchInput').value = '';
        renderChats();
    });
    document.getElementById('searchInput')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        document.querySelectorAll('.chat-item').forEach(item => {
            const name = item.querySelector('.chat-item-name')?.textContent.toLowerCase() || '';
            item.style.display = name.includes(q) ? 'flex' : 'none';
        });
    });
    document.getElementById('dockSearchBtn')?.addEventListener('click', () => {
        switchTab('chats');
        const bar = document.getElementById('searchBar');
        if (!bar) return;
        bar.style.display = 'flex';
        document.getElementById('searchInput')?.focus();
    });

    // Bluetooth toggle
    document.getElementById('btToggleBtn')?.addEventListener('click', toggleBluetooth);

    // Connection mode buttons
    document.getElementById('modeBluetooth')?.addEventListener('click', () => {
        State.connectionMode = 'bluetooth';
        document.getElementById('modeBluetooth').classList.add('active');
        document.getElementById('modeWifi').classList.remove('active');
        document.getElementById('scanCenterIcon').className = 'fab fa-bluetooth-b bt-center-icon';
        renderDiscoveredDevices();
    });
    document.getElementById('modeWifi')?.addEventListener('click', () => {
        State.connectionMode = 'wifi';
        document.getElementById('modeWifi').classList.add('active');
        document.getElementById('modeBluetooth').classList.remove('active');
        document.getElementById('scanCenterIcon').className = 'fas fa-wifi bt-center-icon';
        startWifiDirect();
    });

    // WiFi fallback button
    document.getElementById('useWifiBtn')?.addEventListener('click', () => {
        State.bluetoothEnabled = true;
        State.connectionMode = 'wifi';
        updateBluetoothUI();
        document.getElementById('modeWifi')?.classList.add('active');
        document.getElementById('modeBluetooth')?.classList.remove('active');
        startWifiDirect();
    });

    // Scan button
    document.getElementById('btScanBtn')?.addEventListener('click', scanForDevices);

    // Connecting cancel
    document.getElementById('connectingCancel')?.addEventListener('click', () => {
        document.getElementById('connectingModal').style.display = 'none';
    });

    // Chat back button (desktop inner)
    document.getElementById('chatBack')?.addEventListener('click', closeChat);

    // Chat input
    const msgInput = document.getElementById('messageInput');
    if (msgInput) {
        msgInput.addEventListener('input', updateInputUI);
        msgInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage('text');
            }
        });
    }

    // Send button
    document.getElementById('sendBtn')?.addEventListener('click', () => sendMessage('text'));

    // Attach toggle
    document.getElementById('attachToggle')?.addEventListener('click', () => {
        const toolbar = document.getElementById('chatToolbar');
        const btn = document.getElementById('attachToggle');
        if (toolbar.style.display === 'none') {
            toolbar.style.display = 'flex';
            btn.classList.add('active');
        } else {
            toolbar.style.display = 'none';
            btn.classList.remove('active');
        }
    });

    // File inputs
    document.getElementById('fileImage')?.addEventListener('change', (e) => {
        handleFileSelect('image', e.target.files);
        e.target.value = '';
    });
    document.getElementById('fileVideo')?.addEventListener('change', (e) => {
        handleFileSelect('video', e.target.files);
        e.target.value = '';
    });
    document.getElementById('fileDoc')?.addEventListener('change', (e) => {
        handleFileSelect('file', e.target.files);
        e.target.value = '';
    });

    // Voice recording
    document.getElementById('voiceBtn')?.addEventListener('click', startVoiceRecording);
    document.getElementById('voiceNoteBtn')?.addEventListener('click', startVoiceRecording);
    document.getElementById('voiceCancel')?.addEventListener('click', () => stopVoiceRecording(false));
    document.getElementById('voiceStop')?.addEventListener('click', () => stopVoiceRecording(true));

    // Media close
    document.getElementById('mediaClose')?.addEventListener('click', () => {
        document.getElementById('mediaView').style.display = 'none';
        document.getElementById('mediaContent').innerHTML = '';
    });
    document.getElementById('mpbClose')?.addEventListener('click', () => {
        document.getElementById('mediaPreviewBar').style.display = 'none';
    });

    // Chat more menu
    document.getElementById('chatMore')?.addEventListener('click', async () => {
        if (!State.activeChatId) return;
        const confirmed = await showConfirm('Delete Chat', 'Are you sure you want to delete this conversation?');
        if (confirmed) {
            delete State.chats[State.activeChatId];
            DB.save('chats', State.chats);
            closeChat();
            renderChats();
            toast('Chat deleted');
        }
    });

    // Settings
    document.getElementById('themeItem')?.addEventListener('click', () => {
        document.getElementById('themeModal').style.display = 'flex';
    });
    document.getElementById('themeClose')?.addEventListener('click', () => {
        document.getElementById('themeModal').style.display = 'none';
    });
    document.querySelectorAll('.theme-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.theme-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            State.theme = opt.dataset.theme;
            DB.save('theme', State.theme);
            applyTheme();
        });
    });
    document.getElementById('dockSmallBtn')?.addEventListener('click', () => setDockSize('small'));
    document.getElementById('dockLargeBtn')?.addEventListener('click', () => setDockSize('large'));
    document.getElementById('installAppItem')?.addEventListener('click', promptPwaInstall);

    document.getElementById('howToUseItem')?.addEventListener('click', () => {
        openQuickStart(true);
    });
    document.getElementById('quickStartClose')?.addEventListener('click', () => closeQuickStart(true));
    document.getElementById('quickStartDone')?.addEventListener('click', () => closeQuickStart(true));
    document.getElementById('quickStartModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'quickStartModal') closeQuickStart(true);
    });

    document.getElementById('notifToggle')?.addEventListener('click', () => {
        State.notifications = !State.notifications;
        DB.save('notifs', State.notifications);
        document.getElementById('notifToggle').classList.toggle('active', State.notifications);
    });

    document.getElementById('clearDataItem')?.addEventListener('click', async () => {
        const confirmed = await showConfirm('Clear All Data', 'This will delete all messages, connections and settings. This cannot be undone.');
        if (confirmed) {
            DB.clearAll();
            State.chats = {};
            State.connectedDevices = [];
            State.discoveredDevices = [];
            State.activeChatId = null;
            State.dockSize = 'large';
            applyDockSize();
            renderChats();
            closeChat();
            updateSettingsUI();
            toast('All data cleared');
        }
    });

    document.getElementById('editProfileBtn')?.addEventListener('click', () => {
        // Simple inline edit
        const newName = prompt('Display Name:', State.user.name);
        if (newName && newName.trim()) {
            State.user.name = newName.trim();
            State.user.initials = newName.trim().slice(0, 2).toUpperCase();
            DB.save('user', State.user);
            updateSettingsUI();
            toast('Profile updated');
        }
    });

    document.getElementById('profilePhotoInput')?.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file || !State.user) return;
        try {
            State.user.photo = await fileToDataUrl(file);
            DB.save('user', State.user);
            updateSettingsUI();
            toast('Profile photo updated');
        } catch (err) {
            console.error('Profile photo update failed:', err);
            toast('Could not update profile photo');
        } finally {
            e.target.value = '';
        }
    });

    // Window resize handler
    window.addEventListener('resize', () => {
        // If switching from mobile to desktop with active chat, move to content area
        if (!isMobile() && State.activeChatId) {
            const chatView = document.getElementById('chatView');
            chatView.classList.remove('visible');
            chatView.style.display = 'none';
            document.getElementById('contentWelcome').style.display = 'none';
            document.getElementById('chatViewInner').style.display = 'flex';
            updateChatHeader();
            renderMessages();
        }
        setDockVisibility(!State.activeChatId);
    });
}

// Setup mobile chat events (re-bind after cloning)
function setupMobileChatEvents() {
    const chatView = document.getElementById('chatView');
    if (!chatView) return;

    // Back button
    chatView.querySelector('.back-btn')?.addEventListener('click', closeChat);

    // Message input
    const input = chatView.querySelector('.message-input');
    if (input) {
        input.addEventListener('input', updateInputUI);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage('text');
            }
        });
    }

    // Send button
    chatView.querySelector('.send-btn')?.addEventListener('click', () => sendMessage('text'));

    // Voice button
    chatView.querySelector('.voice-btn')?.addEventListener('click', startVoiceRecording);

    // Attach toggle
    const attachBtn = chatView.querySelector('.attach-btn');
    const toolbar = chatView.querySelector('.chat-input-toolbar');
    if (attachBtn && toolbar) {
        attachBtn.addEventListener('click', () => {
            if (toolbar.style.display === 'none' || !toolbar.style.display) {
                toolbar.style.display = 'flex';
                attachBtn.classList.add('active');
            } else {
                toolbar.style.display = 'none';
                attachBtn.classList.remove('active');
            }
        });
    }

    // File inputs
    chatView.querySelector('#fileImage, input[accept*="image"]')?.addEventListener('change', (e) => {
        handleFileSelect('image', e.target.files);
        e.target.value = '';
    });
    chatView.querySelector('#fileVideo, input[accept*="video"]')?.addEventListener('change', (e) => {
        handleFileSelect('video', e.target.files);
        e.target.value = '';
    });
    chatView.querySelector('#fileDoc, input[accept*=".pdf"]')?.addEventListener('change', (e) => {
        handleFileSelect('file', e.target.files);
        e.target.value = '';
    });

    // Voice note button
    chatView.querySelector('.toolbar-btn[title="Voice Note"]')?.addEventListener('click', startVoiceRecording);

    // More menu
    chatView.querySelector('#chatMore, .chat-header-actions .icon-btn')?.addEventListener('click', async () => {
        if (!State.activeChatId) return;
        const confirmed = await showConfirm('Delete Chat', 'Delete this conversation?');
        if (confirmed) {
            delete State.chats[State.activeChatId];
            DB.save('chats', State.chats);
            closeChat();
            renderChats();
            toast('Chat deleted');
        }
    });

    // Media preview close
    chatView.querySelector('.mpb-close')?.addEventListener('click', () => {
        const bar = chatView.querySelector('.media-preview-bar');
        if (bar) bar.style.display = 'none';
    });
}

// Make switchTab available globally
window.switchTab = switchTab;
window.openChat = openChat;
