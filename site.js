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
