# Portfolio Resume

A responsive portfolio resume website for Justine G. Odi. The design is styled like a code editor and includes dynamic GitHub projects plus a shared visitor counter powered by Cloudflare Workers.

## Features

- Responsive desktop, tablet, and mobile layout
- Code editor-inspired dark theme
- Dynamic GitHub repository loading
- Top-right visitor counter aligned with the resume title bar
- Visitor history dropdown with visit time, device type, browser, OS, screen size, country code, and view count
- Local visitor counter fallback when the shared API is unavailable

## Technologies

- HTML5
- CSS3
- JavaScript
- GitHub REST API
- Cloudflare Workers
- Cloudflare Durable Objects

## Project Structure

```txt
portfolio-resume/
|-- index.html
|-- style.css
|-- script.js
|-- favicon.svg
|-- README.md
`-- cloudflare-worker/
    |-- package.json
    |-- package-lock.json
    |-- wrangler.jsonc
    `-- src/
        `-- index.js
```

## Run Locally

Open `index.html` in a browser.

The page works without a backend. If `VISITOR_API_URL` is blank or unreachable, `script.js` uses `localStorage` and `sessionStorage` for a local-only counter.

## Shared Visitor Counter

The shared counter backend lives in `cloudflare-worker/`.

Deploy it with PowerShell:

```powershell
cd C:\Users\Justine\Documents\PortfolioResume-1\cloudflare-worker
npm.cmd install
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

## Counter API

```txt
GET  /stats
POST /visit
```

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

The site does not know a visitor's real identity unless they log in or submit information. The counter stores basic visit metadata such as device/browser/OS/screen details and Cloudflare's country code when available. It does not store IP addresses in the project code.

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

## Author

Justine G. Odi

- GitHub: [github.com/Justine976](https://github.com/Justine976)
- Email: justineodi09@gmail.com
- Location: Vinzons, Camarines Norte, Philippines

## License

This project is open source and available under the MIT License.
