(function () {
  var C = window.CFG, $ = function (s, r) { return (r || document).querySelector(s); },
    $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var sel = C.defaultTier;

  function money(v) {
    var m = C.money, p = v.toFixed(2).split('.');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, m.thou);
    var s = p[0] + m.dec + p[1], sp = m.space ? ' ' : '';
    return m.pos === 'before' ? m.symbol + sp + s : s + sp + m.symbol;
  }
  function fire(ev, data, custom) {
    if (!window.fbq || !C.pixelId) return;
    custom ? fbq('trackCustom', ev, data || {}) : fbq('track', ev, data || {});
  }

  // ---- tiers + gifts ----
  function pick(i, quiet) {
    sel = i;
    var t = C.tiers[i], total = money(t.price);
    $$('.tier').forEach(function (el, k) {
      el.classList.toggle('on', k === i);
      $('input', el).checked = k === i;
    });
    $$('.gift').forEach(function (g) { g.classList.toggle('locked', t.qty < +g.dataset.from); });
    $('#cta-label').textContent = C.t.cta.replace('{total}', total);
    $('#cta-sticky').firstChild.textContent = C.t.cta_sticky.replace('{total}', total);
    $('#s-name').textContent = C.tierNames[i];
    $('#s-total').textContent = total;
    if (!quiet) fire('LP_TierSwitch', { qty: t.qty }, true);
  }
  $$('.tier').forEach(function (el, k) { el.addEventListener('click', function () { pick(k); }); });
  pick(sel, true);

  // ---- checkout ----
  function checkout(src) {
    var t = C.tiers[sel];
    fire('InitiateCheckout', { value: t.price, currency: C.currency, num_items: t.qty, content_ids: [String(t.variantId || '')], content_type: 'product' });
    var slug = window.lpSlug && lpSlug();
    if (slug) fire('LPC_' + slug.replace(/-/g, '_'), { src: src }, true);
    if (!C.checkoutBase || !t.variantId) { alert(C.t.not_connected); return; }
    // 2026-11-27 AURAVELIS: per-unit tier variants (cart <variant>:<cartQty>), free-shipping code and gift note per tier
    function cartUrl(t) {
      var u = C.checkoutBase.replace(/\/$/, '') + '/cart/' + t.variantId + ':' + (t.cartQty || 1), q = [];
      if (t.giftNote && C.noteKey) q.push('attributes%5B' + encodeURIComponent(C.noteKey) + '%5D=' + encodeURIComponent(t.giftNote));
      if (t.code) q.push('discount=' + encodeURIComponent(t.code));
      return u + (q.length ? '?' + q.join('&') : '');
    }
    location.href = cartUrl(t);
  }
  $('#cta-main').addEventListener('click', function () { checkout('main'); });
  $('#cta-sticky').addEventListener('click', function () { fire('LP_StickyCTA', {}, true); checkout('sticky'); });
  // section CTAs scroll to the offer (optionally preselecting a tier)
  $$('.go').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.tier) pick(+b.dataset.tier);
      $('#offer').scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  // ---- gallery ----
  var track = $('#slides'), dots = $$('#dots i'), ths = $$('#thumbs .th'), cur = -1;
  function go(k) { track.scrollTo({ left: k * track.clientWidth, behavior: 'smooth' }); }
  function syncGal() {
    var k = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    if (k === cur) return;
    cur = k;
    dots.forEach(function (d, j) { d.classList.toggle('on', j === k); });
    ths.forEach(function (t, j) { t.classList.toggle('on', j === k); });
    if (ths[k]) { var th = $('#thumbs'); th.scrollTo({ left: ths[k].offsetLeft - th.clientWidth / 2 + 30, behavior: 'smooth' }); }
  }
  ths.forEach(function (t) { t.addEventListener('click', function () { go(+t.dataset.k); fire('LP_Gallery', {}, true); }); });
  $('.nav.prev').addEventListener('click', function () { go(Math.max(0, cur - 1)); });
  $('.nav.next').addEventListener('click', function () { go(cur + 1 >= dots.length ? 0 : cur + 1); });
  track.addEventListener('scroll', syncGal, { passive: true });

  // ---- sticky bar: visible only while the main CTA is out of view (interval = webview-safe) ----
  var sticky = $('#sticky'), main = $('#cta-main'), offer = $('#offer');
  function syncSticky() {
    var r = main.getBoundingClientRect(), o = offer.getBoundingClientRect(), vh = window.innerHeight;
    var ctaVisible = r.top < vh && r.bottom > 0, offerVisible = o.top < vh * 0.8 && o.bottom > vh * 0.2;
    var past = window.scrollY > 300;
    var show = past && !ctaVisible && !offerVisible;
    sticky.classList.toggle('show', show);
    sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
  }

  // ---- behaviour tracking (fires once each) ----
  var t0 = Date.now(), done = {};
  function once(k, f) { if (!done[k]) { done[k] = 1; f(); } }
  function syncDepth() {
    var h = document.documentElement.scrollHeight - window.innerHeight, p = h > 0 ? window.scrollY / h : 0;
    if (p > 0.5) once('s50', function () { fire('LP_Scroll50', {}, true); });
    if (p > 0.9) once('s90', function () { fire('LP_Scroll90', {}, true); });
    var s = (Date.now() - t0) / 1000;
    if (s > 30) once('e30', function () {
      fire('LP_Engaged30', {}, true);
      var slug = window.lpSlug && lpSlug(); if (slug) fire('LPE_' + slug.replace(/-/g, '_'), {}, true);
    });
    if (s > 120) once('e120', function () { fire('LP_Engaged120', {}, true); });
  }
  $$('details').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) fire('LP_FAQ', {}, true); }); });
  window.addEventListener('pagehide', function () { fire('LP_Exit', { seconds: Math.round((Date.now() - t0) / 1000) }, true); });

  function tick() { syncGal(); syncSticky(); syncDepth(); }
  window.addEventListener('scroll', tick, { passive: true });
  window.addEventListener('resize', tick);
  setInterval(tick, 300);
  tick();

  fire('ViewContent', { content_ids: [String(C.tiers[sel].variantId || '')], content_type: 'product', value: C.tiers[sel].price, currency: C.currency });
  var slug = window.lpSlug && lpSlug();
  if (slug) fire('LPV_' + slug.replace(/-/g, '_'), {}, true);
})();
