/* Shared by every page. */

/* Footer clocks: <time data-tz="..."> shows HH:MM in that time zone, updated on the minute.
   Each also shows its weekday (.dow). */
(function () {
  var els = document.querySelectorAll('time[data-tz]');
  if (!els.length || !window.Intl) return;
  function fmt(tz, o) { o.timeZone = tz; return new Intl.DateTimeFormat('en-US', o); }
  function tick() {
    var now = new Date();
    els.forEach(function (el) {
      var tz = el.getAttribute('data-tz');
      try {
        el.querySelector('.hm').textContent = fmt(tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
        var dow = el.querySelector('.dow');
        if (dow) dow.textContent = fmt(tz, { weekday: 'short' }).format(now);
      } catch (e) {}
    });
    setTimeout(tick, 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 50);   /* on the minute */
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
    tip.classList.toggle('inv', !!a.closest('.site-foot'));
    tip.classList.add('on'); place(e);
  });
  document.addEventListener('mousemove', function (e) { if (cur) place(e); }, { passive: true });
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
})();
