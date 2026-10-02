# virtualleather.net

The Virtual Leather website: a fast, hand-coded static site with the existing **Ecwid** store (ID `97299801`) embedded for cart and checkout. It needs no paid website builder. It's hosted on Hostinger.

## What's in it

| Page | Purpose |
|---|---|
| `/` | Home, laid out like marketcenterco.com: hero → gift ideas → **live apron designer** → customer gallery → products → Etsy reviews → how to order → business orders → FAQ |
| `/shop/` | Full Ecwid storefront (all products, cart, checkout, customer account) |
| `/about/` | Story |
| `/shipping-returns/`, `/terms/`, `/privacy/`, `/cookies/`, `/accessibility/` | Policies |

**The apron designer** (`site/assets/js/designer.js`) shows a live preview and puts the apron straight into the Ecwid cart. It uses the store's exact product options (Main Color, Secondary Color, Customer Height and Weight, Description For Personalization, Email, Phone) and adds the Wings and Bottle Opener extras. If the cart can't load (for example because of an ad blocker), the customer gets a WhatsApp message with their design already written in.

## Editing

Everything you'd normally change is in **`src/`**:

- `src/config.json`: business details, WhatsApp, email, **GA4 and Meta Pixel IDs**, Etsy links.
- `src/data/products.json`: product cards (name, price, summary). Prices must match Ecwid.
- `src/data/reviews.json`: Etsy reviews shown on the homepage. Paste the customer's exact words and star rating.
- `src/pages/*.html`: page content. `src/partials/*.html`: header, footer, cookie banner, layout.
- `site/assets/css/styles.css` and `site/assets/js/*.js`: design and behaviour.

Then build:

```bash
npm install          # first time only
npm run build        # writes the finished site into site/
npm run check        # lists launch TODOs; fails on broken links or images without alt text
npm run serve        # preview at http://localhost:8080
```

`npm run images` re-downloads product photos from Ecwid and converts them to WebP. Edit the list in `tools/images.mjs` first.

## Publishing to Hostinger (free, automatic)

1. **Point the domain.** In hPanel → *Websites*, add `virtualleather.net` as a website, or check it's attached to your hosting plan. If the domain is registered at Hostinger, DNS is set automatically.
2. **Turn on SSL.** In hPanel → *Security → SSL*, install the free SSL for `virtualleather.net` and `www.virtualleather.net`.
3. **FTP details.** In hPanel → *Files → FTP Accounts*, note the hostname, username and password.
4. **GitHub secrets.** In GitHub → this repo → *Settings → Secrets and variables → Actions*, add:
   - `FTP_SERVER`: FTP hostname, e.g. `ftp.virtualleather.net`
   - `FTP_USERNAME`
   - `FTP_PASSWORD`
   - Optional *variable* `FTP_DIR`: set it to `public_html/` only if your FTP login opens one level above `public_html`.
5. Merge to `main`. The **Build and deploy** GitHub Action builds the site and uploads `site/` to Hostinger. Every later change to `main` goes live the same way.

`site/.htaccess` forces HTTPS, redirects `www` to the bare domain, sets caching and security headers, and serves the custom 404 page.

## Analytics and ads

All tracking is **consent-first**. GA4 and the Meta Pixel load only after the visitor allows them in the cookie banner, and Google Consent Mode v2 defaults to *denied*. Use `?vl_debug=1` on any page to see events in the browser console.

| When | GA4 event | Meta event |
|---|---|---|
| Someone starts using the designer | `customize_product` | `CustomizeProduct` |
| Someone views a product in the shop | `view_item` | `ViewContent` |
| Item added to cart (designer or shop) | `add_to_cart` | `AddToCart` |
| Checkout opened | `begin_checkout` | `InitiateCheckout` |
| Order placed | `purchase` (with `transaction_id`) | `Purchase` (`eventID = Purchase.<order no.>`) |
| WhatsApp or email link clicked | `generate_lead` | `Contact` |

### Set up Google Analytics 4
1. At analytics.google.com, create a property called "Virtual Leather". Set the time zone, and set the currency to **USD**.
2. Add a **Web** data stream for `https://virtualleather.net` and copy the **Measurement ID** (`G-XXXXXXX`).
3. Put it in `src/config.json` → `ga4MeasurementId`, then rebuild.
4. In GA4 → *Admin → Events*, mark `purchase` and `generate_lead` as **key events**.
5. Optional: link Google Ads and Search Console in GA4 → *Admin → Product links*.

### Set up the Meta Pixel and ads
1. In Meta **Events Manager**, create or choose a dataset (Pixel) and copy its ID into `src/config.json` → `metaPixelId`.
2. In **Business Settings → Brand safety → Domains**, add and **verify** `virtualleather.net`. The DNS TXT method in Hostinger's DNS zone editor is the easiest.
3. In Events Manager, check that `Purchase`, `AddToCart`, `InitiateCheckout`, `ViewContent` and `Contact` arrive. Use the *Test events* tab.
4. Optimise purchase campaigns for **Purchase**. While purchase volume is still low, optimise for **AddToCart** or **Contact** (WhatsApp).
5. **Conversions API (CAPI).** Browser events already carry an `eventID`. When you add server-side events (for example Meta's "Conversions API Gateway" or a small server function), send the same IDs so Meta de-duplicates them.

### Important: avoid double counting
In the Ecwid admin, **don't** turn on Ecwid's own Google Analytics or Facebook Pixel integrations for this storefront. This site already sends those events and respects the visitor's cookie choice. Ecwid's integrations would count everything twice and skip the consent banner.

## Before launch
See [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md). `npm run check` lists every open item.
