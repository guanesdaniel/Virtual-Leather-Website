# virtualleather.net

The Virtual Leather website: a fast, hand-coded static site with the existing **Ecwid** store (ID `97299801`) embedded for cart and checkout. It needs no paid website builder. It's hosted free on GitHub Pages; the domain is registered at Hostinger.

## What's in it

| Page | Purpose |
|---|---|
| `/` | Home, laid out like marketcenterco.com: hero → gift ideas → **live apron designer** → customer gallery → products → reviews (from Etsy, shown on the site) → how to order → business orders → FAQ |
| `/shop/` | Full Ecwid storefront (all products, cart, checkout, customer account) |
| `/about/` | Story |
| `/shipping-returns/`, `/terms/`, `/privacy/`, `/cookies/`, `/accessibility/` | Policies |

**The apron designer** (`site/assets/js/designer.js`) shows a live preview and puts the apron straight into the Ecwid cart. It uses the store's exact product options (Main Color, Secondary Color, Customer Height and Weight, Description For Personalization, Email, Phone) and adds the Wings and Bottle Opener extras. If the cart can't load (for example because of an ad blocker), the customer gets a WhatsApp message with their design already written in.

## Editing

Everything you'd normally change is in **`src/`**:

- `src/config.json`: business details, WhatsApp, email, **GA4 and Meta Pixel IDs**, Etsy links.
- `src/data/products.json`: product cards (name, price, summary). Prices must match Ecwid.
- `src/data/reviews.json`: Etsy reviews shown on the homepage. Filled in automatically from Etsy (see below); don't edit by hand.

### Etsy reviews on the site (automatic)
The homepage shows your most recent written Etsy reviews (any rating, in the customers' own words) and your Etsy star average and review count. They're fetched through Etsy's official API, so customers read them here and are never sent to Etsy. Until reviews are available, the Reviews section and its menu link stay hidden.

One-time setup (about 10 minutes, free):
1. Signed in to your Etsy shop account, open **https://www.etsy.com/developers/register** and create an app. Name: "Virtual Leather website". Purpose: show my shop's reviews on my own website.
2. Once the app is active, open **Your apps** and copy its **Keystring** and **Shared secret**.
3. On GitHub, go to the repository → **Settings → Secrets and variables → Actions → New repository secret**. Name: `ETSY_API_KEY`. Value: the keystring and the shared secret joined by a colon, `keystring:sharedsecret`. Don't paste the key anywhere else (not in chat, email or code).
4. Go to **Actions → Build and deploy → Run workflow**. Reviews then refresh automatically every 6 hours.

To test locally: `ETSY_API_KEY=keystring:sharedsecret npm run reviews && npm run build`. The page shows Etsy's required notice: "This application uses the Etsy API but is not endorsed or certified by Etsy, Inc."

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

### One way to order an apron
Aprons that the designer makes (the products with a `"designer"` style in `src/data/products.json`) are ordered only through the designer. Their homepage cards open it, and the shop's own page for them (`/shop/#!/p/<id>`, including links from inside the shop) redirects to `/?style=<style>#design` with that apron chosen. Under the preview, the designer shows that apron's description and real photos from its Ecwid listing (`src/data/gallery.json`; run `npm run images` after changing it). Logo files can't travel with the cart, so when a design uses a logo, "Added to your cart" asks the customer to send the file on WhatsApp or by email. Other products (bags, knife rolls, extras, and the patterned BBQ apron) still open in the shop. Business, team and multi-apron orders, and any offers, are agreed directly on WhatsApp or by email (the "Business orders" section and the FAQ say so).

### Apron designer: engraving spots and suggested designs

The designer (`site/assets/js/designer.js`) builds step 4 spot by spot from `SLOT_PLANS`: which choices each spot offers (text, suggested designs, the customer's logo, none) and which it starts on. The BBQ apron has the full set; other styles get text or a logo until they're rolled out.

The suggested-design library is the `DESIGNS` list in the same file. Each design is artwork plus the text the customer fills in (for example the name and year on "Grill Master"), drawn live in the lettering they pick. To add one, send the artwork (SVG, or a high-resolution PNG on a plain background) and say which spots it belongs in and which words customers can change. Artwork from an image is traced into vector shapes by `npm run designs` (`tools/trace-designs.mjs`, source files in `tools/design-src/`): it blanks out the changeable words and writes `site/assets/js/design-art.js`.

### Changing a design after adding it to the cart
The designer remembers each design on the customer's own device (browser storage; see the cookie policy), so nobody has to start again:
- **Unfinished design:** reopening the page brings it back, with a "Start again" button.
- **In the cart:** "Added to your cart" offers **Change this design**. The designer and the shop page (above the cart) link back to each apron in the cart.
- **Saving a change:** the button reads "Update my apron in the cart". It takes that apron and the extras added with it out of the cart and puts the updated ones in, so there are no duplicates.

Each design gets a reference (for example `VL-7K2P`) at the end of its order description and in the "send your logo" message, so a logo file can be matched to its order. Saved designs are dropped once the apron leaves the cart, cleared when an order is placed, and deleted after 30 days. The code is `VL.saved` in `main.js` and the "Saved designs" part of `designer.js`.

### Apron sizes
The designer works out the size we'll cut from the wearer's height and weight, using the workshop's production patterns (`PATTERNS` in `designer.js`; the same for every apron style). It accepts centimetres, metres, feet and inches, kilos, pounds and stone.
- **S, up to 1.69 m:** 55.4 cm wide, 70 to 74 cm long.
- **Normal, 1.70 to 1.75 m:** 56 × 76 cm.
- **X, from 1.76 m:** 56 cm wide, 77 to 90 cm long.
- **BMI of 30 or more:** the wider "OB" version of the pattern, 60 cm wide. Letter M up to 1.79 m, X from 1.80 m.
- **In-between heights:** the nearest pattern, or the longer one when exactly halfway.

Step 5 and the summary show the size to the customer, without mentioning BMI. The order description adds "Size guide: 56 x 81 cm (pattern 1.80 X)" for the workshop, and the WhatsApp message includes it too.

### Engraving price
Each apron includes 2 engravings, and the chest (spots 1 and 2) counts as one. Each extra spot is $5, whatever is on it (text, a suggested design or a logo). The designer counts the spots in use, shows "Included" or "+$5" beside each one, adds the extras to the total and puts that many **Extra engraving** items in the cart (one Ecwid product at $5).

The Extra Engraving can't be bought on its own: its shop page opens the designer, its tile is hidden in the shop, and it's taken out of any cart that has no apron in it (`main.js`).

This switches on once `extraEngravingProductId` in `src/config.json` holds that Ecwid product's ID; until then, extra spots aren't charged and the site keeps saying "engraving included". To change the price, change it in Ecwid, in `ENGRAVING_PRICE` in `site/assets/js/designer.js`, and in the "$5" texts in `src/pages/index.html`.

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

**Who sends what to Meta.** The Meta pixel is **298202042517671**, the owner's own pixel, which is also connected in Ecwid (*Settings → General → Tracking & Analytics*). Ecwid's copy sends the shop's events: product views in the shop, add to cart (the designer's too), checkout and purchase, with Ecwid's own event IDs. The website (`analytics.js`) sends what only it sees: page views, `CustomizeProduct`, the apron viewed in the designer, and `Contact`. If Ecwid's pixel is ever removed, the website sends the shop events itself, so nothing is counted twice and nothing is lost.

**Before consent, nothing reaches Meta.** The website creates the pixel's command queue but downloads Meta's code only after the visitor allows marketing cookies. Ecwid sees the queue and doesn't download it either.

**What Meta and Google never get.** No customer names, emails or phone numbers. Meta Advanced Matching and Google Enhanced Conversions are **off** (the owner's decision, the same as on marketcenterco.com):
- Meta's automatic events, which read buttons and forms, are switched off.
- The customer email and phone Ecwid would attach to the pixel are removed before they reach Meta.
- Addresses carrying a private key (for example a sign-in or order link from an Ecwid email) never go to Meta.
- Google gets each address without its `#…` part and without a design reference.

**Use your own GA4 property and Meta Pixel, never your partner's**, or the two shops' figures get mixed.

### Set up Google Analytics 4
1. At analytics.google.com, go to **Admin → Create → Property**. Call it "Virtual Leather", and set the time zone and the currency (**USD**).
2. Add a **Web** data stream for `https://virtualleather.net` and copy the **Measurement ID** (`G-XXXXXXX`). Leave "user-provided data collection" off.
3. Put it in `src/config.json` → `ga4MeasurementId`, then rebuild.
4. In GA4 → *Admin → Events*, mark `purchase` and `generate_lead` as **key events**.
5. Optional: link Google Ads and Search Console in GA4 → *Admin → Product links*.
6. To see which suggested designs and engraving spots customers use, register `engraving_spot` as an event-scoped **custom dimension** (*Admin → Custom definitions*). `content_type` and `content_id` are standard for `select_content`.

### Set up the Meta Pixel and ads
1. The pixel is already set: `src/config.json` → `metaPixelId` is the owner's own pixel (the one Ecwid uses). Optional extra safety: in Meta **Events Manager**, open the pixel's **Settings** and turn **Automatic advanced matching** off. The website already stops it from reading forms.
2. In **Business Settings → Brand safety → Domains**, add and **verify** `virtualleather.net`. The DNS TXT method in Hostinger's DNS zone editor is the easiest.
3. In Events Manager, check that `Purchase`, `AddToCart`, `InitiateCheckout`, `ViewContent` and `Contact` arrive. Use the *Test events* tab.
4. Optimise purchase campaigns for **Purchase**. While purchase volume is still low, optimise for **AddToCart** or **Contact** (WhatsApp).
5. **Conversions API (CAPI).** Browser events already carry an `eventID`. When you add server-side events (for example Meta's "Conversions API Gateway" or a small server function), send the same IDs so Meta de-duplicates them.

### Important: avoid double counting
- **Meta:** keep Ecwid's Meta pixel as it is; the website works with it (see "Who sends what to Meta" above). Don't add the pixel a second way, for example as custom code in Ecwid.
- **Google:** **don't** turn on Ecwid's own Google Analytics. The website sends GA4 with the visitor's cookie choice; Ecwid's would count everything twice and skip the cookie banner.

## Before launch
See [`LAUNCH-CHECKLIST.md`](LAUNCH-CHECKLIST.md). `npm run check` lists every open item.
