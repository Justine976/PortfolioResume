# Portfolio Resume

A responsive portfolio resume website for Justine G. Odi. The design is styled like a code editor and includes dynamic GitHub projects, a downloadable resume PDF, a contact form, and a shared visitor counter powered by Cloudflare Workers.

## Features

- Responsive desktop, tablet, and mobile layout
- Code editor-inspired dark theme
- Dynamic GitHub repository cards with language, stars, forks, and live demo links
- Pinned repositories prioritized first with an amber "pinned" badge
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

Prioritize pinned projects in the project listing by editing the `PINNED_REPOS`
list in `script.js`. Repositories listed here are shown first (in the given
order) and get an amber "📌 pinned" badge; all other repositories follow in
last-updated order. Keep this list in sync with the pinned repositories on the
GitHub profile:

```js
const PINNED_REPOS = [
  "EmployeeManagementSystem",
  "OnlineLibrary-ApacheTomcat-MySQL-PHPlocal",
  "PayRoll",
];
```

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
