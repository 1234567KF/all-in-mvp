# Design System Inspired by shadcn/ui

> Category: Developer Tools
> A beautifully designed component library built with Radix UI and Tailwind CSS. Clean, minimal, accessible, and customizable.

## 1. Visual Theme & Atmosphere

- **Design Philosophy**: "Copy and paste" component distribution — no dependencies, full control. Radically simple, deeply customizable.
- **Mood**: Clean, professional, minimal, approachable
- **Density**: Comfortable — generous whitespace, clear visual hierarchy
- **Visual Style**: Utility-first, CSS-variable-driven theming, subtle borders and shadows, soft rounded corners
- **Tone**: Developer-friendly, unopinionated, neutral
- **Key differentiator**: Components are not installed as a package — you copy the source code and own it

## 2. Color Palette & Roles

### Light Mode (Default)

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#FFFFFF` | Main page background |
| `--foreground` | `#0A0A0A` | Primary text color |
| `--card` | `#FFFFFF` | Card/surface background |
| `--card-foreground` | `#0A0A0A` | Card text color |
| `--popover` | `#FFFFFF` | Popover/dropdown background |
| `--popover-foreground` | `#0A0A0A` | Popover text color |
| `--primary` | `#0A0A0A` | Primary action background |
| `--primary-foreground` | `#FAFAFA` | Primary action text |
| `--secondary` | `#F5F5F5` | Secondary action background |
| `--secondary-foreground` | `#0A0A0A` | Secondary action text |
| `--muted` | `#F5F5F5` | Muted/de-emphasized background |
| `--muted-foreground` | `#737373` | Muted text (secondary info) |
| `--accent` | `#F5F5F5` | Accent/hover background |
| `--accent-foreground` | `#0A0A0A` | Accent text color |
| `--destructive` | `#EF4444` | Destructive action (red-500) |
| `--destructive-foreground` | `#FAFAFA` | Destructive action text |
| `--border` | `#E5E5E5` | Component borders |
| `--input` | `#E5E5E5` | Input field borders |
| `--ring` | `#0A0A0A` | Focus ring indicator |
| `--radius` | `0.5rem` | Default border radius |

### Dark Mode

| Token | Hex | Role |
|-------|-----|------|
| `--background` | `#0A0A0A` | Main page background |
| `--foreground` | `#FAFAFA` | Primary text color |
| `--card` | `#0A0A0A` | Card/surface background |
| `--card-foreground` | `#FAFAFA` | Card text color |
| `--popover` | `#0A0A0A` | Popover/dropdown background |
| `--popover-foreground` | `#FAFAFA` | Popover text color |
| `--primary` | `#FAFAFA` | Primary action background |
| `--primary-foreground` | `#0A0A0A` | Primary action text |
| `--secondary` | `#262626` | Secondary action background |
| `--secondary-foreground` | `#FAFAFA` | Secondary action text |
| `--muted` | `#262626` | Muted/de-emphasized background |
| `--muted-foreground` | `#A3A3A3` | Muted text (secondary info) |
| `--accent` | `#262626` | Accent/hover background |
| `--accent-foreground` | `#FAFAFA` | Accent text color |
| `--destructive` | `#7F1D1D` | Destructive action (red-900) |
| `--destructive-foreground` | `#FAFAFA` | Destructive action text |
| `--border` | `#262626` | Component borders |
| `--input` | `#262626` | Input field borders |
| `--ring` | `#D4D4D4` | Focus ring indicator |

### Semantic Accent (Neutral — Neutral Gray)

| Weight | Hex | Usage |
|--------|-----|-------|
| 50 | `#FAFAFA` | Near-white backgrounds |
| 100 | `#F5F5F5` | Subtle surface backgrounds |
| 200 | `#E5E5E5` | Borders, dividers |
| 300 | `#D4D4D4` | Disabled states |
| 400 | `#A3A3A3` | Placeholder text |
| 500 | `#737373` | Muted body text |
| 600 | `#525252` | Secondary body text |
| 700 | `#404040` | Body text |
| 800 | `#262626` | Strong headings |
| 900 | `#171717` | Dark surfaces |
| 950 | `#0A0A0A` | Near-black backgrounds |

## 3. Typography Rules

| Level | Font Family | Weight | Size | Line Height | Letter Spacing |
|-------|-------------|--------|------|-------------|----------------|
| H1 | Inter / system-ui | 800 (ExtraBold) | 3rem (48px) | 1.0 | -0.025em |
| H2 | Inter / system-ui | 700 (Bold) | 2.25rem (36px) | 1.1 | -0.025em |
| H3 | Inter / system-ui | 600 (SemiBold) | 1.5rem (24px) | 1.2 | -0.025em |
| H4 | Inter / system-ui | 600 (SemiBold) | 1.25rem (20px) | 1.3 | — |
| Body (Large) | Inter / system-ui | 400 (Regular) | 1.125rem (18px) | 1.5 | — |
| Body (Base) | Inter / system-ui | 400 (Regular) | 1rem (16px) | 1.5 | — |
| Body (Small) | Inter / system-ui | 400 (Regular) | 0.875rem (14px) | 1.5 | — |
| Caption | Inter / system-ui | 400 (Regular) | 0.75rem (12px) | 1.5 | — |
| Muted | Inter / system-ui | 400 (Regular) | 0.875rem (14px) | 1.5 | — |
| Inline Code | JetBrains Mono / monospace | 400 (Regular) | 0.875em | — | — |
| Lead | Inter / system-ui | 400 (Regular) | 1.25rem (20px) | 1.4 | — |

- **Font stack**: `Inter, system-ui, -apple-system, sans-serif` (default)
- **Monospace**: `JetBrains Mono, SF Mono, Monaco, monospace`
- **Weight system**: 400 (regular) for body, 500 (medium) for emphasis, 600 (semi-bold) for subheadings, 700+ (bold) for headings
- **Line length**: 65–75 characters optimal for reading

## 4. Component Stylings

### Buttons

| Variant | Background | Text | Border | Hover | Active | Shadow |
|---------|-----------|------|--------|-------|--------|--------|
| Default (Primary) | `--primary` | `--primary-foreground` | None | Opacity 90 | Scale 97% | None |
| Secondary | `--secondary` | `--secondary-foreground` | None | Opacity 80 | Scale 97% | None |
| Outline | Transparent | `--foreground` | `--border` | `--accent` bg | Scale 97% | None |
| Ghost | Transparent | `--foreground` | None | `--accent` bg | Scale 97% | None |
| Destructive | `--destructive` | `--destructive-foreground` | None | Opacity 90 | Scale 97% | None |
| Link | Transparent | `--primary` | None (underline on hover) | Underline | — | None |

- **Size**: Default `h-10 px-4 py-2`; SM `h-9 px-3 text-sm`; LG `h-11 px-8 text-base`; Icon `h-10 w-10`
- **Radius**: `--radius` (0.5rem)
- **Transition**: 150ms ease-in-out for background-color, 100ms for transform
- **Focus**: Ring-2 with `--ring` color, ring-offset-2

### Input Fields

| Variant | Background | Border | Text | Focus |
|---------|-----------|--------|------|-------|
| Default | `--background` | `--input` (1px) | `--foreground` | Ring-2 `--ring`, no border change |
| File | `--background` | `--input` (1px) | `--foreground` | Ring-2 `--ring` |
- **Height**: `h-10` (2.5rem)
- **Radius**: `--radius` (0.5rem)
- **Padding**: `px-3 py-2`
- **Placeholder**: `--muted-foreground`
- **Disabled**: `cursor-not-allowed opacity-50`
- **Transition**: 150ms ease-in-out for box-shadow, border-color

### Cards

- **Background**: `--card` (default, or --background for nested)
- **Border**: 1px solid `--border`
- **Radius**: `--radius` (0.5rem)
- **Shadow**: `shadow-sm` (subtle)
- **Padding**: `p-6`
- **Header/Footer**: Separated by `flex-col gap-y-1.5` for header, `pt-0` footer
- **Hover**: Optional `hover:shadow-md` for interactive cards

### Badges

| Variant | Background | Text | Border |
|---------|-----------|------|--------|
| Default | `--primary` | `--primary-foreground` | None |
| Secondary | `--secondary` | `--secondary-foreground` | None |
| Outline | Transparent | `--foreground` | `--border` |
| Destructive | `--destructive` | `--destructive-foreground` | None |
- **Radius**: Full (rounded-full / pill shape)
- **Size**: `px-2.5 py-0.5 text-xs font-semibold`
- **Inline**: Inline-flex, center alignment

### Navigation Tabs

- **Trigger (active)**: `--muted` bg, `--foreground` text, `shadow-sm`
- **Trigger (inactive)**: Transparent bg, `--muted-foreground` text
- **Content**: `mt-2`
- **Radius**: `--radius` (0.5rem) on active tab
- **Transition**: 150ms ease-in-out for all properties

### Dialog / Modal

- **Overlay**: `rgba(0,0,0,0.8)` (black at 80%)
- **Content**: `--popover` bg, border `--border`, `shadow-lg`
- **Radius**: `--radius` + `0.5rem` (1rem total, if configured)
- **Close button**: Top-right, ghost variant
- **Animation**: Fade in + scale (enter), fade out + scale (exit)

### Dropdown Menu

- **Content**: `--popover` bg, 1px `--border`, `shadow-md`
- **Radius**: `--radius` (0.5rem)
- **Item (default)**: `--popover-foreground`
- **Item (hover)**: `--accent` bg, `--accent-foreground` text
- **Item (active)**: `--accent` bg, `--accent-foreground` text
- **Separator**: 1px `--muted` horizontal line
- **Checkbox/Radio items**: Use `--primary` for checked state

### Alerts

| Variant | Border | Icon | Background |
|---------|--------|------|------------|
| Default | None / `--border` | Terminal icon | `--background` or `--muted` |
| Destructive | `--destructive` (border-l) | Alert triangle | `--destructive` at 10% alpha |
- **Title**: `font-medium text-sm`
- **Description**: `text-sm text-muted-foreground`
- **Layout**: Flex with icon on the left

### Tables

- **Header**: `--muted-foreground` text, `font-medium`, left-aligned
- **Row**: `border-b border-border`
- **Hover (optional)**: `--muted` bg on row
- **Cell**: `p-4 align-middle text-sm`
- **Caption**: `text-sm text-muted-foreground` at bottom

## 5. Layout Principles

- **Spacing Scale (Tailwind)**: 0, px, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96 (in rem, where 1 = 0.25rem)
- **Grid**: 12-column grid via Tailwind, or custom
- **Container**: Max-width `1280px` centered (`mx-auto`)
- **Whitespace**: Generous — components breathe with 16–24px internal padding
- **Sizing scale**: Same as spacing (Tailwind's w-/h- utilities)
- **Z-index**: Modal 50, Popover 50, Dropdown 50, Tooltip 50, Toast 100

## 6. Depth & Elevation

| Level | Shadow | Usage |
|-------|--------|-------|
| Base | `none` | Flat surfaces (buttons, inputs) |
| Sm | `0 1px 2px 0 rgb(0 0 0 / 0.05)` | Cards, alerts |
| Md | `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)` | Dropdown menus, popovers |
| Lg | `0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)` | Modals, dialogs |
| Focus | `0 0 0 2px hsl(var(--ring))` | Focus ring (2px spread) |

- **Ring offset**: `2px` from element edge
- **No blur overlays** — elevation is communicated purely through shadows

## 7. Do's and Don'ts

### Do's
- ✅ Use CSS variables for all colors — enables easy theme switching
- ✅ Maintain consistent border-radius via `--radius` variable
- ✅ Use Tailwind's spacing scale for consistent gaps and paddings
- ✅ Prefer composition over configuration — copy source and customize
- ✅ Use `sr-only` for screen-reader-only content
- ✅ Use semantic HTML with Radix UI for accessibility (aria attributes)
- ✅ Apply focus rings for keyboard navigation (`focus-visible`)
- ✅ Support both light and dark mode via `.dark` class selector
- ✅ Use `gap-*` utilities on flex/grid containers instead of margin on children
- ✅ Keep interactive elements at minimum 44px touch target on mobile

### Don'ts
- ❌ Don't add new dependencies — components are self-contained
- ❌ Don't override CSS variables globally unless theming
- ❌ Don't use custom spacing outside the Tailwind scale
- ❌ Don't remove focus ring styles — accessibility requirement
- ❌ Don't hardcode color values — always use CSS variable / Tailwind token
- ❌ Don't add animations that exceed 300ms — keep interactions snappy
- ❌ Don't use RGB/HSL for colors — use OKLch or CSS variables
- ❌ Don't forget `outline-none` on elements with custom focus ring
- ❌ Don't nest interactive elements (button inside button, etc.)

## 8. Responsive Behavior

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Base (mobile) | < 640px | Single column, stacked layout, full-width inputs |
| Sm | ≥ 640px | Two-column grids possible |
| Md | ≥ 768px | Sidebar + main layout, multi-column cards |
| Lg | ≥ 1024px | Full multi-column layout, max-width container |
| Xl | ≥ 1280px | Maximum content width, abundant whitespace |
| 2xl | ≥ 1536px | Extra-wide, optional max-width cap |

- **Touch targets**: Minimum 44×44px for all interactive elements
- **Navigation**: Mobile: hamburger/expandable; Desktop: horizontal bar
- **Tables**: Horizontal scroll on small screens
- **Grid**: Responsive columns via `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- **Font scaling**: No font size changes at breakpoints — responsive via container width

## 9. Agent Prompt Guide

When generating UI with this design system:

```
Use shadcn/ui design system:
- Neutral/grayscale palette with CSS variable tokens
- Inter font family (default), JetBrains Mono for code
- Border radius: 0.5rem via --radius variable
- Clean, minimal aesthetic with generous whitespace
- Light mode by default, support .dark class for dark mode
- Tailwind CSS utility classes for all styling
- CSS variables for colors (never hardcode hex values)
- Subtle shadows (shadow-sm for cards, shadow-lg for modals)
- Focus rings on all interactive elements
- Responsive with Tailwind breakpoints (sm/md/lg/xl/2xl)
```

**Quick color reference:**
- Page bg: `#FFFFFF` (light), `#0A0A0A` (dark)
- Text: `#0A0A0A` (light), `#FAFAFA` (dark)
- Borders: `#E5E5E5` (light), `#262626` (dark)
- Primary: `#0A0A0A` bg, `#FAFAFA` text (light)
- Muted text: `#737373` (light), `#A3A3A3` (dark)

**Component instantiation:**
- Button: `<button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2">`
- Card: `<div class="rounded-lg border bg-card text-card-foreground shadow-sm p-6">`
- Input: `<input class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">`
- Badge: `<span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold">`
