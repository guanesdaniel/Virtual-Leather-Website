# Launch checklist

Items marked **Owner** need information only you can give. Run `npm run check` at any time to see what's still open.

## Information needed from the owner
- [ ] **GA4 Measurement ID** → `src/config.json` `ga4MeasurementId`
- [ ] **Meta Pixel ID** → `src/config.json` `metaPixelId`
- [ ] **Etsy reviews**: copy 6–10 genuine reviews (exact text, first name or initial, stars, date, item) and the shop's overall rating and review count into `src/data/reviews.json`. Etsy blocks automated copying, so this has to be done by hand. Only real reviews, word for word.
- [ ] **Legal entity and country** (for example a UK sole trader or company). This decides which law the Terms, Privacy and Refund policies cite.
- [ ] **Business address** (and company and VAT number, if any) → `src/config.json`. UK and EU distance-selling rules require a geographic address on the site.
- [ ] **Production time** after proof approval and **delivery times** by region.
- [ ] **Customs and duties**: who pays outside the 2-apron bundle?
- [ ] **Cancellations**: can an order be cancelled for a full refund before the proof is approved?
- [ ] **Record retention period** for orders (for example 6 years in the UK).
- [ ] **Warranty**: do you offer one (your partner offers 1 year)? If yes, it can be added as a selling point.
- [ ] **Logo**: send the logo file. A "VL" monogram and wordmark are used until then.
- [ ] Is it OK to show the customer photos in the gallery? They come from your Ecwid listings, so they're your own photos. Confirm that the customers shown (or whose names or logos appear) are happy to be featured.

## Setup tasks
- [ ] Ecwid: check that your plan allows the store to run on your own domain. Then in *Settings → General → Store profile*, add `https://virtualleather.net/shop/` as the storefront URL so emails and SEO links point to the new site.
- [ ] Ecwid: keep Ecwid's own GA and Facebook Pixel integrations **off** (see README).
- [ ] Ecwid: consider making "Email for design confirmation" and "Phone Number for shipping confirmation" **optional** product options. Checkout already collects both, so customers wouldn't be asked twice (less data, faster checkout).
- [ ] Hostinger: SSL on, then FTP secrets added to GitHub (see README), then merge to `main`.
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
