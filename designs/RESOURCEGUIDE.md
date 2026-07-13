# Writing Guides - Markdown Authoring Reference

This is the complete reference for writing resource/guide content in the Iron Foundry
web app. Everything below is supported by the in-app Markdown renderer
Write guides in the editor's left pane; the right pane shows a live preview.

The renderer is GitHub-flavored Markdown **plus raw HTML** and a set of custom
shortcodes for callouts, media, cross-references, wiki hover-cards, and RuneLite object
embeds. Anything standard Markdown can do, you can do - this guide focuses on that plus
the Foundry-specific extras.

---

## 1. The editor toolbar

The editor toolbar gives you one-click access to most features:

| Button | Action |
|---|---|
| Bold / Italic / Strikethrough | Wrap the selection (`**`, `*`, `~~`) |
| Inline code / Code block | Wrap selection in `` ` `` or a fenced block |
| H2 / H3 | Prefix the line with `##` / `###` |
| Blockquote | Prefix the line with `>` |
| Assets | Insert an uploaded image or video from the asset library |
| Embed | Paste a YouTube or video URL to embed it |
| Reference | Insert a cross-reference to another guide/plugin/staff page |
| RuneLite | Browse stored RuneLite objects and insert an embed (with optional glow) |
| TOC | Insert a table-of-contents anchor |
| Strip whitespace | Trim leading/trailing spaces on every line |
| Undo / Redo | History (also `Ctrl+Z` / `Ctrl+Shift+Z`) |

**Keyboard shortcuts:** `Ctrl+B` bold, `Ctrl+I` italic, `Ctrl+Z` undo,
`Ctrl+Shift+Z` or `Ctrl+Y` redo, `Tab` inserts four spaces.

---

## 2. Basic formatting

### Headings

```
# Heading 1
## Heading 2
### Heading 3
#### Heading 4
```

Every heading automatically gets an anchor ID derived from its text (for example
`## Getting Started` becomes `getting-started`). You can link to a section using that ID
(see cross-references below).

**Renders as:** bold headings that shrink from H1 to H4, each with its own clickable anchor. (Live heading examples are left out here so they do not show up in this page's own contents sidebar.)

### Emphasis

```
**bold**   *italic*   ~~strikethrough~~   `inline code`
```

**Renders as:** **bold**, *italic*, ~~strikethrough~~, and `inline code`.

### Lists

```
- Bullet item
- Another item
  - Nested item

1. Numbered item
2. Second item
```

**Renders as:**

- Bullet item
- Another item
  - Nested item

1. Numbered item
2. Second item

### Links

```
[Link text](https://example.com)
```

Links open in a new tab. (Links to the OSRS Wiki get a hover-card automatically - see
section 7.)

**Renders as:** [Link text](https://example.com)

### Blockquotes

```
> A quoted line.
```

**Renders as:**

> A quoted line.

### Tables

```
| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |
```

**Renders as:**

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   | Cell 4   |

### Code blocks

Fence code with triple backticks:

    ```
    your code here
    ```

**Renders as:** a monospaced, scrollable code block (exactly like the samples throughout this guide).

### Horizontal rule and keyboard keys

```
---

Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.
```

**Renders as:**

---

Press <kbd>Ctrl</kbd> + <kbd>C</kbd> to copy.

Raw HTML is allowed, so `<kbd>`, `<sup>`, `<sub>`, and similar inline tags work.

---

## 3. Callouts

Callouts are highlighted boxes for tips, warnings, and info. Write them as a raw HTML
`div` with the matching class:

```
<div class="callout-tip">Handy advice goes here.</div>

<div class="callout-warning">Careful - this can go wrong.</div>

<div class="callout-info">Background information worth knowing.</div>
```

**Renders as:**

<div class="callout-tip">Handy advice goes here.</div>

<div class="callout-warning">Careful - this can go wrong.</div>

<div class="callout-info">Background information worth knowing.</div>

Keep the opening tag, content, and closing tag close together (a blank line directly
inside the `div` can break it).

---

## 4. Table of contents

Drop a TOC anchor to add an entry to the page's table of contents and give it a scroll
target:

```
[toc]{indent=1,title=Section Title,hidden=false}
```

- `indent` - nesting level, 1 to 3.
- `title` - the label shown in the TOC (also becomes the scroll anchor).
- `hidden` - `true` to register the anchor without rendering a visible heading.

**Renders as:** an invisible scroll anchor plus an entry in the contents sidebar (the sidebar only appears when a page has two or more headings).

Place one just before each major section you want listed.

---

## 5. Media

### Images

```
![Alt text](https://url/to/image.png)
```

> **Live example - add here:** an `![alt](url)` pointing at a real uploaded image.

Use the **Assets** toolbar button to upload an image and insert it automatically.

### Video

Uploaded videos (via the Assets button) embed as a player:

```
<video src="https://url/to/video.mp4" controls></video>
```

> **Live example - add here:** a `<video src="...">` tag with a real uploaded video URL.

### YouTube

Paste a YouTube URL as a plain link and it becomes an embedded player:

```
[Watch](https://youtu.be/dQw4w9WgXcQ)
```

> **Live example - add here:** paste a real YouTube link on its own line.

The **Embed** toolbar button does this for you (YouTube or direct video URLs).

---

## 6. Cross-references to other pages

Link to another guide, plugin page, or staff resource with a reference shortcode. These
render as hover-preview links.

```
[[resource:slug]]
[[resource:slug|Custom display text]]
[[resource:slug#section-id]]
[[plugin:slug]]
[[staff_resource:slug]]
```

- `resource`, `plugin`, `staff_resource` are the page types.
- `slug` is the target page's slug.
- `#section-id` optionally jumps to a heading anchor on that page.
- `|Custom text` optionally overrides the link label.

> **Live example - add here:** a `[[resource:your-slug]]` pointing at a real page.

Use the **Reference** toolbar button to browse pages and insert the correct shortcode
(including picking a specific section).

---

## 7. OSRS Wiki hover-cards

Any link to the Old School RuneScape Wiki shows a live hover-card with the page's
thumbnail and a short summary, fetched on hover and linked back to the source.

Two ways to add one:

```
Regular link - [Abyssal whip](https://oldschool.runescape.wiki/w/Abyssal_whip)

Shorthand - [[wiki:Abyssal whip]]
[[wiki:Abyssal whip|the whip]]
```

The `[[wiki:Page Title]]` shorthand expands to the correct wiki URL; add `|display text`
to change the visible label. Hover the link to preview the page.

**Renders as:** [[wiki:Abyssal whip]] - hover it for the live preview.

---

## 8. RuneLite object embeds

Stored RuneLite objects (managed on the staff **RuneLite Configs** page) can be embedded
by their stable ID. Editing an object never changes its ID, so embeds keep working after
updates.

Get an embed shortcode two ways:
- The **RuneLite** toolbar button - browse objects, preview them, and insert.
- The **Embed** / copy button on the staff RuneLite Configs page.

The four object types:

```
[[tilemarker:<id>]]     Colored map tiles drawn on an OSRS map
[[bosshealth:<id>]]     Boss HP color breakpoints
[[banktag:<id>]]        A bank tag item layout
[[invsetup:<id>]]       A full gear/inventory/rune-pouch loadout
```

Replace `<id>` with the object's ID (a value like `a1b2c3d4-...`). The RuneLite toolbar
button fills this in for you.

> **Live examples - add here:** one of each with real IDs, e.g. a `[[bosshealth:<id>]]`, a `[[banktag:<id>]]`, and an `[[invsetup:<id>]]`.

### Tile marker alignment and rows

Tile marker embeds accept an alignment, defaulting to left:

```
[[tilemarker:<id>|left]]
[[tilemarker:<id>|center]]
[[tilemarker:<id>|right]]
```

If you place several tile-marker embeds next to each other (only whitespace between
them), they group into a row of up to three, then wrap to the next row. The first
explicit alignment in the group sets the row alignment:

```
[[tilemarker:<id1>]] [[tilemarker:<id2>]] [[tilemarker:<id3>]] [[tilemarker:<id4>]]
```

> **Live example - add here:** a row of `[[tilemarker:<id>]]` embeds with real IDs.

### Item glow (bank tag and inventory setup)

Bank tag and inventory setup embeds render item icons with a soft glow. The default is a
cold blue. You can override it per-embed with a `glow` value encoded as
`blur,red,green,blue,alpha`:

```
[[invsetup:<id>|glow=1.5,150,190,230,0.55]]
[[banktag:<id>|glow=2,120,200,255,0.6]]
```

- `blur` - spread in pixels (0-8).
- `red` / `green` / `blue` - 0-255.
- `alpha` - 0-1 opacity.

> **Live example - add here:** an `[[invsetup:<id>|glow=...]]` with a real ID to show the glow override.

The RuneLite toolbar picker has a live **Item glow** tuner with sliders; adjust it and the
chosen value is encoded into the shortcode automatically. Leaving it at the default keeps
the shortcode clean (no `glow=` suffix).

---

## 9. Tips and gotchas

- **Live preview:** use the editor's preview pane to confirm formatting as you write.
- **Callouts and raw HTML:** keep block-level HTML tags on their own lines and avoid a
  blank line immediately inside a `div`.
- **Shortcodes in code samples:** shortcodes inside inline code (`` `like this` ``) and
  fenced code blocks are left untouched, so you can show a literal `[[...]]`, `[toc]{...}`,
  or `<div class="callout-...">` example just by putting it in code. Shortcodes in normal
  text still render.
- **IDs are stable:** RuneLite embed IDs do not change when an object is edited, so a guide
  keeps working after the underlying loadout, bank tag, or tiles are updated.
- **Section links:** link to a heading on another page with
  `[[resource:slug#heading-id]]`, where the heading ID is the lowercased, hyphenated
  heading text.
