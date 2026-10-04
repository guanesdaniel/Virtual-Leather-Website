# virtualleather.net

The Virtual Leather website: a fast, hand-coded static site with the existing **Ecwid** store (ID `97299801`) embedded for cart and checkout. It needs no paid website builder. It's hosted free on GitHub Pages; the domain is registered at Hostinger.

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

### Apron designer: engraving spots and suggested designs

The designer (`site/assets/js/designer.js`) builds step 4 spot by spot from `SLOT_PLANS`: which choices each spot offers (text, suggested designs, the customer's logo, none) and which it starts on. The BBQ apron has the full set; other styles get text or a logo until they're rolled out.

**Design links and pictures.** Every design has a link (`https://virtualleather.net/#d=…`) that reopens it exactly in the designer. It's in the WhatsApp message and in the Ecwid order description, so you can see what the customer designed with one tap. The link holds only the design: no contact details and no logo files, and the part after `#` never reaches any server. Customers can also share (on phones) or save a picture of their design, with any logos they uploaded.

The suggested-design library is the `DESIGNS` list in the same file. Each design is artwork plus the text the customer fills in (for example the name and year on "Grill Master"), drawn live in the lettering they pick. To add one, send the artwork (SVG, or a high-resolution PNG on a plain background) and say which spots it belongs in and which words customers can change. Artwork from an image is traced into vector shapes by `npm run designs` (`tools/trace-designs.mjs`, source files in `tools/design-src/`): it blanks out the changeable words and writes `site/assets/js/design-art.js`.

## Publishing (free: GitHub Pages + your Hostinger domain)

Hosting is **GitHub Pages**, which is free for this public repo. Hostinger is used **only for the domain**.

- Every push to `main` runs the **Build and deploy** GitHub Action. It builds the site and publishes `site/` to the `gh-pages` branch, which GitHub Pages serves.
- The build writes `site/CNAME` (the domain `virtualleather.net`) and `site/.nojekyll`.

**One-time DNS setup** in Hostinger: hPanel → Domains → virtualleather.net → **DNS / Nameservers → DNS records**.

1. Delete the existing **A** record for `@` (it points to 34.206.176.23, a parking server) and any `AAAA` record for `@`.
2. Add these records:

| Type | Name | Points to | TTL |
|---|---|---|---|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |
| CNAME | www | guanesdaniel.github.io | 3600 |

3. In GitHub → repo **Settings → Pages**, check that the source is the `gh-pages` branch and the custom domain shows `virtualleather.net`. Once the certificate is issued, tick **Enforce HTTPS**. This can take up to an hour after the DNS change.

`site/.htaccess` is only used if the site is ever moved back to Apache/Hostinger hosting. GitHub Pages ignores it, and handles HTTPS and the 404 page itself.

## Analytics and ads

All tracking is **consent-first**. GA4 and the Meta Pixel load only after the visitor allows them in the cookie banner, and Google Consent Mode v2 defaults to *denied*. Use `?vl_debug=1` on any page to see events in the browser console.

| When | GA4 event | Meta event |
|---|---|---|
| Someone starts using the designer | `customize_product` | `CustomizeProduct` |
| Someone sees the designer, or switches apron style (once per style per visit) | `view_item` | `ViewContent` |
| A suggested design is picked, or a logo uploaded, in the designer | `select_content` (`content_type`, `content_id`, `engraving_spot`) | not sent |
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
6. To see which suggested designs and engraving spots customers use, register `engraving_spot` as an event-scoped **custom dimension** (*Admin → Custom definitions*). `content_type` and `content_id` are standard for `select_content`.

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
