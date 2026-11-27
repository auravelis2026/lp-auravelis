(function () {
  var C = window.CFG, $ = function (s, r) { return (r || document).querySelector(s); },
    $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sel = C.defaultTier;
  function fire(ev, data, custom) {
    if (!window.fbq || !C.pixelId) return;
    custom ? fbq('trackCustom', ev, data || {}) : fbq('track', ev, data || {});
  }
  var slug = (window.lpSlug && lpSlug()) || '';
  var key = slug.replace(/-/g, '_');

  // ---- tiers: anchor price, gifts, delivery line, ATC label (all strings pre-formatted at build) ----
  function pick(i, quiet) {
    sel = i;
    var t = C.tiers[i];
    $$('.tcard').forEach(function (el, k) { el.classList.toggle('on', k === i); el.setAttribute('aria-checked', k === i); });
    $('#an-ttl').textContent = t.title;
    $('#an-now').textContent = t.now;
    $('#an-was').textContent = t.was;
    $('#an-save').textContent = t.save;
    $('#an-sub').textContent = t.sub;
    $('#an-note').textContent = t.giftNote;
    $('#atc-label').textContent = t.atc;
    $('#deliv').innerHTML = t.deliv;
    $$('.gcard').forEach(function (g) { g.classList.toggle('locked', t.qty < +g.dataset.from); });
    if (!quiet) fire('LP_TierSwitch', { qty: t.qty }, true);
  }
  $$('.tcard').forEach(function (el, k) {
    el.addEventListener('click', function () { pick(k); });
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(k); } });
  });

  function checkout(src) {
    var t = C.tiers[sel];
    fire('InitiateCheckout', { value: t.price, currency: C.currency, num_items: t.qty, content_ids: [String(t.variantId || '')], content_type: 'product' });
    if (key) fire('LPC_' + key, { src: src }, true);
    if (!C.checkoutBase || !t.variantId) { alert(C.notConnected); return; }
    // 2026-11-27 AURAVELIS: per-unit tier variants (cart <variant>:<cartQty>), free-shipping code and gift note per tier
    function cartUrl(t) {
      var u = C.checkoutBase.replace(/\/$/, '') + '/cart/' + t.variantId + ':' + (t.cartQty || 1), q = [];
      if (t.giftNote && C.noteKey) q.push('attributes%5B' + encodeURIComponent(C.noteKey) + '%5D=' + encodeURIComponent(t.giftNote));
      if (t.code) q.push('discount=' + encodeURIComponent(t.code));
      return u + (q.length ? '?' + q.join('&') : '');
    }
    location.href = cartUrl(t);
  }
  $('#atc').addEventListener('click', function () { checkout('main'); });
  $('#atc-up').addEventListener('click', function () { pick(C.tiers.length - 1); checkout('upsell'); });
  $$('.go').forEach(function (b) {
    b.addEventListener('click', function () { $('#offer').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  });

  // ---- gallery ----
  var track = $('#slides'), dots = $$('#dots span'), ths = $$('#thumbs img'), cur = 0;
  function go(k) { k = (k + dots.length) % dots.length; track.scrollTo({ left: k * track.clientWidth, behavior: 'smooth' }); }
  function syncGal() {
    var k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (k === cur) return;
    cur = k;
    dots.forEach(function (d, j) { d.classList.toggle('on', j === k); });
    ths.forEach(function (t, j) { t.classList.toggle('on', j === k); });
  }
  $$('.gal .arr').forEach(function (b) { b.addEventListener('click', function () { go(cur + +b.dataset.step); }); });
  dots.concat(ths).forEach(function (el) { el.addEventListener('click', function () { go(+el.dataset.k); fire('LP_Gallery', {}, true); }); });
  track.addEventListener('scroll', syncGal, { passive: true });

  // ---- "what's in the pack" tabs + expandable tiles ----
  $$('#ingtabs .tab').forEach(function (b) {
    b.addEventListener('click', function () {
      $$('#ingtabs .tab').forEach(function (x) { x.classList.toggle('on', x === b); });
      $$('#igrid .itile').forEach(function (t) { t.hidden = t.dataset.tab !== b.dataset.tab; });
    });
  });
  $$('.itile').forEach(function (t) { t.addEventListener('click', function () { t.classList.toggle('open'); }); });

  // ---- comparison toggle ----
  $$('#vstabs .vstab').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = +b.dataset.v;
      $$('#vstabs .vstab').forEach(function (x) { x.classList.toggle('on', x === b); });
      $('#vs-em').textContent = C.vs.em[v];
      $('#vs-name').textContent = C.vs.name[v];
      $$('.vst td[data-v0]').forEach(function (td) { td.innerHTML = td.getAttribute('data-v' + v); });
    });
  });

  // ---- behaviour tracking (once each; interval because scroll events are unreliable in webviews) ----
  var t0 = Date.now(), done = {};
  function once(k, f) { if (!done[k]) { done[k] = 1; f(); } }
  function tick() {
    syncGal();
    var h = document.documentElement.scrollHeight - innerHeight, p = h > 0 ? scrollY / h : 0;
    if (p > 0.5) once('s50', function () { fire('LP_Scroll50', {}, true); });
    if (p > 0.9) once('s90', function () { fire('LP_Scroll90', {}, true); });
    var s = (Date.now() - t0) / 1000;
    if (s > 30) once('e30', function () { fire('LP_Engaged30', {}, true); if (key) fire('LPE_' + key, {}, true); });
    if (s > 120) once('e120', function () { fire('LP_Engaged120', {}, true); });
  }
  $$('details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) fire('LP_FAQ', {}, true); }); });
  addEventListener('pagehide', function () { fire('LP_Exit', { seconds: Math.round((Date.now() - t0) / 1000) }, true); });
  addEventListener('scroll', tick, { passive: true });
  setInterval(tick, 400);

  pick(sel, true);
  fire('ViewContent', { content_ids: [String(C.tiers[sel].variantId || '')], content_type: 'product', value: C.tiers[sel].price, currency: C.currency });
  if (key) fire('LPV_' + key, {}, true);
})();
