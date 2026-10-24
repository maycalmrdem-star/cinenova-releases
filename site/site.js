// ChatHup site: header, and the chat demos (hero + /chat). Demo messages never leave the page.
(function () {
  'use strict';

  // Friend QR codes point at /?add-friend=…; those belong to the web app.
  if (/[?&]add-friend=/.test(location.search)) { location.replace('/app' + location.search); return; }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, reduce ? Math.min(ms, 60) : ms); }); };
  var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  var icon = function (name) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
    var u = document.createElementNS(ns, 'use'); u.setAttribute('href', '/icons.svg#' + name); s.appendChild(u); return s;
  };
  var now = function () { var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); };

  // ── header ──
  var top = document.getElementById('top');
  if (top) {
    var onScroll = function () { top.classList.toggle('scrolled', window.scrollY > 8); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
    var btn = top.querySelector('.menu-btn'), drawer = document.getElementById('drawer');
    if (btn && drawer) btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', String(open)); drawer.hidden = !open;
      btn.querySelector('use').setAttribute('href', '/icons.svg#' + (open ? 'x' : 'menu'));
      btn.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    });
  }
  var here = location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.links a, .drawer a').forEach(function (a) { if (a.getAttribute('href') === here) a.setAttribute('aria-current', 'page'); });

  // ── voice-note waveforms ──
  var seed = 7;
  var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  var fillWave = function (w, n) {
    w.textContent = '';
    for (var i = 0; i < n; i++) { var b = el('i'); b.style.height = (6 + Math.round(Math.abs(Math.sin(i * .55)) * 12 + rnd() * 8)) + 'px'; w.appendChild(b); }
  };
  document.querySelectorAll('[data-wave]').forEach(function (w) { fillWave(w, +w.getAttribute('data-wave') || 30); });

  // ── chat demo engine ──
  function Demo(root) {
    this.root = root;
    this.msgs = root.querySelector('[data-msgs]');
    this.form = root.querySelector('[data-compose]');
    this.input = this.form.querySelector('input');
    this.sendBtn = this.form.querySelector('.send');
    this.net = root.querySelector('[data-net]');
    this.netLabel = root.querySelector('[data-net-label]');
    this.presence = root.querySelector('[data-presence]');
    this.relay = root.querySelector('[data-relay]');
    this.offline = false;
    this.quote = null;
    this.replyN = 0;
    this.peer = 'سارة';
    var self = this;
    this.input.addEventListener('input', function () { self.sendBtn.disabled = !self.input.value.trim(); });
    this.form.addEventListener('submit', function (e) {
      e.preventDefault();
      var t = self.input.value.trim(); if (!t) return;
      self.input.value = ''; self.sendBtn.disabled = true;
      self.userSend(t);
    });
    if (this.net) this.net.addEventListener('click', function () { self.setOffline(!self.offline); });
  }
  Demo.prototype.scroll = function () { this.msgs.scrollTop = this.msgs.scrollHeight; };
  Demo.prototype.bubble = function (m) {
    var b = el('div', 'b ' + (m.me ? 'me' : 'them'));
    if (m.from) { var f = el('b', null, m.from); f.style.display = 'block'; f.style.fontSize = '13px'; f.style.color = m.color || '#6b4bd8'; b.appendChild(f); }
    if (m.quote) b.appendChild(el('span', 'quote', m.quote));
    if (m.voice) b.appendChild(this.voice(m.voice));
    else b.appendChild(document.createTextNode(m.text));
    var t = el('span', 't', m.time || now());
    b.appendChild(t);
    if (m.react) this.setReact(b, m.react);
    b._text = m.voice ? 'رسالة صوتية' : m.text;
    b._t = t;
    if (m.voice) t.textContent = '0:' + ('0' + m.voice).slice(-2) + ' · ' + (m.time || now());
    this.msgs.appendChild(b); this.scroll();
    return b;
  };
  Demo.prototype.setReact = function (b, r) {
    var x = b.querySelector('.react');
    if (!x) { x = el('span', 'react'); b.appendChild(x); b.classList.add('has-react'); }
    x.textContent = r;
  };
  Demo.prototype.voice = function (secs) {
    var wrap = el('span', 'voice');
    var play = el('button', 'play'); play.type = 'button'; play.setAttribute('aria-label', 'تشغيل الرسالة الصوتية'); play.appendChild(icon('play'));
    var wave = el('span', 'wave'); fillWave(wave, 28);
    var speed = el('button', 'speed', '1×'); speed.type = 'button'; speed.setAttribute('aria-label', 'سرعة التشغيل');
    wrap.append(play, wave, speed);
    var rate = 1, pos = 0, timer = null, bars = wave.children;
    var paint = function () { var k = Math.round(pos / secs * bars.length); for (var i = 0; i < bars.length; i++) bars[i].classList.toggle('on', i < k); };
    var stop = function () { clearInterval(timer); timer = null; play.querySelector('use').setAttribute('href', '/icons.svg#play'); play.setAttribute('aria-label', 'تشغيل الرسالة الصوتية'); };
    play.addEventListener('click', function (e) {
      e.stopPropagation();
      if (timer) return stop();
      if (pos >= secs) pos = 0;
      play.querySelector('use').setAttribute('href', '/icons.svg#pause'); play.setAttribute('aria-label', 'إيقاف مؤقت');
      timer = setInterval(function () { pos += .1 * rate; paint(); if (pos >= secs) { pos = secs; paint(); stop(); } }, 100);
    });
    speed.addEventListener('click', function (e) { e.stopPropagation(); rate = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1; speed.textContent = rate + '×'; });
    return wrap;
  };
  Demo.prototype.typing = function (ms) {
    var t = el('div', 'typing'); t.setAttribute('aria-label', this.peer + ' يكتب…'); t.append(el('i'), el('i'), el('i'));
    this.msgs.appendChild(t); this.scroll();
    return wait(ms).then(function () { t.remove(); });
  };
  Demo.prototype.statusText = function () { return 'متصل الآن'; };
  Demo.prototype.setOffline = function (off) {
    this.offline = off;
    this.root.classList.toggle('off', off);
    if (this.net) this.net.setAttribute('aria-checked', String(off));
    if (this.netLabel) this.netLabel.textContent = off ? 'أعِد الإنترنت' : 'اقطع الإنترنت';
    if (this.presence) {
      this.presence.textContent = off ? 'قريب منك · عبر البلوتوث' : this.statusText();
      this.presence.classList.toggle('mesh', off);
    }
    var banner = this.root.querySelector('[data-mesh-banner]');
    if (banner) banner.hidden = !off;
  };
  Demo.prototype.hop = function () {
    var relay = this.relay || this.root.querySelector('[data-mesh-banner] .relay');
    if (!relay) return wait(400);
    var nodes = relay.querySelectorAll('.node'), hops = relay.querySelectorAll('.hop');
    for (var i = 1; i < nodes.length; i++) nodes[i].classList.remove('lit');
    hops.forEach(function (h) { h.classList.remove('run'); });
    var p = Promise.resolve();
    hops.forEach(function (h, i) {
      p = p.then(function () { void h.offsetWidth; h.classList.add('run'); return wait(700); })
           .then(function () { nodes[i + 1].classList.add('lit'); return wait(120); });
    });
    return p;
  };
  Demo.prototype.send = function (m) {
    m.me = true;
    if (!this.offline) return Promise.resolve(this.bubble(m));
    var b = this.bubble(Object.assign({}, m, { time: 'تمرّ عبر هاتفين…' }));
    return this.hop().then(function () {
      b._t.textContent = '';
      var v = el('span', 'via'); v.append(icon('bluetooth'), document.createTextNode('وصلت عبر البلوتوث'));
      b._t.append(v, document.createTextNode(' · ' + now()));
      return b;
    });
  };
  Demo.prototype.replies = {
    on: ['ههه صح', 'أوكي، نشوفك من بعد', 'مليح، فهمتك', 'إيه، راني معاك'],
    off: ['وصلتني عبر البلوتوث، حتى بلا إنترنت', 'مليح، راني نقراها دروك', 'فهمتك، نتلاقاو تما', 'الرسالة جات من هاتف لهاتف']
  };
  Demo.prototype.userSend = function (text) {
    var self = this, quote = this.quote;
    if (this.clearReply) this.clearReply();
    return this.send({ text: text, quote: quote }).then(function () { return self.typing(1100); }).then(function () {
      var list = self.offline ? self.replies.off : self.replies.on;
      self.bubble({ text: list[self.replyN++ % list.length] });
    });
  };

  // ── hero: a short scripted conversation, then it is yours ──
  var hero = document.querySelector('[data-demo="hero"]');
  if (hero) {
    var d = new Demo(hero);
    d.statusText = function () { return 'متصلة الآن'; };
    d.setOffline = (function (orig) { return function (off) { orig.call(this, off); if (this.presence) this.presence.textContent = off ? 'قريبة منك · عبر البلوتوث' : 'متصلة الآن'; }; })(d.setOffline);
    var run = function () {
      return wait(500)
        .then(function () { d.bubble({ text: 'وين راكم؟ الماتش بدا' }); return wait(1400); })
        .then(function () { return d.send({ text: 'راني في المدرج، بصح الشبكة طاحت كامل' }); })
        .then(function () { return wait(500); })
        .then(function () { return d.typing(1200); })
        .then(function () { d.bubble({ text: 'حتى أنا، ما عنديش إنترنت' }); return wait(1200); })
        .then(function () { if (!d.offline) d.setOffline(true); return wait(900); })
        .then(function () { return d.send({ text: 'ماكانش مشكل، نبعثلك بالبلوتوث' }); })
        .then(function () { return d.typing(1100); })
        .then(function () { var b = d.bubble({ text: 'وصلتني! نتلاقاو عند الباب 3؟', quote: 'ماكانش مشكل، نبعثلك بالبلوتوث' }); return wait(900).then(function () { d.setReact(b, '❤️'); }); });
    };
    // Start when the demo is on screen, so the visitor sees the network drop happen.
    var started = false;
    var go = function () { if (started) return; started = true; run(); };
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); go(); } }, { threshold: .2 });
      io.observe(hero);
    } else go();
    hero.addEventListener('focusin', go);
  }

  // ── /chat: the full conversation app ──
  var full = document.querySelector('[data-demo="full"]');
  if (full) {
    var c = new Demo(full);
    var people = {
      sara: { name: 'سارة', av: 'av-s', letter: 'س', status: 'متصلة الآن', seed: [
        { text: 'وين راكم؟ الماتش بدا', time: '20:58' },
        { me: true, text: 'راني في المدرج، الشبكة ضعيفة بزاف', time: '20:59' },
        { text: 'اضغط «اقطع الإنترنت» لفوق، وشوف كيفاش تمشي الرسالة', time: '21:00' }
      ] },
      group: { name: 'الحومة', av: 'av-m', letter: 'ح', status: '4 أعضاء', seed: [
        { from: 'ياسين', color: '#0b7a5c', text: 'شكون جاي للماتش السبت؟', time: '18:20' },
        { from: 'أمين', color: '#a65a0c', text: 'أنا، وجايب معايا خويا', time: '18:22', react: '👍 3' },
        { me: true, text: 'حتى أنا، نتلاقاو قدام الباب 3', time: '18:25' },
        { from: 'ياسين', color: '#0b7a5c', voice: 9, time: '18:27' }
      ] },
      yassine: { name: 'ياسين', av: 'av-y', letter: 'ي', status: 'آخر ظهور قبل 5 دقائق', seed: [
        { voice: 14, time: '17:02' },
        { me: true, text: 'سمعتها، بـ 1.5× خير', time: '17:04' },
        { text: 'ههه، اضغط على السرعة وشوف', time: '17:05' }
      ] },
      amine: { name: 'أمين', av: 'av-a', letter: 'أ', status: 'متصل الآن', seed: [
        { text: 'عيّطتلك وما رديتش', time: '15:40' },
        { me: true, text: 'سمحلي، اضغط على زر المكالمة لفوق ونردّ', time: '15:41' }
      ] }
    };
    var headName = full.querySelector('[data-peer-name]'), headAv = full.querySelector('[data-peer-av]');
    c.statusText = function () { return people[c.current].status; };
    var open = function (id) {
      var p = people[id]; c.peer = p.name; c.current = id;
      headName.textContent = p.name; headAv.textContent = p.letter; headAv.className = 'avatar ' + p.av;
      c.presence.textContent = c.offline ? 'قريب منك · عبر البلوتوث' : p.status;
      c.msgs.textContent = ''; c.msgs.appendChild(el('span', 'day', 'اليوم'));
      p.seed.forEach(function (m) { c.bubble(m); });
      full.querySelectorAll('.convo').forEach(function (b) { var on = b.dataset.id === id; b.setAttribute('aria-current', String(on)); if (on) { var u = b.querySelector('.unread'); if (u) u.remove(); } });
      var last = full.querySelector('[data-relay-peer]'); if (last) last.lastChild.textContent = p.name;
      if (c.clearReply) c.clearReply();
    };
    full.querySelectorAll('.convo').forEach(function (b) { b.addEventListener('click', function () { open(b.dataset.id); }); });

    // reactions + reply, from a tap on any bubble
    var bar = full.querySelector('[data-react-bar]'), target = null;
    var room = full.querySelector('.room');
    var hideBar = function () { bar.hidden = true; target = null; };
    c.msgs.addEventListener('click', function (e) {
      if (e.target.closest('button')) return;
      var b = e.target.closest('.b'); if (!b) return hideBar();
      target = b; bar.hidden = false;
      var r = b.getBoundingClientRect(), rr = room.getBoundingClientRect();
      var topY = r.top - rr.top - bar.offsetHeight - 8; if (topY < 70) topY = r.bottom - rr.top + 8;
      bar.style.top = topY + 'px';
      var right = rr.right - r.right;
      if (b.classList.contains('them')) right = Math.max(8, rr.right - r.left - bar.offsetWidth);
      bar.style.insetInlineStart = Math.max(8, Math.min(right, rr.width - bar.offsetWidth - 8)) + 'px';
      var first = bar.querySelector('button'); if (first) first.focus({ preventScroll: true });
    });
    bar.addEventListener('click', function (e) {
      var k = e.target.closest('button'); if (!k || !target) return;
      if (k.dataset.r) c.setReact(target, k.dataset.r);
      else c.startReply(target._text);
      hideBar();
    });
    c.msgs.addEventListener('scroll', hideBar);

    var replying = full.querySelector('[data-replying]');
    c.startReply = function (text) { c.quote = text; replying.hidden = false; replying.querySelector('span').textContent = text; c.input.focus(); };
    c.clearReply = function () { c.quote = null; replying.hidden = true; };
    replying.querySelector('button').addEventListener('click', c.clearReply);

    // disappearing messages
    var tBtn = full.querySelector('[data-timer]'), menu = full.querySelector('[data-timer-menu]');
    var closeTimer = function () { menu.hidden = true; tBtn.setAttribute('aria-expanded', 'false'); };
    tBtn.addEventListener('click', function (e) { e.stopPropagation(); var o = menu.hidden; menu.hidden = !o; tBtn.setAttribute('aria-expanded', String(o)); });
    menu.addEventListener('click', function (e) {
      var k = e.target.closest('button'); if (!k) return;
      menu.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-checked', String(x === k)); });
      tBtn.setAttribute('aria-pressed', String(k.dataset.t !== 'off'));
      var flag = el('span', 'timer-flag'); flag.append(icon('timer'), document.createTextNode(k.dataset.t === 'off' ? 'أوقفتَ الرسائل المؤقتة' : 'فعّلتَ الرسائل المؤقتة: تختفي بعد ' + k.dataset.t));
      c.msgs.appendChild(flag); c.scroll(); closeTimer();
    });
    document.addEventListener('click', function (e) { if (!menu.hidden && !menu.contains(e.target) && e.target !== tBtn) closeTimer(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { hideBar(); closeTimer(); } });

    // voice note from the composer
    full.querySelector('[data-mic]').addEventListener('click', function () {
      c.send({ voice: 4 }).then(function () { return c.typing(1000); }).then(function () { c.bubble({ text: 'سمعتها، صوتك واضح' }); });
    });

    // calls
    var call = full.querySelector('[data-call]'), clock = call.querySelector('[data-clock]'), tick = null, ring = null;
    var startCall = function (video) {
      call.hidden = false; call.querySelector('[data-call-name]').textContent = c.peer;
      var av = call.querySelector('.avatar'); av.textContent = people[c.current].letter; av.className = 'avatar ' + people[c.current].av;
      call.querySelector('[data-cam]').setAttribute('aria-pressed', String(!!video));
      call.querySelector('[data-mute]').setAttribute('aria-pressed', 'false');
      call.querySelector('[data-share]').setAttribute('aria-pressed', 'false');
      clock.textContent = 'يرنّ…'; var s = 0;
      clearInterval(tick); clearTimeout(ring);
      ring = setTimeout(function () { tick = setInterval(function () { s++; clock.textContent = Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2) + ' · جودة الاتصال ممتازة'; }, 1000); }, reduce ? 0 : 1600);
      call.querySelector('.end').focus();
    };
    full.querySelector('[data-voice-call]').addEventListener('click', function () { startCall(false); });
    full.querySelector('[data-video-call]').addEventListener('click', function () { startCall(true); });
    call.addEventListener('click', function (e) {
      var k = e.target.closest('button'); if (!k) return;
      if (k.classList.contains('end')) {
        clearInterval(tick); clearTimeout(ring); call.hidden = true;
        var f = el('span', 'timer-flag'); f.append(icon('phone'), document.createTextNode('مكالمة مع ' + c.peer + ' · انتهت'));
        c.msgs.appendChild(f); c.scroll(); full.querySelector('[data-voice-call]').focus(); return;
      }
      k.setAttribute('aria-pressed', String(k.getAttribute('aria-pressed') !== 'true'));
    });

    open('sara');
  }
})();
