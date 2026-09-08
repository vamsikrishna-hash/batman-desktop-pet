# Batman Desktop Pet

Batman is a real Electron desktop pet for Windows and Mac. It uses transparent, frameless, always-on-top windows for the pet and summon button, local settings, offline chat, optional OpenAI chat, quiet mode, and tray controls.

## Run

1. Install Node.js from https://nodejs.org if you do not already have it.
2. Open this folder in Terminal or Command Prompt.
3. Run:

```bash
npm install
npm start
```

## Test

```bash
npm test
```

There is also an Electron boot self-test:

```bash
npm run self-test
```

That requires a desktop display session. On a normal Windows or Mac machine it should boot the app windows and exit cleanly.

## Double-click launchers

- Windows: double-click `launch.bat`
- Mac: double-click `launch.command`

If the pet or summon button ever moves off-screen:

- Windows: double-click `bring-on-screen.bat`
- Mac: double-click `bring-on-screen.command`

## Using AI Mode

Batman works without an API key in Basic mode. To enable AI mode:

1. Open Settings from the tray menu.
2. Turn on AI chat.
3. Add your OpenAI API key.
4. Save.

The key is never hard-coded. Electron stores it using local OS-backed safe storage when available.

## Tasks

Open Settings from the tray menu to manage a real task list, separate from the canned wellness nudges:

1. Add tasks in the Tasks section of Settings.
2. Check a task off or delete it when it's done.
3. Batman reminds you of a random open task every 10 minutes by default (change "Task reminder frequency" in Settings). If every task is done, it stays quiet instead of nagging.
4. Ask Batman "what are my tasks" in chat any time and it answers with your current open tasks, whether AI chat is on or off.

## Replace the pet image

The current pet is `assets/pet.svg`. Replace that file with your own image using the same name, or update `src/renderer/pet.html` and `src/renderer/summon.html` to point to another asset. The animation is transform-based, so one still image can blink, bob, walk, enter, and leave.

## Project structure

```text
src/main.js                 Electron windows, tray, reminders, storage
src/preload.js              Safe IPC bridge
src/renderer/pet.html       Transparent pet UI
src/renderer/pet.js         Pet animation, speech, chat
src/renderer/summon.html    Floating summon button
src/renderer/settings.html  Settings screen
src/config/messages.json    Reminder messages
src/config/personality.json AI personality
assets/pet.svg              Replaceable pet artwork
```

## Notes

- Random visits stop during pause or quiet hours.
- Manual summon still works during pause.
- Conversation history is kept only while the app is open.
- Settings, reminder timing, pet size, summon position, and quiet hours persist locally.
