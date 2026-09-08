const button = document.getElementById('summon');
let dragging = false;
let start = null;
let moved = false;

button.addEventListener('pointerdown', event => {
  dragging = true;
  moved = false;
  start = { x: event.screenX, y: event.screenY };
  button.setPointerCapture(event.pointerId);
});

button.addEventListener('pointermove', async event => {
  if (!dragging || !start) return;
  const delta = { x: event.screenX - start.x, y: event.screenY - start.y };
  if (Math.abs(delta.x) + Math.abs(delta.y) > 2) moved = true;
  start = { x: event.screenX, y: event.screenY };
  await window.batman.dragSummon(delta);
});

button.addEventListener('pointerup', async () => {
  dragging = false;
  if (!moved) await window.batman.summon();
});
