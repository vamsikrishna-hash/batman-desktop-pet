const stage = document.getElementById('stage');
const petButton = document.getElementById('petButton');
const bubble = document.getElementById('bubble');
const chat = document.getElementById('chat');
const closeChat = document.getElementById('closeChat');
const messages = document.getElementById('messages');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');

let history = [];
let leaveTimeout;
let wanderTimeout;

function applySettings(settings) {
  document.documentElement.style.setProperty('--pet-size', `${settings.petSize || 180}px`);
  document.documentElement.style.setProperty('--speed', settings.animationSpeed || 1);
}

function showSpeech(text) {
  bubble.textContent = text;
  bubble.classList.remove('hidden');
}

function hideSpeech() {
  bubble.classList.add('hidden');
}

function summon(payload) {
  clearTimeout(leaveTimeout);
  clearTimeout(wanderTimeout);
  applySettings(payload.settings || {});
  chat.classList.toggle('hidden', !payload.openChat);
  stage.className = 'stage entering walking';
  showSpeech(payload.message);
  setTimeout(() => {
    stage.className = Math.random() > 0.5 ? 'stage turn-left' : 'stage';
    scheduleWander();
  }, 1200);
  if (!payload.openChat) {
    leaveTimeout = setTimeout(() => leave(), 10000 + Math.random() * 20000);
  }
}

function leave() {
  hideSpeech();
  chat.classList.add('hidden');
  stage.className = 'stage leaving';
  setTimeout(() => window.batman.hideAfterLeave(), 950);
}

function scheduleWander() {
  wanderTimeout = setTimeout(() => {
    if (!chat.classList.contains('hidden')) return scheduleWander();
    stage.classList.toggle('turn-left');
    stage.classList.add('walking');
    setTimeout(() => stage.classList.remove('walking'), 1300);
    scheduleWander();
  }, 3500 + Math.random() * 4500);
}

function appendMessage(role, text) {
  const item = document.createElement('div');
  item.className = `msg ${role === 'user' ? 'user' : 'bot'}`;
  item.textContent = text;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

async function sendMessage(text) {
  history.push({ role: 'user', content: text });
  appendMessage('user', text);
  const thinking = 'One sec...';
  appendMessage('assistant', thinking);
  const response = await window.batman.sendChat(history);
  messages.lastElementChild.textContent = response.text;
  history.push({ role: 'assistant', content: response.text });
}

petButton.addEventListener('click', () => {
  chat.classList.remove('hidden');
  hideSpeech();
  clearTimeout(leaveTimeout);
  if (!history.length) appendMessage('assistant', 'Hi. I am Batman. Tiny check-in?');
  chatInput.focus();
});

closeChat.addEventListener('click', () => {
  chat.classList.add('hidden');
});

chatForm.addEventListener('submit', event => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  sendMessage(text);
});

window.batman.onSummon(summon);
window.batman.onLeave(leave);
