const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('batman', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: settings => ipcRenderer.invoke('settings:save', settings),
  pause: mode => ipcRenderer.invoke('settings:pause', mode),
  summon: () => ipcRenderer.invoke('pet:summon'),
  leave: () => ipcRenderer.invoke('pet:leave'),
  hideAfterLeave: () => ipcRenderer.invoke('pet:hide-after-leave'),
  dragSummon: delta => ipcRenderer.invoke('summon:drag', delta),
  sendChat: history => ipcRenderer.invoke('chat:send', history),
  getTasks: () => ipcRenderer.invoke('tasks:list'),
  addTask: text => ipcRenderer.invoke('tasks:add', text),
  toggleTask: id => ipcRenderer.invoke('tasks:toggle', id),
  removeTask: id => ipcRenderer.invoke('tasks:remove', id),
  onSummon: callback => ipcRenderer.on('pet:summon', (_event, payload) => callback(payload)),
  onLeave: callback => ipcRenderer.on('pet:leave', () => callback())
});
