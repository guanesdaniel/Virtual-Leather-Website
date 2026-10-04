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
 * Add ?vl_debug=1 to any URL to log events in the browser console.
 */
(function () {
  'use strict';
  var C = window.VL_CONFIG || {};
  var KEY = 'vl_consent_v1';
  var debug = /[?&]vl_debug=1/.test(location.search);
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

  function loadScript(src) {
    var s = document.createElement('script');
    s.async = true; s.src = src;
    document.head.appendChild(s);
  }

  function loadGA() {
    if (gaLoaded || !C.ga4MeasurementId) return;
    gaLoaded = true;
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(C.ga4MeasurementId));
    gtag('js', new Date());
    gtag('config', C.ga4MeasurementId);
  }

  function loadPixel() {
    if (fbLoaded || !C.metaPixelId) return;
    fbLoaded = true;
    /* Standard Meta Pixel bootstrap */
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('consent', 'grant');
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
    else if (fbLoaded && window.fbq) window.fbq('consent', 'revoke');
    try { if (window.Ecwid && Ecwid.setTrackingConsent) Ecwid.setTrackingConsent(c.analytics || c.marketing ? 'ACCEPT' : 'DECLINE'); } catch (e) { /* optional API */ }
  }

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
    select_content: null,  // designer engagement: GA4 only, kept out of Meta's optimisation signals
    share: null            // design picture shared or saved: GA4 only
  };

  /* params: GA4-style. { value, currency, items:[{item_id,item_name,price,quantity}], ... } */
  function track(name, params) {
    params = params || {};
    var consent = state || {};
    if (debug) console.info('[VL track]', name, params, 'consent:', consent);

    if (consent.analytics && gaLoaded) gtag('event', name, params);

    if (consent.marketing && fbLoaded && window.fbq) {
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
