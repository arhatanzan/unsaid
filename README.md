# The Unsaid

A responsive, private journal built with React, TypeScript, Vite, and Tailwind CSS.

## Run

```sh
npm install
npm run dev
```

`npm run build` type-checks and creates a production build. `npm run preview` serves it locally.

## Journal

Write text, upload a JPG/PNG/WebP/GIF up to 2 MB, or attach an HTTP(S) image URL. Fragments can be bookmarked, filtered, sorted, and permanently deleted after confirmation. The initial entries are editable-by-removal examples.

Entries are persisted in this browser's local storage. They are not encrypted or synced; clearing browser data deletes them. External images load directly from their hosts, and fonts load from Google Fonts. Storage failures are displayed and preserve the current draft. Invalid existing storage is not overwritten.

The layout adapts from three columns to two to one, includes keyboard focus states and reduced-motion support, and uses CSS grain, torn-paper edges, muted image filters, and an original botanical SVG.
