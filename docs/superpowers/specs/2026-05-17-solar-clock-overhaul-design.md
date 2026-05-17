# Solar Clock Overhaul Design Spec

**Date:** 2026-05-17
**Status:** Draft
**Approach:** Progressive Enhancement (security → bugs → features → visual)

## Overview

Overhaul the Real Solar Time web app with security fixes, bug fixes, feature additions, and a "celestial observatory" visual redesign. The app stays a vanilla 3-file setup (HTML/CSS/JS) with no build system.

## 1. Security Fixes

### XSS in Search Suggestions
- **Problem:** `innerHTML` used with unsanitized API data in `app.js:181-192`. API responses containing `<script>` or `onerror` attributes would execute.
- **Fix:** Replace all `innerHTML` assignments with safe DOM construction using `document.createElement`. Set `textContent` for display strings, `dataset` for data attributes, `addEventListener` for click handlers. Never interpolate API data into HTML strings.

### Scope
- `fetchSuggestions()` — build suggestion items via DOM API
- Any other `innerHTML` usage in app.js — audit and replace

## 2. Bug Fixes

### Empty catch blocks
- Replace all `catch {}` with `catch (err) { console.warn("...", err); }` plus the existing graceful fallback
- Locations: app.js:257 (Nominatim failure), app.js:266 (reverseGeocode total failure), app.js:331 (timezone formatting), app.js:361 (diff calculation)

### Deprecated substr
- Change `now.toISOString().substr(11, 8)` → `now.toISOString().slice(11, 19)` (app.js:337)

### Dead code
- Remove commented-out line at app.js:371

### Button loading states
- Add `disabled` attribute + visual loading state to "Use My Location" and "Go" buttons while API calls are in flight
- Prevents double-submission and gives user feedback
- CSS: add `.btn:disabled` styles with reduced opacity and `cursor: not-allowed`
- JS: set `disabled = true` at start of async handler, `disabled = false` in finally block

## 3. Feature Additions

### Sunrise/Sunset Display
- Extend Open-Meteo API call to include `&daily=sunrise,sunset`
- Parse ISO 8601 datetime strings from the response
- Display as instrument readout beneath the time cards: "☉ ↑ 06:42   ☉ ↓ 19:18"
- Enhance sun arc SVG: draw arc endpoints at sunrise/sunset positions, shade night portion
- Use sunrise/sunset data to determine day/night label more accurately (replacing the simple hour-based check)

### Keyboard Navigation for Suggestions
- Add `keydown` listener on search input for ArrowUp/ArrowDown/Enter/Escape
- Maintain `focusedIndex` variable, highlight focused item with `.suggestion-focused` class
- Enter selects focused item, Escape closes dropdown, Tab closes dropdown
- Add `aria-activedescendant` updates to search input

### ARIA Accessibility
- Search input: `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, `aria-activedescendant`
- Suggestions container: `role="listbox"`, `aria-label="Location suggestions"`
- Suggestion items: `role="option"`, `aria-selected` when focused
- Locate button: `aria-label="Use my current location"`
- Map toggle: `aria-label="Toggle map visibility"`, `aria-expanded`
- Lat/lon inputs: `aria-label="Latitude"`, `aria-label="Longitude"`

### Favicon
- SVG favicon of the sun icon as a data URI in `<link rel="icon">`
- Matches the app's visual identity, no external file needed

### API Caching
- In-memory cache object: `{ geocode: Map<string, {data, timestamp}>, search: Map<string, {data, timestamp}> }`
- Geocode cache: 10-minute TTL, keyed by `lat,lon`
- Search cache: 5-minute TTL, keyed by query string
- Before fetching, check cache. After fetching, store in cache.
- Simple, no eviction beyond TTL — acceptable for a single-session tool

## 4. Visual Redesign — Celestial Observatory

### Typography
- **Display/times:** DM Serif Display via Google Fonts — refined serif with elegant contrast for instrument-like time readouts
- **Body/labels:** Inter via Google Fonts — legible at small sizes, paired intentionally with the serif
- **Time digits:** `font-variant-numeric: tabular-nums` + `letter-spacing: 0.05em` for watch-dial feel

### Color Palette
| Role | Current | New |
|------|---------|-----|
| Background | `#0a0e27` | `#05060f` (near-black, blue undertone) |
| Surface/cards | `#161830` | `#0c0f1f` with `1px solid rgba(212,175,55,0.12)` |
| Primary gold | `#ffb800` | `#d4af37` (metallic gold) |
| Light gold | `#ffd54a` | `#f0d878` |
| Accent warm | `#ff8a3d` | `#c48a3f` (amber) |
| Text primary | `#e8eaf6` | `#e8e4d9` (warm off-white) |
| Text secondary | `#8a8fb8` | `#8a8675` (warm muted) |
| Error/alert | `#ff5e7e` | `#e05252` (warm red) |

### Background — Atmospheric Depth
- Base: `#05060f`
- Layer 1: Radial gradient nebula — subtle warm gold `rgba(212,175,55,0.03)` bleeding from top-right
- Layer 2: Scattered star dots (20-30 `radial-gradient` points), varying sizes (1-3px) and opacity (0.3-0.7)
- Layer 3: Subtle noise texture via SVG `<filter>` for grain
- Slow drift animation on one star layer (translate over 60s)

### Card Redesign
- Cards: thin gold borders `rgba(212,175,55,0.15)` with subtle inner glow `box-shadow: inset 0 1px 0 rgba(212,175,55,0.08)`
- Highlight (solar time) card: `border-top: 2px solid #d4af37` — luxury watch face accent
- Remove pulse animation → replace with subtle gold shimmer on hover (background-position shift)
- Fine horizontal rule between icon+title row and time display (like instrument panel separators)

### Sun Arc Redesign
- Gradient stroke: gold at apex, fading to dim at endpoints
- Mark sunrise/sunset positions on arc baseline with small diamond glyphs (◇)
- Golden glow trail behind sun dot (CSS filter or SVG filter)
- Label arc endpoints with sunrise/sunset times

### Diff Bar Redesign
- Instrument-gauge style: horizontal track with tick marks, centered zero point, needle/indicator showing offset direction
- Feels like a watchmaker's calibration tool
- Gold needle/indicator, subtle tick marks in muted gold

### Button Refinement
- Primary: gold border + gold text on dark surface (not filled gradient) — more restrained, luxury feel
- Hover: gold fill slides in from left via `background-size` transition
- Locate button icon: subtle compass-needle rotation on hover (CSS transform)

### Search Refinement
- Input: thin gold bottom border that expands on focus (width transition from center)
- Suggestions dropdown: gold left-border accent on each item on hover/focus

## 5. Architecture

No structural changes. Three files remain:
- `index.html` — structure, favicon, font links, ARIA attributes
- `style.css` — full visual overhaul, new component styles
- `app.js` — security fix, bug fixes, new features (sunrise/sunset, keyboard nav, caching, button states)

No new files, no dependencies beyond existing Leaflet + Open-Meteo API.