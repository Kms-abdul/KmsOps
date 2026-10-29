# KmsOps Website

Company website for KmsOps (SaaS applications, automation workflows, and tax / CA / HR / accounts / payroll services), with a built-in admin panel at **`/admin`**.

There's no database. All content lives in JSON files, and uploaded images are saved in a folder.

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
server.js            Express server and admin API
data/content.json    All website content (edited from /admin)
data/admin.json      Admin login (hashed password), created on first run
data/enquiries.json  Contact form messages
data/backups/        Automatic content backups
uploads/             Uploaded images
public/              Website, product page and admin panel (HTML/CSS/JS)
```

## Deploying to kmsops.com

You need any host that can run Node.js 18 or newer: a VPS, Render, Railway, Hostinger VPS, and so on.

1. Copy the project to the server, then run `npm install --omit=dev`.
2. Start it with `npm start` (or use `pm2 start server.js --name kmsops` to keep it running).
3. Point the domain at the server and put it behind HTTPS (Nginx/Caddy reverse proxy to port 3000). Then `kmsops.com/admin` opens the admin login.
4. **Back up the `data/` and `uploads/` folders.** They hold all your content.

> Serverless or static hosts such as Vercel and Netlify **won't work** as-is, because the site writes content and images to disk. Use a host that has a persistent disk.

The sample testimonials in `content.json` are placeholders. Replace them with real customer quotes from the admin panel.
