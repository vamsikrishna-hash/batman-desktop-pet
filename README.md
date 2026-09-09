# Batman Desktop Pet

A small, always-on desktop companion that nudges you to take breaks, drink water, and remember your open tasks, without ever feeling like another notification you have to dismiss.

## The problem

Most reminder tools fail in one of two ways. Calendar popups and to-do app notifications are easy to swipe away and forget within seconds. Loud, modal alerts get resented and muted. Neither actually changes behavior for someone doing long, heads-down desk work.

The underlying insight: reminders work better when they feel like a small presence checking in, not a system interrupting you. A quiet, low-stakes character sitting at the edge of the screen is easier to glance at and easier to trust than a dialog box demanding a click.

## Who this is for

Anyone who spends long solo stretches at a desk and tends to forget the basics, water, posture, short breaks, and the small tasks that do not make it into a "real" task manager. It is built for a single user on their own machine, not a team or an organization.

## Goals and non-goals

**Goals**
- Be present without being intrusive
- Work fully offline by default, with zero setup
- Keep all data local to the user's machine
- Let the user tune exactly how often it speaks up, or turn it off entirely

**Non-goals**
- Not a replacement for a full task manager or the operating system's own reminders app
- No accounts, no cloud sync, no telemetry or analytics of any kind
- Not trying to be a general-purpose chat assistant

## Product requirements

- Reminders on independently configurable cadences, so wellness check-ins, water reminders, and task reminders do not have to share one timer
- Quiet hours that suppress automatic visits on a schedule, with manual summon still available
- Pause controls for 30 minutes, 1 hour, until tomorrow, or indefinitely
- A chat surface that works with zero configuration, with an optional upgrade to a connected AI model for richer conversation
- A real task list: add, complete, and remove tasks, with its own reminder cadence, and a way to ask for the current list in plain language
- Adjustable size, animation speed, and window position, remembered across restarts
- Every setting persists locally and survives a restart

## Key product decisions

**Offline by default, AI as an upgrade.** The chat works immediately with no signup and no cost, using simple pattern matching for common intents like feeling tired, needing water, or asking about tasks. A connected AI model is available for anyone who wants more natural conversation, but it is opt-in, and the key is never stored in plain text.

**Local-only storage.** Everything, settings, tasks, window position, lives in a single local file. No account, no server, no sync. This was a deliberate trade-off: less convenience across devices, in exchange for zero trust required and zero setup friction.

**Silence when there is nothing to say.** A task reminder that fires on a fixed timer regardless of whether any tasks are open trains the user to ignore it. The reminder only appears when there is an actual open task to mention, and it names that specific task rather than a generic nudge.

**Three independent cadences instead of one.** Early versions of tools like this tend to bundle every kind of reminder into a single interval. Splitting wellness check-ins, water reminders, and task reminders into three separately configurable timers lets a user tune each to their own habits, silencing the ones that do not fit them without losing the others.

**Quiet hours and multiple pause lengths as first-class requirements.** Respecting focus time was treated as core scope from the start, not something bolted on after complaints. A single "snooze" button would have been faster to build; a schedule plus three explicit pause durations gives the user more honest control.

## How it works

A small floating character sits at the corner of the screen and visits on its own schedule, or on demand through a draggable summon button or the system tray menu. Clicking it opens a lightweight chat panel. A separate settings window controls every cadence, quiet hours, pause state, size, and the task list. Under the hood it is a small Electron desktop app written in plain JavaScript, using local, encrypted storage for anything sensitive like an API key, transparent always-on-top windows for the character itself, and a tray icon for quick access without cluttering the dock or taskbar. The character's artwork is a single replaceable image file, so the whole look can be swapped without touching any code.

## How I made sure it actually works

Every piece of decision logic, which message fires when, how quiet hours are calculated, how a chat message gets classified as a task question versus small talk, is covered by fast automated tests with no app window required. On top of that, an automated end-to-end test actually boots the real application, opens every window, drives a manual summon, sends a chat message, saves settings through the same code path the UI uses, adds and removes a task, drags the summon button, and cycles through every pause state, then confirms nothing crashed and every result was correct. That full pass runs before any change is considered done. Manual passes on a real desktop, including cross-checking exact window bounds and z-order against other running applications, caught issues the automated tests could not, like a window rendering behind another app's floating panel, which fed directly back into the requirements above.

## What I would measure

If this were a real shipped product, the metrics that would matter most:
- Ratio of task reminders acknowledged (chat opened, task marked done) versus silently dismissed
- How often quiet hours or pause actually get used, as a signal the defaults are too aggressive
- Share of chat messages resolved without needing the AI upgrade, as a signal the offline experience is good enough on its own
- How often the summon button gets dragged to a new position, as a signal the default placement should change

## What is next

- Optional sync with the operating system's own reminders or calendar, for anyone who wants their tasks to live in more than one place
- A lightweight weekly summary of what got done and what got snoozed
- Cross-device sync as an explicit opt-in, without changing the local-first default

## Getting started

```bash
npm install
npm start
```

Run the automated tests:

```bash
npm test
```

There is also a full boot self-test that drives the real application:

```bash
npm run self-test
```

Double-click launchers are included for convenience: `launch.command` on Mac, `launch.bat` on Windows. If the character or summon button ever ends up off-screen, `bring-on-screen.command` or `bring-on-screen.bat` resets its position.

To enable the optional AI chat upgrade, open Settings from the tray menu, turn on AI chat, and add an API key. The key is encrypted using the operating system's secure storage and never appears in plain text.

## License

MIT. See `LICENSE`.
