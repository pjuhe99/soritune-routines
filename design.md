# Design System Inspired by Framer

## 1. Visual Theme & Atmosphere

Framer's website is a cinematic, tool-obsessed dark canvas that radiates the confidence of a design tool built by designers who worship craft. The entire experience is drenched in pure black — not a warm charcoal or a cozy dark gray, but an absolute void (`#000000`) that makes every element, every screenshot, every typographic flourish feel like it's floating in deep space. This is a website that treats its own product UI as the hero art, embedding full-fidelity screenshots and interactive demos directly into the narrative flow.

The typography is the signature move: Pretendard with aggressively tight letter-spacing (as extreme as -5.5px on 110px display text) creates headlines that feel compressed, kinetic, almost spring-loaded — like words under pressure that might expand at any moment. Pretendard's 9-weight range (100–900) provides full typographic control across both Korean and Latin text, maintaining consistent geometry and readability at every scale. Framer Blue (`#0099ff`) is deployed sparingly but decisively — as link color, border accents, and subtle ring shadows — creating a cold, electric throughline against the warm-less black.

The overall effect is a nightclub for web designers: dark, precise, seductive, and unapologetically product-forward. Every section exists to showcase what the tool can do, with the website itself serving as proof of concept.

**Key Characteristics:**
- Pure black (`#000000`) void canvas — absolute dark, not warm or gray-tinted
- Pretendard display font with extreme negative letter-spacing (-5.5px at 110px)
- Framer Blue (`#0099ff`) as the sole accent color — cold, electric, precise
- Pill-shaped buttons (40px–100px radius) — no sharp corners on interactive elements
- Product screenshots as hero art — the tool IS the marketing
- Frosted glass button variants using `rgba(255, 255, 255, 0.1)` on dark surfaces
- Single font system (Pretendard) for both Korean and English — visual consistency across languages

## 2. Color Palette & Roles

### Primary
- **Pure Black** (`#000000`): Primary background, the void canvas that defines the dark-first identity
- **Pure White** (`#ffffff`): Primary text color on dark surfaces, button text on accent backgrounds
- **Framer Blue** (`#0099ff`): Primary accent color — links, borders, ring shadows, interactive highlights

### Secondary & Accent
- **Muted Silver** (`#a6a6a6`): Secondary text, subdued labels, dimmed descriptions on dark surfaces
- **Near Black** (`#090909`): Elevated dark surface, shadow ring color for subtle depth separation

### Surface & Background
- **Void Black** (`#000000`): Page background, primary canvas
- **Frosted White** (`rgba(255, 255, 255, 0.1)`): Translucent button backgrounds, glass-effect surfaces on dark
- **Subtle White** (`rgba(255, 255, 255, 0.5)`): Slightly more opaque frosted elements for hover states

### Neutrals & Text
- **Pure White** (`#ffffff`): Heading text, high-emphasis body text
- **Muted Silver** (`#a6a6a6`): Body text, descriptions, secondary information
- **Ghost White** (`rgba(255, 255, 255, 0.6)`): Tertiary text, placeholders on dark surfaces

### Semantic & Accent
- **Framer Blue** (`#0099ff`): Links, interactive borders, focus rings
- **Blue Glow** (`rgba(0, 153, 255, 0.15)`): Focus ring shadow, subtle blue halo around interactive elements

### Gradient System
- No prominent gradient usage — relies on pure flat black surfaces with occasional blue-tinted glows for depth
- Subtle radial glow effects behind product screenshots using Framer Blue at very low opacity

## 3. Typography Rules

### Font Family
- **All Purpose**: `Pretendard Variable` / `Pretendard` — 9-weight (100–900) variable sans-serif supporting Korean, English, and other Latin scripts. Fallbacks: `Pretendard GOV`, `-apple-system`, `BlinkMacSystemFont`, `system-ui`, `Helvetica Neue`, `sans-serif`
- **Monospace**: `JetBrains Mono` / `Fira Code` — for code blocks and technical labels

### CDN
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" />
```

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|------|------|------|--------|-------------|----------------|-------|
| Display Hero | Pretendard | 110px | 700 | 0.85 | -5.5px | Extreme negative tracking, compressed impact |
| Section Display | Pretendard | 85px | 700 | 0.95 | -4.25px | Large section titles |
| Section Heading | Pretendard | 62px | 700 | 1.00 | -3.1px | Section headers |
| Feature Heading | Pretendard | 32px | 600 | 1.13 | -1px | Tightest of the smaller headings |
| Card Title | Pretendard | 24px | 600 | 1.30 | -0.01px | Card headers |
| Feature Title | Pretendard | 22px | 700 | 1.20 | -0.8px | Feature block headers |
| Sub-heading | Pretendard | 20px | 600 | 1.20 | -0.8px | Subsection headers |
| Body Large | Pretendard | 18px | 400 | 1.60 | -0.01px | Lead paragraphs |
| Body | Pretendard | 15px | 400 | 1.60 | -0.01px | Default body text |
| Nav/UI | Pretendard | 15px | 500 | 1.00 | -0.15px | Navigation, UI labels |
| Body Readable | Pretendard | 14px | 400 | 1.70 | normal | Long-form Korean body text — wider line height for readability |
| Caption | Pretendard | 14px | 400 | 1.40 | normal | Image captions, metadata |
| Label | Pretendard | 13px | 500 | 1.60 | normal | Form labels, small UI text |
| Small Caption | Pretendard | 12px | 400 | 1.40 | normal | Timestamps, minor info |
| Badge | Pretendard | 9px | 600 | 1.11 | normal | Status badges, tags |

### Principles
- **Compression as personality**: Pretendard's extreme negative letter-spacing (-5.5px at 110px) on display text creates spring-loaded, urgent headlines
- **Weight variety**: Use 700 for display/headings, 600 for sub-headings, 500 for UI/nav, 400 for body — leverage the full weight range
- **Korean readability**: Body text for Korean content uses wider line-height (1.60–1.70) than typical Latin-only text to accommodate Korean character density
- **Single font consistency**: One font family across Korean and English eliminates language-switching visual jank
- **Ultra-tight line heights on display only**: Display text at 0.85 line-height — but body text stays readable at 1.60+

## 4. Component Stylings

### Buttons
- **Frosted Pill**: `rgba(255, 255, 255, 0.1)` background, white text (`#ffffff`), pill shape (40px radius). The glass-effect button that lives on dark surfaces — translucent, ambient, subtle
- **Solid White Pill**: `rgb(255, 255, 255)` background, black text (`#000000`), full pill shape (100px radius), padding `10px 15px`. The primary CTA — clean, high-contrast on dark, unmissable
- **Ghost**: No visible background, white text, relies on text styling alone. Hover reveals subtle frosted background
- **Transition**: Scale-based animations (matrix transform with 0.85 scale factor), opacity transitions for reveal effects

### Cards & Containers
- **Dark Surface Card**: Black or near-black (`#090909`) background, `rgba(0, 153, 255, 0.15) 0px 0px 0px 1px` blue ring shadow border, rounded corners (10px–15px radius)
- **Elevated Card**: Multi-layer shadow — `rgba(255, 255, 255, 0.1) 0px 0.5px 0px 0.5px` (subtle top highlight) + `rgba(0, 0, 0, 0.25) 0px 10px 30px` (deep ambient shadow)
- **Product Screenshots**: Full-width or padded within dark containers, 8px–12px border-radius for software UI previews
- **Hover**: Subtle glow increase on Framer Blue ring shadow, or brightness shift on frosted surfaces

### Inputs & Forms
- Input fields follow dark theme: dark background, subtle border, white text
- Focus state: Framer Blue (`#0099ff`) ring border, `1px solid #0099ff`
- Placeholder text in `rgba(255, 255, 255, 0.4)`

### Navigation
- **Dark floating nav bar**: Black background with frosted glass effect, white text links
- **Nav links**: Pretendard at 15px, weight 500, white text with subtle hover opacity change
- **CTA button**: Pill-shaped, white or frosted, positioned at right end of nav
- **Mobile**: Collapses to hamburger menu, maintains dark theme
- **Sticky behavior**: Nav remains fixed at top on scroll

### Image Treatment
- **Product screenshots as hero art**: Full-width embedded UI screenshots with rounded corners (8px–12px)
- **Dark-on-dark composition**: Screenshots placed on black backgrounds with subtle shadow for depth separation
- **No decorative imagery**: All images are functional — showing the tool, the output, or the workflow

## 5. Layout Principles

### Spacing System
- **Base unit**: 8px
- **Scale**: 4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px, 64px, 80px, 120px
- **Section padding**: Large vertical spacing (80px–120px between sections)
- **Card padding**: 16px–32px internal padding
- **Component gaps**: 8px–20px between related elements

### Grid & Container
- **Max width**: ~1200px container, centered
- **Column patterns**: Full-width hero, 2-column feature sections, single-column product showcases
- **Asymmetric layouts**: Feature sections often pair text (40%) with screenshot (60%)

### Whitespace Philosophy
- **Breathe through darkness**: Generous vertical spacing between sections — the black background means whitespace manifests as void, creating dramatic pauses between content blocks
- **Dense within, spacious between**: Individual components are tightly composed (tight line-heights, compressed text) but float in generous surrounding space

### Border Radius Scale
- **1px**: Micro-elements, nearly squared precision edges
- **5px–7px**: Small UI elements, image thumbnails — subtly softened
- **8px**: Standard component radius — code blocks, buttons, interactive elements
- **10px–12px**: Cards, product screenshots — comfortably rounded
- **15px–20px**: Large containers, feature cards — generously rounded
- **30px–40px**: Navigation pills, pagination — noticeably rounded
- **100px**: Full pill shape — primary CTAs, tag elements

## 6. Depth & Elevation

| Level | Treatment | Use |
|-------|-----------|-----|
| Level 0 (Flat) | No shadow, pure black surface | Page background, empty areas |
| Level 1 (Ring) | `rgba(0, 153, 255, 0.15) 0px 0px 0px 1px` | Card borders, interactive element outlines — Framer Blue glow ring |
| Level 2 (Contained) | `rgb(9, 9, 9) 0px 0px 0px 2px` | Near-black ring for subtle containment on dark surfaces |
| Level 3 (Floating) | `rgba(255, 255, 255, 0.1) 0px 0.5px 0px 0.5px, rgba(0, 0, 0, 0.25) 0px 10px 30px` | Elevated cards, floating elements — subtle white top-edge highlight + deep ambient shadow |

### Shadow Philosophy
- **Blue-tinted ring shadows** at very low opacity (0.15) for containment
- **White edge highlights** (0.5px) on the top edge of elevated elements
- **Deep ambient shadows** for true floating elements — `rgba(0, 0, 0, 0.25)` at large spread (30px)
- **No heavy glassmorphism**: Translucency is achieved through simple rgba opacity

## 7. Do's and Don'ts

### Do
- Use pure black (`#000000`) as the primary background — not dark gray, not charcoal
- Apply extreme negative letter-spacing on Pretendard display text (-3px to -5.5px)
- Keep all buttons pill-shaped (40px+ radius) — never use squared or slightly-rounded buttons
- Use Framer Blue (`#0099ff`) exclusively for interactive accents — links, borders, focus states
- Deploy `rgba(255, 255, 255, 0.1)` for frosted glass surfaces on dark backgrounds
- Use wider line-height (1.60–1.70) for Korean body text to ensure readability
- Let product screenshots be the visual centerpiece
- Apply blue ring shadows (`rgba(0, 153, 255, 0.15) 0px 0px 0px 1px`) for card containment

### Don't
- Use warm dark backgrounds (no `#1a1a1a`, `#2d2d2d`, or brownish blacks)
- Introduce additional accent colors beyond Framer Blue — this is a one-accent-color system
- Use large border-radius on non-interactive elements (cards use 10px–15px, only buttons get 40px+)
- Add decorative imagery or illustrations — the product IS the illustration
- Use positive letter-spacing on headlines — everything is compressed, negative tracking
- Create heavy drop shadows — depth is communicated through subtle rings and minimal ambients
- Place light/white backgrounds behind content sections — the void is sacred
- Mix other Korean fonts with Pretendard — maintain single-font consistency

## 8. Responsive Behavior

### Breakpoints
| Name | Width | Key Changes |
|------|-------|-------------|
| Mobile | <809px | Single column, stacked feature sections, reduced hero text (110px→40px), hamburger nav |
| Tablet | 809px–1199px | 2-column features begin, nav links partially visible, screenshots scale down |
| Desktop | >1199px | Full layout, expanded nav with all links + CTA, 110px display hero, side-by-side features |

### Touch Targets
- Pill buttons: minimum 44px height — meets WCAG minimum
- Nav links: generous padding for touch accessibility
- Mobile CTA buttons: Full-width pills on mobile for easy thumb reach

### Collapsing Strategy
- **Navigation**: Full horizontal nav → hamburger menu at mobile breakpoint
- **Hero text**: 110px → 85px → 62px → ~40px across breakpoints, maintaining extreme negative tracking proportionally
- **Feature sections**: Side-by-side (text + screenshot) → stacked vertically on mobile
- **Section spacing**: Reduces proportionally — 120px desktop → 60px mobile

## 9. Agent Prompt Guide

### Quick Color Reference
- Primary Background: Void Black (`#000000`)
- Primary Text: Pure White (`#ffffff`)
- Accent/CTA: Framer Blue (`#0099ff`)
- Secondary Text: Muted Silver (`#a6a6a6`)
- Frosted Surface: Translucent White (`rgba(255, 255, 255, 0.1)`)
- Elevation Ring: Blue Glow (`rgba(0, 153, 255, 0.15)`)

### Quick Font Reference
- Font Family: `'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Helvetica Neue, sans-serif`
- Display: weight 700, letter-spacing -3px ~ -5.5px
- Heading: weight 600–700, letter-spacing -0.8px ~ -3.1px
- Body: weight 400, line-height 1.60 (Korean), letter-spacing -0.01px
- UI/Nav: weight 500, letter-spacing -0.15px

### Example Component Prompts
- "Create a hero section on pure black background with 110px Pretendard heading (weight 700) in white, letter-spacing -5.5px, line-height 0.85, and a pill-shaped white CTA button (100px radius) with black text"
- "Design a feature card on black background with a 1px Framer Blue ring shadow border (rgba(0,153,255,0.15)), 12px border-radius, white heading in Pretendard at 22px weight 700, and muted silver (a6a6a6) body text"
- "Build a navigation bar with black background, white Pretendard text links at 15px weight 500, and a frosted pill button (rgba(255,255,255,0.1) background, 40px radius) as the CTA"

### Iteration Guide
1. Focus on ONE component at a time — the dark canvas makes each element precious
2. Always verify letter-spacing on display headings — the extreme negative tracking is non-negotiable
3. Check that Framer Blue appears ONLY on interactive elements — never as decorative background or text color for non-links
4. Ensure all buttons are pill-shaped — any squared corner immediately breaks the aesthetic
5. Test frosted glass surfaces by checking they have exactly `rgba(255, 255, 255, 0.1)` — too opaque looks like a bug, too transparent disappears
6. Verify Korean text has line-height >= 1.60 for body — tighter line-height hurts Korean readability
