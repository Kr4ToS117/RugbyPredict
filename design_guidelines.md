# Design Guidelines: Rugby Predictions Dashboard

## Design Approach

**Selected Approach:** Design System - Modern Analytics Dashboard (Shadcn/ui inspired)

**Justification:** This production-ready analytics platform prioritizes data density, workflow efficiency, and professional presentation. The design system approach ensures consistency across complex data tables, interactive charts, validation workflows, and model management interfaces. Inspired by modern analytics platforms like Retool, Grafana, and Linear's data-heavy views.

**Key Design Principles:**
- Data-first hierarchy: Information architecture optimized for quick scanning and decision-making
- Professional credibility: Clean, sophisticated aesthetic that builds trust in predictions
- Workflow clarity: Clear visual states for data validation, model status, and risk management
- Performance transparency: Always-visible KPIs and system health indicators

## Core Design Elements

### A. Color Palette

**Dark Mode Primary (Default):**
- Background: 222 47% 11% (deep slate, almost black)
- Surface: 217 33% 17% (elevated slate cards)
- Surface Elevated: 215 28% 22% (modals, dropdowns)
- Border: 215 20% 27% (subtle dividers)
- Text Primary: 210 40% 98% (near white, high contrast)
- Text Secondary: 215 16% 65% (muted for labels)
- Text Muted: 215 14% 45% (metadata, timestamps)

**Accent Colors (Semantic):**
- Primary Action: 217 91% 60% (vibrant blue for CTAs, links)
- Success/Positive: 142 76% 36% (green for wins, validation passed)
- Warning/Edge: 38 92% 50% (amber for medium priority, betting edge indicators)
- Danger/Loss: 0 84% 60% (red for losses, validation failures, high risk)
- Info/Neutral: 199 89% 48% (cyan for informational badges)

**Data Visualization Palette:**
- ROI Positive: 142 71% 45%
- ROI Negative: 0 72% 51%
- Probability Gradient: 217 91% 60% to 142 76% 36% (blue to green)
- Chart Grid: 215 20% 27% at 30% opacity

### B. Typography

**Font Families:**
- Primary: Inter (Google Fonts) - exceptional readability for data-dense interfaces
- Monospace: JetBrains Mono (Google Fonts) - for numerical data, odds, probabilities

**Type Scale:**
- Display (H1): 32px/40px, font-semibold (page titles)
- Heading (H2): 24px/32px, font-semibold (section headers)
- Subheading (H3): 18px/28px, font-medium (card titles, table headers)
- Body Large: 16px/24px, font-normal (primary content)
- Body: 14px/20px, font-normal (table data, descriptions)
- Caption: 12px/16px, font-normal (metadata, timestamps)
- Mono Data: 14px/20px, font-mono (odds, probabilities, monetary values)

### C. Layout System

**Spacing Primitives:** Tailwind units of 1, 2, 3, 4, 6, 8, 12, 16, 20, 24
- Micro spacing (gaps, padding): 1, 2, 3, 4
- Component spacing: 4, 6, 8
- Section spacing: 12, 16, 20, 24

**Grid System:**
- Sidebar navigation: 64px collapsed, 240px expanded
- Main content: max-w-7xl with px-6 lg:px-8
- Dashboard cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-3 with gap-6
- Data tables: Full width within container with horizontal scroll on mobile

**Page Structure:**
```
Top Bar (h-16): Logo + breadcrumbs + quick actions + user profile
Sidebar (w-64): Persistent navigation, collapsible on mobile
Main Content Area: pt-6 px-6 pb-12, scrollable
```

### D. Component Library

**Navigation:**
- Top bar: Dark background (222 47% 11%), height 64px, subtle bottom border
- Sidebar: Vertical nav with icon+text, active state with blue accent border-l-2, hover state with subtle background change
- Breadcrumbs: Text-sm with chevron separators, last item font-medium

**Cards & Surfaces:**
- Dashboard cards: Rounded-lg (border-radius 12px), border 1px, p-6, hover:shadow-lg transition
- Stat cards: Grid layout with large numbers (text-3xl font-bold font-mono), trend indicators (↑↓ with color)
- Chart containers: p-4, min-height 320px, responsive aspect ratios

**Data Tables:**
- Sticky header: bg-surface with subtle shadow when scrolled
- Row hover: Subtle background highlight (215 28% 22%)
- Zebra striping: Alternate rows with 215 20% 15% background
- Cell padding: px-4 py-3
- Sortable columns: Arrow indicators, clickable header
- Row actions: Right-aligned icon buttons, revealed on hover
- Pagination: Bottom-aligned, showing "X-Y of Z results"

**Forms & Inputs:**
- Input fields: h-10, px-3, rounded-md, border, dark background (217 33% 17%), focus ring with primary color
- Select dropdowns: Chevron icon, max-height with scroll for long lists
- Checkboxes/Radio: Accent primary color when checked
- Form sections: Grouped with subtle dividers, clear labels above inputs
- Validation states: Red border + error message below for errors, green border for success

**Charts (Using Recharts or similar):**
- Line charts: 2px stroke, gradient fill below line (subtle)
- Bar charts: Rounded top corners, gap between bars
- Calibration plots: Scatter with diagonal reference line
- Tooltips: Dark background, white text, rounded corners, drop shadow

**Buttons:**
- Primary: bg-primary (217 91% 60%), text-white, h-10, px-4, rounded-md, font-medium, hover:opacity-90
- Secondary: border, transparent bg, hover:bg-surface-elevated
- Outline on images: backdrop-blur-md bg-white/10 border border-white/20 text-white (no custom hover states)
- Danger: bg-red-600, text-white for destructive actions
- Icon buttons: Square (h-10 w-10), rounded-md, hover:bg-surface-elevated

**Badges & Tags:**
- Competition badges: Small (h-6), rounded-full, colored by league
- Status badges: Uppercase text-xs, px-2, rounded-md (Success=green, Warning=amber, Error=red, Info=cyan)
- Probability indicators: Circular or pill-shaped, gradient background based on confidence

**Modals & Overlays:**
- Modal backdrop: bg-black/60 backdrop-blur-sm
- Modal container: max-w-2xl, rounded-xl, p-6, bg-surface-elevated, shadow-2xl
- Validation queue modal: Wide (max-w-4xl), split view (conflict on left, resolution on right)

**Special Components:**
- Kelly Calculator: Interactive slider + numeric input, real-time stake calculation display
- Risk Meters: Horizontal bar charts showing exposure vs limits, color-coded (green → amber → red)
- Calibration Chart: Diagonal reference line, scatter points, error bands
- Feature Importance: Horizontal bar chart sorted by importance, truncated labels with tooltips

### E. Animations

**Minimal, Purposeful Only:**
- Page transitions: None (instant navigation)
- Card hover: transform scale-[1.01] transition-transform duration-200
- Loading states: Subtle pulse animation on skeleton screens
- Chart rendering: Fade-in opacity over 400ms
- Notification toasts: Slide-in from top-right with bounce easing
- **Avoid:** Excessive scroll-triggered animations, decorative motion

## Page-Specific Design Notes

**Overview Dashboard:**
- 3-column KPI grid at top (ROI, Yield, Hit Rate, Brier Score)
- 2-column chart section (ROI cumulative line chart + calibration scatter plot)
- Alert feed: List of cards with icons, timestamps, severity badges
- Upcoming fixtures widget: Compact table, first 5 matches, "View All" link

**Data Intake Monitor:**
- Status timeline: Horizontal progress bar showing pipeline stages
- Connector grid: Cards with last run time, success rate, duration, status icon
- Log viewer: Monospace font, dark code-editor aesthetic, filterable by severity

**Validation Queue:**
- Two-pane layout: Conflict list (left 40%), resolution interface (right 60%)
- Conflict cards: Highlight differing values, show source reputation scores
- Resolution UI: Radio buttons for source selection, textarea for comments, "Lock & Resolve" button
- Audit trail: Collapsed accordion below resolution form

**Fixtures & Picks:**
- Advanced filter bar: League multi-select, date range picker, weather/absences toggles
- Match cards in grid: Team names, competition badge, date/time, key stats
- Probability display: Three-segment horizontal bar (Home/Draw/Away) with percentages
- Edge indicator: Badge with "+X%" when edge detected
- Stake suggestion: Calculator widget with strategy selector and slider

**Bankroll & Bets:**
- Bet entry form: Sticky top section with quick entry fields
- Risk dashboard: Gauge charts for exposure limits, stop-loss proximity
- Bet history table: Filterable, sortable, expandable rows for bet details
- Performance charts: ROI by league/market/strategy, time-series line chart
- Export button: Icon button with dropdown (CSV/PDF options)

**Model Lab:**
- Version timeline: Horizontal cards showing deployed models with badges
- Feature importance: Sortable horizontal bar chart
- Backtest results: Metrics table + temporal performance chart
- Promote to prod: Prominent button with confirmation modal

**Post-Weekend Review:**
- Import section: File upload + manual result entry form
- Prediction accuracy table: Predicted vs actual, color-coded differences
- Error attribution: Categorized list (lineup changes, weather, upset)
- Report generation: Button to create HTML/PDF, preview pane

**Settings:**
- Tabbed interface: API Keys, Team Mappings, Scheduling, User Roles
- Secret inputs: Password field style with "Show" toggle, save confirmation
- Mapping table: Editable inline, add/remove rows
- Schedule editor: Cron expression builder with visual preview

## Images

**Hero Images:** Not applicable - this is a data-focused dashboard without marketing/landing pages

**Contextual Images:**
- Team logos: Small (h-8 w-8), rounded, displayed in fixtures and match cards
- Competition badges: Tiny (h-5 w-5), displayed inline with league names
- Placeholder charts: Use actual chart screenshots in documentation/onboarding

**Image Treatment:**
- All team/league logos with subtle drop shadow for definition against dark background
- SVG preferred for logos (scalable, crisp)
- Fallback: First letter of team name in colored circle if logo unavailable