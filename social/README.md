# Automatic Instagram and Facebook posts

Posts and Stories are queued in `social/queue.json`, with their images in `site/social/`. Every 30 minutes the **Social posts** workflow (`.github/workflows/social.yml`) posts whatever is due to Instagram and the Facebook Page, through Meta's official API, and records it in `social/posted.json` so nothing goes out twice.

## How a week works

1. Each Monday Claude opens a pull request with the week's images and captions (queue items with their dates and times).
2. You look at the pull request and say "merge" (or ask for changes). **Merging is the approval:** nothing posts until it's merged.
3. The website deploys the images, and each post goes out at its time.

Limits: Stories can't have link stickers or text added through the API, so the link is written on the image (virtualleather.net/story is the tracked link). A post more than 12 hours late (say the workflow was off) is skipped, not posted late. Instagram allows 50 API posts a day.

## One-time setup (about 20 minutes)

You need: Instagram as a **Business** account linked to your **Facebook Page**, and a **Meta Business portfolio** (business.facebook.com) that owns the Page.

1. **Instagram → Business and linked.** In the Instagram app: Settings → Account type and tools → Switch to professional account → Business. Then on Facebook, open your Page → Settings → Linked accounts → Instagram → Connect.
2. **Create a Meta app.** Go to **developers.facebook.com → My Apps → Create app**. Name it "Virtual Leather posting". For the use case pick **Other**, then the app type **Business**, and connect it to your business portfolio. Then add the **Instagram** product (API setup with Facebook login).
3. **Make a system user.** Go to **business.facebook.com → Settings → Users → System users → Add**. Name it "Website poster" and give it the **Admin** role.
4. **Give it your assets.** On that system user, click **Assign assets**. Give it your **Page** (full control/everything), your **Instagram account** (full control) and the **app** ("Virtual Leather posting", full control).
5. **Generate the token.** Still on the system user, click **Generate new token**. Choose the app, set expiry to **Never**, and tick: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`. Copy the token.
6. **Put it in GitHub.** Open the repository → **Settings → Secrets and variables → Actions → New repository secret**. Name: `META_ACCESS_TOKEN`, value: the token. Don't paste it anywhere else (not in chat, email or code).
7. **Test it.** Go to **Actions → Social posts → Run workflow**, keep mode **check**, then run it. The log should show your Page name, your @Instagram username and "Instagram publishing works". If it lists several Pages, add a second secret `META_PAGE_ID` with the right Page's number.

If the check says a permission is missing, generate the token again with all the permissions above ticked and replace the secret.

## Queue format

```json
[
  { "id": "2026-11-23-duffle-story", "when": "2026-11-23T18:00:00Z", "kind": "story",
    "image": "social/2026-11-23-duffle-story.png", "platforms": ["instagram", "facebook"] },
  { "id": "2026-11-24-bbq-post", "when": "2026-11-24T18:00:00Z", "kind": "post",
    "image": "social/2026-11-24-bbq-post.jpg", "caption": "Engraved with his name…" }
]
```

`when` is UTC (London time in winter). `platforms` defaults to both. Stories are 1080×1920; posts 1080×1350 JPEG or PNG.

Run by hand: **Actions → Social posts → Run workflow** with **dry-run** (shows what would post) or **post** (posts what's due now). Locally: `npm run social -- --dry-run`.
