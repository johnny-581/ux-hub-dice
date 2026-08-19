# Name Picker

A floating hand-drawn random name picker that stays visible above a fullscreen
presentation on macOS.

## Use

There's no Dock icon — intentional (`LSUIElement`), so the app can never become
frontmost and steal focus from your slides. It lives in the menu bar instead.

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

Names are drawn from a shuffle bag — nobody repeats until everyone has come up.
Editing the roster resets the bag.

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

The app is **ad-hoc signed, not notarized** — deliberately, because notarizing
means the $99/year Apple Developer Program. It runs fine, but macOS won't open
a downloaded copy on the first try.

Send someone the `.dmg` from `dist/`, and have them drag it to Applications and
run this once:

```bash
xattr -dr com.apple.quarantine "/Applications/Name Picker.app"
```

That clears the download quarantine flag and it opens normally from then on.
Without it they'll get "damaged and can't be opened", which is Gatekeeper being
unhelpfully worded about *unsigned*, not actually broken. The GUI equivalent is
System Settings → Privacy & Security → **Open Anyway**.

Two things worth saying when you send it:

- The hotkeys are registered system-wide, so they silently do nothing if
  something else on their Mac already owns `⌥D`. The menu bar icon still works.
- It ships seeded with our names — they can swap them out under **Edit names…**.

If it ever spreads past people who know you, that's the point to pay for a
Developer ID certificate and set `hardenedRuntime: true` plus `notarize` in
`package.json`, so it just opens.
