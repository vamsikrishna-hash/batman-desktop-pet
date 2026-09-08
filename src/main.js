const { app, BrowserWindow, ipcMain, Menu, Tray, screen, nativeImage, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const CONFIG_DIR = path.join(__dirname, 'config');
const DEFAULTS = require('./config/default-settings.json');
const MESSAGES = require('./config/messages.json');
const PERSONALITY = require('./config/personality.json');
const { basicReply, isQuietHoursAt, mergeSettings, isTaskQuery, taskListReply, pickTaskReminder } = require('./core');
const SELF_TEST = process.argv.includes('--self-test');

if (SELF_TEST) {
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
}

let petWindow;
let summonWindow;
let settingsWindow;
let tray;
let settings = { ...DEFAULTS };
let visitTimer;
let waterTimer;
let taskTimer;
let pausedUntil = 0;
let encryptedApiKey = '';

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const keyPath = () => path.join(app.getPath('userData'), 'api-key.bin');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function loadSettings() {
  settings = mergeSettings(DEFAULTS, readJson(settingsPath(), {}));
  if (process.argv.includes('--reset-position')) {
    settings.summonPosition = null;
  }
  try {
    encryptedApiKey = fs.readFileSync(keyPath(), 'utf8');
  } catch {
    encryptedApiKey = '';
  }
}

function saveSettings() {
  writeJson(settingsPath(), settings);
}

function getApiKey() {
  if (!encryptedApiKey || !safeStorage.isEncryptionAvailable()) return '';
  try {
    return safeStorage.decryptString(Buffer.from(encryptedApiKey, 'base64'));
  } catch {
    return '';
  }
}

function setApiKey(value) {
  fs.mkdirSync(path.dirname(keyPath()), { recursive: true });
  if (!value) {
    encryptedApiKey = '';
    fs.rmSync(keyPath(), { force: true });
    return;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure key storage is not available on this computer.');
  }
  encryptedApiKey = safeStorage.encryptString(value).toString('base64');
  fs.writeFileSync(keyPath(), encryptedApiKey);
}

function assetDataUrl(file) {
  const svg = fs.readFileSync(path.join(ROOT, 'assets', file), 'utf8');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function clampBounds(bounds, display) {
  const area = display.workArea;
  return {
    x: Math.min(Math.max(bounds.x, area.x), area.x + area.width - bounds.width),
    y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - bounds.height),
    width: bounds.width,
    height: bounds.height
  };
}

function defaultPetBounds() {
  const display = screen.getPrimaryDisplay();
  const size = Math.max(120, Number(settings.petSize) || DEFAULTS.petSize);
  const width = Math.round(size * 2.4);
  const height = Math.round(size * 1.7);
  return {
    x: Math.round(display.workArea.x + display.workArea.width - width - 48),
    y: Math.round(display.workArea.y + display.workArea.height - height - 16),
    width,
    height
  };
}

function defaultSummonBounds() {
  const display = screen.getPrimaryDisplay();
  const size = 62;
  if (settings.summonPosition) {
    return clampBounds({ ...settings.summonPosition, width: size, height: size }, display);
  }
  return {
    x: display.workArea.x + display.workArea.width - size - 12,
    y: display.workArea.y + Math.round(display.workArea.height * 0.42),
    width: size,
    height: size
  };
}

function createPetWindow() {
  petWindow = new BrowserWindow({
    ...defaultPetBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: settings.alwaysOnTop,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.loadFile(path.join(__dirname, 'renderer', 'pet.html'));
}

function createSummonWindow() {
  summonWindow = new BrowserWindow({
    ...defaultSummonBounds(),
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    show: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  summonWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  summonWindow.loadFile(path.join(__dirname, 'renderer', 'summon.html'));
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 760,
    title: 'Batman Settings',
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.once('ready-to-show', () => settingsWindow.show());
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

function waitForLoad(win) {
  if (!win.webContents.isLoading()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = (_event, code, description) => {
      cleanup();
      reject(new Error(`Window load failed: ${code} ${description}`));
    };
    const cleanup = () => {
      win.webContents.off('did-finish-load', done);
      win.webContents.off('did-fail-load', fail);
    };
    win.webContents.once('did-finish-load', done);
    win.webContents.once('did-fail-load', fail);
  });
}

function assertSelfTest(condition, message) {
  if (!condition) throw new Error(message);
}

async function runSelfTest() {
  try {
    await waitForLoad(petWindow);
    await waitForLoad(summonWindow);
    createSettingsWindow();
    await waitForLoad(settingsWindow);

    const petBridge = await petWindow.webContents.executeJavaScript('Boolean(window.batman && document.getElementById("petButton"))');
    const summonBridge = await summonWindow.webContents.executeJavaScript('Boolean(window.batman && document.getElementById("summon"))');
    const settingsBridge = await settingsWindow.webContents.executeJavaScript('Boolean(window.batman && document.getElementById("settingsForm"))');
    assertSelfTest(petBridge, 'Pet window did not load expected bridge and UI.');
    assertSelfTest(summonBridge, 'Summon window did not load expected bridge and UI.');
    assertSelfTest(settingsBridge, 'Settings window did not load expected bridge and UI.');

    summonPet(true, true);
    await new Promise(resolve => setTimeout(resolve, 500));
    const petState = await petWindow.webContents.executeJavaScript(`({
      visibleChat: !document.getElementById("chat").classList.contains("hidden"),
      hasBubbleText: document.getElementById("bubble").textContent.length > 0
    })`);
    assertSelfTest(petState.visibleChat, 'Manual summon did not open chat.');
    assertSelfTest(petState.hasBubbleText, 'Manual summon did not show a pet message.');

    const reply = await petWindow.webContents.executeJavaScript(`window.batman.sendChat([{ role: "user", content: "hi" }])`);
    assertSelfTest(reply && typeof reply.text === 'string' && reply.text.length > 0, 'Basic chat did not return a reply.');

    await settingsWindow.webContents.executeJavaScript(`window.batman.saveSettings({
      petEnabled: true,
      checkIns: true,
      sound: false,
      aiChat: false,
      launchAtStartup: false,
      alwaysOnTop: true,
      visitFrequencyMinutes: 5,
      customVisitFrequencyMinutes: 5,
      waterFrequencyMinutes: 30,
      animationSpeed: 1,
      petSize: 180,
      apiKey: "",
      quietHours: { enabled: false, start: "22:00", end: "08:00" }
    })`);
    const saved = await settingsWindow.webContents.executeJavaScript('window.batman.getSettings()');
    assertSelfTest(saved.petEnabled === true && saved.waterFrequencyMinutes === 30, 'Settings did not persist through IPC.');

    const addedTasks = await settingsWindow.webContents.executeJavaScript(`window.batman.addTask('self test task').then(r => r.tasks)`);
    const selfTestTask = addedTasks.find(task => task.text === 'self test task');
    assertSelfTest(Boolean(selfTestTask), 'Adding a task did not persist through IPC.');
    const taskReply = await petWindow.webContents.executeJavaScript(`window.batman.sendChat([{ role: "user", content: "what are my tasks" }])`);
    assertSelfTest(taskReply.text.includes('self test task'), 'Chat did not answer a task query with the current task list.');
    await settingsWindow.webContents.executeJavaScript(`window.batman.removeTask(${JSON.stringify(selfTestTask.id)})`);

    await summonWindow.webContents.executeJavaScript('window.batman.dragSummon({ x: -20, y: 12 })');
    await settingsWindow.webContents.executeJavaScript('window.batman.pause("30")');
    await settingsWindow.webContents.executeJavaScript('window.batman.pause("resume")');

    leavePet();
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('SELF_TEST_PASS: windows loaded, summon/chat/settings/pause flows passed.');
    app.quit();
  } catch (error) {
    console.error(`SELF_TEST_FAIL: ${error.stack || error.message}`);
    process.exitCode = 1;
    app.quit();
  }
}

function updateTray() {
  const icon = nativeImage.createFromDataURL(assetDataUrl('pet.svg')).resize({ width: 18, height: 18 });
  if (!tray) tray = new Tray(icon);
  tray.setToolTip('Batman Desktop Pet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Summon Pet', click: () => summonPet(true) },
    { label: 'Chat', click: () => summonPet(true, true) },
    { label: 'Settings', click: createSettingsWindow },
    { type: 'separator' },
    { label: settings.petEnabled ? 'Pause Pet' : 'Resume Pet', click: () => settings.petEnabled ? pauseFor(60) : resumePet() },
    { label: 'Pause for 30 minutes', click: () => pauseFor(30) },
    { label: 'Pause for 1 hour', click: () => pauseFor(60) },
    { label: 'Pause until tomorrow', click: pauseUntilTomorrow },
    { label: 'Resume', click: resumePet },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

function isQuietHours() {
  return isQuietHoursAt(settings.quietHours);
}

function canAutoVisit() {
  return settings.petEnabled && Date.now() > pausedUntil && !isQuietHours();
}

function randomMessage(category) {
  const list = MESSAGES[category] || MESSAGES.greeting;
  return list[Math.floor(Math.random() * list.length)];
}

function chooseVisitMessage(forceWater = false, forceTask = false) {
  if (forceTask) {
    const text = pickTaskReminder(settings.tasks);
    return text ? { category: 'task', text: `Reminder: ${text}` } : null;
  }
  if (forceWater) return { category: 'water', text: randomMessage('water') };
  const categories = settings.checkIns
    ? ['greeting', 'water', 'stretch', 'break', 'mood']
    : ['water', 'stretch', 'break'];
  const category = categories[Math.floor(Math.random() * categories.length)];
  return { category, text: randomMessage(category) };
}

function summonPet(manual = false, openChat = false, forceWater = false, forceTask = false) {
  if (!petWindow) return;
  if (!manual && !canAutoVisit()) return;
  const message = chooseVisitMessage(forceWater, forceTask);
  if (!message) return;
  const bounds = defaultPetBounds();
  petWindow.setBounds(bounds);
  petWindow.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
  petWindow.showInactive();
  petWindow.webContents.send('pet:summon', {
    message: message.text,
    category: message.category,
    manual,
    openChat,
    settings
  });
  settings.lastVisitAt = Date.now();
  if (message.category === 'water') settings.lastWaterAt = Date.now();
  saveSettings();
}

function leavePet() {
  petWindow?.webContents.send('pet:leave');
}

function pauseFor(minutes) {
  pausedUntil = Date.now() + minutes * 60 * 1000;
  settings.petEnabled = false;
  saveSettings();
  updateTray();
}

function pauseUntilTomorrow() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  pausedUntil = tomorrow.getTime();
  settings.petEnabled = false;
  saveSettings();
  updateTray();
}

function resumePet() {
  pausedUntil = 0;
  settings.petEnabled = true;
  saveSettings();
  updateTray();
  scheduleVisits();
}

function scheduleVisits() {
  clearInterval(visitTimer);
  clearInterval(waterTimer);
  clearInterval(taskTimer);
  const visitMinutes = settings.visitFrequencyMinutes === 'custom'
    ? Number(settings.customVisitFrequencyMinutes || 5)
    : Number(settings.visitFrequencyMinutes || 5);
  const waterMinutes = Number(settings.waterFrequencyMinutes || 30);
  const taskMinutes = Number(settings.taskReminderMinutes || 10);
  visitTimer = setInterval(() => summonPet(false), Math.max(1, visitMinutes) * 60 * 1000);
  waterTimer = setInterval(() => summonPet(false, false, true), Math.max(1, waterMinutes) * 60 * 1000);
  taskTimer = setInterval(() => summonPet(false, false, false, true), Math.max(1, taskMinutes) * 60 * 1000);
}

function applyStartupSetting() {
  if (!app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtStartup) });
}

ipcMain.handle('settings:get', () => ({ ...settings, hasApiKey: Boolean(getApiKey()) }));

ipcMain.handle('settings:save', (_event, nextSettings) => {
  const { apiKey, ...rest } = nextSettings;
  settings = { ...settings, ...rest };
  settings.quietHours = { ...DEFAULTS.quietHours, ...(settings.quietHours || {}) };
  if (typeof apiKey === 'string' && apiKey.trim()) setApiKey(apiKey.trim());
  saveSettings();
  applyStartupSetting();
  updateTray();
  scheduleVisits();
  petWindow?.setAlwaysOnTop(Boolean(settings.alwaysOnTop));
  return { ok: true, hasApiKey: Boolean(getApiKey()) };
});

ipcMain.handle('settings:pause', (_event, mode) => {
  if (mode === '30') pauseFor(30);
  if (mode === '60') pauseFor(60);
  if (mode === 'tomorrow') pauseUntilTomorrow();
  if (mode === 'resume') resumePet();
  return { ok: true };
});

ipcMain.handle('pet:summon', () => {
  summonPet(true);
  return { ok: true };
});

ipcMain.handle('pet:leave', () => {
  leavePet();
  return { ok: true };
});

ipcMain.handle('pet:hide-after-leave', () => {
  petWindow?.hide();
  return { ok: true };
});

ipcMain.handle('summon:drag', (_event, delta) => {
  if (!summonWindow) return { ok: false };
  const bounds = summonWindow.getBounds();
  const display = screen.getDisplayMatching(bounds);
  const next = clampBounds({ ...bounds, x: bounds.x + delta.x, y: bounds.y + delta.y }, display);
  summonWindow.setBounds(next);
  settings.summonPosition = { x: next.x, y: next.y };
  saveSettings();
  return { ok: true };
});

ipcMain.handle('tasks:list', () => settings.tasks || []);

ipcMain.handle('tasks:add', (_event, text) => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return { ok: false, tasks: settings.tasks || [] };
  const task = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, text: trimmed, done: false };
  settings.tasks = [...(settings.tasks || []), task];
  saveSettings();
  return { ok: true, tasks: settings.tasks };
});

ipcMain.handle('tasks:toggle', (_event, id) => {
  settings.tasks = (settings.tasks || []).map(task => task.id === id ? { ...task, done: !task.done } : task);
  saveSettings();
  return { ok: true, tasks: settings.tasks };
});

ipcMain.handle('tasks:remove', (_event, id) => {
  settings.tasks = (settings.tasks || []).filter(task => task.id !== id);
  saveSettings();
  return { ok: true, tasks: settings.tasks };
});

ipcMain.handle('chat:send', async (_event, history) => {
  const last = history[history.length - 1]?.content || '';
  if (isTaskQuery(last)) return { text: taskListReply(settings.tasks || []) };
  if (!settings.aiChat || !getApiKey()) return { text: basicReply(last) };
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getApiKey()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: PERSONALITY.systemPrompt },
          ...history.slice(-12)
        ],
        temperature: 0.7,
        max_tokens: 100
      })
    });
    if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
    const data = await response.json();
    return { text: data.choices?.[0]?.message?.content?.trim() || basicReply(last) };
  } catch {
    return { text: basicReply(last) };
  }
});

app.whenReady().then(() => {
  loadSettings();
  createPetWindow();
  createSummonWindow();
  updateTray();
  scheduleVisits();
  if (SELF_TEST) {
    runSelfTest();
  } else {
    setTimeout(() => summonPet(false), 1200);
  }
});

app.on('window-all-closed', event => event.preventDefault());

app.on('before-quit', () => {
  clearInterval(visitTimer);
  clearInterval(waterTimer);
  clearInterval(taskTimer);
});
