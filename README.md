# KmsOps Website

Company website for KmsOps (SaaS applications, automation workflows, and tax / CA / HR / accounts / payroll services), with a built-in admin panel at **`/admin`**.

There's no database. Content is stored as JSON files and images as files:
- **On Vercel:** stored in a private **Vercel Blob** store. This mode turns on automatically when `BLOB_READ_WRITE_TOKEN` is set.
- **On your PC (`npm start`):** stored in the `data/` and `uploads/` folders.

## Run it

```bash
npm install
npm start
```

- Website: http://localhost:3000
- Admin: http://localhost:3000/admin

On the first start, the server creates the admin account and prints its login in the console.
Default: `admin` / `ChangeMe@123`. **Change it under Admin → Account straight after you sign in.**
To pick your own login before the first start, set the environment variables `ADMIN_USER` and `ADMIN_PASSWORD`. To use a different port, set `PORT`.

## What the admin can change (no code edits needed)

| Section | What you can do |
|---|---|
| Site settings | Brand name, logo, announcement bar, hero text and buttons, theme colours, contact details, WhatsApp, social links, and turning whole sections on or off |
| Applications | Add a SaaS product (e.g. Kitchorea): name, category, icon, colour, features, cover image, **screenshot gallery** and demo link. Each product gets its own page at `/product/<slug>` |
| Business services | Income tax, CA, GST, accounts, payroll, HR, and so on |
| Industries / Workflows / How we work / Numbers / Testimonials / FAQs | Add, edit, reorder, hide, duplicate or delete items |
| Enquiries | Messages sent from the website contact form |
| Media library | Upload images (drag and drop), reuse them, delete them |
| Backups | Every publish saves a backup (the last 30 are kept). You can restore any of them with one click |

Changes go live when you press **Save & publish** (or Ctrl+S).

## Files

```
server.js            Express server and admin API (exported for Vercel)
storage.js           Saves data to Vercel Blob or to local files
vercel.json          Routes /admin and /product/<slug> to their pages on Vercel
data/content.json    Starting website content (used until the first publish)
public/              Website, product page and admin panel (HTML/CSS/JS)
```

Created when the site runs (in Blob on Vercel, or in these folders on your PC):
`data/admin` (admin login with hashed password), `data/enquiries`, `data/backups/`, `uploads/`. On Vercel each of `content`, `admin` and `enquiries` is a folder holding the latest few saved versions.

## Deploying to Vercel (kmsops.com)

1. **Import the GitHub repo** in Vercel. Use Root Directory `./` and Application Preset **Express**.
2. **Create the Blob store:** Vercel project → **Storage** → **Create** → **Blob**. Choose **Private** access and connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
3. **Add environment variables** (Project → Settings → Environment Variables):
   | Name | Value |
   |---|---|
   | `ADMIN_USER` | your admin username |
   | `ADMIN_PASSWORD` | a strong password (only used to create the account the first time) |
   | `SESSION_SECRET` | a long random string (e.g. 40+ random characters) |
4. **Redeploy** so the new variables take effect.
5. **Add your domain** under Project → Settings → Domains. After that, `kmsops.com/admin` opens the admin login.

Notes:
- Each image upload is limited to 4 MB on Vercel. The admin panel shrinks large photos automatically before uploading.
- Once the admin account exists, changing `ADMIN_PASSWORD` has no effect. Change the password in **Admin → Account** instead. To reset a forgotten password, delete the `data/admin/` folder from the Blob store (Storage → your store → Browse). The account is then created again from the environment variables.
- Your content, images and backups live in the Blob store, not in GitHub. You can download them from the Storage tab.

## Other hosts

Any host that runs Node.js 20+ and has a permanent disk also works with no extra setup (VPS, Render, Railway): run `npm install --omit=dev`, then `npm start`. Back up the `data/` and `uploads/` folders.

The sample testimonials in `content.json` are placeholders. Replace them with real customer quotes from the admin panel.
