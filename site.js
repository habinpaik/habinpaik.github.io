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
   The block keeps its left edge on the text column: room is made only for labels that stick out. */
(function () {
  var box = document.querySelector('.aclock');
  if (!box || !window.Intl) return;
  var NS = 'http://www.w3.org/2000/svg', S = 88, C = S / 2, R = C - 0.5, GAP = 5;
  var hz = box.getAttribute('data-home').split('='), home = hz[0], homeName = hz[1] || '';
  var zones = box.getAttribute('data-zones').split('|').map(function (z) { z = z.split('='); return { tz: z[0], name: z[1] }; });
  function el(n, a) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); return e; }
  var svg = el('svg', { viewBox: '0 0 ' + S + ' ' + S, 'aria-hidden': 'true' });
  svg.appendChild(el('circle', { 'class': 'face', cx: C, cy: C, r: R }));
  for (var i = 0; i < 12; i++) {
    var a = i * Math.PI / 6, q = i % 3 === 0, l = q ? 5 : 3;
    svg.appendChild(el('line', { 'class': 'tick' + (q ? ' q' : ''),
      x1: C + Math.sin(a) * (R - l), y1: C - Math.cos(a) * (R - l), x2: C + Math.sin(a) * R, y2: C - Math.cos(a) * R }));
  }
  var cityHands = zones.map(function () { return svg.appendChild(el('line', { 'class': 'hand city' })); });
  var homeHand = svg.appendChild(el('line', { 'class': 'hand home' }));
  var minHand = svg.appendChild(el('line', { 'class': 'hand min' }));
  svg.appendChild(el('circle', { 'class': 'pin', cx: C, cy: C, r: 1.75 }));
  box.appendChild(svg);

  function hm(tz, now) {
    var t = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(now).split(':');
    return { h: +t[0], m: +t[1], s: +t[2] };
  }
  function point(line, ang, len) {
    line.setAttribute('x1', C); line.setAttribute('y1', C);
    line.setAttribute('x2', C + Math.sin(ang) * len); line.setAttribute('y2', C - Math.cos(ang) * len);
  }
  var labs = [], lastKey = '';
  function hourAng(t) { return ((t.h % 12) + t.m / 60) * Math.PI / 6; }
  function draw() {
    var now = new Date(), H = hm(home, now);
    point(minHand, (H.m + H.s / 60) * Math.PI / 30, R - 7);
    point(homeHand, hourAng(H), R * 0.55);
    var items = zones.map(function (z, k) {
      var t = hm(z.tz, now), a = hourAng(t); point(cityHands[k], a, R * 0.55);
      return { name: z.name, a: a, h: t.h };
    });
    var labelled = homeName ? items.concat([{ name: homeName, a: hourAng(H), h: H.h }]) : items;
    /* hands pointing (nearly) the same way share one label */
    labelled = labelled.slice().sort(function (p, q) { return p.a - q.a; });
    var groups = [];
    labelled.forEach(function (it) {
      var g = groups[groups.length - 1];
      if (g && it.a - g.a1 < 0.4) { g.names.push(it.name); g.a1 = it.a; } else groups.push({ names: [it.name], a0: it.a, a1: it.a });
    });
    if (groups.length > 1) {   /* the circle wraps round at 12 */
      var f = groups[0], l = groups[groups.length - 1];
      if (f.a0 + 2 * Math.PI - l.a1 < 0.4) { l.names = l.names.concat(f.names); l.a1 = f.a1 + 2 * Math.PI; groups.shift(); }
    }
    var key = groups.map(function (g) { return g.names.join() + Math.round((g.a0 + g.a1) * 20); }).join('|');
    if (key === lastKey) return;      /* labels only move a little each minute */
    lastKey = key;
    labs.forEach(function (n) { n.remove(); }); labs = [];
    var minX = 0, maxX = S, minY = 0, maxY = S;
    /* place every label; if two would touch, put those cities on one label and place again */
    function place(g) {
      var a = (g.a0 + g.a1) / 2, s = Math.sin(a), c = Math.cos(a);
      var n = document.createElement('span'); n.className = 'lab'; n.textContent = g.names.join(' · ');
      box.appendChild(n);
      var w = n.offsetWidth, h = n.offsetHeight;
      /* every label keeps the same clear gap from the circle, whatever the angle: its centre moves
         out along the hand's direction until the letters' nearest edge or corner is exactly GAP
         outside the rim (found by halving the search range) */
      var ih = h * 0.3;   /* half the letters' own height: the line box has empty space above and below them */
      var lo = 0, hi = R + GAP + w + h;
      for (var it = 0; it < 24; it++) {
        var md = (lo + hi) / 2, ex = Math.max(Math.abs(s * md) - w / 2, 0), ey = Math.max(Math.abs(c * md) - ih, 0);
        if (Math.hypot(ex, ey) < R + GAP) lo = md; else hi = md;
      }
      var cx = C + s * hi, cy = C - c * hi;
      return { g: g, n: n, x: cx - w / 2, y: cy - h / 2, w: w, h: h, l: cx - w / 2, r: cx + w / 2, t: cy - ih, b: cy + ih };
    }
    var placed;
    for (var round = 0; round < 6; round++) {
      placed = groups.map(place);
      var hit = -1;
      for (var i2 = 0; i2 < placed.length && hit < 0; i2++) {
        var p = placed[i2], q = placed[(i2 + 1) % placed.length];
        if (placed.length > 1 && p !== q && p.l < q.r + 6 && q.l < p.r + 6 && p.t < q.b + 4 && q.t < p.b + 4) hit = i2;
      }
      if (hit < 0) break;
      placed.forEach(function (pp) { pp.n.remove(); });
      var g1 = groups[hit], j = (hit + 1) % groups.length, g2 = groups[j];
      var span = g2.a1 < g1.a0 ? g2.a1 + 2 * Math.PI : g2.a1;
      groups.splice(hit, 1, { names: g1.names.concat(g2.names), a0: g1.a0, a1: span });
      groups.splice(j > hit ? j : 0, 1);
    }
    placed.forEach(function (pp) {
      labs.push(pp.n);
      pp.n.style.left = pp.x + 'px'; pp.n.style.top = pp.y + 'px';
      minX = Math.min(minX, pp.x); maxX = Math.max(maxX, pp.x + pp.w); minY = Math.min(minY, pp.y); maxY = Math.max(maxY, pp.y + pp.h);
    });
    /* make room only for what sticks out, so the outermost letters sit on the column's edge
       (left edge on phones, right edge beside the Seoul time on wider screens) */
    box.style.marginLeft = -minX + 'px';
    box.style.marginRight = (maxX - S) + 'px';
    box.style.marginTop = 'calc(var(--ac-gap, 0px) + ' + (-minY) + 'px)';
    box.style.marginBottom = (maxY - S) + 'px';
    box.setAttribute('aria-label', 'Seoul ' + H.h + ':' + ('0' + H.m).slice(-2) + '; ' +
      items.map(function (i) { return i.name + ' ' + i.h + ':' + ('0' + H.m).slice(-2); }).join(', '));
  }
  box.setAttribute('role', 'img');
  draw(); setInterval(draw, 1000);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lastKey = ''; draw(); });
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
