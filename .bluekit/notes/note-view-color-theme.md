# Note View Page — Color/Theme Setup

All heading/title colors are defined in `src/theme.ts` as exported constants with `{ light, dark }` shape. No raw hex strings in components.

## Color Constants (src/theme.ts)

| Constant | Light Mode | Dark Mode | Used For |
|---|---|---|---|
| `titleColor` | `#1A33A3` (navy blue) | `#a3cfff` (blue.300, light blue) | Note title input |
| `heading1Color` | `#4287f5` (primary.500, theme blue) | `#4287f5` (theme blue) | H1 headings in editor |
| `headingAccentColor` | `#4287f5` (theme blue) | `#4287f5` (theme blue) | H2+ headings in editor |

## Files That Use These

- **Title input**: `src/pages/NoteViewPage.tsx` — uses `titleColor`
- **Title heading (kit view)**: `src/features/workstation/components/ResourceMarkdownHeader.tsx` — uses `titleColor`
- **Reading mode H1/H2**: `src/shared/components/editor/obsidian/ReadingView.tsx` — uses `heading1Color`, `headingAccentColor`
- **Live preview H1/H2**: `src/shared/components/editor/obsidian/theme/livePreviewTheme.ts` — uses `heading1Color`, `headingAccentColor`
- **Source mode H1/H2**: `src/shared/components/editor/codemirrorTheme.ts` — uses `heading1Color`, `headingAccentColor`

## Key Rule

All colors must come from `src/theme.ts` (documented in CLAUDE.md). To change a color, update the constant in theme.ts and it propagates everywhere.
