// State machine + frame timing. CONFIG, SHAPES and renderShape come from the
// scripts loaded before this one.

(() => {
  const { TIMING } = CONFIG;
  const HOLDS = TIMING.holds;

  const body = document.body;
  const shapeEl = document.getElementById('shape');
  const shapeInner = document.getElementById('shapeInner');
  const nameEl = document.getElementById('name');
  const pickBtn = document.getElementById('pick');

  let state = 'idle';
  let raf = 0;
  let timers = [];
  let startTime = 0;
  let currentFrame = -1;
  let winner = '';

  // --- name selection ----------------------------------------------------
  // Nobody comes up twice before everyone has come up once. For picking people
  // that matters more than true randomness.
  //
  // What's remembered is who has *already* come up this round, rather than a
  // pre-shuffled queue of who's left. The two are equivalent while the roster
  // holds still, but this one survives it changing: main re-sends the roster on
  // every menu sync — including hide/show, and including pushes where nothing
  // actually changed — and a queue had to be thrown away each time, which
  // quietly started the round over and handed someone a second turn early.

  // Fed from main, not from CONFIG: the roster is editable at runtime, so the
  // list here has to be able to change under us.
  let names = [];
  let picked = new Set();
  let lastPicked = null;

  function setNames(next) {
    names = Array.isArray(next) ? next : [];
    // `picked` deliberately survives: unchecking someone, or just opening the
    // menu, shouldn't give the people already drawn a fresh turn. Anyone added
    // or re-checked isn't in it, so they're eligible straight away.
  }

  function drawName() {
    // The store won't let you empty the roster, so this is only reachable if
    // names.json is unreadable and CONFIG.NAMES is empty too.
    if (!names.length) return 'no names yet';

    let eligible = names.filter((name) => !picked.has(name));

    if (!eligible.length) {
      // Everyone has had a turn — start the next round.
      picked.clear();
      eligible = names.slice();
      // Don't open a round with whoever closed the last one.
      if (eligible.length > 1) eligible = eligible.filter((name) => name !== lastPicked);
    }

    lastPicked = eligible[Math.floor(Math.random() * eligible.length)];
    picked.add(lastPicked);
    return lastPicked;
  }

  // --- click-through and dragging -----------------------------------------
  // The window ignores mouse events by default so clicks reach the slides. We
  // turn that off only while the cursor is over ink that's actually on screen.
  // Whatever is live is also what you grab to move the widget.

  const DRAG_THRESHOLD = 4; // px of travel before a press counts as a drag

  let interactive = false;
  let mouse = { x: -1, y: -1 };
  let press = null;
  let justDragged = false;

  function liveElements() {
    switch (state) {
      case 'idle':
        return [pickBtn];
      case 'rolling':
      case 'settling':
        return [shapeEl];
      case 'result':
        return [nameEl]; // the name is both the re-roll control and the drag handle
      default:
        return [];
    }
  }

  function setInteractive(next) {
    if (next === interactive) return;
    interactive = next;
    window.widget.setInteractive(next);
  }

  function evaluateInteractive() {
    // Never drop interactivity mid-drag — losing it would swallow the mouseup
    // and leave the window stuck to the cursor.
    if (press && press.dragging) {
      setInteractive(true);
      return;
    }
    if (mouse.x < 0) {
      setInteractive(false);
      return;
    }
    setInteractive(
      liveElements().some((el) => {
        const r = el.getBoundingClientRect();
        return mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
      })
    );
  }

  // mousedown only ever reaches us when the cursor is over live ink, so there's
  // no need to check the target.
  window.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    press = { x: event.screenX, y: event.screenY, dragging: false };
  });

  window.addEventListener('mousemove', (event) => {
    mouse = { x: event.clientX, y: event.clientY };

    if (press && !press.dragging) {
      const travel = Math.hypot(event.screenX - press.x, event.screenY - press.y);
      if (travel > DRAG_THRESHOLD) {
        press.dragging = true;
        body.classList.add('dragging');
        window.widget.dragStart();
      }
    }

    evaluateInteractive();
  });

  window.addEventListener('mouseup', () => {
    if (press && press.dragging) {
      window.widget.dragEnd();
      body.classList.remove('dragging');
      // click fires immediately after mouseup; swallow it so letting go of a
      // drag on top of a button doesn't also press the button.
      justDragged = true;
      setTimeout(() => {
        justDragged = false;
      }, 0);
    }
    press = null;
    evaluateInteractive();
  });

  // Without this the window stays clickable after the cursor leaves, which
  // would put a dead zone over the slides.
  document.addEventListener('mouseleave', () => {
    mouse = { x: -1, y: -1 };
    evaluateInteractive();
  });

  // --- native menu ---------------------------------------------------------
  // Built and popped in main; the renderer only says when. Right-click and
  // Control-click both arrive as `contextmenu`, and either can reach us only
  // while the window is accepting clicks — i.e. over live ink.

  const MENU_ON_LEFT = CONFIG.CONTEXT_MENU_BUTTON === 'left';

  function openMenu() {
    // A press that ends in a menu isn't a drag or a pick.
    if (press && press.dragging) window.widget.dragEnd();
    press = null;
    body.classList.remove('dragging');
    window.widget.showMenu();
  }

  window.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openMenu();
  });

  // No mouseup or mouseleave arrives while the menu is tracking, so reset by
  // hand — otherwise the window stays clickable and puts a dead zone over the
  // slides. Mousemove is still forwarded, so it goes live again on its own.
  window.widget.onMenuClosed(() => {
    press = null;
    body.classList.remove('dragging');
    mouse = { x: -1, y: -1 };
    evaluateInteractive();
  });

  // --- state --------------------------------------------------------------

  function setState(next) {
    state = next;
    body.dataset.state = next;
    // Re-check against the last known cursor position rather than waiting for
    // the next mousemove, so ink under a stationary cursor is still live.
    evaluateInteractive();
  }

  function after(ms, fn) {
    timers.push(setTimeout(fn, ms));
  }

  function clearTimers() {
    timers.forEach(clearTimeout);
    timers = [];
  }

  // --- animation ----------------------------------------------------------

  function frameAt(elapsed) {
    let acc = 0;
    for (let i = 0; i < HOLDS.length; i++) {
      acc += HOLDS[i];
      if (elapsed < acc) return i;
    }
    return -1; // schedule exhausted
  }

  function drawFrame(i) {
    shapeInner.innerHTML = renderShape(SHAPES[i % SHAPES.length]);
    // Light touch now that the art carries its own hand-drawn variation — the
    // frames already differ in angle and placement.
    const wobble = () => Math.random() * 2 - 1;
    shapeInner.style.setProperty('--jr', `${(wobble() * 1.5).toFixed(2)}deg`);
    shapeInner.style.setProperty('--jx', `${wobble().toFixed(2)}px`);
    shapeInner.style.setProperty('--jy', `${wobble().toFixed(2)}px`);
  }

  // One rAF loop mapping elapsed time to a frame index. A setTimeout chain
  // would accumulate drift; this cannot.
  function tick(now) {
    const i = frameAt(now - startTime);
    if (i < 0) {
      settle();
      return;
    }
    if (i !== currentFrame) {
      currentFrame = i;
      drawFrame(i);
    }
    raf = requestAnimationFrame(tick);
  }

  function roll() {
    if (state === 'rolling' || state === 'settling') return;

    clearTimers();
    cancelAnimationFrame(raf);
    shapeInner.classList.remove('settle');

    // The winner is decided before a single frame plays. The roll is theater.
    winner = drawName();

    currentFrame = -1;
    setState('rolling');
    startTime = performance.now();
    raf = requestAnimationFrame(tick);
  }

  function settle() {
    setState('settling');
    shapeInner.classList.remove('settle');
    void shapeInner.offsetWidth; // force a reflow so the animation restarts
    shapeInner.classList.add('settle');
    after(TIMING.settleMs + TIMING.holdAfterSettleMs, reveal);
  }

  function reveal() {
    nameEl.textContent = winner;
    setState('result');
    shapeInner.classList.remove('settle');
  }

  function dismiss() {
    clearTimers();
    cancelAnimationFrame(raf);
    shapeInner.classList.remove('settle');
    setState('idle');
  }

  // --- wiring -------------------------------------------------------------

  function activate() {
    if (justDragged) return; // that press was a reposition, not a pick
    if (MENU_ON_LEFT) openMenu();
    else roll();
  }

  pickBtn.addEventListener('click', activate);
  nameEl.addEventListener('click', activate);

  window.widget.onRoster(setNames);

  // Asked for rather than waited for, so a hotkey pressed the instant the
  // widget appears can't find an empty list.
  window.widget.getNames().then(setNames);

  window.widget.onHotkey((action) => {
    if (action === 'roll') roll();
    else if (action === 'dismiss') dismiss();
  });

  document.documentElement.style.setProperty('--ink', CONFIG.INK);

  // Held in scope so the decoded frames aren't garbage collected before the
  // first roll.
  const warmFrames = preloadShapes();
  void warmFrames;

  setState('idle');
})();
