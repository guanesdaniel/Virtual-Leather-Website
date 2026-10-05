# Launch checklist

Items marked **Owner** need information only you can give. Run `npm run check` at any time to see what's still open.

## Information needed from the owner
- [ ] **GA4 Measurement ID** (your own, not your partner's) → `src/config.json` `ga4MeasurementId`. Google Analytics → Admin → Create property → Web stream → copy the "G-…".
- [x] **Meta Pixel ID**: your own pixel 298202042517671 (already connected in Ecwid) is used. Shop events come from Ecwid, designer and contact events from the website, and nothing is sent before cookie consent.
- [x] Meta Advanced Matching / Google Enhanced Conversions: **no**. The site never sends customer emails or phone numbers to Meta or Google.
- [x] **Etsy reviews**: live. The keystring and shared secret are saved as the GitHub secrets `ETSY_API_KEY` and `ETSY_SHARED_SECRET`; reviews refresh every 6 hours, and stay up if Etsy can't be reached.
- [x] **UK VAT**: left as it is in Ecwid (owner's choice). US orders have no tax.
- [x] **Legal entity and country**: sole trader, UK (England and Wales law).
- [x] **Business address**: 1 Viaduct Road, Leeds LS4 2BG, United Kingdom (`src/config.json`).
- [x] **Production time**: about 3 days after proof approval. Optional: typical **delivery times** by region, to add to the shipping page.
- [x] **Customs and duties**: the customer pays, unless agreed otherwise.
- [x] **Cancellations**: full refund any time until the approved design is engraved.
- [x] **Record retention**: as UK tax law requires (5 years after the 31 January deadline for the tax year).
- [ ] **Warranty**: the same as on Etsy. Send a screenshot of the Etsy policy so it can be copied word for word.
- [ ] **Logo**: send the logo file. A "VL" monogram and wordmark are used until then.
- [x] **Customer photos**: OK to show. The owner confirmed on 5 October 2026 that the customers shown in the gallery photos (and whose names or logos appear) are happy to be featured.

## Setup tasks
- [ ] Ecwid: check that your plan allows the store to run on your own domain. Then in *Settings → General → Store profile*, add `https://virtualleather.net/shop/` as the storefront URL so emails and SEO links point to the new site.
- [ ] Ecwid: keep its Meta pixel as it is, and **don't** turn on Ecwid's own Google Analytics (see README, "avoid double counting").
- [x] Ecwid: create the **"Extra engraving"** product ($5, no shipping, in no category) and put its product ID in `src/config.json` → `extraEngravingProductId`. Until then the designer doesn't charge for engravings beyond the 2 included (README, "Engraving price").
- [ ] Ecwid: consider making "Email for design confirmation" and "Phone Number for shipping confirmation" **optional** product options. Checkout already collects both, so customers wouldn't be asked twice (less data, faster checkout).
- [x] Hostinger DNS: point `virtualleather.net` at GitHub Pages (4 A records + `www` CNAME, see README). Then in GitHub → Settings → Pages, tick "Enforce HTTPS".
- [ ] Meta: verify the domain and confirm that test events arrive.
- [ ] Google Search Console: add `virtualleather.net` and submit `https://virtualleather.net/sitemap.xml`.
- [ ] Update the website link on Instagram, Etsy and WhatsApp Business to `https://virtualleather.net`.
- [ ] Optional: redirect the old `virtualleather.company.site` to the new domain (Ecwid → Instant Site settings).

## Already done in this build
- Cookie banner with equal Accept and Reject buttons, plus granular choices. Nothing loads before consent. Choice is re-asked after 12 months and can be changed from the footer.
- Privacy, cookie, terms, shipping/returns/refunds and accessibility pages. Business details appear in the footer.
- Forms ask only for the data the Ecwid product requires, with a clear purpose and a link to the privacy policy.
- WCAG 2.2 AA: keyboard-friendly forms, visible labels and focus, error messages in text, alt text, contrast-checked colours, skip link, reduced-motion support. An axe-core scan reports 0 violations on all pages at desktop and mobile widths.
- No fake reviews, no invented statistics. Unverifiable claims were removed from the copy.
- Images: only your own product photos. Fonts are self-hosted under the SIL Open Font License, so no Google Fonts requests.
