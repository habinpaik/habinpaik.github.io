/* Shared by every page. */

/* Footer clocks: <time data-tz="..."> shows HH:MM in that time zone.
   Where present, .sec shows the seconds and .dow the weekday (Thursday). Updated every second;
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
    var a = i * Math.PI / 6, l = i % 3 === 0 ? 5 : 3;
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
  /* hover: a broadcast-clock wipe. Crimson sweeps once round the face from Seoul's hour hand, with a
     light leading edge, until the face is solid; after a beat it clears, sweeping once round from the
     minute hand -- so the minute hand is the last thing to come back out. Quick and eased (fast in
     the middle, soft at the ends). Each hand turns white while crimson lies under it. Repeats while
     the pointer stays. */
  var sweeping = 0, t0 = 0, homeA = 0, minA = 0, cityA = [];
  var FILL = 950, HOLD = 350, CLEAR = 950, REST = 600, BAND = 70;
  function easeInOut(x) { return x < .5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2; }
  function cg(from, stops) { return 'conic-gradient(from ' + from + 'deg, ' + stops + ')'; }
  function rel(a, from) { return ((a - from) % 360 + 360) % 360; }
  function light(line, on) { line.style.stroke = on ? '#fff' : ''; }
  function wipe(now) {
    var C1 = 'var(--crimson)', C2 = 'var(--crimson-light)', el = (now - t0) % (FILL + HOLD + CLEAR + REST), bg, covered;
    if (el < FILL) {   /* filling from the hour hand */
      var L = easeInOut(el / FILL) * (360 + BAND), Lc = Math.min(360, L);
      bg = cg(homeA, C1 + ' 0deg ' + Math.max(0, L - BAND) + 'deg, ' + C2 + ' ' + Lc + 'deg, transparent ' + Lc + 'deg');
      if (L >= 360 + BAND - 0.5) bg = C1;
      covered = function (a) { return rel(a, homeA) < Math.max(0, L - BAND / 2); };
    } else if (el < FILL + HOLD) { bg = C1; covered = function () { return true; }; }
    else if (el < FILL + HOLD + CLEAR) {   /* clearing from the minute hand: it comes out last */
      var E = easeInOut((el - FILL - HOLD) / CLEAR) * (360 + BAND), Ec = Math.min(360, E);
      bg = cg(minA, 'transparent 0deg ' + Math.max(0, E - BAND) + 'deg, ' + C2 + ' ' + Ec + 'deg, ' + C1 + ' ' + Ec + 'deg');
      if (E >= 360 + BAND - 0.5) bg = 'transparent';
      covered = function (a) { var r = rel(a, minA); return r > E - BAND / 2 && !(r < 0.5 && E > 300); };
    } else { bg = 'transparent'; covered = function () { return false; }; }
    fillDisc.style.background = bg;
    light(homeHand, covered(homeA)); light(minHand, covered(minA));
    cityHands.forEach(function (h, k) { light(h, covered(cityA[k])); });
    pin.style.fill = (el > FILL * 0.5 && el < FILL + HOLD + CLEAR * 0.5) ? '#fff' : '';
    sweeping = requestAnimationFrame(wipe);
  }
  box.addEventListener('mouseenter', function () {
    var now = new Date(), H = hm(home, now);
    homeA = hourAng(H) * 180 / Math.PI; minA = (H.m + H.s / 60) * 6;
    cityA = zones.map(function (z) { return hourAng(hm(z.tz, now)) * 180 / Math.PI; });
    t0 = performance.now(); if (!sweeping) sweeping = requestAnimationFrame(wipe);
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
    var m = measure(g.names, stacked), lo = 0, hi = Rk + GAP + m.w + m.h;
    for (var it = 0; it < 24; it++) {
      var md = (lo + hi) / 2, ex = Math.max(Math.abs(s * md) - m.w / 2, 0), ey = Math.max(Math.abs(c * md) - m.ih, 0);
      if (Math.hypot(ex, ey) < Rk + GAP) lo = md; else hi = md;
    }
    var cx = Ck + s * hi, cy = Ck - c * hi;
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
    var words = [].filter.call(host.querySelectorAll('.clock-main .hm, .clock-main .sec, .clock-main .dow, .clock-main .city, .clock-mail .city'), function (e) { return e.getClientRects().length; })
                  .map(function (e) { return rel(e, 0.2); });   /* only words actually shown */
    var mail = rel(host.querySelector('.foot-mail'), 0);
    /* below: the address (and, on wider screens, the copyright on the right) -- the dial stays clear of them */
    var below = [].map.call(foot.querySelectorAll('.foot-contact > *, .foot-copy'), function (e) { return rel(e, 0.2); });
    var keep = words.concat([mail], below);
    var top = Math.min.apply(null, words.map(function (r) { return r.t; }));
    /* down to the first thing under it: on phones the address line right under the mail (it runs the
       full width); on wider screens the copyright, which sits under the dial on the right */
    var bot = phone ? Math.min.apply(null, below.map(function (r) { return r.t; })) - 4
                    : (below.length ? below[below.length - 1].t - 8 : mail.b);
    var colR = hr.width;
    return { keep: keep, top: top, bot: bot, cy: (top + bot) / 2, colR: colR,
             cx0: phone ? (mail.r + colR) / 2 : colR };   /* phones: middle of the room beside the mail; wider: as far right as it goes */
  }
  /* where the dial's centre can go for one moment's labels at size D: the allowed x nearest cx0, or null */
  function bestX(groups, D, A, phone, stackAll) {
    if (stackAll === undefined) return bestX(groups, D, A, phone, false) || bestX(groups, D, A, phone, true);
    var placed = layout(groups, D, stackAll, phone), half = D / 2;
    var rects = placed.map(function (p) { return { l: p.l - half, r: p.r - half, t: p.t - half, b: p.b - half }; })
                      .concat([{ l: -half, r: half, t: -half, b: half }]);
    if (!phone) {
      /* wider screens: the group's top (its highest name, or the circle's top) on the top of the
         time's digits, and its right edge (its rightmost name, or the circle) on the column's right */
      var gT = Math.min.apply(null, rects.map(function (q) { return q.t; })), gR = Math.max.apply(null, rects.map(function (q) { return q.r; }));
      var X = A.colR - gR, Y = A.top - gT;
      var fits = rects.every(function (q) {
        var L = X + q.l, Rr = X + q.r, T = Y + q.t, B = Y + q.b;
        if (L < 0 || B > A.bot) return false;
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
    var dow = (host.querySelector('.clock-main .dow') || {}).textContent;
    var fkey = phone + '|' + Math.round(host.getBoundingClientRect().width) + '|' + dow;
    if (!fit || fit.key !== fkey) { fit = makeFit(now, phone); fit.key = fkey; lastKey = ''; }
    var groups = groupsAt(now, phone);
    var key = groups.map(function (g) { return g.names.join() + Math.round((g.a0 + g.a1) * 20); }).join('|');
    if (key === lastKey) return;      /* labels only move a little each minute */
    lastKey = key;

    /* a screen too narrow for one size all day: the largest that suits this moment */
    var D = fit.D, res = D ? bestX(groups, D, fit.A, phone) : null;
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
