1. *Add slug availability check*
   - In `worker.js`, add a new API route `/api/business/check-slug` that checks if a slug is already taken.
   - In `onboarding-1-basic.html` and `editor-1-basic.html`, add a fetch to this new endpoint in `saveAndNext()` before proceeding to the next page.
   - If the slug is taken by another business, show an error message and block navigation.
