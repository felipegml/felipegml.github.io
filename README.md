# felipegml.github.io

A lightweight portfolio site hosted on GitHub Pages. It is built from static files and does not require a build step.

- `index.html` is the landing page.
- `artpage.html` is a full-screen, horizontally scrolling illustration wall with an edge-to-edge image viewer.
- `artpage.css` and `artpage.js` contain the gallery styles and behavior.
- `artworks.json` lists the gallery artwork and its paired thumbnail/full-size image paths.
- `assets/art/` contains the gallery image files.
- `gamepage.html` is a directly accessible game portfolio with a finite carousel and an overlay game details panel.
- `gamepage.css`, `gamepage.js`, and `game-data.js` define the game page's styles, behavior, and content. Its banners are in `assets/game/`.

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

To update the game page, edit the entries in `game-data.js`. Each entry supplies the title, `banner` path, `bannerAlt`, `shortDescription`, and full `description`. Carousel banners use a 16:9 frame and are fitted without cropping; `bannerPosition` controls the banner's CSS `object-position` (for example, `"center center"` or `"30% center"`). `palette` supplies the background, glow, and accent colors. Keep text readable against the chosen colors.

The carousel is navigated by dragging or swiping; keyboard users can also use the arrow keys. Its edges fade and blur toward the current game. Short descriptions are displayed at a maximum of two lines. Selecting a game opens its details panel in the game's palette over the blurred carousel; it can be closed by clicking outside, using the close button, or pressing Escape. On desktop, two or three `{ src, alt }` image entries display in a single column of 16:9 frames sized to fit the viewport; the frame width adjusts to the number of images. On mobile, the images stack at full width and the details panel can scroll vertically. An empty `src` renders a white placeholder; replace it with a relative image path and meaningful alt text when screenshots are available. Put `\n` in a `description` string to create a line break; HTML such as `<br>` is displayed as text. Replace the placeholder descriptions and `playUrl` with real game information, then set `playUrlIsPlaceholder` to `false` so the Play button is no longer labeled as a placeholder. Play URLs must be absolute HTTP or HTTPS links and open in a new tab. The page loads its data directly and can also be previewed using `file://`.
