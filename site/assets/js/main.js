/* Virtual Leather — site behaviour: consent banner, click tracking, Ecwid loader + analytics bridge. */
(function () {
  'use strict';
  var C = window.VL_CONFIG || {};
  var VL = window.VL = window.VL || {};
  var track = VL.track || function () {};
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // One way to order an apron: the shop's pages for the aprons our designer makes open the designer,
  // with that apron chosen, instead of the shop's own order form.
  function designerStyle(id) { var p = (C.products || {})[String(id)]; return p && p.designer; }
  function toDesigner(style) { location.replace('/?style=' + encodeURIComponent(style) + '#design'); }
  var linked = /^#!\/(?:p\/(\d+)|[^?#]*?-p(\d+))(?:[\/?&]|$)/.exec(location.hash);
  if (linked && document.getElementById('my-store-' + C.ecwidStoreId) && designerStyle(linked[1] || linked[2])) {
    toDesigner(designerStyle(linked[1] || linked[2]));
    return;
  }

  function productInfo(id) {
    var p = (C.products || {})[String(id)];
    return p ? { item_id: String(id), item_name: p.name, price: p.price, item_category: p.group } : { item_id: String(id) };
  }

  /* ---------- Consent banner ---------- */
  var banner = $('#consent');
  if (banner) {
    var opts = $('#consent-options', banner);
    var btnChoose = $('[data-consent="customise"]', banner);
    var btnSave = $('[data-consent="save"]', banner);
    var lastFocus = null;

    var openBanner = function (showOptions) {
      var cur = VL.consent && VL.consent.get();
      opts.analytics.checked = !!(cur && cur.analytics);
      opts.marketing.checked = !!(cur && cur.marketing);
      banner.hidden = false;
      setOptions(!!showOptions);
      // Only move focus when the visitor opened the settings themselves.
      if (showOptions) { lastFocus = document.activeElement; opts.analytics.focus({ preventScroll: true }); }
    };
    var setOptions = function (show) {
      opts.hidden = !show;
      btnSave.hidden = !show;
      btnChoose.setAttribute('aria-expanded', String(show));
    };
    var close = function (choice) {
      VL.consent.set(choice);
      banner.hidden = true;
      if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
    };

    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-consent]');
      if (!b) return;
      var a = b.getAttribute('data-consent');
      if (a === 'accept') close({ analytics: true, marketing: true });
      else if (a === 'reject') close({ analytics: false, marketing: false });
      else if (a === 'customise') { var open = opts.hidden; setOptions(open); if (open) opts.analytics.focus(); }
      else if (a === 'save') close({ analytics: opts.analytics.checked, marketing: opts.marketing.checked });
    });
    document.addEventListener('click', function (e) {
      if (e.target.closest('[data-open-consent]')) openBanner(true);
    });
    if (!(VL.consent && VL.consent.get())) openBanner(false);
  }

  /* ---------- Click tracking (data-track attributes) ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-track]');
    if (!el) return;
    var kind = el.getAttribute('data-track');
    if (kind === 'contact') {
      track('generate_lead', { method: el.getAttribute('data-channel') || 'link', location: el.getAttribute('data-location') || '' });
    } else if (kind === 'select_item') {
      track('select_item', { items: [productInfo(el.getAttribute('data-id'))] });
    } else if (kind === 'select_style') {
      var style = el.getAttribute('data-style');
      if (style && VL.designer) VL.designer.setStyle(style);
      else if (style) { e.preventDefault(); location.href = '/?style=' + encodeURIComponent(style) + '#design'; }
    }
  });

  /* ---------- Toast ---------- */
  VL.toast = function (html, ms) {
    var old = $('.toast'); if (old) old.remove();
    var t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.innerHTML = html;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 7000);
  };

  /* ---------- Saved apron designs (kept on this device only) ---------- */
  // The designer keeps the design in progress and each apron design added to the cart, so customers can
  // come back and change it without starting again. A design is dropped once its apron leaves the cart,
  // everything is cleared when an order is placed, and nothing older than 30 days is used. Nothing here
  // is sent anywhere. If the browser is short of space, logo previews are left out.
  var SAVED_KEY = 'vl_designs', DRAFT_KEY = 'vl_design_draft', KEEP_MS = 30 * 864e5;
  var DESC = 'Description For Personalization';
  function readJSON(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function writeJSON(key, v) {
    try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  function noLogos(d) { return d && d.snap ? Object.assign({}, d, { snap: Object.assign({}, d.snap, { logos: {} }) }) : d; }
  function fresh(d) { return d && Date.now() - (d.time || 0) < KEEP_MS; }
  VL.saved = {
    designs: function () {
      var all = readJSON(SAVED_KEY, []), list = (Array.isArray(all) ? all : []).filter(function (d) { return fresh(d) && d.ref && d.cart; });
      if (list.length !== all.length) writeJSON(SAVED_KEY, list.length ? list : null);
      return list;
    },
    setDesigns: function (list) {
      if (!writeJSON(SAVED_KEY, list.length ? list : null)) writeJSON(SAVED_KEY, list.map(noLogos));
      document.dispatchEvent(new CustomEvent('vl:saved-designs'));
    },
    find: function (ref) { return VL.saved.designs().filter(function (d) { return d.ref === ref; })[0] || null; },
    draft: function () {
      var d = readJSON(DRAFT_KEY, null);
      if (d && !fresh(d)) writeJSON(DRAFT_KEY, null);
      return fresh(d) && d.fields ? d : null;
    },
    setDraft: function (d) { if (!writeJSON(DRAFT_KEY, d)) writeJSON(DRAFT_KEY, noLogos(d)); },
    clear: function () { writeJSON(SAVED_KEY, null); writeJSON(DRAFT_KEY, null); },
    // The cart line holding this design's apron (its order description carries the design ref).
    lineIndex: function (d, cart) {
      var items = cart && cart.items || [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i], desc = String((it.options || {})[DESC] || '');
        if (it.product && it.product.id === d.cart.apronId && desc.indexOf(d.ref) !== -1) return i;
      }
      return -1;
    }
  };
  // Keep only the designs still in the cart, and offer to edit them above the shop (and its cart).
  function syncSaved(cart) {
    var list = VL.saved.designs(), kept = list.filter(function (d) { return VL.saved.lineIndex(d, cart) !== -1; });
    if (kept.length !== list.length && !VL.cartBusy) VL.saved.setDesigns(kept);
    var box = $('[data-edit-designs]');
    if (!box) return;
    box.textContent = '';
    box.hidden = !kept.length;
    if (!kept.length) return;
    box.appendChild(document.createTextNode(kept.length > 1 ? 'Want to change an apron? Edit ' : 'Want to change your apron? '));
    kept.forEach(function (d, i) {
      if (i) box.appendChild(document.createTextNode(i === kept.length - 1 ? ' or ' : ', '));
      var a = document.createElement('a');
      a.href = '/?edit=' + encodeURIComponent(d.ref) + '#design';
      a.textContent = kept.length > 1 ? 'your ' + d.label : 'Edit your design';
      box.appendChild(a);
    });
    box.appendChild(document.createTextNode('. Everything you entered is kept.'));
  }

  /* ---------- Ecwid loader ---------- */
  var ecwidPromise = null;
  VL.loadEcwid = function () {
    if (ecwidPromise) return ecwidPromise;
    ecwidPromise = new Promise(function (resolve, reject) {
      if (!C.ecwidStoreId) return reject(new Error('No Ecwid store ID'));
      window.ecwid_script_defer = true;
      window.ecwid_dynamic_widgets = true;
      window.ec = window.ec || {};
      window.ec.config = window.ec.config || {};
      window.ec.config.storefrontUrls = { cleanUrls: false };
      var s = document.createElement('script');
      s.src = 'https://app.ecwid.com/script.js?' + C.ecwidStoreId + '&data_platform=code';
      s.charset = 'utf-8';
      s.setAttribute('data-cfasync', 'false');
      var timer = setTimeout(function () { reject(new Error('Ecwid timed out')); }, 15000);
      s.onerror = function () { clearTimeout(timer); reject(new Error('Ecwid blocked')); };
      s.onload = function () {
        var store = document.getElementById('my-store-' + C.ecwidStoreId);
        if (store && window.xProductBrowser) {
          window.xProductBrowser('categoriesPerRow=3', 'views=grid(20,3) list(60) table(60)', 'categoryView=grid', 'searchView=list', 'id=my-store-' + C.ecwidStoreId);
        }
        window.Ecwid.OnAPILoaded.add(function () { clearTimeout(timer); bridge(); resolve(window.Ecwid); });
        window.Ecwid.init();
      };
      document.head.appendChild(s);
    });
    return ecwidPromise;
  };

  /* ---------- Ecwid -> analytics bridge ---------- */
  var bridged = false;
  function bridge() {
    if (bridged) return; bridged = true;
    var E = window.Ecwid;
    var lastQty = null;
    var checkoutTracked = false;

    function cartItems(cart) {
      var map = {};
      (cart && cart.items || []).forEach(function (it) {
        var id = String(it.product && it.product.id);
        if (!map[id]) map[id] = { qty: 0, price: it.product && it.product.price, name: it.product && it.product.name };
        map[id].qty += it.quantity || 0;
      });
      return map;
    }
    function setCount(n) {
      $$('[data-cart-count]').forEach(function (el) {
        el.textContent = n;
        if (n > 0) el.removeAttribute('data-empty'); else el.setAttribute('data-empty', '');
      });
    }

    // Baseline = cart contents at load, so only later additions count as add_to_cart.
    E.Cart.get(function (cart) {
      if (!lastQty) lastQty = cartItems(cart);
      setCount(cart && cart.productsQuantity || 0);
      syncSaved(cart);
    });

    E.OnCartChanged.add(function (cart) {
      var now = cartItems(cart);
      setCount(cart && cart.productsQuantity || 0);
      E.Cart.get(syncSaved);
      // While the designer swaps an edited design into the cart, re-adding it isn't a new add to cart.
      if (lastQty && !VL.cartBusy) {
        Object.keys(now).forEach(function (id) {
          var added = now[id].qty - (lastQty[id] ? lastQty[id].qty : 0);
          if (added > 0) {
            var info = productInfo(id);
            info.item_name = info.item_name || now[id].name;
            info.price = now[id].price != null ? now[id].price : info.price;
            info.quantity = added;
            track('add_to_cart', { currency: C.currency, value: (info.price || 0) * added, items: [info] });
          }
        });
      }
      lastQty = now;
    });

    E.OnPageLoaded.add(function (page) {
      if (!page) return;
      if (page.type === 'PRODUCT' && page.productId && designerStyle(page.productId)) {
        toDesigner(designerStyle(page.productId));
        return;
      }
      if (page.type === 'PRODUCT' && page.productId) {
        var info = productInfo(page.productId);
        info.item_name = info.item_name || page.name;
        track('view_item', { currency: C.currency, value: info.price || 0, items: [info] });
      } else if (page.type === 'CART') {
        track('view_cart', {});
      } else if (/^CHECKOUT/.test(page.type) && !checkoutTracked) {
        checkoutTracked = true;
        E.Cart.get(function (cart) {
          var items = (cart.items || []).map(function (it) {
            var info = productInfo(it.product.id);
            info.item_name = info.item_name || it.product.name;
            info.price = it.product.price; info.quantity = it.quantity;
            return info;
          });
          var value = items.reduce(function (s, i) { return s + (i.price || 0) * (i.quantity || 1); }, 0);
          track('begin_checkout', { currency: C.currency, value: value, items: items });
        });
      }
    });

    if (E.OnOrderPlaced) {
      E.OnOrderPlaced.add(function (order) {
        if (!order) return;
        VL.saved.clear();
        var id = String(order.vendorOrderNumber || order.orderNumber || order.id || '');
        var seenKey = 'vl_order_' + id;
        try { if (sessionStorage.getItem(seenKey)) return; sessionStorage.setItem(seenKey, '1'); } catch (e) { /* ignore */ }
        var items = (order.items || []).map(function (it) {
          var p = it.product || it;
          var info = productInfo(p.id || it.productId);
          info.item_name = info.item_name || p.name;
          info.price = p.price != null ? p.price : it.price;
          info.quantity = it.quantity || 1;
          return info;
        });
        track('purchase', {
          transaction_id: id, event_id: 'Purchase.' + id,
          currency: C.currency, value: Number(order.total) || 0,
          tax: Number(order.tax) || 0, shipping: Number(order.shippingOption && order.shippingOption.shippingRate) || 0,
          items: items
        });
      });
    }
  }

  /* Load Ecwid immediately on the shop page; elsewhere when the cart icon is used or the designer is near. */
  if (document.getElementById('my-store-' + C.ecwidStoreId)) {
    VL.loadEcwid().then(function () {
      var l = $('[data-store-loading]'); if (l) l.hidden = true;
    }).catch(function () {
      var f = $('[data-store-fallback]'); if (f) f.hidden = false;
      var l = $('[data-store-loading]'); if (l) l.hidden = true;
    });
  } else {
    var warm = function () { VL.loadEcwid().catch(function () {}); };
    if ('requestIdleCallback' in window) requestIdleCallback(function () { setTimeout(warm, 2500); });
    else setTimeout(warm, 4000);
  }
})();
