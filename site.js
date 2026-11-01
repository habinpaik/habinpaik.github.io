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
   and one per city in data-zones ("Zone=Name|..."), each named just outside the dial. */
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
  /* the labels for a given moment: one per hour hand (Seoul's left out on phones), and hands
     pointing (nearly) the same way share one label */
  function groupsAt(when, phone) {
    var H = hm(home, when);
    var labelled = zones.map(function (z) { var t = hm(z.tz, when); return { name: z.name, a: hourAng(t) }; });
    if (homeName && !phone) labelled.push({ name: homeName, a: hourAng(H) });
    labelled.sort(function (p, q) { return p.a - q.a; });
    var groups = [];
    labelled.forEach(function (it) {
      var g = groups[groups.length - 1];
      if (g && it.a - g.a1 < 0.4) { g.names.push(it.name); g.a1 = it.a; } else groups.push({ names: [it.name], a0: it.a, a1: it.a });
    });
    if (groups.length > 1) {   /* the circle wraps round at 12 */
      var f = groups[0], l = groups[groups.length - 1];
      if (f.a0 + 2 * Math.PI - l.a1 < 0.4) { l.names = l.names.concat(f.names); l.a1 = f.a1 + 2 * Math.PI; groups.shift(); }
    }
    return groups;
  }
  var fit = null;   /* phones: the dial's size and place, worked out once for the whole day */
  function draw() {
    var now = new Date(), H = hm(home, now);
    point(minHand, (H.m + H.s / 60) * Math.PI / 30, R - 7);
    point(homeHand, hourAng(H), R * 0.55);
    var items = zones.map(function (z, k) {
      var t = hm(z.tz, now), a = hourAng(t); point(cityHands[k], a, R * 0.55);
      return { name: z.name, a: a, h: t.h };
    });
    var phone = window.matchMedia && window.matchMedia('(max-width: 40rem)').matches;   /* phones: Seoul's hand unnamed */
    var groups = groupsAt(now, phone);
    var key = (phone ? 'p' : '') + groups.map(function (g) { return g.names.join() + Math.round((g.a0 + g.a1) * 20); }).join('|');
    if (key === lastKey) return;      /* labels only move a little each minute */
    lastKey = key;
    labs.forEach(function (n) { n.remove(); }); labs = [];
    var Sk, Ck, Rk, stackAll = false;
    /* place every label round the dial at its current size; if two would touch, put those
       cities on one label and place again */
    function place(g) {
      var a = (g.a0 + g.a1) / 2, s = Math.sin(a), c = Math.cos(a);
      var n = document.createElement('span'); n.className = 'lab';
      /* phones: a shared label beside the dial stacks its names, to stay narrow; above or below the
         dial it runs them on one line, to stay low, unless that line would be too wide */
      if (phone && (stackAll || Math.abs(s) > Math.abs(c))) g.names.forEach(function (nm, i) { if (i) n.appendChild(document.createElement('br')); n.appendChild(document.createTextNode(nm)); });
      else n.textContent = g.names.join(' · ');
      box.appendChild(n);
      var w = n.offsetWidth, h = n.offsetHeight;
      /* every label keeps the same clear gap from the circle, whatever the angle: its centre moves
         out along the hand's direction until the letters' nearest edge or corner is exactly GAP
         outside the rim (found by halving the search range) */
      var lh = parseFloat(getComputedStyle(n).lineHeight) || h;
      var ih = h / 2 - lh * 0.2;   /* half the letters' own height: each line box has some empty space above and below them */
      var lo = 0, hi = Rk + GAP + w + h;
      for (var it = 0; it < 24; it++) {
        var md = (lo + hi) / 2, ex = Math.max(Math.abs(s * md) - w / 2, 0), ey = Math.max(Math.abs(c * md) - ih, 0);
        if (Math.hypot(ex, ey) < Rk + GAP) lo = md; else hi = md;
      }
      var cx = Ck + s * hi, cy = Ck - c * hi;
      return { n: n, x: cx - w / 2, y: cy - h / 2, w: w, h: h, l: cx - w / 2, r: cx + w / 2, t: cy - ih, b: cy + ih };
    }
    function layout(src) {
      var k = box.clientWidth / S || 1; Sk = S * k; Ck = C * k; Rk = R * k;   /* the dial may be drawn smaller (phones) */
      var gs = src.map(function (g) { return { names: g.names.slice(), a0: g.a0, a1: g.a1 }; }), placed;
      for (var round = 0; round < 6; round++) {
        placed = gs.map(place);
        var hit = -1;
        for (var i2 = 0; i2 < placed.length && hit < 0; i2++) {
          var p = placed[i2], q = placed[(i2 + 1) % placed.length];
          if (placed.length > 1 && p !== q && p.l < q.r + 6 && q.l < p.r + 6 && p.t < q.b + 4 && q.t < p.b + 4) hit = i2;
        }
        if (hit < 0) break;
        placed.forEach(function (pp) { pp.n.remove(); });
        var g1 = gs[hit], j = (hit + 1) % gs.length, g2 = gs[j];
        var span = g2.a1 < g1.a0 ? g2.a1 + 2 * Math.PI : g2.a1;
        gs.splice(hit, 1, { names: g1.names.concat(g2.names), a0: g1.a0, a1: span });
        gs.splice(j > hit ? j : 0, 1);
      }
      return placed;
    }
    function show(placed) {
      placed.forEach(function (pp) { labs.push(pp.n); pp.n.style.left = pp.x + 'px'; pp.n.style.top = pp.y + 'px'; });
    }

    if (phone) {
      /* phones: the dial sits beside four short lines (time, weekday, "Always open", the mail), its
         circle on their vertical middle, as near the middle of the room beside the mail as it can go.
         Every name stays inside the four lines' height and the column, clear of all their words and
         of the mail box. Its size is the largest that works at every half hour of the day, so it
         doesn't change as the hands turn. */
      var host = box.parentNode, hr = host.getBoundingClientRect();
      var dayKey = hr.width + '|' + (host.querySelector('.clock-main .dow') || {}).textContent;
      if (!fit || fit.key !== dayKey) {
        function rel(e, cut) {
          var r = e.getBoundingClientRect(), c = r.height * cut;
          return { l: r.left - hr.left, r: r.right - hr.left, t: r.top - hr.top + c, b: r.bottom - hr.top - c };
        }
        var words = [].map.call(host.querySelectorAll('.clock-main .hm, .clock-main .sec, .clock-main .dow, .clock-main .city, .clock-mail .city'), function (e) { return rel(e, 0.2); });
        var mail = rel(host.querySelector('.foot-mail'), 0), all = words.concat([mail]);
        var top = Math.min.apply(null, all.map(function (r) { return r.t; })), bot = mail.b, colR = Math.floor(hr.width);
        var cy = (top + bot) / 2, cx0 = (mail.r + colR) / 2;
        var day = [];
        for (var hh = 0; hh < 48; hh++) day.push(groupsAt(new Date(now.getTime() + hh * 1800000), true));
        /* the best x for one moment's labels at size D, or null */
        function bestX(gs, D, stack) {
          if (stack === undefined) { var b1 = bestX(gs, D, false); return b1 !== null ? b1 : bestX(gs, D, true); }
          box.style.width = box.style.height = D + 'px'; stackAll = stack;
          var placed = layout(gs), half = D / 2;
          placed.forEach(function (pp) { pp.n.remove(); });
          var rects = placed.map(function (pp) { return { l: pp.l - half, r: pp.r - half, t: pp.t - half, b: pp.b - half }; })
                            .concat([{ l: -half, r: half, t: -half, b: half }]);
          var best = null;
          for (var x = 0; x <= colR; x++) {
            var ok = rects.every(function (q) {
              var L = x + q.l, Rr = x + q.r, T = cy + q.t, B = cy + q.b;
              if (L < 0 || Rr > colR || T < top || B > bot) return false;
              return all.every(function (w) { return !(L < w.r + 8 && w.l < Rr + 8 && T < w.b + 4 && w.t < B + 4); });
            });
            if (ok && (best === null || Math.abs(x - cx0) < Math.abs(best.x - cx0))) best = { x: x, stack: stack };
          }
          return best;
        }
        var SIZES = [72, 68, 64, 60, 56, 52, 48, 44, 40];
        fit = { key: dayKey, D: null, cy: cy, bestX: bestX, colR: colR, SIZES: SIZES };
        SIZES.some(function (D) {
          if (!day.every(function (gs) { return bestX(gs, D) !== null; })) return false;
          fit.D = D; return true;
        });
      }
      /* a very narrow screen where no one size suits the whole day: the largest that suits now */
      var D0 = fit.D, bx = null;
      if (D0) bx = fit.bestX(groups, D0);
      else fit.SIZES.some(function (D) { bx = fit.bestX(groups, D); if (bx) { D0 = D; return true; } return false; });
      if (!bx) { D0 = 40; bx = { x: fit.colR - 20, stack: true }; }
      stackAll = bx.stack;
      box.style.width = box.style.height = D0 + 'px';
      box.style.left = (bx.x - D0 / 2) + 'px'; box.style.top = (fit.cy - D0 / 2) + 'px';
      box.style.margin = '0';
      show(layout(groups));
    } else {
      box.style.width = box.style.height = box.style.left = box.style.top = '';
      fit = null;
      var placed = layout(groups);
      show(placed);
      var minX = 0, maxX = Sk, minY = 0, maxY = Sk;
      placed.forEach(function (pp) { minX = Math.min(minX, pp.x); maxX = Math.max(maxX, pp.x + pp.w); minY = Math.min(minY, pp.y); maxY = Math.max(maxY, pp.y + pp.h); });
      /* make room only for what sticks out, so the outermost letters sit on the column's edge
         (the right edge of the column, beside the Seoul time) */
      box.style.marginLeft = -minX + 'px';
      box.style.marginRight = (maxX - Sk) + 'px';
      box.style.marginTop = 'calc(var(--ac-gap, 0px) + ' + (-minY) + 'px)';
      box.style.marginBottom = (maxY - Sk) + 'px';
    }
    box.setAttribute('aria-label', 'Seoul ' + H.h + ':' + ('0' + H.m).slice(-2) + '; ' +
      items.map(function (i) { return i.name + ' ' + i.h + ':' + ('0' + H.m).slice(-2); }).join(', '));
  }
  box.setAttribute('role', 'img');
  draw(); setInterval(draw, 1000);
  window.addEventListener('resize', function () { lastKey = ''; fit = null; draw(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { lastKey = ''; fit = null; draw(); });
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
