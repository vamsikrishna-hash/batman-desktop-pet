function basicReply(input) {
  const text = String(input || '').toLowerCase();
  if (text.includes('water')) return 'Good idea. Take a few sips now, then come back.';
  if (text.includes('tired')) return 'You sound tired. Try a small break before pushing further.';
  if (text.includes('stress')) return 'That sounds heavy. Breathe slowly for a minute; I will sit here with you.';
  if (text.includes('nice to meet')) return 'Nice to meet you too. I am Batman, your tiny desk companion.';
  if (text.includes('how are')) return 'I am doing well. Mostly guarding the corner of your screen.';
  if (text === 'hi' || text.includes('hello') || text.includes('hey')) return 'Hi. I am here if you need a tiny check-in.';
  return 'I hear you. Keep it small and steady.';
}

function isQuietHoursAt(quietHours, date = new Date()) {
  if (!quietHours?.enabled) return false;
  const current = date.getHours() * 60 + date.getMinutes();
  const [sh, sm] = quietHours.start.split(':').map(Number);
  const [eh, em] = quietHours.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? current >= start && current < end : current >= start || current < end;
}

function mergeSettings(defaults, stored = {}) {
  return {
    ...defaults,
    ...stored,
    quietHours: {
      ...defaults.quietHours,
      ...(stored.quietHours || {})
    }
  };
}

function isTaskQuery(input) {
  const text = String(input || '').toLowerCase();
  return /\btasks?\b/.test(text) || /\bto-?do(s|list)?\b/.test(text) || text.includes('my list') || text.includes('what do i need to do');
}

function taskListReply(tasks = []) {
  const open = tasks.filter(task => !task.done);
  if (!open.length) return 'You have no open tasks right now. Nice and clear.';
  const names = open.map(task => task.text);
  if (names.length === 1) return `One open task: ${names[0]}.`;
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const list = shown.join(', ');
  return rest > 0
    ? `You have ${names.length} open tasks: ${list}, and ${rest} more.`
    : `You have ${names.length} open tasks: ${list}.`;
}

function pickTaskReminder(tasks = []) {
  const open = tasks.filter(task => !task.done);
  if (!open.length) return null;
  return open[Math.floor(Math.random() * open.length)].text;
}

module.exports = {
  basicReply,
  isQuietHoursAt,
  mergeSettings,
  isTaskQuery,
  taskListReply,
  pickTaskReminder
};
