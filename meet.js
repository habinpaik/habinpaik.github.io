/* Meet Habin Paik: the calendar (week / month, Seoul time) read from the Apps Script web app named in
   main[data-endpoint], and the appointment form posted to the same web app, which mails it on.
   Until an endpoint is set, the calendar shows no events and the form opens a mail draft instead. */
(function () {
  var main = document.querySelector('main.meet'); if (!main) return;
  var EP = (main.getAttribute('data-endpoint') || '').trim();
  var H = 3600000, D = 24 * H, KST = 9 * H;          /* Seoul keeps +9, no summer time */
  var FIRST = 8, LAST = 24;                           /* the week's hours shown: 08:00 to midnight */
  var DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* "wall" times: Seoul's clock reading as a UTC timestamp, so getUTC* gives Seoul's fields */
  function wallNow() { return Date.now() + KST; }
  function dayStart(w) { return w - (((w % D) + D) % D); }
  function monday(w) { var d = dayStart(w); return d - ((new Date(d).getUTCDay() + 6) % 7) * D; }
  function f(w) { var t = new Date(w); return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate(), h: t.getUTCHours(), mi: t.getUTCMinutes(), dw: (t.getUTCDay() + 6) % 7 }; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function hhmm(w) { var x = f(w); return pad(x.h) + ':' + pad(x.mi); }

  var grid = main.querySelector('.cal-grid'), title = main.querySelector('.cal-title');
  var note = main.querySelector('.cal-note');
  var view = 'week', anchor = dayStart(wallNow()), cache = {};
  if (!EP && note) note.textContent = 'Seoul time. The calendar is not connected yet.';

  function range() {
    if (view === 'week') { var s = monday(anchor); return [s, s + 7 * D]; }
    var x = f(anchor), first = Date.UTC(x.y, x.m, 1), s2 = monday(first);
    return [s2, s2 + 42 * D];
  }
  function load(r, done) {
    if (!EP) return done([]);
    var key = r[0] + '-' + r[1];
    if (cache[key]) return done(cache[key]);
    var url = EP + (EP.indexOf('?') < 0 ? '?' : '&') + 'start=' + encodeURIComponent(new Date(r[0] - KST).toISOString()) + '&end=' + encodeURIComponent(new Date(r[1] - KST).toISOString());
    grid.classList.add('loading');
    fetch(url).then(function (res) { return res.json(); }).then(function (j) {
      var ev = (j.events || []).map(function (e) {
        return { t: e.title || 'Busy', s: Date.parse(e.start) + KST, e: Date.parse(e.end) + KST, all: !!e.allDay };
      });
      cache[key] = ev; done(ev);
    }).catch(function () { done([]); }).then(function () { grid.classList.remove('loading'); });
  }

  function el(tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; }

  function render() {
    var r = range(), now = wallNow(), today = dayStart(now);
    if (view === 'week') {
      var a = f(r[0]), b = f(r[1] - D);
      title.textContent = MON[a.m] + ' ' + a.d + ' – ' + (a.m !== b.m ? MON[b.m] + ' ' : '') + b.d + ', ' + b.y;
    } else { var x = f(anchor); title.textContent = MON[x.m] + ' ' + x.y; }
    grid.className = 'cal-grid ' + view;
    grid.textContent = '';
    load(r, function (ev) { (view === 'week' ? week : month)(r, ev, now, today); });
  }

  function week(r, ev, now, today) {
    grid.textContent = '';
    var head = el('div', 'cw-head'); head.appendChild(el('span', 'cw-corner'));
    for (var i = 0; i < 7; i++) {
      var day = r[0] + i * D, x = f(day), h = el('span', 'cw-day' + (day === today ? ' today' : ''));
      h.appendChild(el('b', null, DOW[i])); h.appendChild(document.createTextNode(' ' + x.d));
      head.appendChild(h);
    }
    grid.appendChild(head);
    /* all-day events: a strip under the days */
    var alls = ev.filter(function (e) { return e.all; });
    if (alls.length) {
      var strip = el('div', 'cw-all'); strip.appendChild(el('span', 'cw-corner'));
      for (var k = 0; k < 7; k++) {
        var c = el('span', 'cw-allday'), d0 = r[0] + k * D;
        alls.forEach(function (e) { if (e.s < d0 + D && e.e > d0) c.appendChild(el('span', 'cw-ev', e.t)); });
        strip.appendChild(c);
      }
      grid.appendChild(strip);
    }
    var body = el('div', 'cw-body'), hours = el('div', 'cw-hours');
    for (var hr = FIRST; hr < LAST; hr++) hours.appendChild(el('span', null, pad(hr) + ':00'));
    body.appendChild(hours);
    for (var j = 0; j < 7; j++) {
      var d = r[0] + j * D, col = el('div', 'cw-col' + (d === today ? ' today' : ''));
      for (var h2 = FIRST; h2 < LAST; h2++) {
        var at = d + h2 * H, cell = el('button', 'cw-slot');
        cell.type = 'button';
        if (at + H <= now) { cell.disabled = true; cell.classList.add('past'); }
        cell.setAttribute('aria-label', DOW[j] + ' ' + f(d).d + ' ' + MON[f(d).m] + ', ' + pad(h2) + ':00');
        cell.dataset.at = at;
        col.appendChild(cell);
      }
      /* events at the same time sit side by side: each cluster of overlapping events shares the column */
      var todays = ev.filter(function (e) { return !e.all && e.e > d + FIRST * H && e.s < d + LAST * H; })
        .sort(function (a, b) { return a.s - b.s || b.e - a.e; });
      var cl = [], clEnd = 0;
      todays.forEach(function (e) {
        if (!cl.length || e.s >= clEnd) { cl.push([]); clEnd = 0; }
        var group = cl[cl.length - 1], lane = 0;
        while (group.some(function (o) { return o.lane === lane && o.e > e.s; })) lane++;
        e.lane = lane; group.push(e); clEnd = Math.max(clEnd, e.e);
      });
      cl.forEach(function (g) { var n = 0; g.forEach(function (e) { n = Math.max(n, e.lane + 1); }); g.forEach(function (e) { e.lanes = n; }); });
      todays.forEach(function (e) {
        var s = Math.max(e.s, d + FIRST * H), en = Math.min(e.e, d + LAST * H);
        var b = el('span', 'cw-ev');
        b.style.left = 'calc(2px + (100% - 4px) * ' + (e.lane / e.lanes) + ')';
        b.style.width = 'calc((100% - 4px) / ' + e.lanes + ' - ' + (e.lanes > 1 ? 2 : 0) + 'px)';
        b.style.right = 'auto';
        b.style.top = 'calc(var(--cal-row) * ' + ((s - d) / H - FIRST).toFixed(3) + ')';
        b.style.height = 'calc(var(--cal-row) * ' + Math.max((en - s) / H, 0.5).toFixed(3) + ' - 2px)';
        b.appendChild(el('span', 'cw-t', e.t)); b.appendChild(el('span', 'cw-when', hhmm(e.s) + '–' + hhmm(e.e)));
        b.title = e.t + ', ' + hhmm(e.s) + '–' + hhmm(e.e);
        col.appendChild(b);
      });
      if (d === today && now > d + FIRST * H && now < d + LAST * H) {
        var line = el('span', 'cw-now'); line.style.top = 'calc(var(--cal-row) * ' + ((now - d) / H - FIRST).toFixed(3) + ')';
        col.appendChild(line);
      }
      body.appendChild(col);
    }
    grid.appendChild(body);
  }

  function month(r, ev, now, today) {
    grid.textContent = '';
    var head = el('div', 'cm-head');
    DOW.forEach(function (n) { head.appendChild(el('span', null, n)); });
    grid.appendChild(head);
    var body = el('div', 'cm-body'), cur = f(anchor).m;
    for (var i = 0; i < 42; i++) {
      var d = r[0] + i * D, x = f(d), c = el('button', 'cm-day' + (x.m !== cur ? ' other' : '') + (d === today ? ' today' : '') + (d + D <= now ? ' past' : ''));
      c.type = 'button'; c.dataset.day = d;
      c.setAttribute('aria-label', DOW[i % 7] + ' ' + x.d + ' ' + MON[x.m]);
      c.appendChild(el('span', 'cm-n', x.d));
      var list = ev.filter(function (e) { return e.s < d + D && e.e > d; });
      list.slice(0, 3).forEach(function (e) { c.appendChild(el('span', 'cm-ev', (e.all ? '' : hhmm(Math.max(e.s, d)) + ' ') + e.t)); });
      if (list.length > 3) c.appendChild(el('span', 'cm-more', '+' + (list.length - 3) + ' more'));
      body.appendChild(c);
    }
    grid.appendChild(body);
  }

  /* controls */
  [].forEach.call(main.querySelectorAll('.cal-views .filter-btn'), function (b) {
    b.addEventListener('click', function () {
      view = b.dataset.view;
      [].forEach.call(main.querySelectorAll('.cal-views .filter-btn'), function (o) { o.setAttribute('aria-pressed', o === b); });
      render();
    });
  });
  function step(n) {
    if (view === 'week') anchor += n * 7 * D;
    else { var x = f(anchor); anchor = Date.UTC(x.y, x.m + n, 1); }
    render();
  }
  main.querySelector('.cal-prev').addEventListener('click', function () { step(-1); });
  main.querySelector('.cal-next').addEventListener('click', function () { step(1); });
  grid.addEventListener('click', function (e) {
    var day = e.target.closest('.cm-day');
    if (day) { anchor = +day.dataset.day; view = 'week'; [].forEach.call(main.querySelectorAll('.cal-views .filter-btn'), function (o) { o.setAttribute('aria-pressed', o.dataset.view === 'week'); }); render(); return; }
    var slot = e.target.closest('.cw-slot');
    if (slot && !slot.disabled) {
      var at = +slot.dataset.at, x = f(at);
      form.when.value = DOW[x.dw] + ' ' + x.d + ' ' + MON[x.m] + ' ' + x.y + ', ' + pad(x.h) + ':00 (Seoul)';
      [].forEach.call(grid.querySelectorAll('.cw-slot.picked'), function (o) { o.classList.remove('picked'); });
      slot.classList.add('picked');
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { (form.name.value ? form.message : form.name).focus({ preventScroll: true }); }, 500);
    }
  });
  render();
  setInterval(function () { if (view === 'week') { var n = grid.querySelector('.cw-now'); if (n) render(); } }, 5 * 60000);

  /* the form */
  var form = main.querySelector('.meet-form'), status = main.querySelector('.mf-status'), mode = 'Offline';
  [].forEach.call(form.querySelectorAll('.mf-mode .filter-btn'), function (b) {
    b.addEventListener('click', function () {
      mode = b.dataset.mode;
      [].forEach.call(form.querySelectorAll('.mf-mode .filter-btn'), function (o) { o.setAttribute('aria-pressed', o === b); });
    });
  });
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = { name: form.name.value.trim(), email: form.email.value.trim(), when: form.when.value.trim(), message: form.message.value.trim(), mode: mode, website: form.website.value };
    if (!data.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || !data.message) {
      status.textContent = !data.name ? 'Your name, please.' : !data.message ? 'A few words, please.' : 'An email I can reply to, please.';
      (!data.name ? form.name : !data.message ? form.message : form.email).focus();
      return;
    }
    if (!EP) {   /* not connected yet: a mail draft with everything filled in */
      var body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\nWhere: ' + data.mode + '\nWhen: ' + (data.when || '-') + '\n\n' + data.message;
      location.href = 'mailto:downbeen100@korea.ac.kr?subject=' + encodeURIComponent('Appointment (' + data.mode + ') — ' + data.name) + '&body=' + encodeURIComponent(body);
      return;
    }
    var btn = form.querySelector('button[type=submit]'); btn.disabled = true; status.textContent = 'Sending…';
    fetch(EP, { method: 'POST', body: JSON.stringify(data) })   /* text/plain: no preflight */
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw 0;
        status.textContent = 'Sent. I will reply by email.';
        form.message.value = ''; form.when.value = '';
      })
      .catch(function () { status.textContent = 'Could not send. Please write to downbeen100@korea.ac.kr.'; })
      .then(function () { btn.disabled = false; });
  });
})();
