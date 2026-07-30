// State machine + frame timing. CONFIG, SHAPES and renderShape come from the
// scripts loaded before this one.

(() => {
  const { TIMING, NAMES } = CONFIG;
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
  // Shuffle bag, not random choice: nobody comes up twice before everyone has
  // come up once. For picking people that matters more than true randomness.

  let bag = [];
  let lastPicked = null;

  function shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function drawName() {
    if (!NAMES.length) return 'add names to config.js';
    if (NAMES.length === 1) return NAMES[0];

    if (!bag.length) {
      bag = shuffled(NAMES);
      // A fresh bag can otherwise repeat whoever was picked last.
      if (bag[bag.length - 1] === lastPicked) {
        const j = Math.floor(Math.random() * (bag.length - 1));
        [bag[bag.length - 1], bag[j]] = [bag[j], bag[bag.length - 1]];
      }
    }

    lastPicked = bag.pop();
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
    roll();
  }

  pickBtn.addEventListener('click', activate);
  nameEl.addEventListener('click', activate);

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
