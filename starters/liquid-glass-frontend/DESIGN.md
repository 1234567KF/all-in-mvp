---
name: Liquid Intelligence Design System
colors:
  dark:
    surface: "#131316"
    surface-dim: "#131316"
    surface-bright: "#39393c"
    surface-container-lowest: "#0e0e11"
    surface-container-low: "#1b1b1e"
    surface-container: "#1f1f22"
    surface-container-high: "#2a2a2d"
    surface-container-highest: "#353438"
    on-surface: "#e4e1e6"
    on-surface-variant: "#bccbb9"
    inverse-surface: "#e4e1e6"
    inverse-on-surface: "#303033"
    outline: "#869585"
    outline-variant: "#3d4a3d"
    surface-tint: "#4ae176"
    primary: "#22c55e"
    on-primary: "#003915"
    primary-container: "#22c55e"
    on-primary-container: "#004b1e"
    inverse-primary: "#006e2f"
    secondary: "#d0bcff"
    on-secondary: "#3c0091"
    secondary-container: "#571bc1"
    on-secondary-container: "#c4abff"
    tertiary: "#8bcfff"
    on-tertiary: "#00344d"
    tertiary-container: "#36b6fb"
    on-tertiary-container: "#004564"
    error: "#ffb4ab"
    on-error: "#690005"
    error-container: "#93000a"
    on-error-container: "#ffdad6"
    primary-fixed: "#6bff8f"
    primary-fixed-dim: "#4ae176"
    on-primary-fixed: "#002109"
    on-primary-fixed-variant: "#005321"
    secondary-fixed: "#e9ddff"
    secondary-fixed-dim: "#d0bcff"
    on-secondary-fixed: "#23005c"
    on-secondary-fixed-variant: "#5516be"
    tertiary-fixed: "#c9e6ff"
    tertiary-fixed-dim: "#89ceff"
    on-tertiary-fixed: "#001e2f"
    on-tertiary-fixed-variant: "#004c6e"
    background: "#131316"
    on-background: "#e4e1e6"
    surface-variant: "#353438"
  light:
    surface: "#f7f9fb"
    surface-dim: "#d8dadc"
    surface-bright: "#f7f9fb"
    surface-container-lowest: "#ffffff"
    surface-container-low: "#f2f4f6"
    surface-container: "#eceef0"
    surface-container-high: "#e6e8ea"
    surface-container-highest: "#e0e3e5"
    on-surface: "#191c1e"
    on-surface-variant: "#3d4a3d"
    inverse-surface: "#2d3133"
    inverse-on-surface: "#eff1f3"
    outline: "#6d7b6c"
    outline-variant: "#bccbb9"
    surface-tint: "#006e2f"
    primary: "#006e2f"
    on-primary: "#ffffff"
    primary-container: "#22c55e"
    on-primary-container: "#004b1e"
    inverse-primary: "#4ae176"
    secondary: "#565e74"
    on-secondary: "#ffffff"
    secondary-container: "#dae2fd"
    on-secondary-container: "#5c647a"
    tertiary: "#005ac2"
    on-tertiary: "#ffffff"
    tertiary-container: "#82abff"
    on-tertiary-container: "#003d88"
    error: "#ba1a1a"
    on-error: "#ffffff"
    error-container: "#ffdad6"
    on-error-container: "#93000a"
    primary-fixed: "#6bff8f"
    primary-fixed-dim: "#4ae176"
    on-primary-fixed: "#002109"
    on-primary-fixed-variant: "#005321"
    secondary-fixed: "#dae2fd"
    secondary-fixed-dim: "#bec6e0"
    on-secondary-fixed: "#131b2e"
    on-secondary-fixed-variant: "#3f465c"
    tertiary-fixed: "#d8e2ff"
    tertiary-fixed-dim: "#adc6ff"
    on-tertiary-fixed: "#001a42"
    on-tertiary-fixed-variant: "#004395"
    background: "#f7f9fb"
    on-background: "#191c1e"
    surface-variant: "#e0e3e5"
typography:
  display-lg:
    fontFamily: Manrope
    fontSize: 48px
    fontWeight: "700"
    lineHeight: "56px"
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Manrope
    fontSize: 32px
    fontWeight: "600"
    lineHeight: "40px"
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "32px"
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: "400"
    lineHeight: "28px"
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "24px"
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: "500"
    lineHeight: "20px"
    letterSpacing: 0.02em
  h1:
    fontFamily: Manrope
    fontSize: 36px
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: -0.02em
  h2:
    fontFamily: Manrope
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.3"
    letterSpacing: -0.01em
  body-main:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.5"
  body-muted:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: "400"
    lineHeight: "1.5"
  data-display:
    fontFamily: JetBrains Mono
    fontSize: 28px
    fontWeight: "600"
    lineHeight: "1"
  label-mono:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: "500"
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  card-gap: 16px
  element-margin: 12px
  section-padding: 32px
---

# Liquid Glass Design System Specifications

This document defines the "Liquid Glass" design system, engineered for high-fidelity data environments. It serves as a persistent contract for developers and AI agents (such as Cursor and Claude) to generate consistent UI across the project.

## Overview

The design system centers on a "Liquid Glass" aesthetic, evoking a sense of deep technical mastery and AI-native fluidity. The interface uses high-transparency layers, subtle background blurs, and light refraction to create depth without visual clutter.

## Visual Theme & Atmosphere

- **Aesthetic**: Atmospheric Precision—airy, spacious, and technically precise.
- **Theme Consistency**: Switching themes (Dark/Light) **only changes colors, opacity, and light-reflection rules**. The underlying layout grid, typography, spacing, and geometric shapes (border-radius) remain absolutely identical to prevent layout shifts.

## Color Palette & Roles

The system features dual-theme colors mapped through CSS variables.

### Dark Theme (Default)

Optimized for low eye strain during intensive data analysis.

- **Foundation**: Main background `#0e0e11` for absolute stability.
- **Surfaces**: Card backgrounds `#1b1b1e` with `rgba(27, 27, 30, 0.7)` opacity.
- **Accents**: Primary accent (Qoder Green `#22c55e` / `#4be277`) for critical paths, KPIs, and progress indicators.
- **Borders**: Consistent `#3d4a3d` (opacity blended) creating soft structural definition.

### Light Theme

Clean and architectural, prioritizing legibility and light-refraction.

- **Foundation**: Background `#f7f9fb` (Slate-50 equivalent).
- **Surfaces**: Card backgrounds `#ffffff` with `rgba(255, 255, 255, 0.7)` opacity.
- **Accents**: Primary accent (Deep Green `#006e2f`) for actions and brand strength; Qoder Green (`#22c55e`) for active states.
- **Borders**: Consistent Slate-200 / `#bccbb9` (`rgba(109, 123, 108, 0.3)`) to maintain structure.

---

## Typography Rules

The system utilizes a dual-font strategy:

- **Manrope**: Primary heading typeface. Sharp, contemporary, geometric.
- **Inter**: Primary body typeface. Legible, neutral, comfortable for long reading.
- **JetBrains Mono**: Data display, metrics, KPIs, and AI-generated logs. Monospaced to prevent "jumping" during real-time updates.

---

## Layout & Spacing

The system follows a fluid 12-column grid system with consistent margins.

- **Grid**: Content is grouped into semantic card containers.
- **Rhythm**: Spacing is based on a **4px baseline** grid (unit: 4px).
- **Page Spacing**: 32px for desktop, 16px for mobile.
- **Card Padding**: 24px base padding.
- **Element Margin**: 12px or 16px.

---

## Depth & Elevation

### Dark Mode (Ambient Glow)

1. **Level 0 (Base)**: Solid background `#0e0e11`.
2. **Level 1 (Cards/Rows)**: `rgba(27, 27, 30, 0.7)` background, `backdrop-filter: blur(12px)`, and 1px solid border of `#3d4a3d` (40% opacity).
3. **Level 2 (Modals/Dropdowns)**: `rgba(27, 27, 30, 0.95)` with a subtle primary glow shadow (`0 0 8px rgba(34, 197, 94, 0.4)`).

### Light Mode (Tinted Occlusion)

1. **Level 0 (Base)**: Solid background `#f7f9fb`.
2. **Level 1 (Cards/Rows)**: `rgba(255, 255, 255, 0.7)` background, `backdrop-filter: blur(12px)`, and 1px solid border of `rgba(109, 123, 108, 0.3)`.
3. **Level 2 (Modals/Dropdowns)**: `rgba(255, 255, 255, 0.95)` with a highly diffused soft ambient shadow `0 20px 40px rgba(15, 23, 42, 0.08)`.

---

## Component Stylings

### Cards

Cards are the primary container and must feature:

- 1px border.
- 12px (0.75rem) border-radius.
- **Dark Mode**: `bg-[#1b1b1e]/70` with `backdrop-blur-md` and `rgba(255, 255, 255, 0.03)` top sheen gradient.
- **Light Mode**: `bg-[#ffffff]/70` with `backdrop-blur-md` and `rgba(0, 0, 0, 0.03)` top sheen gradient.

### Buttons

- **Primary**:
  - _Dark Mode_: Solid Qoder Green (`#22c55e`) background, black text. Hover scales to `#4be277` with primary glow.
  - _Light Mode_: Solid Deep Green (`#006e2f`) background, white text. Hover scales to `#16a34a` with soft green shadow.
- **Secondary**:
  - Ghost glass style with 1px border and a subtle hover state increasing opacity.

### Inputs & Selects

- 8px (0.5rem) border-radius.
- **Dark Mode**: Background `rgba(27, 27, 30, 0.7)`, focus border Qoder Green (`#4be277`) with `rgba(34, 197, 94, 0.3)` glow.
- **Light Mode**: Background `rgba(255, 255, 255, 0.7)`, focus border Deep Green (`#006e2f`) with `rgba(0, 110, 47, 0.2)` glow.

### Progress Bars

- Track: Solid background (`#3d4a3d` in Dark, `#6d7b6c` in Light).
- Indicator: Primary color with a soft outer glow.

### Key Metrics (KPIs)

- Value must use **JetBrains Mono** font.
- Includes a "Liquid" accent line (2px vertical line to the left of the metric).
  - _Dark Mode_: Qoder Green (`#22c55e`) line with glow.
  - _Light Mode_: Deep Green (`#006e2f`) line with glow.

---

## Structural UI & Layout Conventions

### Page Header & Titles

- **Page Titles**: Main page header titles (`h1`) must use `className="font-h2"` with `style={{ color: "var(--lg-text-primary)" }}`. They **DO NOT** contain visual icons (keep them clean).
- **Button Styling**: Primary buttons on page headers must use `className="btn-primary"`.

### Dialog Formatting

- **Dialog Titles**: `DialogTitle` **MUST** include visual icons (e.g., `<ShieldCheck className="size-4" style={{ color: "var(--lg-info)" }} />` or `<Pencil className="size-4" style={{ color: "var(--lg-info)" }} />`).
- **Dialog Forms**: Form fields must use standard glass styling: inputs/selects with `bg-background/40 backdrop-blur-[12px]`, labels with `style={{ color: "var(--lg-text-secondary)" }}`.

### Tables & Filtering

- **DataTable Filters**: All page filters, search inputs, and selectors must be nested inside the `toolbar` property of `DataTable` using the [FilterBar](apps/web/src/components/shared/FilterBar.tsx) component.
- **Date Filtering**: Use the custom [DateRangePicker](apps/web/src/components/ui/date-range-picker.tsx) component for all date range selection fields, never native HTML input date types or separate inputs.

---

## Do's and Don'ts (Constraints & Anti-patterns)

- **DO** use CSS theme variables (e.g., `var(--primary)`, `var(--lg-surface)`) or utility classes from `design-utils.css` (e.g., `.glass-card`, `.matte-card`) for all styles.
- **DO** use the dual-font strategy: `Manrope` for headings and `Inter` for body text.
- **DO** keep card border radius at exactly 12px to maintain geometric consistency.
- **DON'T** hardcode raw hex or rgba colors (e.g., `#22c55e` or `#ffffff`) directly in React components.
- **DON'T** use standard Tailwind border-radius classes like `rounded-lg` (which is 8px in Tailwind) on card containers; use `rounded-[12px]` or CSS variables.
- **DON'T** use generic modals or overlays without applying `backdrop-filter: blur(12px)`.

---

## Agent Prompt Guide & Instructions

You are an AI coding assistant. When modifying or creating UI components in this repository, you must adhere to this document:

1. **Read `DESIGN.md` first** to align with the core visual principles of Liquid Glass.
2. **Import tokens indirectly**: Rely on [theme-tokens.css](theme-tokens.css) or Tailwind CSS v4 variables mapped inside `index.css`.
3. **Use shared layout classes**: Before writing custom container styles, check if `.glass-card`, `.liquid-card`, `.matte-card`, or `.glass-row` in [design-utils.css](design-utils.css) satisfy the requirements.
4. **Enforce typography variables**: Use `font-heading`, `font-body`, and `font-mono` utilities instead of generic sans/serif overrides.

---

## Responsive Breakpoints

| Token | Min-width | Target                   |
| ----- | --------- | ------------------------ |
| `sm`  | 640px     | Large phones (landscape) |
| `md`  | 768px     | Tablets                  |
| `lg`  | 1024px    | Small laptops            |
| `xl`  | 1280px    | Desktops                 |
| `2xl` | 1536px    | Large screens            |

Layout shifts:

- **< md**: Sidebar collapses to bottom nav or hamburger; cards stack single-column.
- **md – lg**: Sidebar overlay mode; 2-column grid.
- **≥ lg**: Sidebar persistent; 3+ column grid.

Container max-width: `1400px` (centered with auto margins).

---

## Motion & Transitions

| Context                                 | Duration | Easing                       | CSS Variable          |
| --------------------------------------- | -------- | ---------------------------- | --------------------- |
| Micro-interactions (hover, focus)       | 150ms    | ease-out                     | `--duration-fast`     |
| Panel open/close                        | 250ms    | cubic-bezier(0.4, 0, 0.2, 1) | `--duration-normal`   |
| Page transitions (View Transitions API) | 300ms    | cubic-bezier(0.4, 0, 0.2, 1) | `--duration-page`     |
| Loading skeleton pulse                  | 1.5s     | ease-in-out                  | `--duration-skeleton` |

Principles:

- Prefer **opacity + scale** for enter/exit; avoid layout-triggering transforms (`top`/`left`/`width`/`height`).
- Reduced-motion: respect `prefers-reduced-motion: reduce`—disable all non-essential animations.
- Page transitions use the native View Transitions API via React Router DOM v7 `viewTransition` prop.
