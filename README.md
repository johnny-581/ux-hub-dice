# Name Picker

A floating hand-drawn random name picker that stays visible above a fullscreen
presentation on macOS.

## Use

There's no Dock icon — intentional (`LSUIElement`), so the app can never become
frontmost and steal focus from your slides. It lives in the menu bar instead,
where you can toggle the widget's visibility or quit.

| | |
|---|---|
| `⌥D` | Roll — and roll again once a name has landed |
| `⌥⇧D` | Dismiss back to the **pick** state |
| `⌥⇧Q` | Quit |

Click **pick** to roll, click the name to re-roll, and drag any visible ink to
move the widget. Position is remembered between launches. Everywhere else on
screen stays click-through, so your slides still get their clicks.

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

Everything routine lives in [`config.js`](config.js): `NAMES`, starting
`POSITION`, `HOTKEYS`, animation `TIMING`, and `DRAG_OVERHANG` (how far off a
screen edge it can be dragged).

Names are drawn from a shuffle bag — nobody repeats until everyone has come up.

## Frames

The five PNGs in [`animation-frames/`](animation-frames) are listed in
[`shapes.js`](shapes.js) and cycle in that order. To add or reorder frames, edit
that list. They share one 1004×790 canvas and the app renders the whole canvas,
so each shape keeps the position it was drawn in — don't crop them to their
bounding boxes or the flipbook will jitter.

## Rebuild

```bash
npm run dist:fast   # just the .app, quick
npm run dist        # full .dmg
```

Then install:

```bash
cp -R "dist/mac-arm64/Name Picker.app" /Applications/
```

Built arm64-only and ad-hoc signed — fine locally, but unsigned for anyone else,
who'd hit Gatekeeper. Handing it to other people means a Developer ID
certificate and notarization.

Note `config.js` is sealed inside the app bundle, so changing names means a
rebuild. Use `npm start` while you're iterating.
