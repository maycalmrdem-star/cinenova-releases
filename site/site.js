// Reviews live in Supabase (table site_reviews, see reviews.sql). Plain fetch, no library.
(function () {
  // Friend QR codes point at /?add-friend=…; those belong to the web app.
  if (/[?&]add-friend=/.test(location.search)) { location.replace('/app' + location.search); return; }
  var API = 'https://yaohklgfegdexsniehhi.supabase.co/rest/v1/site_reviews';
  var KEY = 'sb_publishable_etFJKue6zjzxyyIEFNKxvQ_npH9SW3_';
  var HEADERS = { apikey: KEY, 'Content-Type': 'application/json' };
  var MINE = 'chathup-reviewed';

  var $ = function (id) { return document.getElementById(id); };
  var pick = $('pick'), form = $('form'), send = $('send'), text = $('text'), name = $('name'), status = $('status'), list = $('list');
  var rating = 0;

  var stars = function (n) {
    n = Math.round(n);
    var on = document.createElement('span'); on.textContent = '★'.repeat(n);
    var off = document.createElement('span'); off.className = 'off'; off.textContent = '★'.repeat(5 - n);
    var f = document.createDocumentFragment(); f.append(on, off); return f;
  };
  var ago = function (iso) {
    var d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (d < 60) return 'الآن';
    if (d < 3600) return 'قبل ' + Math.floor(d / 60) + ' د';
    if (d < 86400) return 'قبل ' + Math.floor(d / 3600) + ' س';
    return new Date(iso).toLocaleDateString('ar', { day: 'numeric', month: 'long' });
  };
  var reviewed = function () { try { return localStorage.getItem(MINE) === '1'; } catch (e) { return false; } };

  for (var i = 5; i >= 1; i--) (function (v) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = '★'; b.setAttribute('role', 'radio'); b.setAttribute('aria-label', v + ' من 5');
    b.addEventListener('click', function () { rating = v; paint(); });
    pick.appendChild(b);
  })(i);
  function paint() {
    Array.prototype.forEach.call(pick.children, function (b, idx) {
      var v = 5 - idx; b.classList.toggle('on', v <= rating); b.setAttribute('aria-checked', String(v === rating));
    });
    send.disabled = rating === 0 || !name.value.trim();
  }
  name.addEventListener('input', paint);
  if (reviewed()) { form.hidden = true; $('thanks').hidden = false; }

  function render(rows) {
    var n = rows.length, avg = n ? rows.reduce(function (s, x) { return s + x.rating; }, 0) / n : 0;
    $('avg').textContent = n ? avg.toFixed(1) : '—';
    var as = $('avg-stars'); as.textContent = ''; as.appendChild(stars(avg));
    $('count').textContent = n ? (n === 1 ? 'تقييم واحد' : n + ' تقييمات') : 'لا توجد تقييمات بعد';
    list.textContent = '';
    if (!n) {
      var e = document.createElement('div'); e.className = 'empty'; e.textContent = 'لا توجد آراء بعد. كن أول من يقيّم ChatHup.';
      list.appendChild(e); return;
    }
    rows.forEach(function (x) {
      var el = document.createElement('article'); el.className = 'rev';
      var h = document.createElement('header');
      var who = document.createElement('span'); who.className = 'who'; who.textContent = x.name;
      var st = document.createElement('span'); st.className = 'stars'; st.appendChild(stars(x.rating));
      var when = document.createElement('span'); when.className = 'when'; when.textContent = ago(x.created_at);
      h.append(who, st, when); el.appendChild(h);
      if (x.body) { var p = document.createElement('p'); p.textContent = x.body; el.appendChild(p); }
      list.appendChild(el);
    });
  }

  function load() {
    return fetch(API + '?select=name,rating,body,created_at&order=created_at.desc&limit=100', { headers: HEADERS })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (rows) { render(Array.isArray(rows) ? rows : []); })
      .catch(function () { render([]); });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!rating || !name.value.trim() || $('website').value) return;
    send.disabled = true; status.textContent = 'جارٍ النشر…';
    fetch(API, {
      method: 'POST',
      headers: Object.assign({ Prefer: 'return=minimal' }, HEADERS),
      body: JSON.stringify({ name: name.value.trim().slice(0, 40), rating: rating, body: text.value.trim().slice(0, 500), version: '5.2.0' })
    }).then(function (r) {
      if (!r.ok) throw r;
      try { localStorage.setItem(MINE, '1'); } catch (err) {}
      form.hidden = true; status.textContent = ''; $('thanks').hidden = false;
      return load();
    }).catch(function () {
      status.textContent = 'تعذر النشر، حاول مرة أخرى.'; paint();
    });
  });

  load();
})();
