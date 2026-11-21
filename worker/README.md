# Order Worker: website orders to MarketCenter

Sends paid orders from the Ecwid store to Juan Miguel's MarketCenter portal
(`POST https://marketcenterco.com/api/distribuidor/pedido-web`), as his brief "para el Claude de Guanes" (v2,
17 Nov 2026, part 2) describes, and since his "pedido-web v2" (19 Nov 2026) knife rolls, backpacks, duffle bags and
loose extras too. Free Cloudflare Workers plan. Code: `src/index.js`.

How it works:
1. When a customer adds a designed apron to the cart, the designer (`site/assets/js/designer.js`, `mcApron`) sends the
   design to `POST /design`: every engraving in mm on the standard 56 x 77 cm apron (`h`, `w`, `x` from the centre
   line, `down` from the top of the bib, `font` for text), the extras, colours, height and weight, the order
   description, the design picture, and each logo cut to its ink (uploaded to Cloudinary). It's kept 30 days under
   the design ref (VL-XXXX).
   The knife roll, backpack and duffle designer (`site/assets/js/product-designer.js`, `mcItem`) does the same for its
   product (`mc` in `designs/*.js`: `estuche`, `maletin-14`, `maleta-mediana`): leathers, the knife roll's size, and
   each engraving's box in mm (`h`, `w`, `font` for text), centred on its place. The Worker turns the places into
   MarketCenter's spots (`ITEM_SPOTS`, confirmed by Juan Miguel 21 Nov 2026: knife roll `outside` (centre of the
   outside) / `inside` (centre of the inside flap); backpack piece `1` front, `2` front pocket; duffle `1` side, `2`
   round end). A design idea
   (Best Dad Ever...) goes as a logo: a black PNG of it, uploaded to Cloudinary.
2. When a customer finishes checkout, Ecwid tells the shop page the order was placed (`Ecwid.OnOrderPlaced`, on every
   Ecwid plan, Starter included: no Ecwid API or app needed). The page (`site/assets/js/main.js`, `sendPlacedOrder`)
   sends `POST /order`: the order number, payment status, shipping address, and for each designed apron its ref,
   this device's key for that ref, quantity, height and weight, plus the apron extras in the cart (bottle opener,
   wings, grease: Ecwid ids in `EXTRA_IDS`) with colour and quantity. Only designs made on the same device are kept.
   Extras that came with a designed apron are already in that apron; the rest go as loose `extras`. An order of
   extras only isn't sent ("extras-only" on the owner's page): they're only sold with an apron, so it's an add-on to
   an earlier apron order, and the owner asks Juan Miguel to add them to it.
   A paid order (Ecwid says **ACCEPTED** or **PAID**) goes to MarketCenter at once (4 aprons per call; a 5th goes as `<order>-2`); any other is kept
   and shows as "held" on the owner's page, to send from there. Knife rolls, bags and loose extras go too (format v2,
   one order with the aprons) once `V2_LIVE = "1"`; until then they're entered by hand, and each paid order that has
   them is also checked as v2 (a dry run, "v2-check" on the owner's page). If the customer closes the page before Ecwid's thank-you step,
   the order doesn't arrive: enter it by hand too.
   Orders go in with `clientApproved: false`: they wait in the portal until the owner ticks the client's "yes",
   after the customer has approved the design proof.
3. If MarketCenter is busy or rate-limited, the order is retried every 15 minutes (up to 20 times). It never enters
   twice: MarketCenter files each apron by shop + order + place, and the Worker remembers what it sent.

While `DRY_RUN = "1"` (in `wrangler.toml`), MarketCenter only checks each order and creates nothing.

## Owner's page

`https://vl-orders.<your-subdomain>.workers.dev/admin?key=<ADMIN_KEY>`
- no other parameter: the latest 20 events (sent, dry runs, errors) and the orders waiting to be retried;
- `&send=<Ecwid order number>`: tests that order now (dry run, knife rolls, bags and loose extras included) and shows
  MarketCenter's reply; add `&live=1` to really send it (for a "held" order too, once you've checked it was paid). An
  order already sent isn't sent again unless you add `&again=1`; `&v=1` leaves out everything but the aprons;
- `&ref=VL-XXXX`: the design saved for that ref.

## Setup (once)

1. **Cloudflare**: free account. Workers & Pages > KV > Create namespace `vl-orders`; put its id in `wrangler.toml`.
2. **GitHub secrets** (repo > Settings > Secrets and variables > Actions): `CLOUDFLARE_API_TOKEN` (Cloudflare > My
   Profile > API Tokens > Create Token > template "Edit Cloudflare Workers") and `CLOUDFLARE_ACCOUNT_ID`
   (Workers & Pages overview, right-hand side). Then Actions > Deploy order Worker > Run workflow.
3. **Worker secrets** (Cloudflare > Workers & Pages > vl-orders > Settings > Variables and Secrets, type Secret):
   `MC_STORE_KEY` (the store key from Juan Miguel, not the portal password) and `ADMIN_KEY` (any long password you
   make up, for the owner's page).
4. **Website**: set `"orderWorker": "https://vl-orders.<subdomain>.workers.dev"` in `src/config.json`.
5. **Test**: place a test order on the website, then open the owner's page: the dry run shows what MarketCenter
   would create. When it's right, set `DRY_RUN = "0"` and send one real test order, which MarketCenter marks "No aprobar".

Later (when MarketCenter says it's ready): Etsy/WhatsApp orders from a private "Guanes mode" (`shop: "etsy"` or
`"manual"`), and orders without the height yet. Not built.
