# felipegml.github.io

A lightweight portfolio site hosted on GitHub Pages. It is built from static files and does not require a build step.

- `index.html` is the landing page.
- `artpage.html` is a full-screen, horizontally scrolling illustration wall with an edge-to-edge image viewer.
- `artpage.css` and `artpage.js` contain the gallery styles and behavior.
- `artworks.json` lists the gallery artwork and its paired thumbnail/full-size image paths.
- `assets/art/` contains the gallery image files.

To add an illustration, place its thumbnail and full-size JPG or PNG in `assets/art/`, then add an entry to `artworks.json`:

```json
{
  "title": "Artwork title",
  "alt": "A short description of the illustration.",
  "thumb": "assets/art/artwork-thumb.jpg",
  "full": "assets/art/artwork-full.jpg"
}
```

Use the matching `.png` paths for PNG files. The current SVGs are placeholders; the browser can display JPG and PNG files without a build step. Keep paths relative to the site root so they work on GitHub Pages. Since the gallery loads `artworks.json` with `fetch`, preview the site over HTTP rather than opening `artpage.html` directly with `file://`.
