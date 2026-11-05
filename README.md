# Name Picker

A floating hand-drawn random name picker that stays visible above a fullscreen
presentation on macOS.

![Name Picker writing out a name by hand, then the Names list](assets/name-picker-demo.gif)

## Install

1. Open the `.dmg` and drag **Name Picker** into Applications.
2. Run this once — the app is unsigned, so macOS quarantines it on download:

   ```bash
   xattr -dr com.apple.quarantine "/Applications/Name Picker.app"
   ```

3. Open it from Applications. There's no Dock icon: look for the orange **X**
   in the menu bar, and the widget in the corner of the screen.

Skipping step 2 gets you "damaged and can't be opened" — that's Gatekeeper's
wording for *unsigned*, not actually broken. See [Sharing it](#sharing-it).

## Use

The missing Dock icon is deliberate (`LSUIElement`): it means the app can never
become frontmost and steal focus from your slides.

| | |
|---|---|
| `⌥D` | Roll — and roll again once a name has landed |
| `⌥⇧D` | Dismiss back to the **pick** state |
| `⌥⇧Q` | Quit |

Click **pick** to roll, click the name to re-roll, and drag any visible ink to
move the widget. Position is remembered between launches. Everywhere else on
screen stays click-through, so your slides still get their clicks.

## The menu

One menu, reachable two ways: click the menu bar icon, or right-click (or
Control-click) the widget itself. They're identical apart from show vs. hide.

```
Pick a name  (⌥D)
Start over   (⌥⇧D)
──────────────
✓ Johnny          ← only checked names get picked
✓ Jefferson
  Bernard
──────────────
Edit names…
──────────────
Hide widget       ← "Show widget" in the menu bar version
Quit  (⌥⇧Q)
```

**Start over** clears a landed name and goes back to the **pick** state — the
same thing `⌥⇧D` does.

Clicking a name checks or unchecks it. macOS closes a menu on every click, so
that's best for flipping one person — **Edit names…** opens a small window for
adding, deleting, and toggling several at once.

The last checked name can't be unchecked and the last remaining name can't be
deleted: something always has to be pickable.

Set `CONTEXT_MENU_BUTTON: "left"` in `config.js` to move the widget's menu onto
a plain left click instead — rolling then lives in the menu's first item and on
`⌥D`.

Escape is deliberately not bound — it would be stolen from Keynote, where it
exits the slideshow. Rolling while the widget is hidden un-hides it first.

## Run in dev

```bash
npm install
npm start
```

Edits to the HTML/CSS/JS need only a restart. Quit the packaged app first if
it's running, or the second instance won't get the hotkeys.

## Configure

Everything routine lives in [`config.js`](config.js): starting `POSITION`,
`HOTKEYS`, animation `TIMING`, `DRAG_OVERHANG` (how far off a screen edge it can
be dragged), and `CONTEXT_MENU_BUTTON`.

`NAMES` there is only the **first-run seed**. Once the app has started, the
roster lives in `names.json` under the app's userData and is edited from the
menu — so changing who's in the draw never needs a rebuild.

Nobody repeats until everyone has come up. Editing the roster doesn't restart
that — unchecking someone mid-round leaves everyone else's turn intact, and a
name you add or re-check becomes eligible immediately.

## Frames

The five PNGs in [`animation-frames/`](animation-frames) are listed in
[`shapes.js`](shapes.js) and cycle in that order. To add or reorder frames, edit
that list. They share one 1004×790 canvas and the app renders the whole canvas,
so each shape keeps the position it was drawn in — don't crop them to their
bounding boxes or the flipbook will jitter.

## Rebuild

```bash
npm run dist:fast   # just the .app, arm64 only — for iterating locally
npm run dist        # universal .dmg — what you hand to other people
```

Then install:

```bash
cp -R "dist/mac-universal/Name Picker.app" /Applications/
```

`npm run dist` builds universal (Apple Silicon *and* Intel), which is why it's
slower — it packages Electron twice and merges the two. The app icon is
[`assets/icon.png`](assets/icon.png), the terracotta X from the flipbook,
cropped out of its 1004×790 frame and centred on a square.

`config.js` is sealed inside the app bundle, so changing anything in *it* means
a rebuild — but the roster isn't in it after first run, so names stay editable
in the installed app. Both `npm start` and the installed app read the same
`~/Library/Application Support/ux-hub-dice/`, so your roster and position carry
across the two.

## Sharing it

```bash
npm run dist
```

Send them `dist/Name Picker-<version>-universal.dmg` and the three
[Install](#install) steps. That's the whole process.

The app is **ad-hoc signed, not notarized** — deliberately, since notarizing
means the $99/year Apple Developer Program. The only cost is step 2: one command
to clear the quarantine flag, or System Settings → Privacy & Security →
**Open Anyway** for anyone who'd rather not touch a terminal.

Two things worth saying when you send it:

- The hotkeys are registered system-wide, so they silently do nothing if
  something else on their Mac already owns `⌥D`. The menu bar icon still works.
- It ships seeded with our names — they can swap them out under **Edit names…**.

If it ever spreads past people who know you, that's the point to pay for a
Developer ID certificate and set `hardenedRuntime: true` plus `notarize` in
`package.json`, so it just opens.
