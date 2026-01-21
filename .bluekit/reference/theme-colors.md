## Theme Colors – Mapped to Meaning

Quick mental model of what each color “means” in the app, with underlying tokens and hex values from `src/theme.ts`. Light/dark follow the modes from `ColorModeContext`.

### Brand & Primary Actions

- **Primary brand blue (buttons, key accents)**
  - meaning: main interactive blue
  - token: `primary.solid`
  - base: `{colors.primary.600}`
  - light: `#2563eb`
  - dark: `#2563eb`

- **Primary text-on-blue / pill contrast**
  - meaning: text/icon on strong blue surfaces
  - token: `primary.contrast`
  - base: `{colors.primary.50}`
  - light: `#eff6ff`
  - dark: `#eff6ff`

- **Primary emphasis / hover states**
  - meaning: slightly stronger blue for emphasis or hover
  - token: `primary.emphasized`
  - base: `{colors.primary.300}`
  - light: `#93c5fd`
  - dark: `#93c5fd`

- **Primary focus ring**
  - meaning: outline color for focused elements
  - token: `primary.focusRing`
  - base: `{colors.primary.500}`
  - light: `#4287f5`
  - dark: `#4287f5`

- **Primary border**
  - meaning: borders on primary-flavored components
  - token: `primary.border`
  - base: `{colors.primary.200}`
  - light: `#FAEDE3`
  - dark: `#FAEDE3`

### Primary Blues Scale (raw palette)

- **Primary blue scale**
  - `primary.50`: `#eff6ff` – soft background blue
  - `primary.100`: `#FFE6BF` – warm accent (muted)
  - `primary.200`: `#FAEDE3` – soft brand-tinted background
  - `primary.300`: `#93c5fd` – light accent blue
  - `primary.400`: `#60a5fa` – medium accent blue
  - `primary.500`: `#4287f5` – core brand blue
  - `primary.600`: `#2563eb` – strong brand blue (default solid)
  - `primary.700`: `#1d4ed8` – deep blue (strong text in light mode)
  - `primary.800`: `#1e40af` – very deep blue (subtle dark bg)
  - `primary.900`: `#1e3a8a` – near-navy
  - `primary.950`: `#172554` – darkest navy

### Text Colors

- **Main text color**
  - meaning: default body / primary text
  - token: `text.primary`
  - light: `{colors.gray.900}` (Chakra gray.900)
  - dark: `{colors.primary.200}` → `#FAEDE3`

- **Secondary / muted text**
  - meaning: labels, helper text, less prominent content
  - token: `text.secondary`
  - light: `{colors.gray.600}` (Chakra gray.600)
  - dark: `{colors.primary.400}` → `#60a5fa`

- **Tertiary / subtle text**
  - meaning: metadata, low-emphasis details
  - token: `text.tertiary`
  - light: `{colors.gray.500}` (Chakra gray.500)
  - dark: `#A69385`

- **Generic foreground**
  - meaning: generic “fg” where not explicitly text.*
  - token: `fg`
  - light: `{colors.gray.900}` (Chakra gray.900)
  - dark: `{colors.primary.200}` → `#FAEDE3`

- **Muted foreground**
  - meaning: icons / text that should be quieter than main fg
  - token: `fg.muted`
  - light: `{colors.gray.600}` (Chakra gray.600)
  - dark: `{colors.primary.400}` → `#60a5fa`

### Backgrounds & Surfaces

- **App background (content area)**
  - meaning: main canvas behind content
  - token: `main.bg`
  - light: `white`
  - dark: `{colors.gray.950}` (Chakra gray.950)

- **Header background**
  - meaning: top app header / toolbar
  - token: `header.bg`
  - light: `{colors.gray.100}` (Chakra gray.100)
  - dark: `{colors.gray.950}` (Chakra gray.950)

- **Subtle background (cards, tabs, soft sections)**
  - meaning: shared background for cards / tabs / containers
  - token: `bg.subtle`
  - light: `{colors.gray.100}` (Chakra gray.100)
  - dark: `{colors.gray.950}` (Chakra gray.950)

- **Surface background (raised elements)**
  - meaning: selected tab, cards, elevated surfaces
  - token: `bg.surface`
  - light: `white`
  - dark: `{colors.gray.900}` (Chakra gray.900)

- **Primary hover background**
  - meaning: subtle hover state for primary-ish rows/cards
  - token: `primary.hover.bg`
  - light: `{colors.primary.50}` → `#eff6ff`
  - dark: `rgba(66, 135, 245, 0.3)`

### Status / Priority Backgrounds

- **Blue subtle**
  - meaning: info / neutral priority background
  - token: `blue.subtle`
  - light: `{colors.blue.100}` (Chakra blue.100)
  - dark: `rgba(59, 130, 246, 0.15)`

- **Red subtle**
  - meaning: error / destructive priority background
  - token: `red.subtle`
  - light: `{colors.red.100}` (Chakra red.100)
  - dark: `rgba(239, 68, 68, 0.15)`

- **Purple subtle**
  - meaning: special / creative / secondary highlight
  - token: `purple.subtle`
  - light: `{colors.purple.100}` (Chakra purple.100)
  - dark: `rgba(168, 85, 247, 0.15)`

- **Yellow subtle**
  - meaning: warning / attention background
  - token: `yellow.subtle`
  - light: `{colors.yellow.100}` (Chakra yellow.100)
  - dark: `rgba(234, 179, 8, 0.15)`

- **Orange subtle**
  - meaning: high-priority / “hot” background
  - token: `orange.subtle`
  - light: `{colors.orange.100}` (Chakra orange.100)
  - dark: `rgba(249, 115, 22, 0.15)`

### Secondary Brand Blue

- **Secondary blue**
  - meaning: alternate brand/section color (e.g. GitHub, side accents)
  - tokens:
    - `secondary.solid`: `#1A33A3` (light/dark)
    - `secondary.fg`: `#1A33A3` (light/dark)
    - `secondary.border`: `#1A33A3` (light/dark)
    - `secondary.subtle`:
      - light: `{colors.blue.50}` (Chakra blue.50)
      - dark: `rgba(26, 51, 163, 0.15)`
    - `secondary.hover`:
      - light: `{colors.blue.100}` (Chakra blue.100)
      - dark: `rgba(26, 51, 163, 0.25)`

### Glassmorphism Layers

- **Glass generic**
  - `glass.light`: `rgba(255, 255, 255, 0.15)`
  - `glass.dark`: `rgba(0, 0, 0, 0.2)`

- **Glass borders**
  - `glass.border.light`: `rgba(255, 255, 255, 0.2)`
  - `glass.border.dark`: `rgba(255, 255, 255, 0.15)`

- **Glass content panels**
  - `glass.content.light`: `rgba(255, 255, 255, 0.1)`
  - `glass.content.dark`: `rgba(0, 0, 0, 0.15)`

- **Glass cards**
  - `glass.card.light`: `rgba(255, 255, 255, 0.2)`
  - `glass.card.dark`: `rgba(0, 0, 0, 0.25)`

- **Glass navigation / tabs**
  - `glass.nav.light`: `rgba(255, 255, 255, 0.15)`
  - `glass.nav.dark`: `rgba(0, 0, 0, 0.2)`


