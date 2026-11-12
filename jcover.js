/* Journalism cover: a ring of photos -> one pair folded into a two-way picture (an agamograph).
   The 12 photos turn in a ring on the page's own ground, slow down and stop with this visit's pair
   in front; the pair steps out, and the two pictures become one zigzag-folded board: every fold has
   a face turned left (the first photo, cut into strips) and a face turned right (the second photo).
   Pull the pointer right and the board turns to face right -- the left-turned faces come round to
   you and the first photo shows whole; pull left for the second. Touch: drag sideways.
   Click (or tap) the board: the ring turns again and brings another pair.
   Photos: images/journalism/grid/<name>.webp (small, the ring) and <full>/<name>.webp (the board). */
(function () {
  var stage = document.querySelector('.j-cover');
  if (!stage) return;
  var JC = window.JC || {};
  var DIR = 'images/journalism/';
  var GROUPS = JC.groups || [['morning', 'night'], ['one', 'embracing'], ['inside', 'outside'],
                ['sunny', 'rain'], ['summer', 'winter'], ['black', 'color']];
  var FULL = JC.full || DIR;
  var NAMES = [].concat.apply([], GROUPS);          /* ring order: each pair side by side */
  var STEP = 360 / NAMES.length;
  var THETA = 45;                                     /* fold: each face 45 deg off the board's plane */
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var pair = JC.pair || GROUPS[Math.floor(Math.random() * GROUPS.length)];

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeIO(k) { return (1 - Math.cos(Math.PI * k)) / 2; }

  /* ---------- the ring ---------- */
  var ring = document.createElement('div'); ring.className = 'jc-ring';
  var cards = NAMES.map(function (n) {
    var c = document.createElement('div'); c.className = 'jc-card';
    var im = document.createElement('img'); im.src = DIR + 'grid/' + n + '.webp'; im.alt = ''; im.draggable = false;
    c.appendChild(im); ring.appendChild(c); return c;
  });
  stage.appendChild(ring);

  /* ---------- the board ---------- */
  var board = document.createElement('div'); board.className = 'jc-board';
  stage.appendChild(board);
  var labels = document.createElement('div'); labels.className = 'jc-labels';
  var labA = document.createElement('span'), labB = document.createElement('span');
  labels.appendChild(labA); labels.appendChild(labB); stage.appendChild(labels);

  var faces = [], N = 0, F = 0, BW = 0, BH = 0, ratios = {}, RES = 0;
  var PERSP = 1700, MAX = THETA - 3;   /* the stage's perspective; the furthest the board turns (just short of edge-on) */
  /* the size of everything, from the stage */
  var W = 0, H = 0, CW = 0, R = 0, LIFTZ = 0;
  /* the opener ("Covering the campus...") sits over the top of the stage, where it would be without
     the photos; the ring and the board take the room under it */
  var dek = document.querySelector('main > p.dek');
  function measure() {
    W = stage.clientWidth; H = stage.clientHeight;
    var portrait = H > W * 1.1;
    RES = 0;
    if (dek) {
      var pad = parseFloat(getComputedStyle(dek.parentNode).paddingTop) || 0;
      RES = pad + dek.offsetHeight + (portrait ? 16 : 28);
    }
    stage.style.setProperty('--res', RES + 'px');
    H = H - RES;
    BW = Math.min(W * (portrait ? 0.84 : 0.62), (H - 96) * 4 / 3, 760);   /* the folded board, 4:3 */
    BH = BW * 3 / 4;
    N = BW >= 560 ? 20 : BW >= 380 ? 14 : 10;                          /* folds */
    F = BW / (N * 2 * Math.cos(THETA * Math.PI / 180));                   /* one face's width */
    CW = Math.min(W * (portrait ? 0.3 : 0.15), 190, H * 0.24 * 4 / 3);   /* a card in the ring */
    R = CW / (2 * Math.tan(Math.PI / NAMES.length)) * 1.18;
    stage.style.setProperty('--cw', CW + 'px');
    LIFTZ = Math.max(0, Math.min(1200, 1700 * (1 - CW / (0.5 * BW))));   /* each card then half the board's width */
    stage.style.setProperty('--bh', BH + 'px'); stage.style.setProperty('--bw', BW + 'px');
  }

  /* Each face shows its strip of the photo, the photo cropped to fill the faces' full run, centred.
     The strips are not equal slices: seen from the far end of its turn (the board at +-MAX), the board's
     far side is further from you and shrinks in perspective, so a photo cut evenly would look squeezed
     toward that side. Each face gets the share of the photo that its width takes on screen at that
     angle -- the far faces show less of the picture, stretched -- so from there it reads as the photo.
     (Exact at the end of the turn; in between, the stripes of the two photos mix anyway.) */
  function screenX(x, z, phi) {   /* a point of the board (x, z), the board turned by phi: its place on screen */
    var c = Math.cos(phi), sn = Math.sin(phi), X = x * c + z * sn, Z = -x * sn + z * c;
    return X * PERSP / (PERSP - Z);
  }
  function shares(k) {   /* k 0: the left-turned faces at +MAX; 1: the right-turned ones at -MAX */
    var t = THETA * Math.PI / 180, p = 2 * F * Math.cos(t), d = F * Math.sin(t), w = N * p;
    var phi = (k ? -MAX : MAX) * Math.PI / 180, ed = [];
    for (var i = 0; i < N; i++) {
      var x = i * p - w / 2;
      if (!k) ed.push([screenX(x, -d / 2, phi), screenX(x + F * Math.cos(t), d / 2, phi)]);
      else ed.push([screenX(x + p / 2, d / 2, phi), screenX(x + p / 2 + F * Math.cos(t), -d / 2, phi)]);
    }
    var a = ed[0][0], b = ed[N - 1][1];
    return ed.map(function (e) { return [(e[0] - a) / (b - a), (e[1] - a) / (b - a)]; });
  }
  var SH = [[], []];
  function strip(face, name, i, k) {
    var run = N * F, r = ratios[name] || 4 / 3, sw, sh, x0, y0;
    if (r > run / BH) { sh = BH; sw = BH * r; x0 = (sw - run) / 2; y0 = 0; }
    else { sw = run; sh = run / r; x0 = 0; y0 = (sh - BH) / 2; }
    var u = SH[k][i], kx = F / ((u[1] - u[0]) * run);   /* this face's share, stretched across its width */
    face.style.backgroundImage = 'url(' + FULL + name + '.webp), url(' + DIR + 'grid/' + name + '.webp)';
    face.style.backgroundSize = (sw * kx) + 'px ' + sh + 'px';
    face.style.backgroundPosition = (-(x0 + u[0] * run) * kx) + 'px ' + (-y0) + 'px';
  }
  function build() {
    board.textContent = ''; faces = []; SH = [shares(0), shares(1)];
    for (var i = 0; i < N; i++) {
      ['a', 'b'].forEach(function (s, k) {
        var f = document.createElement('div'); f.className = 'jc-face ' + s;
        f.style.width = F + 'px'; f.style.height = BH + 'px';
        strip(f, pair[k], i, k);
        board.appendChild(f); faces.push(f);
      });
    }
    labA.textContent = cap(pair[0]); labB.textContent = cap(pair[1]);
  }
  /* fold the board to angle th (0 = flat, THETA = folded) and turn it by phi (deg; + = to the right) */
  function fold(th, phi) {
    var t = th * Math.PI / 180, p = 2 * F * Math.cos(t), d = F * Math.sin(t), w = N * p;
    for (var i = 0; i < N; i++) {
      var x = i * p - w / 2;
      faces[2 * i].style.transform = 'translate3d(' + x + 'px,0,' + (-d / 2) + 'px) rotateY(' + (-th) + 'deg)';
      faces[2 * i + 1].style.transform = 'translate3d(' + (x + p / 2) + 'px,0,' + (d / 2) + 'px) rotateY(' + th + 'deg)';
    }
    board.style.transform = 'rotateY(' + phi + 'deg)';
    /* light: a face darkens as it turns away from you */
    var la = Math.cos((phi - th) * Math.PI / 180), lb = Math.cos((phi + th) * Math.PI / 180);
    board.style.setProperty('--da', (0.42 * (1 - Math.max(0, la))).toFixed(3));
    board.style.setProperty('--db', (0.42 * (1 - Math.max(0, lb))).toFixed(3));
    /* the name of the photo you are seeing more of, in ink; the other in grey */
    labA.classList.toggle('on', phi > 4); labB.classList.toggle('on', phi < -4);
  }

  /* ---------- the ring's motion ---------- */
  var ang = 0;
  function placeRing(a, liftK) {
    ring.style.transform = 'translateZ(' + (-R) + 'px) rotateX(' + (-9 * (1 - (liftK || 0))) + 'deg) rotateY(' + a + 'deg)';   /* the tilt levels out as the pair comes forward */
    cards.forEach(function (c, i) {
      var th = i * STEP, world = ((th + a) % 360 + 540) % 360 - 180;   /* -180..180, 0 = facing you */
      var isPair = NAMES[i] === pair[0] || NAMES[i] === pair[1];
      var z = R, op = 0.3 + 0.7 * Math.max(0, Math.cos(world * Math.PI / 180));
      /* the pair comes toward you and closes up, side by side, until together they are as wide as the board */
      if (liftK) {
        if (isPair) {
          z = R + liftK * LIFTZ; op = 1;
          var al = Math.asin(Math.min(1, (CW / 2) / z)) * 180 / Math.PI, side = world < 0 ? -1 : 1;
          th += (side * (STEP / 2 + (al - STEP / 2) * liftK)) - world;
        } else op *= 1 - liftK;
      }
      c.style.transform = 'rotateY(' + th + 'deg) translateZ(' + z + 'px)';
      c.style.opacity = op.toFixed(3);
    });
  }

  var raf = 0, mode = 'intro', phi = 0, target = 0, last = 0, user = false;
  function run(fn) { cancelAnimationFrame(raf); var t0 = performance.now(); (function f(now) { if (fn(now - t0) !== false) raf = requestAnimationFrame(f); })(t0); }

  function play() {
    mode = 'intro'; user = false;
    stage.classList.remove('folded'); stage.classList.add('spinning');
    measure(); build();
    var i0 = NAMES.indexOf(pair[0]);
    var stop = -(i0 * STEP + STEP / 2);                    /* the pair's middle in front */
    var start = ang, least = still ? 0 : 1.5 * 360;
    var end = stop; while (end > start - least) end -= 360;   /* whole turns only (the pair must land in front): always the same way, at least a turn and a half */
    var SPIN = still ? 0 : 3400, LIFT = still ? 0 : 700, FOLD = still ? 0 : 1300, SWAY = still ? 0 : 2600;
    run(function (t) {
      if (t < SPIN) { ang = start + (end - start) * easeOut(t / SPIN); placeRing(ang, 0); return; }
      ang = end;
      if (t < SPIN + LIFT) { placeRing(ang, easeIO((t - SPIN) / LIFT)); return; }
      /* the board unfolds out of the two cards: flat (both pictures in fine stripes) -> folded */
      if (!stage.classList.contains('folded')) { stage.classList.remove('spinning'); stage.classList.add('folded'); }
      var k = FOLD ? clamp((t - SPIN - LIFT) / FOLD, 0, 1) : 1;
      if (k < 1) { fold(THETA * easeIO(k), 0); return; }
      /* then it turns once to each side, so you see what it does, and hands over to the pointer */
      var s = SWAY ? clamp((t - SPIN - LIFT - FOLD) / SWAY, 0, 1) : 1;
      if (!user && s < 1) { phi = 38 * Math.sin(2 * Math.PI * s) * (1 - s * 0.15); fold(THETA, phi); return; }
      if (!user) { phi = 0; fold(THETA, 0); }
      mode = 'live'; target = phi; return false;
    });
  }

  /* ---------- the pointer ---------- */
  function follow() {
    cancelAnimationFrame(raf); last = 0;
    raf = requestAnimationFrame(function f(now) {
      var dt = last ? now - last : 16; last = now;
      phi += (target - phi) * (1 - Math.exp(-dt / 110));
      if (Math.abs(target - phi) < 0.05) phi = target;
      fold(THETA, phi);
      if (phi !== target) raf = requestAnimationFrame(f);
    });
  }
  function aim(x) {
    var o = stage.getBoundingClientRect();
    target = clamp(((x - o.left) / o.width * 2 - 1) * MAX * 1.25, -MAX, MAX);
  }
  var dragX = null, dragged = false;
  /* the mouse is followed over the whole stage, also where the opener or the time box lie on it */
  var inside = false;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'mouse') {
      var o = stage.getBoundingClientRect();
      var now = e.clientX >= o.left && e.clientX <= o.right && e.clientY >= o.top && e.clientY <= o.bottom;
      if (!now) { if (inside && mode === 'live') { target = 0; follow(); } inside = false; return; }
      inside = true; user = true;
      if (mode !== 'live') return;
      aim(e.clientX); follow();
    } else if (dragX != null) {
      if (Math.abs(e.clientX - dragX) > 4) dragged = true;
      user = true; if (mode !== 'live') { dragX = e.clientX; return; }
      target = clamp(target + (e.clientX - dragX) * 0.35, -MAX, MAX); dragX = e.clientX; follow();
    }
  }, { passive: true });
  stage.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { dragX = e.clientX; dragged = false; } });
  window.addEventListener('pointerup', function () { dragX = null; });

  /* a click on the board: another pair */
  board.addEventListener('click', function () {
    if (mode !== 'live' || dragged) { dragged = false; return; }
    var others = GROUPS.filter(function (g) { return g[0] !== pair[0]; });
    pair = others[Math.floor(Math.random() * others.length)];
    [0, 1].forEach(function (k) { var im = new Image(); im.src = FULL + pair[k] + '.webp'; });
    play();
  });
  /* keyboard: the arrows turn it */
  stage.tabIndex = 0;
  stage.addEventListener('keydown', function (e) {
    if (mode !== 'live') return;
    if (e.key === 'ArrowRight') target = clamp(target + 15, -MAX, MAX);
    else if (e.key === 'ArrowLeft') target = clamp(target - 15, -MAX, MAX);
    else return;
    e.preventDefault(); user = true; follow();
  });

  window.addEventListener('resize', function () {
    var was = mode; measure(); build();
    if (stage.classList.contains('folded')) fold(THETA, phi); else placeRing(ang, 0);
    mode = was;
  });

  /* each photo's own ratio (for the crop), then go */
  var pending = NAMES.length;
  NAMES.forEach(function (n, i) {
    var im = cards[i].firstChild;
    function done() { ratios[n] = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 4 / 3; if (--pending === 0) { measure(); placeRing(0, 0); stage.classList.add('ready'); play(); } }
    if (im.complete && im.naturalWidth) done(); else { im.addEventListener('load', done); im.addEventListener('error', done); }
  });
  measure(); placeRing(0, 0);

  /* the opener stays put at the top of the stage while the photos scroll away, and once the text
     beneath it comes up to it, it goes up with the text */
  if (dek) {
    var dekY = function () {
      dek.style.transform = '';
      var head = document.querySelector('.site-head'), hb = head ? head.getBoundingClientRect().bottom : 0;
      var pad = parseFloat(getComputedStyle(dek.parentNode).paddingTop) || 0;
      var nat = dek.getBoundingClientRect().top;
      var want = Math.min(nat, hb + pad);   /* where it would sit with no photos: under the bar, after main's own top space -- held there on screen */
      dek.style.transform = 'translateY(' + (want - nat) + 'px)';
    };
    dek.classList.add('jc-dek');
    dekY(); window.addEventListener('scroll', dekY, { passive: true }); window.addEventListener('resize', dekY);
    window.addEventListener('load', dekY);   /* the page settles (fonts, the bar) after the first go */
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(dekY);
    if (window.ResizeObserver) new ResizeObserver(dekY).observe(document.body);
  }
})();
