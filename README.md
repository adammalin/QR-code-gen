# QR Studio

A mobile-friendly, client-side QR code generator using the ORNL color system. It creates QR codes for websites, text, email, phone, SMS, Wi-Fi, vCards, and locations, then exports high-resolution PNG or editable SVG files.

## Local development

```bash
npm install
npm run dev
```

Production checks:

```bash
npm test
npm run build
npm run preview
```

The static site is generated in `dist/`. Vite uses relative asset paths, so the same build works at a GitHub Pages project URL.

## GitHub Pages

The included `.github/workflows/deploy-pages.yml` workflow tests, builds, and deploys the site whenever `main` is pushed. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

No QR content is sent to a server or stored in local storage. Only appearance settings are remembered in the browser.

## Brand status

This is a draft application of the ORNL visual system, not an officially approved ORNL product. It intentionally omits the ORNL logo because approved production artwork was not supplied.
