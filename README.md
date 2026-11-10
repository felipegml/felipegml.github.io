# felipegml.github.io

A lightweight portfolio site hosted on GitHub Pages. It is built from static files and does not require a build step.

- `index.html` is the landing page.
- `artpage.html` is a full-screen, horizontally scrolling illustration wall with an edge-to-edge image viewer.
- `artpage.css` and `artpage.js` contain the gallery styles and behavior.
- `artworks.json` lists the gallery artwork and its paired thumbnail/full-size image paths.
- `assets/art/` contains the gallery image files.
- `signature-data.js` embeds the signature shared by the illustration viewer and the book gallery; it avoids a separate image request, but the embedded image can still be extracted.
- `artpagensfw.html` is a directly accessible book-style art gallery, with its own `artpagensfw.css`, `artpagensfw.js`, `artworks-nsfw.json` manifest, and `artworks-nsfw-data.js` local test data.
- `gamepage.html` is a directly accessible game portfolio with a finite carousel and an overlay game details panel.
- `gamepage.css`, `gamepage.js`, and `game-data.js` define the game page's styles, behavior, and content. Its banners are in `assets/game/`.
- `main_music.html` is a directly accessible audio-reactive network; `main_music.css` and `main_music.js` provide its styling and behavior.
- `main_placeholder.html` is a separate interactive portfolio example over a network background; it does not replace the landing page. Games displays the shared `game-data.js` carousel and details using `gamepage.js`, and its current game's glow color changes the network lights. Art links to `artpage.html`; AR and VR have project views, and Prototype opens a placeholder section. In-page section changes keep the background running and support browser back/forward and section hash links. Edit the introduction, skills, and links in `main_placeholder.html` and section labels in `portfolio_navigation.js` to update the content. A non-intercepted Games link opens the standalone `gamepage.html`; project links open `portfolio_placeholder.html`.

AR and VR descriptions and YouTube links are configured in `portfolio_projects.js`. Set each `videoUrl` to a YouTube watch, short, or embed link to display its thumbnail and playback controls. The player uses YouTube's privacy-enhanced embed and is unloaded when leaving a project section. Preview `main_placeholder.html` over HTTP (for example, run `python -m http.server 8000` in the site directory and open `http://localhost:8000/main_placeholder.html`); YouTube requires an HTTP referrer for embedded playback. When opened directly as a local file, the thumbnail links to the video on YouTube instead.

Text selection is disabled in the interactive portfolio example, including its games section. This is a presentation choice, not protection against copying.

The social profile list in `main_placeholder.html` links to GitHub and itch.io. LinkedIn, ArtStation, and Instagram are non-interactive until their profile URLs are supplied; replace their placeholder spans with links when available.

Open `main_music.html` over HTTPS or localhost in a browser that supports screen sharing with audio. Select **Share audio**, choose a tab or screen, and enable audio sharing in the browser's picker. The available tab and system-audio options depend on the browser and operating system; some sources may not offer audio. Audio is analyzed locally and is not played back by the page. Use **Stop sharing** or the browser's sharing controls to end capture. If reduced motion is enabled, the network remains still.

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

The book gallery is available directly at `artpagensfw.html` and is not linked from the home page. Edit `artworks-nsfw.json` to replace its non-explicit placeholders with the desired artwork. Its top-level array contains themes in book order, each with a non-empty `title` and `artworks` array. Every artwork needs non-empty `title`, `alt`, `description`, `thumb`, and `full` strings; paths must be relative to the site root. The contents page links to the first artwork in each theme. Artwork order within each theme determines the order in the book, grid, and viewer.

The published page fetches this separate manifest. Local loopback and `file://` previews instead use `artworks-nsfw-data.js`; update that file too when testing changes locally. Keep both data files in sync. For example:

```json
[
  {
    "title": "Political",
    "artworks": [
      {
        "title": "Artwork title",
        "alt": "A short description of the illustration.",
        "description": "A description for the book.",
        "thumb": "assets/art/artwork-thumb.jpg",
        "full": "assets/art/artwork-full.jpg"
      }
    ]
  }
]
```

Drag or swipe the book, or use the arrows or keyboard arrow keys to turn between the front cover, contents, artwork spreads, and back cover. Use the contents button beside the arrows to return to the theme index; select a theme to jump to its first artwork. Select an image to open its full-size viewer; use its arrows to browse, and close with Escape, the close button, or the backdrop. The top-right toggle switches between the book and a two-row grid, which supports scrolling, dragging, and touch. Text selection and the context menu are disabled on this page, but these do not prevent copying or downloading content. On narrow portrait screens the gallery asks for landscape orientation. This prompt does not provide age verification or restrict access to the page or image files.

To update the game page, edit the entries in `game-data.js`. Each entry supplies the title, `banner` path, `bannerAlt`, `shortDescription`, and full `description`. Carousel banners use a 16:9 frame and are fitted without cropping; `bannerPosition` controls the banner's CSS `object-position` (for example, `"center center"` or `"30% center"`). `palette` supplies the background, glow, and accent colors. Keep text readable against the chosen colors.

The carousel is navigated by dragging or swiping; keyboard users can also use the arrow keys. Its edges fade and blur toward the current game. Short descriptions are displayed at a maximum of two lines. Selecting a game opens its details panel in the game's palette over the blurred carousel; it can be closed by clicking outside, using the close button, or pressing Escape. On desktop, two or three `{ src, alt }` image entries display in a single column of 16:9 frames sized to fit the viewport; the frame width adjusts to the number of images. On mobile, the images stack at full width and the details panel can scroll vertically. An empty `src` renders a white placeholder; replace it with a relative image path and meaningful alt text when screenshots are available. Put `\n` in a `description` string to create a line break; HTML such as `<br>` is displayed as text. Replace the placeholder descriptions and `playUrl` with real game information, then set `playUrlIsPlaceholder` to `false` so the Play button is no longer labeled as a placeholder. Play URLs must be absolute HTTP or HTTPS links and open in a new tab. The page loads its data directly and can also be previewed using `file://`.
