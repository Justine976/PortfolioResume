# Portfolio Resume

A responsive portfolio resume website for Justine G. Odi. The design is styled like a code editor and includes dynamic GitHub projects, a downloadable resume PDF, a contact form, and a shared visitor counter powered by Cloudflare Workers.

## Features

- Responsive desktop, tablet, and mobile layout
- Code editor-inspired dark theme
- Dynamic GitHub repository cards with language, stars, forks, and live demo links
- Pinned repositories prioritized first with an amber "pinned" badge (read dynamically from the GitHub profile via the worker)
- Dynamically generated project descriptions with the full tech stack, project type, and topics
- All languages (by share of code) and topics shown as pills on every project card
- Live website screenshot on every project card (auto-generated via WordPress mShots - free, no API key), linking to the repo
- Contact form that sends messages to your Gmail
- Contact links for GitHub, LinkedIn, and Upwork
- Downloadable resume PDF (`Justine_G._Odi-resume.pdf`)
- Top-right visitor counter aligned with the resume title bar
- Visitor history dropdown with visit time, device type, browser, OS, screen size, country code, and view count
- Reloads in the same browser session increase the `views` count for that visit instead of the total visitor count
- Local visitor counter fallback when the shared API is unavailable

## Technologies

- HTML5
- CSS3
- JavaScript
- GitHub REST API
- Cloudflare Workers
- Cloudflare Durable Objects
- FormSubmit.co (free email delivery for the contact form)

## Project Structure

```txt
PortfolioResume-1/
|-- index.html
|-- style.css
|-- script.js
|-- favicon.svg
|-- Justine_G._Odi-resume.pdf
|-- README.md
`-- cloudflare-worker/
    |-- package.json
    |-- package-lock.json
    |-- wrangler.jsonc
    |-- .gitignore
    `-- src/
        `-- index.js
```

## Run Locally

Open `index.html` in a browser.

The page works without a backend. If `VISITOR_API_URL` is blank or unreachable, `script.js` uses `localStorage` and `sessionStorage` for a local-only counter.

## Shared Visitor Counter & Contact Form

The shared counter backend lives in `cloudflare-worker/`. The contact form runs entirely in the browser and delivers messages through [FormSubmit.co](https://formsubmit.co/) - free forever, with no API keys or backend needed.

`script.js` uses a FormSubmit **random-string (hashed) endpoint** instead of a plain email address, so the recipient email is not exposed in the client-side code:

```js
const CONTACT_FORM_ENDPOINT =
  "https://formsubmit.co/ajax/698bc540063c62a2c6973444d3764b30";
```

### Setup FormSubmit (Free, Lifetime)

1. No account sign-up is required.
2. `script.js` sends the form data as JSON to the FormSubmit AJAX endpoint above.
3. The **first** time someone submits the form, FormSubmit sends a one-time activation email to the linked address. Open it once and click **"Activate"** - from then on messages are forwarded to your Gmail automatically.

> If you generate a new endpoint (from a new email address), that address also needs its one-time activation click.

### Develop & Deploy the Worker

To run the worker locally:

```powershell
cd C:\Users\Justine\Documents\PortfolioResume-1\cloudflare-worker
npm.cmd install
npm.cmd run dev
```

To deploy:

```powershell
npx.cmd wrangler login
npm.cmd run deploy
```

After deployment, Cloudflare gives a URL like:

```txt
https://portfolio-visitor-counter.YOUR-SUBDOMAIN.workers.dev
```

Add that URL to `script.js`:

```js
const VISITOR_API_URL =
  "https://portfolio-visitor-counter.YOUR-SUBDOMAIN.workers.dev";
```

Do not include `/visit` or `/stats` in `VISITOR_API_URL`; the script adds those paths automatically.

Current configured API:

```js
const VISITOR_API_URL =
  "https://portfolio-visitor-counter.visitorcountapi.workers.dev";
```

## API Endpoints

```txt
GET  /stats     - Get visitor statistics
POST /visit     - Record a visit
```

### Contact Form (FormSubmit.co)

The contact form does **not** call the Cloudflare worker. `script.js` POSTs JSON directly to the FormSubmit AJAX endpoint:

```txt
POST https://formsubmit.co/ajax/<endpoint-id>
```

Request body:
```json
{
  "name": "Sender Name",
  "email": "sender@example.com",
  "subject": "Message Subject",
  "message": "Message content...",
  "_captcha": "false"
}
```

Response (success):
```json
{
  "success": "true",
  "message": "Success - your email was sent"
}
```

If the email has not completed the one-time activation, FormSubmit returns a 400 with `success: "false"` and a message telling the visitor to retry later.

`POST /visit` records a shared visit. Reloads from the same browser session increase the `views` number for that visit instead of increasing the total visitor count.

## Reset Local Counter

For the local browser fallback, open DevTools Console and run:

```js
localStorage.removeItem("justinePortfolioVisitorStats");
localStorage.removeItem("justinePortfolioActiveVisit");
sessionStorage.removeItem("justinePortfolioActiveVisit");
location.reload();
```

This only resets the counter in the current browser. The shared Cloudflare counter is stored remotely.

## Privacy Note

The site does not know a visitor's real identity unless they log in or submit information. The counter stores basic visit metadata such as device/browser/OS/screen/language details and Cloudflare's country code when available. It does not store IP addresses in the project code.

## Customization

Update personal details in `index.html`.

Change theme colors in `style.css`:

```css
:root {
  --paper: #0c0f12;
  --panel: #11161b;
  --ink: #e6edf3;
}
```

Change the GitHub username by editing the `data-username` value in `index.html`:

```html
<div class="project-list" data-github-projects data-username="Justine976"></div>
```

Pinned projects are prioritized **dynamically**. The Cloudflare Worker exposes a
`GET /pinned?username=<user>` endpoint that reads the pinned repositories from
the GitHub profile page (in pin order) and caches them for 1 hour. `script.js`
uses that list to sort pinned repositories first and show an amber
"📌 pinned" badge; all other repositories follow in last-updated order.

To change the order shown, change the pinned repositories and their order on
your GitHub profile. If the worker is unreachable, `script.js` falls back to the
static `FALLBACK_PINNED_REPOS` list:

```js
const FALLBACK_PINNED_REPOS = [
  "PayRoll",
  "OnlineLibrary-ApacheTomcat-MySQL-PHPlocal",
  "EmployeeManagementSystem",
];
```

> The `/pinned` and `/project-details` endpoints require the worker to be
> redeployed after making changes: `cd cloudflare-worker && npm.cmd run deploy`.
> Until then, the site quietly uses the fallback list and basic repo data.

### Dynamic Project Descriptions & Full Tech Stacks

The worker also exposes a `GET /project-details?username=<user>` endpoint that
collects, for every repository, the complete language breakdown (with byte
sizes), topics, description, and homepage - cached at the edge for 1 hour.

`script.js` uses that data to:

- Generate a rich project description dynamically: the GitHub description
  (when present) plus the full tech stack, a project-type guess from the
  repository name (e.g. "an employee management system", "a payroll
  processing system"), and up to four topics.
- Display **every** language used in each project as a pill (sorted by share
  of code), not just the primary language.
- Display all repository topics as green dashed pills.
- Keep stars, forks, and live-demo links in a separate stats row.

If the worker is unreachable, descriptions fall back to the primary language
from the basic GitHub API data and the listing still renders.

### Dynamic Project Screenshots

Every project card shows a preview, chosen dynamically by
`getRepoPreviewUrl()` in `script.js`:

1. If the repo has a **homepage** set on GitHub, that URL is screenshotted.
2. Otherwise, if the repo has **GitHub Pages enabled** (`has_pages` in the
   GitHub API), `https://<owner>.github.io/<repo>/` is screenshotted.
3. Otherwise (desktop/software applications with no live site), the **first
   usable image from the repo's README** is used - a committed screenshot or
   demo GIF. The worker's `/project-details` endpoint extracts it from the
   rendered README (skipping emoji and CI badges, including ones proxied
   through GitHub's camo proxy) and serves it as `previewImage`, cached at
   the edge for 1 hour. **To give a software project a preview, simply
   commit a screenshot or demo GIF to its README** - the site picks it up
   automatically within an hour.
4. As a last resort, the card falls back to GitHub's auto-generated Open
   Graph preview image.

Screenshots are rendered by [WordPress mShots]
(`https://s0.wp.com/mshots/v1/<encoded-url>?w=1280&h=640`) - a public endpoint
that is free forever, with no API key, signup, or rate limit. Notes:

- mShots caches each URL's screenshot and refreshes it automatically over time,
  so previews stay current without any maintenance.
- The **first-ever** request for a URL may briefly show a small "generating"
  placeholder while the screenshot is captured server-side; every later load
  serves the finished image.
- Images are lazy-loaded and hidden entirely if a preview URL ever fails.

Change the contact form endpoint in `script.js` (see [FormSubmit's docs](https://formsubmit.co/) for generating an endpoint for your email):

```js
const CONTACT_FORM_ENDPOINT =
  "https://formsubmit.co/ajax/<your-endpoint-id>";
```

Remember to open the new address' one-time activation email after your first test submission.

## Author

Justine G. Odi

- GitHub: [github.com/Justine976](https://github.com/Justine976)

## License

This project is open source and available under the MIT License.
