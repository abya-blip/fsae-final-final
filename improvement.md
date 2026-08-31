# FSAE Website - Future Improvements & Roadmap

This document outlines technical debt, potential architectural upgrades, and UX/UI improvements for the IIPE FSAE team website. 

## 1. Architectural Upgrades

### Migrate from Base64 to Firebase Storage
**Current State:** Images (blog posts, team roster, gallery) are compressed client-side and stored directly as Base64 strings inside Firestore documents.
**The Problem:** Firestore has a 1MB limit per document. Large base64 strings inflate document sizes, which increases payload size over the network and slows down queries. 
**Solution:** 
- Set up **Firebase Cloud Storage**.
- When an admin uploads an image, upload the `Blob`/`File` to Firebase Storage.
- Save only the resulting `downloadURL` string in the Firestore document.

### Implement a Build Tool (e.g., Vite)
**Current State:** The site uses native ES Modules without a build step. `script.js` handles massive amounts of logic (over 1000 lines).
**The Problem:** Hard to manage, no minification for production, and prevents the use of `.env` files for configuration.
**Solution:**
- Initialize the project with [Vite](https://vitejs.dev/).
- Break `script.js` into smaller modular files (e.g., `auth.js`, `ui-animations.js`, `api/team.js`).
- Benefit from fast Hot Module Replacement (HMR) during local development and optimized/minified assets for production deployment.

---

## 2. SEO & Performance

### Static Generation for SEO
**Current State:** Dynamic content like the team roster, blog, and gallery are rendered entirely client-side via JavaScript.
**The Problem:** Search engine crawlers (like Googlebot) may not execute the JavaScript reliably, meaning they will only see the empty container `div`s, hurting search rankings.
**Solution:**
- Add meta tags (`og:title`, `og:description`, `og:image`) to `index.html` for better link previews on WhatsApp, LinkedIn, and Discord.
- *Long-term:* Consider migrating to a framework like **Next.js** or **Astro** to statically pre-render (SSG) the HTML for the blog and team pages while keeping Firebase for dynamic client-side updates.

### Lazy Loading Enhancements
- Ensure all images have `loading="lazy"` (currently used in the gallery, but should be verified for team avatars and blog images).
- Use `content-visibility: auto` in CSS for sections further down the page to improve rendering performance.

---

## 3. UI / UX Enhancements

### Better Form Validation & Feedback
- Add visual indicators for password strength and email formatting on the login/apply forms.
- Implement rate-limiting or reCAPTCHA on the public recruitment application form to prevent spam bots from submitting fake applications.

### Accessibility (a11y)
- Ensure all interactive elements (like the Swiper carousel and GSAP magnetic buttons) are fully keyboard navigable.
- Add `aria-labels` to icon-only buttons (like the `lucide` trash or edit icons) so screen readers can interpret them correctly.
- Verify color contrast ratios between the text and the frosted glass / dark backgrounds.

---

## 4. Security

### Firestore Rules Hardening
*Note: A baseline validation has been added to `firestore.rules`.*
- **Action Item:** As the app grows, consider implementing **Firebase Custom Claims** to officially designate "Admin" users, rather than relying solely on the presence of a user's `uid` in the `team` collection or hardcoded domains. This ensures that even if someone registers via the REST API, they won't have admin access without an explicit role grant.
