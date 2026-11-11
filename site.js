/* Shared by every page. */

/* Footer clocks: <time data-tz="..."> shows HH:MM in that time zone.
   Where present, .dow shows the weekday (Thursday). Updated every second;
   HH:MM is only rewritten when it changes. */
(function () {
  var els = document.querySelectorAll('time[data-tz]');
  if (!els.length || !window.Intl) return;
  function fmt(tz, o) { o.timeZone = tz; return new Intl.DateTimeFormat('en-US', o); }
  function tick() {
    var now = new Date();
    els.forEach(function (el) {
      var tz = el.getAttribute('data-tz');
      try {
        var t = fmt(tz, { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now).split(':');
        var hm = el.querySelector('.hm'), key = t[0] + ':' + t[1];
        if (hm.getAttribute('data-v') !== key) {
          hm.setAttribute('data-v', key);
          hm.textContent = key;
        }
        var sec = el.querySelector('.sec');
        if (sec) sec.textContent = t[2];
        var dow = el.querySelector('.dow');
        if (dow) dow.textContent = fmt(tz, { weekday: 'long' }).format(now);   /* Thursday */
      } catch (e) {}
    });
    setTimeout(tick, 1000 - now.getMilliseconds() + 20);   /* on the second */
  }
  tick();
})();

/* Footer dial (.aclock): one face, one minute hand, an hour hand for Seoul (data-home "Zone=Name")
   and one per city in data-zones ("Zone=Name|..."), each named just outside the dial.
   The dial is drawn as large as it can be, beside the time and mail lines and down as far as the
   address (phones) or the copyright (wider screens), its right edge on the column's right edge. On wider screens the group's top
   (highest name, or the circle) sits on the top of the time's digits; on phones the circle's top does. Every name stays inside that area and
   the column, clear of all the words and boxes around it -- at every half hour of the day, so the
   dial keeps one size as the hands turn (only its sideways place may shift a little). */
(function () {
  var box = document.querySelector('.aclock');
  if (!box || !window.Intl) return;
  var host = box.parentNode, foot = box.closest('.site-foot') || document;
  var NS = 'http://www.w3.org/2000/svg', S = 88, C = S / 2, R = C - 0.5, GAP = 5;
  var hz = box.getAttribute('data-home').split('='), home = hz[0], homeName = hz[1] || '';
  var zones = box.getAttribute('data-zones').split('|').map(function (z) { z = z.split('='); return { tz: z[0], name: z[1] }; });
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var svg = el('svg', { viewBox: '0 0 ' + S + ' ' + S, 'aria-hidden': 'true' });
  svg.appendChild(el('circle', { 'class': 'face', cx: C, cy: C, r: R }));
  for (var i = 0; i < 12; i++) {
    var a = i * Math.PI / 6, l = 3;   /* every hour mark the same length */
    svg.appendChild(el('line', { 'class': 'tick',
      x1: C + Math.sin(a) * (R - l), y1: C - Math.cos(a) * (R - l), x2: C + Math.sin(a) * R, y2: C - Math.cos(a) * R }));
  }
  var cityHands = zones.map(function () { return svg.appendChild(el('line', { 'class': 'hand city' })); });
  var homeHand = svg.appendChild(el('line', { 'class': 'hand home' }));
  var minHand = svg.appendChild(el('line', { 'class': 'hand min' }));
  var pin = svg.appendChild(el('circle', { 'class': 'pin', cx: C, cy: C, r: 1.75 }));
  var fillDisc = document.createElement('span'); fillDisc.className = 'aclock-fill'; fillDisc.setAttribute('aria-hidden', 'true');
  box.appendChild(fillDisc);
  box.appendChild(svg);
  /* hover: one crimson arc from Seoul's hour hand round to its minute hand.
     Path: clockwise from the hour hand h to the minute hand m, one full turn plus the way between
       them -- D = 360 + (m - h, clockwise) -- so it passes over the whole face once.
     One eased progress p (0 -> 1) drives everything:
       centre  C = D * p                      (slides from the hour hand to the minute hand)
       length  L = Lmax * sin(pi * p)         (0 at the start, largest midway, 0 at the end)
       head = C + L/2, tail = C - L/2
     so the arc is born as a point on the hour hand and closes to a point on the minute hand, filling
     and clearing at mirrored speeds. Lmax = min(360, 2D/pi) keeps the head from ever passing the
     minute hand or the tail going back past the hour hand, without clamping.
     Each turn re-reads the hands (so a long hover never runs on stale angles), and its duration grows
     with D, so the arc turns at an even pace whether the minute hand is just ahead of the hour hand
     or just behind it. City hands go white while crimson lies under them; Seoul's hour and minute
     hands stay pale grey. A beat's rest between turns. */
  var sweeping = 0, homeA = 0, minA = 0, cityA = [];
  var REST = 600, BAND = 45, cyc = null;
  function ease(x) { x = Math.max(0, Math.min(1, x)); return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function rel(a, from) { return ((a - from) % 360 + 360) % 360; }
  function light(line, on) { line.style.stroke = on ? 'var(--dial-on, #fff)' : ''; }
  function readHands() {
    var now = new Date(), H = hm(home, now);
    homeA = hourAng(H) * 180 / Math.PI; minA = (H.m + H.s / 60) * 6;
    cityA = zones.map(function (z) { return hourAng(hm(z.tz, now)) * 180 / Math.PI; });
  }
  function newCycle(t) {
    readHands();
    var D = 360 + rel(minA, homeA);
    cyc = { t: t, D: D, T: 1100 + (D - 360) / 360 * 700, Lmax: Math.min(360, 2 * D / Math.PI) };   /* 1.1s for one turn, 1.8s for two */
  }
  /* crimson between tail and head (unwrapped angles from the hour hand); a light edge at the head */
  function arc(tail, head) {
    var C1 = 'var(--dial-fill, var(--crimson))', C2 = 'var(--dial-edge, var(--crimson-light))';
    if (head - tail <= 0.2) return 'transparent';
    if (head - tail >= 359.9) return C1;
    var edge = Math.min(BAND, head - tail), eS = head - edge, pieces = [];
    function col(u) { if (u <= eS) return C1; var f = Math.round((u - eS) / edge * 100); return 'color-mix(in srgb, ' + C2 + ' ' + f + '%, ' + C1 + ')'; }
    function add(s0, e0) {   /* split at whole turns, then fold into 0..360 */
      for (var s1 = s0; s1 < e0 - 1e-6; ) {
        var nxt = Math.min(e0, (Math.floor(s1 / 360) + 1) * 360), base = Math.floor(s1 / 360) * 360;
        pieces.push({ a: s1 - base, b: nxt - base, ca: col(s1), cb: col(nxt) }); s1 = nxt;
      }
    }
    if (eS > tail) add(tail, eS);
    var steps = 6;   /* the light edge in a few slices, so its colour runs smoothly even across 0deg */
    for (var k = 0; k < steps; k++) add(eS + edge * k / steps, eS + edge * (k + 1) / steps);
    pieces.sort(function (p, q) { return p.a - q.a; });
    var st = [], cur = 0;
    pieces.forEach(function (p) {
      if (p.a > cur + 1e-3) st.push('transparent ' + cur + 'deg ' + p.a + 'deg');
      st.push(p.ca + ' ' + p.a + 'deg', p.cb + ' ' + p.b + 'deg'); cur = p.b;
    });
    if (cur < 360) st.push('transparent ' + cur + 'deg 360deg');
    return 'conic-gradient(from ' + homeA + 'deg, ' + st.join(', ') + ')';
  }
  function wipe(now) {
    if (!cyc || now - cyc.t >= cyc.T + REST) newCycle(now);
    var el = now - cyc.t, on = el < cyc.T, head = 0, tail = 0;
    if (on) {
      var p = ease(el / cyc.T), C = cyc.D * p, L = cyc.Lmax * Math.sin(Math.PI * p);
      head = C + L / 2; tail = C - L / 2;
    }
    fillDisc.style.background = on ? arc(tail, head) : 'transparent';
    cityHands.forEach(function (h, k) {
      var r = rel(cityA[k], homeA), lit = false;
      for (var t = r; t <= head; t += 360) if (t >= tail && t <= head - BAND / 2) lit = true;
      light(h, on && lit);
    });
    pin.style.fill = (on && head - tail > 40) ? 'var(--dial-on, #fff)' : '';
    sweeping = requestAnimationFrame(wipe);
  }
  var canHover = !window.matchMedia || window.matchMedia('(hover: hover)').matches;   /* touch screens: no sweep (a tap would leave it stuck) */
  box.addEventListener('mouseenter', function () {
    if (!canHover) return;
    cyc = null; if (!sweeping) sweeping = requestAnimationFrame(wipe);
    box.classList.add('live');
  });
  box.addEventListener('mouseleave', function () {
    cancelAnimationFrame(sweeping); sweeping = 0; box.classList.remove('live');
    [homeHand, minHand].concat(cityHands).forEach(function (h) { light(h, false); }); pin.style.fill = '';
  });

  function hm(tz, when) {
    var t = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(when).split(':');
    return { h: +t[0], m: +t[1], s: +t[2] };
  }
  function point(line, ang, len) {
    line.setAttribute('x1', C); line.setAttribute('y1', C);
    line.setAttribute('x2', C + Math.sin(ang) * len); line.setAttribute('y2', C - Math.cos(ang) * len);
  }
  function hourAng(t) { return ((t.h % 12) + t.m / 60) * Math.PI / 6; }
  function isPhone() { return !!(window.matchMedia && window.matchMedia('(max-width: 40rem)').matches); }

  /* the labels for a moment: one per hour hand (Seoul's left out on phones); hands pointing
     (nearly) the same way share one label */
  function groupsAt(when, phone) {
    var labelled = zones.map(function (z) { return { name: z.name, a: hourAng(hm(z.tz, when)) }; });
    if (homeName && !phone) labelled.push({ name: homeName, a: hourAng(hm(home, when)) });
    labelled.sort(function (p, q) { return p.a - q.a; });
    var groups = [];
    labelled.forEach(function (it) {
      var g = groups[groups.length - 1];
      if (g && it.a - g.a1 < 0.4) { g.names.push(it.name); g.a1 = it.a; } else groups.push({ names: [it.name], a0: it.a, a1: it.a });
    });
    if (groups.length > 1) {   /* the circle wraps round at 12 */
      var f = groups[0], z = groups[groups.length - 1];
      if (f.a0 + 2 * Math.PI - z.a1 < 0.4) { z.names = z.names.concat(f.names); z.a1 = f.a1 + 2 * Math.PI; groups.shift(); }
    }
    return groups;
  }

  /* label sizes, measured once each */
  var sizes = {};
  function fill(n, names, stacked) {
    n.textContent = '';
    if (stacked) names.forEach(function (nm, i) { if (i) n.appendChild(document.createElement('br')); n.appendChild(document.createTextNode(nm)); });
    else n.textContent = names.join(' · ');
  }
  function measure(names, stacked) {
    var key = names.join('|') + (stacked ? '#' : '') + (isPhone() ? 'p' : '');
    if (!sizes[key]) {
      var n = document.createElement('span'); n.className = 'lab'; fill(n, names, stacked); box.appendChild(n);
      var h = n.offsetHeight, lh = parseFloat(getComputedStyle(n).lineHeight) || h;
      sizes[key] = { w: n.offsetWidth, h: h, ih: h / 2 - lh * 0.2 };   /* ih: half the letters' own height */
      n.remove();
    }
    return sizes[key];
  }
  /* one label beside a dial of size D (px): its centre goes out along the hand's direction until the
     letters' nearest edge or corner is exactly GAP outside the rim. Beside the dial a shared label
     stacks its names on phones, to stay narrow; above or below, it runs them on one line, to stay
     low -- unless stackAll asks for every shared label to be stacked. */
  function geom(g, D, stackAll, phone) {
    var a = (g.a0 + g.a1) / 2, s = Math.sin(a), c = Math.cos(a), Rk = R * D / S, Ck = D / 2;
    var stacked = g.names.length > 1 && (stackAll || (phone && Math.abs(s) > Math.abs(c)));
    /* the label hangs off its point the way the hand points: straight out -> centred on it; on a
       diagonal -> by its near corner (a label up and to the left sits with its bottom-right corner
       there), so a wide shared label doesn't slide round to the top. The point goes out along the
       hand until the letters' nearest edge or corner is exactly GAP outside the rim. */
    var m = measure(g.names, stacked), k = 1 / Math.max(Math.abs(s), Math.abs(c));
    var ox = s * k * m.w / 2, oy = -c * k * m.ih, lo = 0, hi = Rk + GAP + m.w + m.h;
    for (var it = 0; it < 24; it++) {
      var md = (lo + hi) / 2, px = s * md + ox, py = -c * md + oy;
      var ex = Math.max(Math.abs(px) - m.w / 2, 0), ey = Math.max(Math.abs(py) - m.ih, 0);
      if (Math.hypot(ex, ey) < Rk + GAP) lo = md; else hi = md;
    }
    var cx = Ck + s * hi + ox, cy = Ck - c * hi + oy;
    return { names: g.names, stacked: stacked, x: cx - m.w / 2, y: cy - m.h / 2, w: m.w, h: m.h,
             l: cx - m.w / 2, r: cx + m.w / 2, t: cy - m.ih, b: cy + m.ih };
  }
  /* all the labels; two that would touch become one label, and everything is placed again */
  function layout(groups, D, stackAll, phone) {
    var gs = groups.map(function (g) { return { names: g.names.slice(), a0: g.a0, a1: g.a1 }; }), placed;
    for (var round = 0; round < 6; round++) {
      placed = gs.map(function (g) { return geom(g, D, stackAll, phone); });
      var hit = -1;
      for (var i2 = 0; i2 < placed.length && hit < 0; i2++) {
        var p = placed[i2], q = placed[(i2 + 1) % placed.length];
        if (placed.length > 1 && p !== q && p.l < q.r + 6 && q.l < p.r + 6 && p.t < q.b + 4 && q.t < p.b + 4) hit = i2;
      }
      if (hit < 0) break;
      var g1 = gs[hit], j = (hit + 1) % gs.length, g2 = gs[j];
      var span = g2.a1 < g1.a0 ? g2.a1 + 2 * Math.PI : g2.a1;
      gs.splice(hit, 1, { names: g1.names.concat(g2.names), a0: g1.a0, a1: span });
      gs.splice(j > hit ? j : 0, 1);
    }
    return placed;
  }

  /* the area the dial may use, and what it must keep clear of (all relative to the clocks block) */
  function area(phone) {
    var hr = host.getBoundingClientRect();
    function rel(e, cut) {
      var r = e.getBoundingClientRect(), c = r.height * cut;
      return { l: r.left - hr.left, r: r.right - hr.left, t: r.top - hr.top + c, b: r.bottom - hr.top - c };
    }
    var cm = host.querySelector('.clock-main');
    if (!cm) {
      /* wide screens: the time and mail live in the left sketch area; the dial sits beside the one
         paragraph left in the footer (copyright, then the address), from its first line to its last */
      var lines = [].map.call(foot.querySelectorAll('.foot-copy, .foot-contact > *'), function (e) { return rel(e, 0.2); });
      var t0 = Math.min.apply(null, lines.map(function (r) { return r.t; })), b0 = Math.max.apply(null, lines.map(function (r) { return r.b; }));
      /* it may use the footer's padding too -- from --s2 under the top line's shade to --s2 above the
         page's end -- without the footer growing */
      var fr = foot.getBoundingClientRect(), floor0 = fr.bottom - hr.top - 8;
      /* the ceiling: an imagined line over the copyright, as far above its capitals as the address's
         last baseline is above the page's end -- the footer's margin mirrored, so the dial keeps within */
      var bl0 = function (el) { var z = document.createElement('span'); z.style.cssText = 'display:inline-block;width:0;height:0'; el.appendChild(z); var y = z.getBoundingClientRect().top; z.remove(); return y; };
      var copy = foot.querySelector('.foot-copy'), addrLast = foot.querySelector('.foot-contact > :last-child');
      var ccs = getComputedStyle(copy), cctx = document.createElement('canvas').getContext('2d');
      cctx.font = ccs.fontWeight + ' ' + ccs.fontSize + ' ' + ccs.fontFamily;
      var capTop = bl0(copy) - cctx.measureText('H').actualBoundingBoxAscent;
      var ceil0 = capTop - (fr.bottom - bl0(addrLast)) - hr.top;
      return { keep: lines, top: ceil0, bot: floor0, ceil: ceil0, centre: true, cy: (ceil0 + floor0) / 2, colR: hr.width, cx0: hr.width };
    }
    var words = [].filter.call(host.querySelectorAll('.clock-main .hm, .clock-main .dow, .clock-main .city'), function (e) { return e.getClientRects().length; })
                  .map(function (e) { return rel(e, 0.2); });   /* only words actually shown */
    var mail = rel(host.querySelector('.foot-mail'), 0);
    /* below: the address (and, on wider screens, the copyright on the right) -- the dial stays clear of them */
    var below = [].map.call(foot.querySelectorAll('.foot-contact > *, .foot-copy'), function (e) { return rel(e, 0.2); });
    var keep = words.concat([mail], below);
    var top = Math.min.apply(null, words.map(function (r) { return r.t; }));
    /* down to the first thing under it: on phones the address line right under the mail (it runs the
       full width); on wider screens the copyright, which sits under the dial on the right */
    var bot = phone ? Math.min.apply(null, below.map(function (r) { return r.t; })) - 4
                    : (below.length ? below[below.length - 1].t - 20 : mail.b);   /* tight: --s4 clear of the copyright */
    var colR = hr.width;
    /* the ceiling: names above the dial may rise to --s2 under the footer's top line and its shade */
    var ceil = (foot.querySelector('.foot-main') || foot).getBoundingClientRect().top - hr.top + 8 + 8;   /* the line, its shade, and --s2 */
    return { keep: keep, top: top, bot: bot, ceil: ceil, cy: (top + bot) / 2, colR: colR,
             cx0: phone ? (mail.r + colR) / 2 : colR };   /* phones: middle of the room beside the mail; wider: as far right as it goes */
  }
  /* where the dial's centre can go for one moment's labels at size D: the allowed x nearest cx0, or null */
  function bestX(groups, D, A, phone, stackAll) {
    if (stackAll === undefined) return bestX(groups, D, A, phone, false) || bestX(groups, D, A, phone, true);
    var placed = layout(groups, D, stackAll, phone), half = D / 2;
    var rects = placed.map(function (p) { return { l: p.l - half, r: p.r - half, t: p.t - half, b: p.b - half }; })
                      .concat([{ l: -half, r: half, t: -half, b: half }]);
    if (!phone) {
      /* wider screens, as on phones: the circle's top on the top of the time's digits (names above it
         may rise into the room over the time, up to --s5 above it), and the group's right edge (its
         rightmost name, or the circle) on the column's right */
      var gR = Math.max.apply(null, rects.map(function (q) { return q.r; }));
      var X = A.colR - gR, Y = A.top + half;
      if (A.centre) {   /* sketch layout: the whole group centred in the footer's height, its own padding included */
        var gT = Math.min.apply(null, rects.map(function (q) { return q.t; })), gB = Math.max.apply(null, rects.map(function (q) { return q.b; }));
        Y = (A.ceil + A.bot) / 2 - (gT + gB) / 2;
      }
      var fits = rects.every(function (q) {
        var L = X + q.l, Rr = X + q.r, T = Y + q.t, B = Y + q.b;
        if (L < 0 || B > A.bot || T < Math.min(A.top, A.ceil)) return false;
        return A.keep.every(function (w) { return !(L < w.r + 8 && w.l < Rr + 8 && T < w.b + 4 && w.t < B + 4); });
      });
      return fits ? { x: X, cy: Y, stackAll: stackAll, placed: placed } : null;
    }
    /* phones: the circle's top on the top of the time's digits (names above it may rise into the
       space over the time -- the footer's own spacing stays as it is), and the group's right edge on
       the column's right edge */
    /* At some hours a name on the left would run into the words at that height; then, and only
       then, the dial drops a little at a time until it clears them. */
    var gR2 = Math.max.apply(null, rects.map(function (q) { return q.r; }));
    var X2 = A.colR - gR2;
    for (var Y2 = A.top + half; ; Y2 += 2) {
      var low = false;
      var fits2 = rects.every(function (q) {
        var L = X2 + q.l, Rr = X2 + q.r, T = Y2 + q.t, B = Y2 + q.b;
        if (B > A.bot) { low = true; return false; }
        if (L < 0) return false;
        return A.keep.every(function (w) { return !(L < w.r + 8 && w.l < Rr + 8 && T < w.b + 4 && w.t < B + 4); });
      });
      if (fits2) return { x: X2, cy: Y2, stackAll: stackAll, placed: placed };
      if (low) return null;
    }
  }

  var fit = null, labs = [], lastKey = '';
  /* the largest size that suits every half hour of the day */
  function makeFit(now, phone) {
    var A0 = area(phone), day = [];
    for (var k = 0; k < 48; k++) day.push(groupsAt(new Date(now.getTime() + k * 1800000), phone));
    var mid = A0.cy, span = 0, best = { A: A0, D: null };   /* the height comes from the top alignment */
    var offs = [0];
    for (var d = 4; d <= span; d += 4) offs.push(-d, d);
    offs.forEach(function (off) {
      var A = Object.assign({}, A0, { cy: mid + off });
      var ok = function (D) { return day.every(function (gs) { return bestX(gs, D, A, phone) !== null; }); };
      var lo = 40, hi = Math.floor(Math.min(A.bot - A.top, 240)), D = null;
      if (ok(lo)) { D = lo; while (hi - lo > 1) { var md = (lo + hi) >> 1; if (ok(md)) { lo = md; D = md; } else hi = md; } if (ok(hi)) D = hi; }
      if (D !== null && (best.D === null || D > best.D)) best = { A: A, D: D };
    });
    if (phone && best.D) {
      /* phones: of the sizes that work all day, the one that keeps the circle's top on the time's
         top at the most hours (the larger on a tie) */
      var bestDrops = Infinity, pick = best.D;
      for (var D2 = best.D; D2 >= 40; D2 -= 2) {
        var drops = 0, all = true;
        for (var j = 0; j < day.length && all; j++) {
          var r = bestX(day[j], D2, best.A, phone);
          if (!r) all = false; else if (r.cy > best.A.top + D2 / 2 + 0.5) drops++;
        }
        if (all && drops < bestDrops) { bestDrops = drops; pick = D2; }
        if (bestDrops === 0) break;
      }
      best.D = pick;
    }
    return { A: best.A, D: best.D, phone: phone };
  }

  function draw() {
    var now = new Date(), H = hm(home, now), phone = isPhone();
    point(minHand, (H.m + H.s / 60) * Math.PI / 30, R - 7);
    point(homeHand, hourAng(H), R * 0.55);
    var items = zones.map(function (z, k) {
      var t = hm(z.tz, now); point(cityHands[k], hourAng(t), R * 0.55); return { name: z.name, h: t.h };
    });
    var dow = (document.querySelector('.clock-main .dow') || {}).textContent;
    var fkey = phone + '|' + Math.round(host.getBoundingClientRect().width) + '|' + dow;
    if (!fit || fit.key !== fkey) { fit = makeFit(now, phone); fit.key = fkey; lastKey = ''; }
    var groups = groupsAt(now, phone);
    var key = groups.map(function (g) { return g.names.join() + Math.round((g.a0 + g.a1) * 20); }).join('|');
    if (key === lastKey) return;      /* labels only move a little each minute */
    lastKey = key;

    /* the largest dial that suits this moment's names (at hours when they crowd less, it grows);
       never smaller than the size that suits the whole day */
    var D = null, res = null;
    for (var d = Math.floor(Math.min(fit.A.bot - fit.A.top, 240)); d >= Math.max(40, fit.D || 40); d -= 2) {
      var r0 = bestX(groups, d, fit.A, phone); if (r0) { D = d; res = r0; break; }
    }
    if (!res && fit.D) { D = fit.D; res = bestX(groups, D, fit.A, phone); }
    if (!res) for (D = Math.floor(fit.A.bot - fit.A.top); D >= 40 && !res; D -= 2) res = bestX(groups, D, fit.A, phone);
    if (!res) { D = 40; res = { x: fit.A.colR - 20, placed: layout(groups, 40, true, phone) }; }

    box.style.width = box.style.height = D + 'px';
    box.style.left = (res.x - D / 2) + 'px'; box.style.top = ((res.cy !== undefined ? res.cy : fit.A.cy) - D / 2) + 'px';
    pin.setAttribute('r', 1.75 * S / D);   /* the centre dot stays 3.5px across at any size */
    labs.forEach(function (n) { n.remove(); }); labs = [];
    res.placed.forEach(function (p) {
      var n = document.createElement('span'); n.className = 'lab'; fill(n, p.names, p.stacked);
      n.style.left = p.x + 'px'; n.style.top = p.y + 'px'; box.appendChild(n); labs.push(n);
    });
    box.setAttribute('aria-label', 'Seoul ' + H.h + ':' + ('0' + H.m).slice(-2) + '; ' +
      items.map(function (i) { return i.name + ' ' + i.h + ':' + ('0' + H.m).slice(-2); }).join(', '));
  }
  box.setAttribute('role', 'img');
  draw(); setInterval(draw, 1000);
  window.addEventListener('resize', function () { fit = null; sizes = {}; draw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit = null; sizes = {}; draw(); });
})();

/* Link address tooltip: while the pointer is over a link, its address follows the pointer. */
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var tip = document.createElement('div');
  tip.className = 'link-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tip);
  var cur = null;

  function label(a) {
    var h = a.getAttribute('href') || '';
    if (a.hasAttribute('data-no-tip')) return '';
    if (!h || h.charAt(0) === '#' || /^javascript:/i.test(h)) return '';
    if (/^mailto:/i.test(h)) return h.replace(/^mailto:/i, '').split('?')[0];
    if (/^tel:/i.test(h)) return h.replace(/^tel:/i, '');
    if (a.protocol === 'file:') return '';   /* local preview: no long file paths */
    var u = a.href.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
    try { u = decodeURI(u); } catch (e) {}
    return u;
  }
  function place(e) {
    var x = e.clientX + 14, y = e.clientY + 18, w = tip.offsetWidth, h = tip.offsetHeight;
    if (x + w > window.innerWidth - 8) x = e.clientX - 14 - w;
    if (y + h > window.innerHeight - 8) y = e.clientY - 10 - h;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function hide() { cur = null; tip.classList.remove('on'); }

  document.addEventListener('mouseover', function (e) {
    var a = e.target.closest ? e.target.closest('a[href]') : null;
    if (a === cur) return;
    var t = a ? label(a) : '';
    if (!t) { hide(); return; }
    cur = a; tip.textContent = t;
    tip.classList.add('on'); place(e);
  });
  document.addEventListener('mousemove', function (e) { if (cur) place(e); }, { passive: true });
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
})();

/* Card rails (Portfolio): the thin bar under each row shows how far along you are;
   the arrows move one card at a time. */
(function () {
  document.querySelectorAll('.card-rail').forEach(function (rail) {
    var track = rail.querySelector('.rail-track'), thumb = rail.querySelector('.rail-thumb'),
        prev = rail.querySelector('.rail-btn.prev'), next = rail.querySelector('.rail-btn.next');
    function step() { var c = track.querySelector('.card, .blur-card'); return c ? c.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0) : 300; }
    function update() {
      var max = track.scrollWidth - track.clientWidth, w = track.clientWidth / track.scrollWidth;
      thumb.style.width = (Math.min(1, w) * 100) + '%';
      thumb.style.left = (max > 0 ? (track.scrollLeft / max) * (1 - w) * 100 : 0) + '%';
      if (prev) prev.disabled = track.scrollLeft <= 1;
      if (next) next.disabled = track.scrollLeft >= max - 1;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();

/* lets :active (the press shade) show on iOS */
document.addEventListener('touchstart', function () {}, { passive: true });

/* Journalism: a story's photo enlarges while any link to the same story is hovered */
(function () {
  var photos = [].slice.call(document.querySelectorAll('.feat-photo[href], .side-photo[href]'));
  if (!photos.length) return;
  function set(a, on) {
    var href = a.getAttribute('href');
    photos.forEach(function (p) { if (p.getAttribute('href') === href) p.classList.toggle('zoom', on); });
  }
  document.addEventListener('mouseover', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a) set(a, true); });
  document.addEventListener('mouseout', function (e) { var a = e.target.closest && e.target.closest('a[href]'); if (a && !a.contains(e.relatedTarget)) set(a, false); });
})();

/* every tab: the outline of its sections in the left sketch area (see .outline in the css) */
(function () {
  var main = document.querySelector('main.wrap'), heads = [].slice.call(document.querySelectorAll('main h2.section-title'));
  if (!main || heads.length < 2) return;
  var nav = document.createElement('nav'); nav.className = 'outline'; nav.setAttribute('aria-label', 'On this page');
  var ol = document.createElement('ol'), bar = document.createElement('span'); bar.className = 'bar';
  var links = heads.map(function (h, i) {
    if (!h.id) h.id = 'sec-' + h.textContent.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var li = document.createElement('li'), a = document.createElement('a');
    a.href = '#' + h.id; a.textContent = h.textContent.trim().replace(/\s*\d{4}(\s*[–-]\s*(\d{4}|present))?$/, '');   /* the title, without a trailing year */
    a.addEventListener('click', function (e) {
      e.preventDefault(); h.scrollIntoView({ behavior: 'smooth', block: 'start' });
      pinned = i; place();   /* the bar goes to what was clicked at once, and stays while the page glides there */
      clearTimeout(pinT); pinT = setTimeout(function () { pinned = null; place(); }, 900);
    });
    li.appendChild(a); ol.appendChild(li); return a;
  });
  /* the outline rides on a rail laid in the page beside the text, from the first section's title to the
     end of the page's text, and sticks (css position: sticky) under the menu bar -- the browser moves it
     with the scroll itself, so it never trails or shakes */
  var rail = document.createElement('div'); rail.className = 'outline-rail';
  ol.appendChild(bar); nav.appendChild(ol); rail.appendChild(nav); main.appendChild(rail);
  if (getComputedStyle(main).position === 'static') main.style.position = 'relative';
  var head = document.querySelector('.site-head'), cur = -1;
  var pinned = null, pinT = 0;
  function baseline(el) { var z = document.createElement('span'); z.style.cssText = 'display:inline-block;width:0;height:0'; el.appendChild(z); var y = z.getBoundingClientRect().top; z.remove(); return y; }
  function layoutRail() {
    var pad = parseFloat(getComputedStyle(main).paddingLeft) || 0, m = main.getBoundingClientRect();
    rail.style.left = (pad - 56 - nav.offsetWidth) + 'px';   /* --s7 left of the text column */
    var hh = head ? head.offsetHeight : 0;
    nav.style.top = (hh + 40) + 'px';
    rail.style.top = '0px';
    var itemOff = baseline(links[0]) - nav.getBoundingClientRect().top;   /* the first item's baseline, from the outline's top */
    rail.style.top = (baseline(heads[0]) - m.top - itemOff) + 'px';    /* level with the first title's baseline */
  }
  function place() {
    var hb = head ? head.getBoundingClientRect().bottom : 0, vh = window.innerHeight;
    /* the section being read: the last whose title has passed the reading line, just under the menu bar
       (where a click on the outline brings a title); at the page's very end, the last section */
    var line = Math.max(hb, 0) + 120, k = 0;
    heads.forEach(function (h, i) { if (h.getBoundingClientRect().top <= line) k = i; });
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2 && heads[heads.length - 1].getBoundingClientRect().top < vh) k = heads.length - 1;
    if (pinned !== null) k = pinned;
    if (k !== cur) {
      cur = k; links.forEach(function (a, i) { a.classList.toggle('cur', i === k); });
      var li = links[k].parentNode; bar.style.top = li.offsetTop + 'px'; bar.style.height = li.offsetHeight + 'px';
    }
  }
  var raf = 0; function soon() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; place(); }); }
  window.addEventListener('scroll', soon, { passive: true });
  window.addEventListener('resize', function () { layoutRail(); soon(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layoutRail(); place(); });
  if (window.ResizeObserver) new ResizeObserver(function () { layoutRail(); }).observe(main);
  layoutRail(); place();
})();

/* night from the copyright on: it turns as the copyright line comes into view (see html.night in the css) */
(function () {
  var root = document.documentElement, on = false, t = 0;
  function check() {
    var mark = document.querySelector('.foot-copy') || document.querySelector('.site-foot'); if (!mark) return;
    var ft = mark.getBoundingClientRect().top, vh = window.innerHeight;
    var want = on ? ft < vh + 20 : ft < vh - 1;   /* on as the copyright line comes into view; off once it has left */
    if (want === on) return;
    on = want;
    /* the page switches at once underneath a veil of the old ground, which then fades away (.3s) --
       one opacity fade on the compositor: every word, line and shade appears at the same pace, smooth,
       and the page keeps scrolling */
    var veil = document.createElement('div'); veil.className = 'night-veil';
    veil.style.background = getComputedStyle(document.body).backgroundColor;
    document.body.appendChild(veil);
    root.classList.add('night-switch');
    root.classList.toggle('night', on);
    requestAnimationFrame(function () { requestAnimationFrame(function () { veil.classList.add('go'); }); });
    clearTimeout(t); t = setTimeout(function () { root.classList.remove('night-switch'); }, 50);
    setTimeout(function () { veil.remove(); }, 450);
  }
  window.addEventListener('scroll', check, { passive: true }); window.addEventListener('resize', check); check();
})();

/* wide screens: where the left sketch area begins (the outline and the time/mail line up on it) */
(function () {
  var main = document.querySelector('main.wrap'); if (!main) return;
  var wide = window.matchMedia('(min-width: 80rem)');
  var rail = document.createElement('div'); rail.className = 'time-rail'; rail.hidden = true; document.body.appendChild(rail);
  /* in the rail the whole box is the mail button */
  rail.addEventListener('click', function (e) {
    var mail = rail.querySelector('.foot-mail'); if (!mail) return;
    window.location.href = mail.href;
  });
  rail.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var mail = rail.querySelector('.foot-mail'); if (!mail) return;
    e.preventDefault(); window.location.href = mail.href;
  });
  function set() {
    var m = main.getBoundingClientRect(), pad = parseFloat(getComputedStyle(main).paddingLeft) || 0;
    var rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    document.documentElement.style.setProperty('--sketch-l', (m.left + pad - 56 - 9 * rem) + 'px');
    /* wide screens: the time and mail sit at the bottom right of the screen (--s5 in from both
       edges), and are carried up by the page so they never touch the footer: they ride a rail that
       ends 25px above Explore More's line, stuck (css sticky) to the bottom of the screen until the
       rail's end comes up */
    var cm = document.querySelector('.clock-main'), home = document.querySelector('.site-foot .clocks');
    if (!cm || !home) return;
    if (wide.matches) {
      if (!rail.contains(cm)) {
        rail.appendChild(cm);
        cm.setAttribute('role', 'link'); cm.tabIndex = 0;   /* the box is the button (keyboard too) */
        var a = cm.querySelector('.foot-mail'); if (a) a.tabIndex = -1;
      }
      var line = document.querySelector('.pre-foot') || document.querySelector('.foot-main') || document.querySelector('.site-foot');   /* stop before Explore More's line */
      rail.style.left = '0px'; rail.style.width = document.documentElement.clientWidth + 'px';   /* the box sits at the screen's right, --s5 in */
      rail.style.height = Math.max(0, line.getBoundingClientRect().top + window.scrollY - 25) + 'px';
      rail.hidden = false;
    } else {
      if (rail.contains(cm)) {
        home.insertBefore(cm, home.firstChild);
        cm.removeAttribute('role'); cm.removeAttribute('tabindex');
        var a2 = cm.querySelector('.foot-mail'); if (a2) a2.removeAttribute('tabindex');
      }
      rail.hidden = true;
    }
  }
  window.addEventListener('resize', set); set();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
  if (window.ResizeObserver) new ResizeObserver(set).observe(document.body);   /* the page's height changes (more books, etc.) */
})();
