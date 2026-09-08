const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { basicReply, isQuietHoursAt, mergeSettings, isTaskQuery, taskListReply, pickTaskReminder } = require('../src/core');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const json = file => JSON.parse(read(file));

const defaults = json('src/config/default-settings.json');
const messages = json('src/config/messages.json');
const personality = json('src/config/personality.json');
const main = read('src/main.js');
const preload = read('src/preload.js');
const petHtml = read('src/renderer/pet.html');
const settingsHtml = read('src/renderer/settings.html');
const summonHtml = read('src/renderer/summon.html');
const petCss = read('src/renderer/pet.css');

function includesAll(source, values, label) {
  for (const value of values) {
    assert(source.includes(value), `${label} missing ${value}`);
  }
}

assert.strictEqual(defaults.petEnabled, true, 'pet should be enabled by default');
assert.strictEqual(defaults.visitFrequencyMinutes, 5, 'default visit frequency should be 5 minutes');
assert(defaults.waterFrequencyMinutes > 0, 'water reminder frequency should be configurable');
assert(defaults.quietHours.start && defaults.quietHours.end, 'quiet hours should have start/end defaults');
assert(Array.isArray(defaults.tasks), 'default tasks should be an array');
assert.strictEqual(defaults.taskReminderMinutes, 10, 'default task reminder frequency should be 10 minutes');

includesAll(Object.keys(messages).join(','), ['greeting', 'water', 'stretch', 'break', 'mood'], 'message categories');
assert(messages.water.some(message => message.toLowerCase().includes('water')), 'water messages should mention water');
assert(personality.systemPrompt.includes('tiny desktop companion'), 'personality config should contain the requested companion style');

includesAll(main, [
  'transparent: true',
  'frame: false',
  'alwaysOnTop',
  'skipTaskbar: true',
  'new Tray',
  'safeStorage.encryptString',
  'setLoginItemSettings',
  'settings.summonPosition',
  'setInterval(() => summonPet(false)',
  'setInterval(() => summonPet(false, false, true)',
  'taskTimer',
  "'screen-saver'",
  "'tasks:add'",
  "'tasks:toggle'",
  "'tasks:remove'",
  "'tasks:list'"
], 'main process contract');

includesAll(preload, [
  'getSettings',
  'saveSettings',
  'summon',
  'dragSummon',
  'sendChat',
  'onSummon',
  'onLeave',
  'getTasks',
  'addTask',
  'toggleTask',
  'removeTask'
], 'preload bridge');

includesAll(petHtml, ['petButton', 'bubble', 'chat', 'messages', 'chatInput', 'chatForm'], 'pet UI');
includesAll(settingsHtml, [
  'petEnabled',
  'visitFrequencyMinutes',
  'waterFrequencyMinutes',
  'checkIns',
  'sound',
  'animationSpeed',
  'petSize',
  'aiChat',
  'apiKey',
  'launchAtStartup',
  'alwaysOnTop',
  'quietStart',
  'quietEnd',
  'taskReminderMinutes',
  'taskList',
  'newTask',
  'addTaskBtn'
], 'settings UI');
includesAll(summonHtml, ['summon', '../../assets/pet.svg'], 'summon UI');

includesAll(petCss, ['@keyframes breathe', '@keyframes walk', '@keyframes enter', '@keyframes leave', '@keyframes blink'], 'pet animations');
assert(fs.existsSync(path.join(root, 'launch.bat')), 'Windows launcher should exist');
assert(fs.existsSync(path.join(root, 'launch.command')), 'Mac launcher should exist');
assert(fs.existsSync(path.join(root, 'bring-on-screen.bat')), 'Windows bring-on-screen launcher should exist');
assert(fs.existsSync(path.join(root, 'bring-on-screen.command')), 'Mac bring-on-screen launcher should exist');
assert(fs.existsSync(path.join(root, 'assets/pet.svg')), 'replaceable pet asset should exist');

assert(basicReply('hi').toLowerCase().includes('hi'), 'basic chat should answer greetings');
assert(basicReply('I need water').toLowerCase().includes('sips'), 'basic chat should answer water intent');
assert(basicReply('I am tired').toLowerCase().includes('break'), 'basic chat should answer tired intent');
assert(basicReply('I am stressed').toLowerCase().includes('breathe'), 'basic chat should answer stress intent');

assert.strictEqual(isQuietHoursAt({ enabled: true, start: '22:00', end: '08:00' }, new Date('2026-09-08T23:00:00')), true);
assert.strictEqual(isQuietHoursAt({ enabled: true, start: '22:00', end: '08:00' }, new Date('2026-09-08T12:00:00')), false);
assert.strictEqual(isQuietHoursAt({ enabled: true, start: '09:00', end: '17:00' }, new Date('2026-09-08T10:00:00')), true);

const merged = mergeSettings(defaults, { petSize: 220, quietHours: { enabled: true } });
assert.strictEqual(merged.petSize, 220, 'stored settings should override defaults');
assert.strictEqual(merged.quietHours.enabled, true, 'quiet hour enabled override should persist');
assert.strictEqual(merged.quietHours.start, defaults.quietHours.start, 'quiet hour defaults should be preserved when partial settings are saved');

assert.strictEqual(isTaskQuery('what are my tasks'), true, 'should detect a task query');
assert.strictEqual(isTaskQuery('what is on my todo list'), true, 'should detect a todo-phrased task query');
assert.strictEqual(isTaskQuery('hi there'), false, 'should not misfire on unrelated chat');

assert.strictEqual(taskListReply([]), 'You have no open tasks right now. Nice and clear.', 'empty task list should say so');
assert(taskListReply([{ id: '1', text: 'ship the report', done: false }]).includes('ship the report'), 'single open task should be named');
assert(taskListReply([{ id: '1', text: 'a', done: true }, { id: '2', text: 'b', done: false }]).includes('b'), 'done tasks should be excluded from the reply');

assert.strictEqual(pickTaskReminder([]), null, 'no open tasks should yield no reminder');
assert.strictEqual(pickTaskReminder([{ id: '1', text: 'x', done: true }]), null, 'all-done tasks should yield no reminder');
const openTasks = [{ id: '1', text: 'call the vet', done: false }, { id: '2', text: 'reply to email', done: false }];
assert(openTasks.map(t => t.text).includes(pickTaskReminder(openTasks)), 'reminder should be one of the open tasks');

console.log('E2E_SIM_PASS: project contracts, config, local logic, UI hooks, launchers, and animation hooks passed.');
