/* Virtual Leather — consent-gated analytics (GA4 + Meta Pixel).
 *
 * Nothing that sets tracking cookies loads until the visitor opts in:
 *   - "analytics" consent loads Google Analytics 4 (gtag.js)
 *   - "marketing" consent loads the Meta Pixel
 * Google Consent Mode v2 defaults are set to "denied" before anything else.
 *
 * Use VL.track(eventName, params) everywhere. Event names follow GA4's
 * recommended e-commerce names and are mapped to Meta standard events:
 *   view_item        -> ViewContent
 *   add_to_cart      -> AddToCart
 *   begin_checkout   -> InitiateCheckout
 *   purchase         -> Purchase
 *   generate_lead    -> Contact      (WhatsApp / email clicks)
 *   customize_product-> CustomizeProduct
 *   select_content   -> (GA4 only: suggested designs picked, logos uploaded)
 * Every Meta event gets a unique eventID so a future Conversions API
 * integration can de-duplicate browser and server events.
 *
 * Meta and Ecwid: Ecwid has the same Meta pixel connected in its admin and sends the shop events itself
 * (product views in the shop, add to cart, checkout, purchase). This file keeps that from counting twice
 * or running early (see "Meta pixel" below), and adds what only the website sees.
 * Add ?vl_debug=1 to any URL to log events in the browser console.
 */
(function () {
  'use strict';
  var C = window.VL_CONFIG || {};
  var KEY = 'vl_consent_v1';
  var debug = /[?&]vl_debug=1/.test(location.search);

  /* ---------- The owner's own visits ----------
   * virtualleather.net/?me=on marks this browser as the shop owner's: from then on it sends nothing to Google
   * Analytics or Meta, so his own visits and test orders don't count as customers. ?me=off undoes it.
   * Once per browser and device (phone, laptop...). Kept in local storage as vl_owner. */
  var OWNER_KEY = 'vl_owner';
  var meParam = (location.search.match(/[?&]me=(on|off)\b/) || [])[1];
  if (meParam) {
    try { meParam === 'on' ? localStorage.setItem(OWNER_KEY, '1') : localStorage.removeItem(OWNER_KEY); } catch (e) { /* storage blocked */ }
    try { history.replaceState(history.state, '', location.href.replace(/([?&])me=(on|off)&?/, '$1').replace(/[?&](#|$)/, '$1')); } catch (e) { /* old browser */ }
    document.addEventListener('DOMContentLoaded', function () {
      var n = document.createElement('div');
      n.setAttribute('role', 'status');
      n.textContent = meParam === 'on'
        ? 'Done: your visits on this browser are no longer counted in Google Analytics or Meta.'
        : 'Done: your visits on this browser are counted again.';
      n.style.cssText = 'position:fixed;left:16px;right:16px;bottom:16px;z-index:9999;max-width:560px;margin:0 auto;padding:14px 16px;' +
        'border-radius:10px;background:#1f1a17;color:#fff;font:15px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)';
      document.body.appendChild(n);
      setTimeout(function () { n.remove(); }, 6000);
    });
  }
  var owner = false;
  try { owner = localStorage.getItem(OWNER_KEY) === '1'; } catch (e) { /* storage blocked */ }

  /* ---------- Where the visit came from ----------
   * Google Analytics only starts once the visitor allows it, which can be a page or two after they arrive
   * (from Instagram, an Etsy link, a tagged short link like /bio/ ...). The landing page's tags and the site
   * that sent them are kept for this tab only (session storage vl_landing) and handed to Google Analytics
   * when it starts, so the visit is still put down to the right place. Nothing is sent without consent. */
  var LANDING_KEY = 'vl_landing';
  var CAMPAIGN = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id'];
  (function noteLanding() {
    try {
      var params = new URLSearchParams(location.search), utm = {}, has = false;
      CAMPAIGN.forEach(function (k) { var v = params.get(k); if (v) { utm[k] = v.slice(0, 100); has = true; } });
      var ref = document.referrer, external = false;
      try { external = !!ref && new URL(ref).hostname.replace(/^www\./, '') !== location.hostname.replace(/^www\./, ''); } catch (e) { /* bad referrer */ }
      if (!has && !external) return;
      // A tagged link always wins; a plain outside referrer only fills in when nothing is kept yet.
      if (!has && sessionStorage.getItem(LANDING_KEY)) return;
      sessionStorage.setItem(LANDING_KEY, JSON.stringify({ utm: utm, ref: external ? ref.split('#')[0].slice(0, 300) : '', page: location.pathname }));
    } catch (e) { /* storage blocked: Google Analytics uses what it sees itself */ }
  })();
  // Extra settings for Google Analytics' first start in this tab, when it starts on a later page than the landing one.
  function landingFields() {
    try {
      var l = JSON.parse(sessionStorage.getItem(LANDING_KEY));
      if (!l || l.used) return {};
      l.used = true;
      sessionStorage.setItem(LANDING_KEY, JSON.stringify(l));
      if (l.page === location.pathname) return {};   // started on the landing page itself: it sees the tags and referrer
      var f = {};
      if (l.ref) f.page_referrer = l.ref;
      var map = { utm_source: 'campaign_source', utm_medium: 'campaign_medium', utm_campaign: 'campaign_name',
        utm_content: 'campaign_content', utm_term: 'campaign_term', utm_id: 'campaign_id' };
      Object.keys(l.utm || {}).forEach(function (k) { f[map[k]] = l.utm[k]; });
      return f;
    } catch (e) { return {}; }
  }
  var gaLoaded = false, fbLoaded = false;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
    analytics_storage: 'denied', functionality_storage: 'granted', security_storage: 'granted',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);

  function readConsent() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      if (!v || typeof v !== 'object') return null;
      // Ask again after 12 months.
      if (!v.ts || Date.now() - Date.parse(v.ts) > 365 * 864e5) return null;
      return v;
    }
    catch (e) { return null; }
  }
  function writeConsent(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* storage blocked: consent lasts for this page only */ }
  }

  // Addresses carrying a private key (for example a sign-in or order link from an Ecwid email) never go to
  // Meta: the pixel sends the full address, "#…" included, with every event, and such a key opens someone's
  // account or order. Google gets every address without the "#…" part and without a design reference.
  // (The same rule as on marketcenterco.com.)
  function privateUrl() { return /[?&#\/;](key|token|access_?token|auth|secret|session)=/i.test(location.href); }
  function cleanUrl() {
    var q = location.search.replace(/([?&])edit=[^&]*&?/, '$1').replace(/[?&]$/, '');
    return location.origin + location.pathname + q;
  }

  /* ---------- Meta pixel ----------
   * The pixel's command queue is created straight away, but Meta's code is downloaded only once the
   * visitor allows marketing cookies. Ecwid finds this queue and doesn't download Meta's code itself, so
   * nothing reaches Meta before consent. Every command passes through here, which lets us:
   *   - keep Ecwid's shop events (it sends them with its own event IDs) but drop the customer email and
   *     phone Ecwid would attach: we never send Meta names, emails or phone numbers;
   *   - drop Ecwid's page views, as this file sends one per page;
   *   - drop Ecwid's own consent switches: the visitor's choice here decides, by loading Meta's code or not
   *     (an Ecwid "revoke" left in the queue would otherwise hold everything back);
   *   - send the shop events ourselves only when Ecwid's pixel isn't there (storePixel).
   * Automatic events (Meta reading buttons and forms) are off, and address changes add no page views. */
  var storePixel = false, ownCall = false;
  if (C.metaPixelId && !window.fbq) {
    var fbq = window.fbq = function () {
      var a = Array.prototype.slice.call(arguments);
      if (a[0] === 'init' && a[3] && a[3].agent === 'plecwid') { storePixel = true; a[2] = {}; }
      if (a[0] === 'track' && a[1] === 'PageView' && !a[3]) return;
      if (a[0] === 'consent' && !ownCall) return;
      fbq.callMethod ? fbq.callMethod.apply(fbq, a) : fbq.queue.push(a);
    };
    if (!window._fbq) window._fbq = fbq;
    fbq.push = fbq; fbq.loaded = true; fbq.version = '2.0'; fbq.queue = [];
    fbq.disablePushState = true;
    fbq('set', 'autoConfig', false, C.metaPixelId);
  }
  function metaConsent(v) { ownCall = true; try { window.fbq('consent', v); } finally { ownCall = false; } }

  function loadScript(src) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function loadGA() {
    if (gaLoaded || !C.ga4MeasurementId || owner) return;
    gaLoaded = true;
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.ga4MeasurementId));
    gtag('js', new Date());
    gtag('config', C.ga4MeasurementId, Object.assign({ page_location: cleanUrl() }, landingFields()));
  }

  function loadPixel() {
    if (fbLoaded || !C.metaPixelId || !window.fbq || privateUrl() || owner) return;
    fbLoaded = true;
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
    metaConsent('grant');
    window.fbq('init', C.metaPixelId);
    window.fbq('track', 'PageView', {}, { eventID: newId('PageView') });
  }

  function apply(c) {
    gtag('consent', 'update', {
      analytics_storage: c.analytics ? 'granted' : 'denied',
      ad_storage: c.marketing ? 'granted' : 'denied',
      ad_user_data: c.marketing ? 'granted' : 'denied',
      ad_personalization: c.marketing ? 'granted' : 'denied'
    });
    if (c.analytics) loadGA();
    if (c.marketing) loadPixel();
    else if (fbLoaded && window.fbq) metaConsent('revoke');
    // Ecwid takes "ACCEPT"/"DECLINE" before it loads and "ACCEPTED"/"DECLINED" afterwards.
    try { if (window.Ecwid && Ecwid.setTrackingConsent) Ecwid.setTrackingConsent(ecwidConsent(c) + 'ED'); } catch (e) { /* optional API */ }
  }
  // What Ecwid is told: its tracking (its Meta pixel) follows the marketing choice.
  function ecwidConsent(c) { return c && c.marketing ? 'ACCEPT' : 'DECLINE'; }

  function clearCookies(re) {
    document.cookie.split(';').forEach(function (c) {
      var name = c.split('=')[0].trim();
      if (!re.test(name)) return;
      var host = location.hostname.replace(/^www\./, '');
      ['', '; domain=' + host, '; domain=.' + host].forEach(function (d) {
        document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
      });
    });
  }

  function newId(name) {
    return name + '.' + Date.now().toString(36) + '.' + Math.random().toString(36).slice(2, 10);
  }

  var META_MAP = {
    view_item: 'ViewContent', add_to_cart: 'AddToCart', begin_checkout: 'InitiateCheckout',
    purchase: 'Purchase', generate_lead: 'Contact', customize_product: 'CustomizeProduct',
    view_cart: null, select_item: null, remove_from_cart: null, select_style: null,
    select_content: null   // designer engagement: GA4 only, kept out of Meta's optimisation signals
  };

  /* params: GA4-style. { value, currency, items:[{item_id,item_name,price,quantity}], ... }
   * from_store: true marks the shop's own events (main.js), which Ecwid's pixel sends to Meta when it's there. */
  function track(name, params) {
    params = Object.assign({}, params);
    var fromStore = !!params.from_store;
    delete params.from_store;
    var consent = state || {};
    if (debug) console.info('[VL track]', name, params, 'consent:', consent, fromStore ? '(shop event)' : '');

    if (consent.analytics && gaLoaded) gtag('event', name, Object.assign({ page_location: cleanUrl() }, params));

    if (!consent.marketing || privateUrl()) return;
    loadPixel();   // e.g. after leaving a private address
    if (!fromStore) return sendMeta(name, params);
    // Give Ecwid's pixel a moment to start, then send it ourselves only if Ecwid didn't.
    if (storePixel) return;
    setTimeout(function () { if (!storePixel) sendMeta(name, params); }, 2500);
  }

  function sendMeta(name, params) {
    if (fbLoaded && window.fbq) {
      var metaName = META_MAP.hasOwnProperty(name) ? META_MAP[name] : undefined;
      var items = params.items || [];
      var data = {};
      if (items.length) {
        data.content_ids = items.map(function (i) { return String(i.item_id); });
        data.contents = items.map(function (i) { return { id: String(i.item_id), quantity: i.quantity || 1 }; });
        data.content_type = 'product';
        if (items.length === 1) data.content_name = items[0].item_name;
      }
      if (params.value != null) { data.value = Number(params.value); data.currency = params.currency || C.currency || 'USD'; }
      if (params.method) data.content_category = params.method;
      var opts = { eventID: params.event_id || newId(metaName || name) };
      if (metaName) window.fbq('track', metaName, data, opts);
      else if (metaName === undefined) window.fbq('trackCustom', name, data, opts);
    }
  }

  var state = readConsent();
  if (state) apply(state);

  window.VL = window.VL || {};
  window.VL.track = track;
  window.VL.consent = {
    get: function () { return state; },
    ecwid: function () { return ecwidConsent(state); },
    set: function (c) {
      var wasOn = state && (state.analytics || state.marketing);
      state = { analytics: !!c.analytics, marketing: !!c.marketing, ts: new Date().toISOString(), v: 1 };
      writeConsent(state);
      apply(state);
      // Withdrawing consent after scripts loaded: reload so they are fully removed from the page.
      if (!state.analytics) clearCookies(/^_ga/);
      if (!state.marketing) clearCookies(/^_fb[pc]$/);
      if (wasOn && ((!state.analytics && gaLoaded) || (!state.marketing && fbLoaded))) location.reload();
    }
  };
})();
