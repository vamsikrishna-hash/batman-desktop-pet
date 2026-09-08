const form = document.getElementById('settingsForm');
const status = document.getElementById('status');

const fields = {
  petEnabled: document.getElementById('petEnabled'),
  checkIns: document.getElementById('checkIns'),
  sound: document.getElementById('sound'),
  aiChat: document.getElementById('aiChat'),
  launchAtStartup: document.getElementById('launchAtStartup'),
  alwaysOnTop: document.getElementById('alwaysOnTop'),
  visitFrequencyMinutes: document.getElementById('visitFrequencyMinutes'),
  customVisitFrequencyMinutes: document.getElementById('customVisitFrequencyMinutes'),
  waterFrequencyMinutes: document.getElementById('waterFrequencyMinutes'),
  taskReminderMinutes: document.getElementById('taskReminderMinutes'),
  animationSpeed: document.getElementById('animationSpeed'),
  petSize: document.getElementById('petSize'),
  apiKey: document.getElementById('apiKey'),
  quietEnabled: document.getElementById('quietEnabled'),
  quietStart: document.getElementById('quietStart'),
  quietEnd: document.getElementById('quietEnd')
};

async function load() {
  const settings = await window.batman.getSettings();
  fields.petEnabled.checked = settings.petEnabled;
  fields.checkIns.checked = settings.checkIns;
  fields.sound.checked = settings.sound;
  fields.aiChat.checked = settings.aiChat;
  fields.launchAtStartup.checked = settings.launchAtStartup;
  fields.alwaysOnTop.checked = settings.alwaysOnTop;
  fields.visitFrequencyMinutes.value = String(settings.visitFrequencyMinutes);
  fields.customVisitFrequencyMinutes.value = settings.customVisitFrequencyMinutes;
  fields.waterFrequencyMinutes.value = settings.waterFrequencyMinutes;
  fields.taskReminderMinutes.value = settings.taskReminderMinutes;
  fields.animationSpeed.value = settings.animationSpeed;
  fields.petSize.value = settings.petSize;
  fields.quietEnabled.checked = settings.quietHours.enabled;
  fields.quietStart.value = settings.quietHours.start;
  fields.quietEnd.value = settings.quietHours.end;
  fields.apiKey.placeholder = settings.hasApiKey ? 'Saved securely. Leave blank to keep it.' : 'Paste API key';
  await renderTasks();
}

async function renderTasks() {
  const tasks = await window.batman.getTasks();
  const container = document.getElementById('taskList');
  container.innerHTML = '';
  tasks.forEach(task => {
    const row = document.createElement('div');
    row.className = `task-item${task.done ? ' done' : ''}`;
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = task.done;
    checkbox.addEventListener('change', async () => {
      await window.batman.toggleTask(task.id);
      await renderTasks();
    });
    const label = document.createElement('span');
    label.textContent = task.text;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      await window.batman.removeTask(task.id);
      await renderTasks();
    });
    row.append(checkbox, label, remove);
    container.appendChild(row);
  });
}

document.getElementById('addTaskBtn').addEventListener('click', async () => {
  const input = document.getElementById('newTask');
  const text = input.value.trim();
  if (!text) return;
  await window.batman.addTask(text);
  input.value = '';
  await renderTasks();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  status.textContent = 'Saving...';
  try {
    await window.batman.saveSettings({
      petEnabled: fields.petEnabled.checked,
      checkIns: fields.checkIns.checked,
      sound: fields.sound.checked,
      aiChat: fields.aiChat.checked,
      launchAtStartup: fields.launchAtStartup.checked,
      alwaysOnTop: fields.alwaysOnTop.checked,
      visitFrequencyMinutes: fields.visitFrequencyMinutes.value === 'custom' ? 'custom' : Number(fields.visitFrequencyMinutes.value),
      customVisitFrequencyMinutes: Number(fields.customVisitFrequencyMinutes.value || 5),
      waterFrequencyMinutes: Number(fields.waterFrequencyMinutes.value || 30),
      taskReminderMinutes: Number(fields.taskReminderMinutes.value || 10),
      animationSpeed: Number(fields.animationSpeed.value || 1),
      petSize: Number(fields.petSize.value || 180),
      apiKey: fields.apiKey.value,
      quietHours: {
        enabled: fields.quietEnabled.checked,
        start: fields.quietStart.value || '22:00',
        end: fields.quietEnd.value || '08:00'
      }
    });
    fields.apiKey.value = '';
    status.textContent = 'Saved.';
    await load();
  } catch (error) {
    status.textContent = error.message || 'Could not save settings.';
  }
});

document.getElementById('pause30').addEventListener('click', () => window.batman.pause('30'));
document.getElementById('pause60').addEventListener('click', () => window.batman.pause('60'));
document.getElementById('pauseTomorrow').addEventListener('click', () => window.batman.pause('tomorrow'));
document.getElementById('resume').addEventListener('click', () => window.batman.pause('resume'));

load();
