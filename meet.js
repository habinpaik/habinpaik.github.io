/* Meet Habin Paik: small month calendars (a dot on each day with events) and, under them, the days
   around the chosen one (five on wide screens, three on phones) hour by hour in Seoul and New York time,
   read from the Apps Script web app in main[data-endpoint]; and the appointment form, posted to the same
   web app, which mails it on. Without an endpoint the calendar is empty and the form opens a mail draft. */
(function () {
  var main = document.querySelector('main.meet'); if (!main) return;
  var EP = (main.getAttribute('data-endpoint') || '').trim();
  var H = 3600000, D = 24 * H, KST = 9 * H;          /* Seoul keeps +9, no summer time */
  var FIRST = 8, LAST = 24;                           /* the hours shown: 8am to midnight, Seoul */
  var SAME = 30 * 60000;                              /* events starting within 30 min of each other sit side by side */
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var phone = window.matchMedia('(max-width: 34rem)');

  /* "wall" times: Seoul's clock reading as a UTC timestamp, so getUTC* gives Seoul's fields */
  function wallNow() { return Date.now() + KST; }
  function dayStart(w) { return w - (((w % D) + D) % D); }
  function f(w) { var t = new Date(w); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), dw: (t.getUTCDay() + 6) % 7 }; }
  function monthStart(w) { var x = f(w); return Date.UTC(x.y, x.m, 1); }
  function addMonths(w, n) { var x = f(w); return Date.UTC(x.y, x.m + n, 1); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function clock(w) { var x = f(w), h = x.h % 12 || 12; return h + (x.mi ? ':' + pad(x.mi) : '') + (x.h < 12 ? 'am' : 'pm'); }
  /* an hour's name in another city, for the Seoul hour at wall time w */
  function hourIn(tz, w) {
    var p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: true }).formatToParts(new Date(w - KST));
    var h = '', ap = '';
    p.forEach(function (q) { if (q.type === 'hour') h = q.value; if (q.type === 'dayPeriod') ap = q.value.toLowerCase(); });
    return { h: h, ap: ap };
  }

  var months = main.querySelector('.cal-months'), days = main.querySelector('.cal-days');
  var title = main.querySelector('.cal-title'), cal = main.querySelector('section.cal');
  var impBtn = main.querySelector('.cal-imp'), tip = document.querySelector('.cal-tip');
  var sel = dayStart(wallNow()), first = monthStart(sel), important = false, cache = [], pending = 0, picked = null;

  function nMonths() { return phone.matches ? 1 : 2; }
  function nDays() { return phone.matches ? 3 : 5; }
  function dayRange() { var k = (nDays() - 1) / 2; return [sel - k * D, sel + (k + 1) * D]; }
  function need() {
    var r = dayRange();
    return [Math.min(first, r[0]), Math.max(addMonths(first, nMonths()), r[1])];
  }
  /* events known for [a, b): from every fetched span that overlaps it */
  function eventsIn(a, b) {
    var seen = {}, out = [];
    cache.forEach(function (c) {
      c.ev.forEach(function (e) { var k = e.t + e.s + e.e; if (!seen[k] && e.s < b && e.e > a) { seen[k] = 1; out.push(e); } });
    });
    return out;
  }
  function covered(a, b) { return cache.some(function (c) { return c.a <= a && c.b >= b; }); }
  function load() {
    var r = need();
    if (!EP || covered(r[0], r[1])) return;
    pending++; cal.classList.add('loading');
    var url = EP + (EP.indexOf('?') < 0 ? '?' : '&') + 'start=' + encodeURIComponent(new Date(r[0] - KST).toISOString()) + '&end=' + encodeURIComponent(new Date(r[1] - KST).toISOString());
    fetch(url).then(function (res) { return res.json(); }).then(function (j) {
      cache.push({ a: r[0], b: r[1], ev: (j.events || []).map(function (e) {
        return { t: e.title || 'Busy', s: Date.parse(e.start) + KST, e: Date.parse(e.end) + KST, all: !!e.allDay, free: !!e.free };
      }) });
    }).catch(function () {}).then(function () {
      if (--pending === 0) cal.classList.remove('loading');
      draw();
    });
  }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  /* the small month calendars: always six weeks tall, so nothing below moves */
  function drawMonths(now) {
    months.textContent = '';
    var n = nMonths(), today = dayStart(now), rr = dayRange();
    var a = f(first), b = f(addMonths(first, n - 1));
    title.textContent = a.y === b.y ? a.y : a.y + ' – ' + b.y;   /* the year only: each month is named over its days */
    for (var k = 0; k < n; k++) {
      var m0 = addMonths(first, k), x = f(m0), box = el('div', 'mc');
      box.appendChild(el('p', 'mc-name', MON[x.m]));
      var g = el('div', 'mc-grid');
      ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (c) { g.appendChild(el('span', 'mc-dow', c)); });
      var start = m0 - x.dw * D, end = addMonths(m0, 1), ev = eventsIn(m0, end);
      for (var i = 0; i < 42; i++) {
        var d = start + i * D;
        if (d < m0 || d >= end) { g.appendChild(el('span', 'mc-day off')); continue; }
        var b2 = el('button', 'mc-day', f(d).d);
        b2.type = 'button'; b2.dataset.day = d;
        b2.setAttribute('aria-label', DOW[f(d).dw] + ' ' + f(d).d + ' ' + MON[f(d).m]);
        if (d === today) b2.classList.add('today');
        if (d === sel) { b2.classList.add('sel'); b2.setAttribute('aria-pressed', 'true'); }
        else if (d >= rr[0] && d < rr[1]) b2.classList.add('near');   /* the other days shown below: grey */
        if (d + D <= now) b2.classList.add('past');
        if (ev.some(function (e) { return e.s < d + D && e.e > d; })) b2.classList.add('has');
        g.appendChild(b2);
      }
      box.appendChild(g); months.appendChild(box);
    }
  }

  /* overlapping events, as Apple's Calendar sets them: those starting together share the width side by
     side; one starting later, inside another, is indented a step and laid over it */
  function layout(list) {
    list.sort(function (a, b) { return a.s - b.s || b.e - a.e; });
    list.forEach(function (e) {
      var live = list.filter(function (o) { return o !== e && o.g && o.s <= e.s && o.e > e.s; });
      var mate = live.filter(function (o) { return e.s - o.g.s < SAME; })[0];
      if (mate) { e.g = mate.g; e.g.m.push(e); return; }
      var lvl = 0; live.forEach(function (o) { lvl = Math.max(lvl, o.g.lvl + 1); });
      e.g = { s: e.s, lvl: lvl, m: [e] };
    });
    list.forEach(function (e) { e.i = e.g.m.indexOf(e); e.n = e.g.m.length; e.lvl = e.g.lvl; });
  }

  function drawDays(now) {
    days.textContent = '';
    var r = dayRange(), n = nDays(), today = dayStart(now), ev = eventsIn(r[0], r[1]);
    days.style.setProperty('--days', n);
    var head = el('div', 'cd-head');
    head.appendChild(el('span', 'cd-zone', 'Seoul')); head.appendChild(el('span', 'cd-zone', 'NYC'));
    for (var i = 0; i < n; i++) {
      var d = r[0] + i * D, x = f(d), h = el('span', 'cd-day' + (d === today ? ' today' : '') + (d === sel ? ' sel' : ''));
      h.appendChild(el('b', null, DOW[x.dw])); h.appendChild(document.createTextNode(' ' + x.d));
      var alls = ev.filter(function (e) { return e.all && e.s < d + D && e.e > d; });   /* all-day: a chip under the day's name */
      var chip = el('span', 'cd-allday', alls.length === 1 ? alls[0].t : alls.length > 1 ? alls.length + ' all day' : '');
      if (alls.length) chip.dataset.tip = alls.map(function (e) { return e.t; }).join(', ') + ', all day';
      h.appendChild(chip);
      head.appendChild(h);
    }
    days.appendChild(head);
    var body = el('div', 'cd-body');
    /* the hours: 8am, then 9 10 11, 12pm, 1 2 ... -- the period named at the first hour and at noon or midnight */
    ['Asia/Seoul', 'America/New_York'].forEach(function (tz) {
      var col = el('div', 'cd-hours');
      for (var hr = FIRST; hr < LAST; hr++) {
        var q = hourIn(tz, sel + hr * H), lab = q.h + ((hr === FIRST || q.h === '12') ? q.ap : '');
        var s = el('span', hr === 12 ? 'noon' : null, lab); s.style.top = 'calc(var(--cal-row) * ' + (hr - FIRST) + ')';
        col.appendChild(s);
      }
      body.appendChild(col);
    });
    for (var j = 0; j < n; j++) {
      var d = r[0] + j * D, col2 = el('div', 'cd-col' + (d === today ? ' today' : ''));
      for (var h2 = FIRST; h2 < LAST; h2++) {
        var at = d + h2 * H, cell = el('button', 'cd-slot' + (h2 === 12 ? ' noon' : ''));
        cell.type = 'button';
        if (at + H <= now) { cell.disabled = true; cell.classList.add('past'); }
        cell.setAttribute('aria-label', DOW[f(d).dw] + ' ' + f(d).d + ' ' + MON[f(d).m] + ', ' + clock(at));
        cell.dataset.at = at;
        if (picked === at) cell.classList.add('picked');
        col2.appendChild(cell);
      }
      var list = ev.filter(function (e) { return e.e > d + FIRST * H && e.s < d + LAST * H && !e.all; })
        .map(function (e) { return { t: e.t, s: e.s, e: e.e, free: e.free }; });
      layout(list);
      list.forEach(function (e) {
        var s = Math.max(e.s, d + FIRST * H), en = Math.min(e.e, d + LAST * H);
        var ind = e.lvl * 10;
        var b = el('span', 'cd-ev' + (e.free ? ' free' : ''), e.t);
        b.style.top = 'calc(var(--cal-row) * ' + ((s - d) / H - FIRST).toFixed(3) + ' + 1px)';
        b.style.height = 'calc(var(--cal-row) * ' + Math.max((en - s) / H, 0.4).toFixed(3) + ' - 2px)';
        b.style.left = 'calc(' + ind + 'px + (100% - ' + ind + 'px) * ' + (e.i / e.n).toFixed(4) + ')';
        b.style.width = 'calc((100% - ' + ind + 'px) / ' + e.n + ' - 2px)';
        b.style.zIndex = 1 + e.lvl;
        b.dataset.tip = e.t + ', ' + DOW[f(e.s).dw] + ' ' + f(e.s).d + ' ' + MON[f(e.s).m] + ', ' + clock(e.s) + '–' + clock(e.e);
        col2.appendChild(b);
      });
      if (d === today && now > d + FIRST * H && now < d + LAST * H) {
        var line = el('span', 'cd-now'); line.style.top = 'calc(var(--cal-row) * ' + ((now - d) / H - FIRST).toFixed(3) + ')';
        col2.appendChild(line);
      }
      body.appendChild(col2);
    }
    days.appendChild(body);
  }

  function draw() { var now = wallNow(); drawMonths(now); drawDays(now); main.classList.toggle('imp', important); }
  function go() { draw(); load(); }

  /* controls */
  main.querySelector('.cal-prev').addEventListener('click', function () { first = addMonths(first, -nMonths()); go(); });
  main.querySelector('.cal-next').addEventListener('click', function () { first = addMonths(first, nMonths()); go(); });
  main.querySelector('.cal-today').addEventListener('click', function () { sel = dayStart(wallNow()); first = monthStart(sel); go(); });
  impBtn.addEventListener('click', function () { important = !important; impBtn.setAttribute('aria-pressed', important); draw(); });
  months.addEventListener('click', function (e) {
    var b = e.target.closest('.mc-day[data-day]'); if (!b) return;
    sel = +b.dataset.day; go();
  });
  days.addEventListener('click', function (e) {
    var slot = e.target.closest('.cd-slot');
    if (!slot || slot.disabled) return;
    var at = +slot.dataset.at, x = f(at);
    picked = at;
    form.when.value = DOW[x.dw] + ' ' + x.d + ' ' + MON[x.m] + ' ' + x.y + ', ' + clock(at) + ' Seoul';
    [].forEach.call(days.querySelectorAll('.cd-slot.picked'), function (o) { o.classList.remove('picked'); });
    slot.classList.add('picked');
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function () { (form.name.value ? form.message : form.name).focus({ preventScroll: true }); }, 500);
  });
  /* an event's details, as the book tip: by the pointer (tapped, on phones) */
  function placeTip(e) {
    var pad = 14, tw = tip.offsetWidth, th = tip.offsetHeight, x = e.clientX + pad, y = e.clientY + pad;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
    tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
  }
  var tipFor = null, tipT = 0;
  main.addEventListener('mouseover', function (e) {
    var b = e.target.closest('[data-tip]');
    if (b === tipFor) return;
    tipFor = b;
    if (!b) { tip.classList.remove('show'); return; }
    tip.textContent = b.dataset.tip; tip.classList.add('show'); placeTip(e);
  });
  main.addEventListener('mousemove', function (e) { if (tipFor) placeTip(e); });
  days.addEventListener('mouseleave', function () { tipFor = null; tip.classList.remove('show'); });
  days.addEventListener('touchstart', function (e) {
    var b = e.target.closest('[data-tip]'); if (!b) return;
    var t = e.touches[0]; tip.textContent = b.dataset.tip; tip.classList.add('show'); placeTip(t);
    clearTimeout(tipT); tipT = setTimeout(function () { tip.classList.remove('show'); }, 2200);
  }, { passive: true });
  if (phone.addEventListener) phone.addEventListener('change', go);
  go();
  setInterval(draw, 5 * 60000);

  /* the form */
  var form = main.querySelector('.meet-form'), status = main.querySelector('.mf-status'), mode = 'Offline';
  [].forEach.call(form.querySelectorAll('.mf-mode .filter-btn'), function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      [].forEach.call(form.querySelectorAll('.mf-mode .filter-btn'), function (o) { o.setAttribute('aria-pressed', o === b); });
    });
  });
  /* the message box: three lines, then as tall as its words */
  function fit() { form.message.style.height = 'auto'; form.message.style.height = (form.message.scrollHeight + 2) + 'px'; }
  form.message.addEventListener('input', fit);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = { name: form.name.value.trim(), email: form.email.value.trim(), when: form.when.value.trim(), message: form.message.value.trim(), mode: mode, important: important, website: form.website.value };
    if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.message) {
      status.textContent = !data.name ? 'Your name, please.' : !data.message ? 'A few words, please.' : 'An email I can reply to, please.';
      (!data.name ? form.name : !data.message ? form.message : form.email).focus();
      return;
    }
    if (!EP) {
      var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nWhere: ' + data.mode + (data.important ? ' (important)' : '') + '\nWhen: ' + (data.when || '-') + '\n\n' + data.message;
      location.href = 'mailto:downbeen100@korea.ac.kr?subject=' + encodeURIComponent((data.important ? '[중요] ' : '') + '미팅을 요청받았습니다. (hpaik.me)') + '&body=' + encodeURIComponent(body);
      return;
    }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; status.textContent = 'Sending…';
    fetch(EP, { method: 'POST', body: JSON.stringify(data) })   /* text/plain: no preflight */
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw 0;
        status.textContent = 'Sent. I will reply by email.';
        form.message.value = ''; form.when.value = ''; fit();
      })
      .catch(function () { status.textContent = 'Could not send. Please write to downbeen100@korea.ac.kr.'; })
      .then(function () { btn.disabled = false; });
  });
})();
