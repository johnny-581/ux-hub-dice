// The only file you should need to edit day to day.
//
// Loaded twice, deliberately: `require`d by main.js as a CommonJS module, and
// pulled in as a plain <script> by index.html where it just defines a global.

const CONFIG = {
  // Who's in the draw. Order doesn't matter — it gets shuffled.
  // NAMES: ["Johnny", "Bernard", "Talia", "Jefferson", "Sukhraj"],
  NAMES: ["Johnny", "Jefferson", "Bernard", "Talia", "Sukhraj"],

  // Invisible window that holds the ink. Bigger than the art so the bloom and
  // the overshoot bounce have room; you never see its edges.
  WINDOW: { width: 380, height: 360 },

  // Starting position on first launch only. After that, wherever you last
  // dragged it wins (remembered in position.json under the app's userData).
  // anchor: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'center'
  POSITION: { anchor: "bottom-right", insetX: 72, insetY: 72 },

  // How far the window may hang off a screen edge while dragging. The art sits
  // centred inside a deliberately larger transparent window (room for the
  // settle bounce and the name's glow), so these values are roughly that
  // padding — letting the empty margin leave the screen so the visible ink can
  // actually reach the edge. Raise them to tuck the widget partly off-screen.
  DRAG_OVERHANG: { x: 80, y: 90 },

  // Global — they work while Keynote has focus, which is the whole point.
  // NOTE: 'Escape' is deliberately not used. Registering it globally would
  // steal Escape from every app, and Escape is how you exit a Keynote
  // slideshow. Dismiss is Alt+Shift+D instead.
  HOTKEYS: {
    roll: "Alt+D",
    dismiss: "Alt+Shift+D",
    quit: "Alt+Shift+Q",
  },

  TIMING: {
    // Per-frame hold durations in ms. Growing gaps = deceleration, and it's far
    // easier to tune by feel than a physics sim. 15 frames is exactly 3 clean
    // cycles of the 5 painted frames. Sum ≈ 1808ms.
    holds: [40, 40, 42, 45, 50, 58, 68, 80, 95, 115, 140, 175, 220, 280, 360],
    settleMs: 260, // overshoot bounce on the final shape
    holdAfterSettleMs: 150, // beat before the shape starts leaving
  },

  // Which mouse button opens the widget's own menu (pick / hide / quit).
  // "right" is the macOS convention and also covers Control-click. Set it to
  // "left" to put the menu on a plain click — but note a left click is also
  // how you roll, so the menu takes that over (its first item still rolls).
  // Right-click opens the menu either way.
  CONTEXT_MENU_BUTTON: "right",

  // Which frame becomes the menu bar icon. Drawn as a template image, so only
  // its silhouette is used and it adapts to a light or dark menu bar.
  TRAY_FRAME: "Untitled_Artwork-5.png",

  INK: "#1a1a1a",
};

if (typeof module !== "undefined" && module.exports) module.exports = CONFIG;
