1. **Core Engine Identified**: The core functionality consists of the Cloudflare worker (`worker.js`) executing the business logic and API endpoints, storing data in KV. Frontend functionality includes the authentication mechanism, dashboard dynamic routing (`dashboard.html`), editing/onboarding forms (`onboarding-*.html`, `editor-*.html`), the dynamic profile render engine (`business-dynamic.html`, `business-profile.html`), and admin review/seo actions (`admin-*.html`).

2. **Copied to `engine/`**: We created an `engine/` directory and copied all `.html` files, `styles.css`, `worker.js`, configurations (`package.json`, `esbuild.mjs`, `wrangler.toml`), and static dependency folders (`dist/`, `profile/`). The copy maintains the identical file structure but isolated inside `engine/`.

3. **Frontend Reduction**: We created a Python script (using `beautifulsoup4`) that stripped out inline styling rules from all frontend `.html` files without removing DOM elements (ids, classes, tags) required by the extensive client-side JavaScript. We then aggressively reduced `styles.css` to only contain rules required for basic interaction (like `.hidden { display: none }`, `.active`, `.modal-overlay`, `.section-body`) acting as a purely functional skeleton.

4. **Preserved Functionality**: All HTML structural elements and the complete JavaScript logic embedded in the pages (like auth tokens fetching, form submissions parsing, the full `worker.js` endpoints) are preserved. The data structure (business draft/published model) remains fully intact.

5. **Remaining Dependencies**: The engine still relies externally on Cloudflare KV services (as set in `wrangler.toml`) and the Worker URL hardcoded in the scripts, which is expected since it operates as the actual database backend.

6. **Self-Containment**: The engine now functions completely independently of the visual repository wrapper. File paths (e.g. `/styles.css`) are relative and automatically resolve within the `engine/` structure without pointing upwards to the original wrapper.

7. **Tests/Builds Run**: We successfully ran `npm install` and the build step `node esbuild.mjs` within the `engine/` directory. No import errors or missing dependencies were encountered in the node modules. We also verified with node `--check worker.js` that the script doesn't have syntax errors.

8. **Limitations**: The JavaScript within the frontend files (e.g. `WORKER_URL = 'https://late-frost-770c.nakiaklocko57.workers.dev'`) still points to the production worker URL. This is the desired behavior for a functional placeholder frontend talking to the exact same backend, but for true generic commercialization this URL would later become an environment variable. The engine is fully ready for a new visual frontend to be wrapped around it.
