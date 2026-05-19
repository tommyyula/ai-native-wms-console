# AI Native WMS Console

Image-to-code rebuild of the inventory, inbound, and outbound WMS screens using the WMS 3.0 and IAM ontology structure available through `ontologyExtractor`.

## What is included

- IAM-gated runtime with demo and Production API modes.
- Tenant and warehouse selection before entering the workspace.
- Inventory, inbound, and outbound pages based on the supplied screenshots.
- Multilingual UI: Chinese, English, and Japanese.
- Clickable controls for filtering, date buckets, status editing, creation, import, export, detail drawers, API settings, and sync.
- WMS API adapter that sends `Authorization`, `X-Tenant-Id`, `X-Warehouse-Id`, and `X-Locale` headers when API URLs are configured.

## Production API configuration

Set these variables at build time, or configure them at runtime from the Settings dialog:

```bash
VITE_IAM_BASE_URL=https://iam.example.com/api/v1
VITE_WMS_API_BASE_URL=https://wms.example.com/api/v1
```

If either URL is missing, the app runs through the demo adapter so the public GitHub Pages deployment remains fully usable.

## Development

```bash
npm install
npm run dev
npm run build
```
