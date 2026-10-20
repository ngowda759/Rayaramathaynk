# Brief - R1: re-theme the HTML brief from the CoreFlex house theme to the temple site's own identity

Read `.claude/state/briefs/RULES.md` first. Then this.

## Goal

`docs/overview/temple-portal-brief.html` currently wears the CoreFlex Solutions house theme (inlined
CFS logo, Century Gothic, red `#AF2027` accent, "Prepared for: Nikhil, CoreFlex Solutions"). Nikhil
has ruled that this repository is a proof of concept, not a CoreFlex deliverable: every HTML page here
must look like the temple portal itself - its colour tokens, its typefaces, its warm approach. The
page's content stays word-for-word the same; only its identity changes. It must remain one
self-contained file.

## Inputs

```
docs/overview/temple-portal-brief.html                     the page to re-theme (87 KB); read it fully
docs/rearchitecture/ui-redesign-specimens.html             one caption mentions CoreFlex; neutralise that sentence only
app/globals.css                                            the site's 84 design tokens, light and dark - the only source of colour values
app/layout.tsx                                             the site's fonts: Playfair Display (--font-heading), Inter (--font-inter), Noto Sans Kannada (--font-kannada)
components/layout/                                         the site header and footer - how the site names itself (English and Kannada), what colour its links and buttons use
public/                                                    list by name and extension only; an SVG logo under 30 KB may be inlined, anything else is not
.claude/skills/temple-portal-expert/brain/M01-foundation-and-ui-kit.md   the token inventory and their roles (Design tokens section)
docs/rearchitecture/UI-REDESIGN-PLAN.md                    section 7.1 only - measured contrast ratios; the site's gold cannot carry white text (3.56:1), use --foreground on --primary
```

## Method

1. Copy the current file to `.claude/state/brief-cfs-version.html` before touching it, so the two
   can be compared.
2. Read `app/globals.css` fully. Write down the light and dark token sets and the role of each
   (background, foreground, card, primary, secondary, accent, muted, border, destructive, ring,
   radius, the temple-* colours). Read the site header and footer components to learn the site's
   name as it renders it (English, and Kannada if present), and which token colours its links,
   primary buttons and section headings actually use.
3. Read the HTML fully. List every CoreFlex element: the `<symbol id="cfs-logo">` and its `<use>`
   references, the header band text, the "Prepared for" line, the footer, the Century Gothic stack,
   the `--brand` token and every rule using it, the print overrides, comments and any other
   "CoreFlex"/"CFS" string.
4. Re-theme:
   - **Tokens.** Replace the page's palette with tokens named and valued exactly as in
     `app/globals.css` (light on `:root`, dark under the same guards the file already uses:
     `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, and
     `:root[data-theme="dark"]`). Give `body` an explicit background. Every colour in the page is a
     `var()` of one of these tokens; no new literals.
   - **Type.** Headings `'Playfair Display', Georgia, 'Times New Roman', serif`; body
     `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`; any `lang="kn"` text
     `'Noto Sans Kannada', 'Noto Sans', sans-serif`. No `<link>` to fonts; the stacks degrade to
     installed fonts.
   - **Header band.** The site's own treatment: its name in English and, if the site renders one,
     in Kannada with `lang="kn"`; the subtitle "Application Brief"; the date 19 September 2026;
     "Prepared for: Nikhil" with no company. If `public/` holds an SVG logo under 30 KB, inline it
     once; otherwise a typographic mark using the heading face. No CFS logo anywhere.
   - **Accent.** Use the site's accent the way the site uses it: links and focus rings in the token
     the site's header links use; the critical-severity pill in `--destructive`; section markers in
     `--primary` or the temple maroon as the site does. Saffron and gold are accents, not surfaces,
     unless the site's own header uses them as surfaces.
   - **Surfaces and shapes.** Cards on `--card` with `--border`; radius from `--radius`; the stat
     tiles, tables, `<pre>` trees and callouts restyled on the same tokens. Keep the layout,
     section order, table wrappers, 16px gutters, print stylesheet and static anchor navigation.
   - **Footer.** The site's name, the date, and the self-containment sentence. No company.
   - Remove every remaining "CoreFlex", "CFS", "cfs-" and "Century Gothic" string, including in
     comments and CSS class names.
5. In the specimen page, rewrite the one caption that mentions CoreFlex to say the page is styled
   with the temple portal's own palette tokens from `app/globals.css`. Change nothing else there.
6. Verify by script, both files:
   - zero matches for `/coreflex|\bcfs\b|cfs-|century gothic|af2027|af2127/i`;
   - zero external resources: no `http(s)://` in `src=`, `<link href>`, `<script src>`, `url(`,
     `@import`;
   - every colour literal (`#hex`, `rgb(`, `hsl(`, `oklch(`) in the brief page appears verbatim in
     `app/globals.css` (count of literals not found must be 0);
   - tags balanced; size under 400 KB; the print block and both dark-mode guards still present;
     no fixed width above 375px outside a scrolling wrapper;
   - contrast (compute it): header title on the header background, body text on `--background`,
     link colour on `--background`, critical pill text on its fill, primary-tile text on its fill -
     all at least 4.5:1, or say which are not and why they are acceptable (large text at 3:1).
   - content check: strip tags from the old copy and the new file, diff the visible text; the only
     differing lines may be the header band, the "Prepared for" line and the footer. Report the
     count of differing lines and list them.

## Done means

- Both files pass every script check in step 6.
- The visible-text diff contains only the branding lines.
- `.claude/state/brief-cfs-version.html` holds the previous version.

## Output contract - structured return

```
filesEdited: [paths], briefBytes, externalResources, brandingMatches, colourLiteralsNotInGlobals,
contentDiffLines, contentDiffSample: [strings], contrast: [{pair, ratio}], fontsUsed: [strings],
logoInlined: string (source path or "typographic mark"), siteNameUsed: string, notes (<=8 lines)
```
