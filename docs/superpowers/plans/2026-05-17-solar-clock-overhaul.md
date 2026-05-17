# Solar Clock Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Real Solar Time app with security fixes, bug fixes, sunrise/sunset feature, keyboard nav, ARIA, caching, and a celestial observatory visual redesign.

**Architecture:** Progressive Enhancement — security first, then bugs, then features, then visual. Vanilla 3-file setup (HTML/CSS/JS), no build system, no new dependencies.

**Tech Stack:** Vanilla HTML5, CSS3, ES5+ JavaScript, Leaflet 1.9.4, Open-Meteo API, Google Fonts (DM Serif Display, Inter)

---

## Files

| File | Responsibility |
|------|---------------|
| `index.html` | Page structure, favicon, font links, ARIA attributes, sunrise/sunset HTML |
| `style.css` | Full visual overhaul: new palette, typography, backgrounds, components |
| `app.js` | Security fix, bug fixes, caching, sunrise/sunset, keyboard nav, button states |

No new files. All changes are modifications to existing files.

---

### Task 1: XSS Fix — Safe DOM Construction

**Files:**
- Modify: `app.js` (lines 170-209, the `fetchSuggestions` function)

The entire `fetchSuggestions` function currently builds HTML by interpolating API data into `innerHTML`. This is the XSS vulnerability. Replace it with DOM construction.

- [ ] **Step 1: Rewrite fetchSuggestions to use DOM API**

Replace the `fetchSuggestions` function in `app.js` (lines 170-209) with:

```javascript
async function fetchSuggestions(q) {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
    );
    const data = await res.json();
    if (!data.results || data.results.length === 0) {
      suggestionsBox.textContent = "";
      const emptyItem = document.createElement("div");
      emptyItem.className = "suggestion-item";
      const emptyText = document.createElement("span");
      emptyText.className = "suggestion-text";
      emptyText.textContent = "No results found";
      emptyItem.appendChild(emptyText);
      suggestionsBox.appendChild(emptyItem);
      suggestionsBox.classList.add("active");
      return;
    }
    suggestionsBox.textContent = "";
    data.results.forEach((r) => {
      const item = document.createElement("div");
      item.className = "suggestion-item";
      item.dataset.lat = r.latitude;
      item.dataset.lon = r.longitude;
      item.dataset.tz = r.timezone || "";

      const flag = document.createElement("span");
      flag.className = "suggestion-flag";
      flag.textContent = countryCodeToFlag(r.country_code);

      const textWrap = document.createElement("div");
      textWrap.className = "suggestion-text";

      const name = document.createElement("div");
      name.className = "suggestion-name";
      name.textContent = r.name;

      const meta = document.createElement("div");
      meta.className = "suggestion-meta";
      const region = r.admin1 ? r.admin1 + ", " : "";
      meta.textContent = region + r.country;

      textWrap.appendChild(name);
      textWrap.appendChild(meta);
      item.appendChild(flag);
      item.appendChild(textWrap);

      item.dataset.name = r.name + (r.admin1 ? ", " + r.admin1 : "") + ", " + r.country;
      item.addEventListener("click", () => {
        const lat = parseFloat(item.dataset.lat);
        const lon = parseFloat(item.dataset.lon);
        const tz = item.dataset.tz;
        const itemName = item.dataset.name;
        searchInput.value = itemName;
        suggestionsBox.classList.remove("active");
        startWithLocation(lat, lon, itemName, tz, true);
      });

      suggestionsBox.appendChild(item);
    });
    suggestionsBox.classList.add("active");
  } catch (err) {
    console.warn("Search failed:", err);
    showStatus("Search failed. Check your connection.");
  }
}
```

- [ ] **Step 2: Verify XSS fix**

Open `index.html` in browser. Search for a city. Confirm suggestions appear correctly. Try searching for `<img onerror=alert(1) src=x>` — no alert should fire. Suggestions should display the literal text.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "fix: replace innerHTML with safe DOM construction in search suggestions"
```

---

### Task 2: Bug Fixes — Empty Catches, Deprecated API, Dead Code, Button States

**Files:**
- Modify: `app.js` (multiple locations)
- Modify: `style.css` (add disabled button styles)

- [ ] **Step 1: Fix empty catch blocks with console.warn**

In `app.js`, replace the empty catch in `reverseGeocode` inner try (around line 257):

```javascript
    } catch (nomErr) {
      console.warn("Nominatim reverse geocode failed:", nomErr);
    }
```

Replace the empty catch in `reverseGeocode` outer try (around line 266):

```javascript
  } catch (err) {
    console.warn("Reverse geocode failed:", err);
    return { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, timezone: "UTC" };
  }
```

Replace the empty catch in `updateAll` timezone formatting (around line 331):

```javascript
  } catch (tzErr) {
    console.warn("Timezone formatting failed:", tzErr);
    officialTimeEl.textContent = "--:--:--";
    tzNameEl.textContent = "Unknown";
  }
```

Replace the empty catch in `updateAll` diff calculation (around line 361):

```javascript
  } catch (diffErr) {
    console.warn("Diff calculation failed:", diffErr);
    diffText.textContent = "—";
  }
```

- [ ] **Step 2: Replace deprecated substr with slice**

In `app.js`, line 337, change:

```javascript
utcTimeEl.textContent = now.toISOString().substr(11, 8);
```

to:

```javascript
utcTimeEl.textContent = now.toISOString().slice(11, 19);
```

- [ ] **Step 3: Remove dead code**

Delete the commented-out line at the end of `app.js` (line 371):

```javascript
// StartWithLocation(0, 0, "Equator & Prime Meridian", "UTC", false);
```

- [ ] **Step 4: Add button loading states**

In `app.js`, add a `setButtonLoading` helper function after the existing DOM references (around line 22):

```javascript
function setButtonLoading(btn, isLoading) {
  btn.disabled = isLoading;
  if (isLoading) {
    btn.classList.add("btn-loading");
  } else {
    btn.classList.remove("btn-loading");
  }
}
```

Update the `locateBtn` click handler (around line 212) to disable/enable:

```javascript
locateBtn.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Geolocation not supported.");
    return;
  }
  setButtonLoading(locateBtn, true);
  showStatus("Getting your location...");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const info = await reverseGeocode(lat, lon);
      startWithLocation(lat, lon, info.name, info.timezone, true);
      setButtonLoading(locateBtn, false);
    },
    (err) => {
      showStatus("Location denied. Please enter coordinates manually.");
      setButtonLoading(locateBtn, false);
    }
  );
});
```

Update the `manualBtn` click handler (around line 229):

```javascript
manualBtn.addEventListener("click", async () => {
  const lat = parseFloat(latInput.value);
  const lon = parseFloat(lonInput.value);
  if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    showStatus("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
    return;
  }
  setButtonLoading(manualBtn, true);
  showStatus("Looking up location...");
  try {
    const info = await reverseGeocode(lat, lon);
    startWithLocation(lat, lon, info.name, info.timezone, true);
  } finally {
    setButtonLoading(manualBtn, false);
  }
});
```

- [ ] **Step 5: Add disabled/loading button CSS**

In `style.css`, add after the `.btn-secondary:hover` rule (after line 247):

```css
.btn:disabled,
.btn-loading {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn-loading::after {
  content: "";
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  margin-left: 8px;
  animation: spin 0.8s linear infinite;
}
```

- [ ] **Step 6: Verify bug fixes**

Open in browser. Click "Use My Location" — button should show loading spinner and be disabled during fetch. Same for "Go" button. Test coordinate validation by entering invalid values. Confirm error messages appear in console for failed API calls (check DevTools console).

- [ ] **Step 7: Commit**

```bash
git add app.js style.css
git commit -m "fix: empty catches, deprecated substr, dead code, button loading states"
```

---

### Task 3: API Caching Layer

**Files:**
- Modify: `app.js` (add cache object, modify `fetchSuggestions` and `reverseGeocode`)

- [ ] **Step 1: Add cache data structure and helper**

In `app.js`, after the existing `let` declarations (after line 27), add:

```javascript
const cache = {
  geocode: new Map(),
  search: new Map(),
};

function getCached(map, key, ttlMs) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > ttlMs) {
    map.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(map, key, data) {
  map.set(key, { data, timestamp: Date.now() });
}
```

- [ ] **Step 2: Add caching to fetchSuggestions**

In `app.js`, at the start of `fetchSuggestions` (after the function signature, before the try), add:

```javascript
  const cached = getCached(cache.search, q, 5 * 60 * 1000);
  if (cached) {
    renderSuggestions(cached);
    return;
  }
```

Then, after parsing the `data` from the API response (after `const data = await res.json();`), before the existing empty-check, add caching for successful results:

```javascript
    setCache(cache.search, q, data.results || []);
```

Wrap the existing rendering logic in a `renderSuggestions` function extracted from the current `fetchSuggestions` body. Add this new function before `fetchSuggestions`:

```javascript
function renderSuggestions(results) {
  suggestionsBox.textContent = "";
  if (!results || results.length === 0) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "suggestion-item";
    const emptyText = document.createElement("span");
    emptyText.className = "suggestion-text";
    emptyText.textContent = "No results found";
    emptyItem.appendChild(emptyText);
    suggestionsBox.appendChild(emptyItem);
    suggestionsBox.classList.add("active");
    return;
  }
  results.forEach((r) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.dataset.lat = r.latitude;
    item.dataset.lon = r.longitude;
    item.dataset.tz = r.timezone || "";

    const flag = document.createElement("span");
    flag.className = "suggestion-flag";
    flag.textContent = countryCodeToFlag(r.country_code);

    const textWrap = document.createElement("div");
    textWrap.className = "suggestion-text";

    const name = document.createElement("div");
    name.className = "suggestion-name";
    name.textContent = r.name;

    const meta = document.createElement("div");
    meta.className = "suggestion-meta";
    const region = r.admin1 ? r.admin1 + ", " : "";
    meta.textContent = region + r.country;

    textWrap.appendChild(name);
    textWrap.appendChild(meta);
    item.appendChild(flag);
    item.appendChild(textWrap);

    item.dataset.name = r.name + (r.admin1 ? ", " + r.admin1 : "") + ", " + r.country;
    item.addEventListener("click", () => {
      const lat = parseFloat(item.dataset.lat);
      const lon = parseFloat(item.dataset.lon);
      const tz = item.dataset.tz;
      const itemName = item.dataset.name;
      searchInput.value = itemName;
      suggestionsBox.classList.remove("active");
      startWithLocation(lat, lon, itemName, tz, true);
    });

    suggestionsBox.appendChild(item);
  });
  suggestionsBox.classList.add("active");
}
```

Then simplify `fetchSuggestions` to:

```javascript
async function fetchSuggestions(q) {
  const cached = getCached(cache.search, q, 5 * 60 * 1000);
  if (cached) {
    renderSuggestions(cached);
    return;
  }
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
    );
    const data = await res.json();
    const results = data.results || [];
    setCache(cache.search, q, results);
    renderSuggestions(results);
  } catch (err) {
    console.warn("Search failed:", err);
    showStatus("Search failed. Check your connection.");
  }
}
```

Note: This replaces the Task 1 version of `fetchSuggestions` with a cleaner factored version that uses the extracted `renderSuggestions`.

- [ ] **Step 3: Add caching to reverseGeocode**

In `app.js`, at the start of `reverseGeocode` (after the function signature), add:

```javascript
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = getCached(cache.geocode, cacheKey, 10 * 60 * 1000);
  if (cached) return cached;
```

Then, before each `return` statement in `reverseGeocode`, add `setCache`:

Before `return { name: placeName, timezone: tz };` (the success case):

```javascript
  const result = { name: placeName, timezone: tz };
  setCache(cache.geocode, cacheKey, result);
  return result;
```

Before the catch fallback `return`:

```javascript
  const fallback = { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, timezone: "UTC" };
  setCache(cache.geocode, cacheKey, fallback);
  return fallback;
```

- [ ] **Step 4: Verify caching works**

Open in browser. Search for a city — should hit the API. Clear Network tab in DevTools. Search for the same city again — should not make a second API call. Same test for geolocation: click "Use My Location" twice, second click should be instant.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add API caching for search and geocode results"
```

---

### Task 4: Sunrise/Sunset Feature

**Files:**
- Modify: `index.html` (add sunrise/sunset display in results section, add sun arc labels)
- Modify: `app.js` (add sunrise/sunset state, API call, rendering, sun arc update)
- Modify: `style.css` (add styles for sunrise/sunset row, updated sun arc)

- [ ] **Step 1: Add sunrise/sunset HTML to index.html**

After the closing `</div>` of the cards grid (after line 155, before `<div class="diff-section">`), add:

```html
    <div class="sun-schedule">
      <div class="sun-event">
        <span class="sun-event-icon">&#9788;</span>
        <span class="sun-event-label">Sunrise</span>
        <span id="sunriseTime" class="sun-event-time">--:--</span>
      </div>
      <div class="sun-arc-mini">
        <svg viewBox="0 0 200 60" preserveAspectRatio="xMidYMid meet">
          <path d="M 10 50 Q 100 -10 190 50" fill="none" stroke="rgba(212,175,55,0.2)" stroke-width="1.5"/>
          <line x1="10" y1="50" x2="190" y2="50" stroke="rgba(138,134,117,0.3)" stroke-width="1"/>
          <circle id="sunDotMini" cx="100" cy="15" r="5" fill="#d4af37"/>
        </svg>
      </div>
      <div class="sun-event">
        <span class="sun-event-icon">&#9788;</span>
        <span class="sun-event-label">Sunset</span>
        <span id="sunsetTime" class="sun-event-time">--:--</span>
      </div>
    </div>
```

Also update the main sun arc SVG (replace lines 113-117) to add labels and a gradient:

```html
        <svg class="sun-arc" viewBox="0 0 300 100" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stop-color="rgba(212,175,55,0.15)"/>
              <stop offset="50%" stop-color="rgba(212,175,55,0.5)"/>
              <stop offset="100%" stop-color="rgba(212,175,55,0.15)"/>
            </linearGradient>
          </defs>
          <path d="M 20 90 Q 150 -30 280 90" fill="none" stroke="url(#arcGrad)" stroke-width="2"/>
          <line x1="20" y1="90" x2="280" y2="90" stroke="rgba(138,134,117,0.2)" stroke-width="1"/>
          <text id="sunriseLabel" x="10" y="88" fill="#8a8675" font-size="9" font-family="Inter, sans-serif">--:--</text>
          <text id="sunsetLabel" x="265" y="88" fill="#8a8675" font-size="9" font-family="Inter, sans-serif">--:--</text>
          <circle id="sunDot" cx="150" cy="20" r="8" fill="#d4af37"/>
        </svg>
```

- [ ] **Step 2: Add sunrise/sunset state and API call to app.js**

Add new DOM references after the existing ones (after line 21):

```javascript
const sunriseTimeEl = document.getElementById("sunriseTime");
const sunsetTimeEl = document.getElementById("sunsetTime");
const sunriseLabel = document.getElementById("sunriseLabel");
const sunsetLabel = document.getElementById("sunsetLabel");
const sunDotMini = document.getElementById("sunDotMini");
```

Add new state variables (after `currentTimezone`):

```javascript
let currentSunrise = null;
let currentSunset = null;
```

Update the `reverseGeocode` function to also fetch sunrise/sunset. Modify the Open-Meteo API call inside `reverseGeocode` from:

```javascript
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1`
    );
```

to:

```javascript
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&daily=sunrise,sunset`
    );
```

After parsing the timezone, extract sunrise/sunset:

```javascript
    const tz = data.timezone || "UTC";
    const daily = data.daily || {};
    const sunriseISO = daily.sunrise ? daily.sunrise[0] : null;
    const sunsetISO = daily.sunset ? daily.sunset[0] : null;
    return { name: placeName, timezone: tz, sunrise: sunriseISO, sunset: sunsetISO };
```

Update the fallback return in the catch block:

```javascript
  const fallback = { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, timezone: "UTC", sunrise: null, sunset: null };
```

Update `startWithLocation` to store sunrise/sunset:

```javascript
function startWithLocation(lat, lon, name, timezone, sunrise, sunset, recenterMap) {
  currentLat = lat;
  currentLon = lon;
  currentTimezone = timezone || "UTC";
  currentSunrise = sunrise;
  currentSunset = sunset;
  locationName.textContent = name;
  // ... rest stays the same
```

Update all callers of `startWithLocation` to pass sunrise/sunset:

In the map click handler:
```javascript
startWithLocation(lat, lng, info.name, info.timezone, info.sunrise, info.sunset, false);
```

In the locateBtn handler:
```javascript
startWithLocation(lat, lon, info.name, info.timezone, info.sunrise, info.sunset, true);
```

In the manualBtn handler:
```javascript
startWithLocation(lat, lon, info.name, info.timezone, info.sunrise, info.sunset, true);
```

In the suggestion click handler (inside `renderSuggestions`):
```javascript
startWithLocation(lat, lon, itemName, tz, r.sunrise, r.sunset, true);
```

Note: `r.sunrise` and `r.sunset` come from the Open-Meteo search API which doesn't provide these, so we'll need to handle null values. The cached geocode results include sunrise/sunset, but search suggestions don't. Set `r.sunrise` and `r.sunset` to `null` for search results, and `startWithLocation` will fetch them via a separate call if needed. Actually, for simplicity, when sunrise/sunset are null, `startWithLocation` will trigger an additional geocode call. Let me add this logic:

In `startWithLocation`, after setting the state variables, add:

```javascript
  if (!currentSunrise || !currentSunset) {
    // Fetch sunrise/sunset if not provided
    (async () => {
      try {
        const info = await reverseGeocode(lat, lon);
        currentSunrise = info.sunrise;
        currentSunset = info.sunset;
      } catch (err) {
        console.warn("Could not fetch sunrise/sunset:", err);
      }
    })();
  }
```

- [ ] **Step 3: Update updateAll to display sunrise/sunset and improve solar label**

In `updateAll`, after setting `solarTimeEl.textContent`, replace the solar label logic:

```javascript
  // Update sunrise/sunset display
  if (currentSunrise) {
    try {
      const sr = new Date(currentSunrise);
      sunriseTimeEl.textContent = formatTimeFromMinutes(sr.getHours() + sr.getMinutes() / 60);
      sunriseLabel.textContent = formatTimeFromMinutes(sr.getHours() + sr.getMinutes() / 60);
    } catch (e) {
      sunriseTimeEl.textContent = "--:--";
      sunriseLabel.textContent = "--:--";
    }
  } else {
    sunriseTimeEl.textContent = "--:--";
    sunriseLabel.textContent = "--:--";
  }
  if (currentSunset) {
    try {
      const ss = new Date(currentSunset);
      sunsetTimeEl.textContent = formatTimeFromMinutes(ss.getHours() + ss.getMinutes() / 60);
      sunsetLabel.textContent = formatTimeFromMinutes(ss.getHours() + ss.getMinutes() / 60);
    } catch (e) {
      sunsetTimeEl.textContent = "--:--";
      sunsetLabel.textContent = "--:--";
    }
  } else {
    sunsetTimeEl.textContent = "--:--";
    sunsetLabel.textContent = "--:--";
  }

  // Solar label
  if (Math.abs(trueHours - 12) < 0.01) {
    solarLabel.textContent = "☀ Solar noon!";
  } else if (currentSunrise && currentSunset) {
    const srHours = new Date(currentSunrise).getHours() + new Date(currentSunrise).getMinutes() / 60;
    const ssHours = new Date(currentSunset).getHours() + new Date(currentSunset).getMinutes() / 60;
    const localTrueHours = trueHours; // already in solar time
    if (localTrueHours < srHours || localTrueHours > ssHours) {
      solarLabel.textContent = "🌙 Night time";
    } else {
      solarLabel.textContent = "Real time by the sun";
    }
  } else if (trueHours < 6 || trueHours > 20) {
    solarLabel.textContent = "🌙 Night time";
  } else {
    solarLabel.textContent = "Real time by the sun";
  }
```

Add the `formatTimeFromMinutes` helper after `formatTime`:

```javascript
function formatTimeFromMinutes(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Add sunrise/sunset CSS**

In `style.css`, add after the `.cards` rule (after line 422):

```css
.sun-schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: #161830;
  border-radius: 12px;
  border: 1px solid #2a2f55;
}

.sun-event {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.sun-event-icon {
  font-size: 1.2rem;
}

.sun-event-label {
  font-size: 0.8rem;
  color: #8a8fb8;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.sun-event-time {
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #e8eaf6;
}

.sun-arc-mini {
  flex: 1;
  max-width: 200px;
}

.sun-arc-mini svg {
  width: 100%;
  height: auto;
  display: block;
}

#sunDotMini {
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.6));
}
```

- [ ] **Step 5: Verify sunrise/sunset feature**

Open in browser. Search for a city. Confirm sunrise and sunset times appear in the schedule row and on the sun arc labels. Check that the solar label updates based on actual sunrise/sunset when available.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add sunrise/sunset display with sun arc labels"
```

---

### Task 5: Keyboard Navigation, ARIA Accessibility, Favicon

**Files:**
- Modify: `index.html` (ARIA attributes, favicon)
- Modify: `app.js` (keyboard nav logic, ARIA state management)
- Modify: `style.css` (focused suggestion style)

- [ ] **Step 1: Add ARIA attributes and favicon to index.html**

In `<head>`, after the Leaflet CSS link (line 7), add Google Fonts and favicon:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(32,32)'%3E%3Ccircle r='12' fill='%23d4af37'/%3E%3Cg stroke='%23f0d878' stroke-width='3' stroke-linecap='round'%3E%3Cline y1='-28' y2='-20'/%3E%3Cline y1='20' y2='28'/%3E%3Cline x1='-28' x2='-20'/%3E%3Cline x1='20' x2='28'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E">
```

Update the search input (line 42) with ARIA:

```html
<input id="searchInput" type="text" placeholder="Search city or country..." autocomplete="off" role="combobox" aria-expanded="false" aria-autocomplete="list" aria-activedescendant="" aria-owns="suggestions" />
```

Update the suggestions div (line 43):

```html
<div id="suggestions" class="suggestions" role="listbox" aria-label="Location suggestions"></div>
```

Update the locate button (line 46):

```html
<button id="locateBtn" class="btn btn-primary" aria-label="Use my current location">
```

Update the map toggle button (line 54):

```html
<button id="toggleMapBtn" class="btn btn-secondary" aria-label="Toggle map visibility" aria-expanded="false">
```

Update the lat/lon inputs (lines 64-65):

```html
<input id="latInput" type="number" step="any" placeholder="Latitude" aria-label="Latitude" />
<input id="lonInput" type="number" step="any" placeholder="Longitude" aria-label="Longitude" />
```

- [ ] **Step 2: Add keyboard navigation and ARIA state management to app.js**

Add a `focusedIndex` variable after the existing `let` declarations:

```javascript
let focusedIndex = -1;
```

Add a keyboard event listener after the existing `searchInput` input handler (after the `document.addEventListener("click", ...)` block):

```javascript
searchInput.addEventListener("keydown", (e) => {
  const items = suggestionsBox.querySelectorAll(".suggestion-item[data-lat]");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
    updateFocusedItem(items);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    focusedIndex = Math.max(focusedIndex - 1, 0);
    updateFocusedItem(items);
  } else if (e.key === "Enter" && focusedIndex >= 0) {
    e.preventDefault();
    items[focusedIndex].click();
  } else if (e.key === "Escape") {
    suggestionsBox.classList.remove("active");
    searchInput.setAttribute("aria-expanded", "false");
    focusedIndex = -1;
  }
});

function updateFocusedItem(items) {
  items.forEach((item, i) => {
    item.classList.toggle("suggestion-focused", i === focusedIndex);
    item.setAttribute("aria-selected", i === focusedIndex ? "true" : "false");
  });
  if (focusedIndex >= 0 && items[focusedIndex]) {
    searchInput.setAttribute("aria-activedescendant", items[focusedIndex].id || "");
    items[focusedIndex].scrollIntoView({ block: "nearest" });
  } else {
    searchInput.setAttribute("aria-activedescendant", "");
  }
}
```

Add `role="option"` and unique IDs to suggestion items in `renderSuggestions`. Update each item creation:

```javascript
    item.id = `suggestion-${suggestionIndex}`;
    item.setAttribute("role", "option");
```

Add `suggestionIndex` as a counter in the `renderSuggestions` forEach:

```javascript
function renderSuggestions(results) {
  suggestionsBox.textContent = "";
  if (!results || results.length === 0) {
    const emptyItem = document.createElement("div");
    emptyItem.className = "suggestion-item";
    const emptyText = document.createElement("span");
    emptyText.className = "suggestion-text";
    emptyText.textContent = "No results found";
    emptyItem.appendChild(emptyText);
    suggestionsBox.appendChild(emptyItem);
    suggestionsBox.classList.add("active");
    return;
  }
  results.forEach((r, suggestionIndex) => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.id = `suggestion-${suggestionIndex}`;
    item.setAttribute("role", "option");
    item.dataset.lat = r.latitude;
    item.dataset.lon = r.longitude;
    item.dataset.tz = r.timezone || "";
    // ... rest of item creation stays the same
```

Update ARIA expanded state when suggestions appear/disappear. In `renderSuggestions`, at the end before closing, add:

```javascript
  searchInput.setAttribute("aria-expanded", "true");
```

In the click handler that closes suggestions:

```javascript
      suggestionsBox.classList.remove("active");
      searchInput.setAttribute("aria-expanded", "false");
```

Also update the document click handler:

```javascript
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) {
    suggestionsBox.classList.remove("active");
    searchInput.setAttribute("aria-expanded", "false");
  }
});
```

Also update ARIA for the map toggle button:

```javascript
toggleMapBtn.addEventListener("click", () => {
  const isHidden = mapSection.classList.contains("hidden");
  if (isHidden) {
    mapSection.classList.remove("hidden");
    toggleMapLabel.textContent = "Hide Map";
    toggleMapBtn.setAttribute("aria-expanded", "true");
    // ... rest stays same
  } else {
    mapSection.classList.add("hidden");
    toggleMapLabel.textContent = "Show Map";
    toggleMapBtn.setAttribute("aria-expanded", "false");
  }
});
```

- [ ] **Step 3: Add keyboard-focused suggestion style to style.css**

Add after the `.suggestion-item:hover` rule (after line 188):

```css
.suggestion-item.suggestion-focused {
  background: #1f2347;
  padding-left: 22px;
}

.suggestion-item.suggestion-focused .suggestion-name {
  color: #f0d878;
}
```

- [ ] **Step 4: Verify keyboard nav and ARIA**

Open in browser. Search for a city. Press ArrowDown — items should highlight. ArrowUp — move up. Enter — select. Escape — close dropdown. Tab — close dropdown. Check DevTools Accessibility tab for ARIA attributes on the search input and suggestions.

- [ ] **Step 5: Commit**

```bash
git add index.html style.css app.js
git commit -m "feat: add keyboard navigation, ARIA accessibility, and favicon"
```

---

### Task 6: Visual Redesign — Foundations (Colors, Background, Typography)

**Files:**
- Modify: `style.css` (complete color and typography overhaul)
- Modify: `index.html` (font links already added in Task 5)

This is the largest task. It replaces the entire visual foundation.

- [ ] **Step 1: Update CSS custom properties and base styles**

Replace the opening of `style.css` (lines 1-14) with:

```css
:root {
  --bg-deep: #05060f;
  --bg-surface: #0c0f1f;
  --bg-input: #0e1225;
  --border: #1a1e3a;
  --border-gold: rgba(212,175,55,0.12);
  --border-gold-hover: rgba(212,175,55,0.25);
  --gold: #d4af37;
  --gold-light: #f0d878;
  --gold-dim: #a68b2a;
  --amber: #c48a3f;
  --text-primary: #e8e4d9;
  --text-secondary: #8a8675;
  --text-muted: #5e5b50;
  --red: #e05252;
  --font-display: "DM Serif Display", Georgia, serif;
  --font-body: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  background: var(--bg-deep);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}
```

- [ ] **Step 2: Replace stars with atmospheric depth background**

Replace the `.stars` rules (lines 16-40) with:

```css
.stars {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 0;
  background-color: var(--bg-deep);
  background-image:
    radial-gradient(ellipse at 80% 10%, rgba(212,175,55,0.04) 0%, transparent 50%),
    radial-gradient(2px 2px at 15% 25%, rgba(232,228,217,0.5), transparent),
    radial-gradient(1px 1px at 35% 65%, rgba(232,228,217,0.35), transparent),
    radial-gradient(1.5px 1.5px at 55% 15%, rgba(232,228,217,0.45), transparent),
    radial-gradient(1px 1px at 75% 80%, rgba(232,228,217,0.3), transparent),
    radial-gradient(2px 2px at 90% 40%, rgba(240,216,120,0.4), transparent),
    radial-gradient(1px 1px at 10% 90%, rgba(232,228,217,0.35), transparent),
    radial-gradient(1.5px 1.5px at 45% 45%, rgba(232,228,217,0.4), transparent),
    radial-gradient(1px 1px at 65% 30%, rgba(232,228,217,0.3), transparent),
    radial-gradient(2px 2px at 25% 55%, rgba(240,216,120,0.3), transparent),
    radial-gradient(1px 1px at 85% 60%, rgba(232,228,217,0.35), transparent),
    radial-gradient(1.5px 1.5px at 5% 40%, rgba(232,228,217,0.4), transparent),
    radial-gradient(1px 1px at 50% 70%, rgba(232,228,217,0.25), transparent),
    radial-gradient(2px 2px at 30% 10%, rgba(240,216,120,0.35), transparent),
    radial-gradient(1px 1px at 70% 95%, rgba(232,228,217,0.3), transparent),
    radial-gradient(1.5px 1.5px at 95% 75%, rgba(232,228,217,0.45), transparent),
    radial-gradient(1px 1px at 40% 85%, rgba(232,228,217,0.25), transparent),
    radial-gradient(2px 2px at 60% 5%, rgba(240,216,120,0.3), transparent),
    radial-gradient(1px 1px at 20% 50%, rgba(232,228,217,0.3), transparent),
    radial-gradient(1.5px 1.5px at 80% 20%, rgba(232,228,217,0.4), transparent);
  background-size: 100% 100%;
}

.stars::after {
  content: "";
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.5;
  pointer-events: none;
}
```

Remove the old `@keyframes twinkle` animation (lines 37-40) — the new background doesn't need it.

- [ ] **Step 3: Update all component colors throughout style.css**

This is a systematic find-and-replace pass. Update these color mappings across the entire file:

| Old value | New value | Property/Context |
|-----------|-----------|-----------------|
| `#0a0e27` | `var(--bg-deep)` | backgrounds |
| `#161830` | `var(--bg-surface)` | card/input backgrounds |
| `#2a2f55` | `var(--border)` | borders |
| `#1f2347` | `rgba(212,175,55,0.08)` | hover backgrounds |
| `#353b6b` | `var(--border-gold-hover)` | active borders |
| `#3a4080` | `var(--border-gold-hover)` | card hover borders |
| `#ffb800` | `var(--gold)` | primary gold |
| `#ffd54a` | `var(--gold-light)` | light gold text |
| `#ff8a3d` | `var(--amber)` | warm accent |
| `#e8eaf6` | `var(--text-primary)` | primary text |
| `#b8bce0` | `var(--text-secondary)` | secondary text |
| `#8a8fb8` | `var(--text-secondary)` | muted text |
| `#6a6f95` | `var(--text-muted)` | placeholder/footer text |
| `#ff5e7e` | `var(--red)` | error/pin color |

Also update:
- `#1f1a3d` and `#2a1f4d` (highlight card gradient) → `var(--bg-surface)` with gold border-top
- `rgba(255,184,0,0.3)` → `rgba(212,175,55,0.3)` (shadows)
- `rgba(255,138,61,0.3)` → `rgba(196,138,63,0.3)` (button shadows)
- `rgba(255,138,61,0.45)` → `rgba(196,138,63,0.45)` (button hover shadows)
- `rgba(255,255,255,0.2)` → `rgba(138,134,117,0.3)` (muted lines)
- `rgba(255,213,74,0.3)` → `rgba(212,175,55,0.3)` (sun arc stroke)
- `rgba(255,184,0,0.8)` → `rgba(212,175,55,0.8)` (sun dot glow)

- [ ] **Step 4: Update typography throughout**

Replace all `font-family` references to use CSS variables:

- `.header h1` font: change to `font-family: var(--font-display);`
- `.time-big` font: change to `font-family: var(--font-display);` and add `letter-spacing: 0.05em;`
- All other text uses `var(--font-body)` by default from the body rule

- [ ] **Step 5: Update specific component styles for observatory aesthetic**

Update `.card-highlight` — remove gradient background, add gold top border:

```css
.card-highlight {
  background: var(--bg-surface);
  border-top: 2px solid var(--gold);
  border-color: var(--gold);
}
```

Replace the `.card-highlight::before` pulse animation with a subtle shimmer:

```css
.card-highlight::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(212,175,55,0.06), transparent 60%);
  pointer-events: none;
  border-radius: 16px;
}
```

Remove the `@keyframes pulse` animation.

Update `.card` hover to use gold border:

```css
.card:hover {
  transform: translateY(-4px);
  border-color: var(--border-gold-hover);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 1px var(--border-gold-hover);
}
```

Update `.card-head` — add a separator line:

```css
.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: 1;
}
```

Update `.card-highlight .time-big` color:

```css
.card-highlight .time-big {
  color: var(--gold-light);
}
```

Update button styles:

```css
.btn-primary {
  background: transparent;
  color: var(--gold);
  border: 1.5px solid var(--gold);
  box-shadow: none;
  transition: background-color 0.3s, color 0.3s, transform 0.15s;
}

.btn-primary:hover {
  background: var(--gold);
  color: var(--bg-deep);
  box-shadow: 0 4px 14px rgba(212,175,55,0.25);
}

.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  border-color: var(--border-gold-hover);
  background: rgba(212,175,55,0.06);
}
```

Update search input focus:

```css
#searchInput:focus {
  border-color: var(--gold);
  box-shadow: 0 2px 0 0 var(--gold), 0 0 0 3px rgba(212,175,55,0.12);
}
```

Update suggestion hover:

```css
.suggestion-item:hover,
.suggestion-item.suggestion-focused {
  background: rgba(212,175,55,0.08);
  border-left: 2px solid var(--gold);
  padding-left: 20px;
}

.suggestion-item.suggestion-focused .suggestion-name {
  color: var(--gold-light);
}
```

- [ ] **Step 6: Verify visual foundation**

Open in browser. Confirm: deep black background with subtle warm nebula glow, gold accents on highlight card border-top, serif display font on heading and times, warm off-white text color throughout. All interactive elements should be functional.

- [ ] **Step 7: Commit**

```bash
git add style.css
git commit -m "design: celestial observatory foundation — colors, background, typography"
```

---

### Task 7: Visual Redesign — Components (Diff Bar, Sun Arc, Final Polish)

**Files:**
- Modify: `style.css` (diff bar redesign, sun arc, final polish)
- Modify: `app.js` (diff bar calculation update)

- [ ] **Step 1: Redesign diff bar as instrument gauge**

Replace the `.diff-section`, `.diff-bar-wrap`, `.diff-bar`, and `.diff-text` styles with:

```css
.diff-section {
  background: var(--bg-surface);
  border-radius: 16px;
  padding: 20px;
  border: 1px solid var(--border-gold);
}

.diff-section h4 {
  font-family: var(--font-body);
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin-bottom: 16px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.diff-bar-wrap {
  height: 32px;
  background: linear-gradient(90deg,
    var(--gold) 0%,
    rgba(212,175,55,0.3) 25%,
    rgba(138,134,117,0.15) 50%,
    rgba(196,138,63,0.3) 75%,
    var(--amber) 100%
  );
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  border: 1px solid var(--border);
}

.diff-bar-wrap::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  background: var(--gold);
  z-index: 2;
  box-shadow: 0 0 6px rgba(212,175,55,0.5);
}

.diff-bar-wrap::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: repeating-linear-gradient(
    90deg,
    transparent,
    transparent 9%,
    rgba(232,228,217,0.06) 9%,
    rgba(232,228,217,0.06) 10%
  );
  z-index: 1;
}

.diff-bar {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: 4px;
  background: var(--gold-light);
  border-radius: 2px;
  transition: left 0.6s ease;
  z-index: 3;
  box-shadow: 0 0 8px rgba(212,175,55,0.6);
}

.diff-text {
  margin-top: 12px;
  font-size: 0.95rem;
  color: var(--text-primary);
  text-align: center;
}
```

- [ ] **Step 2: Update diff bar calculation in app.js**

The diff bar needs to change from a width-based bar to a position-based needle. Replace the diff bar logic in `updateAll`:

Change from:
```javascript
    const pct = Math.min((absDiff / 3) * 100, 100);
    diffBar.style.width = pct + "%";
```

to:

```javascript
    // Position the needle: center is 50%, map ±120min range to 0-100%
    const needlePos = 50 + (diff / 120) * 50;
    diffBar.style.left = Math.max(2, Math.min(98, needlePos)) + "%";
```

- [ ] **Step 3: Update sun arc styles**

Replace `.sun-arc` and `#sunDot` styles:

```css
.sun-arc {
  width: 100%;
  height: auto;
  display: block;
  margin-top: 16px;
  overflow: visible;
}

#sunDot {
  filter: drop-shadow(0 0 8px rgba(212,175,55,0.7));
  transition: cx 1s linear, cy 1s linear;
}
```

- [ ] **Step 4: Update location display pin color**

```css
.pin-icon {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

Update the pin SVG color in `index.html` — change `fill="#ff5e7e"` and `stroke="#ff5e7e"` to `fill="#e05252"` and `stroke="#e05252"`.

- [ ] **Step 5: Update sun schedule colors for observatory theme**

Replace the `.sun-schedule` background and border colors added in Task 4:

```css
.sun-schedule {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 24px;
  padding: 16px 20px;
  background: var(--bg-surface);
  border-radius: 12px;
  border: 1px solid var(--border-gold);
}
```

Update `.sun-event-time` color:

```css
.sun-event-time {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--gold-light);
  letter-spacing: 0.05em;
}
```

Update `.sun-event-label` color:

```css
.sun-event-label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.15em;
}
```

Update `.sun-event-icon` color:

```css
.sun-event-icon {
  font-size: 1.2rem;
  color: var(--gold);
}
```

- [ ] **Step 6: Final responsive updates**

Update the `@media (max-width: 600px)` rule to use CSS variables:

```css
@media (max-width: 600px) {
  .header h1 {
    font-size: 1.6rem;
    text-align: center;
  }
  .tagline {
    text-align: center;
  }
  .logo {
    flex-direction: column;
    gap: 8px;
  }
  .time-big {
    font-size: 1.8rem;
  }
  .manual-coords input {
    flex: 1;
    min-width: 100px;
  }
  #map {
    height: 320px;
  }
  .map-style-switch {
    width: 100%;
    justify-content: space-between;
  }
  .map-style-btn {
    flex: 1;
    padding: 8px 6px;
    font-size: 0.75rem;
  }
  .sun-schedule {
    flex-direction: column;
    gap: 12px;
  }
  .sun-arc-mini {
    max-width: 100%;
  }
}
```

- [ ] **Step 7: Verify complete visual redesign**

Open in browser. Confirm the full celestial observatory aesthetic: deep blacks, gold accents, serif time display, instrument-gauge diff bar, atmospheric star field, warm off-white text, gold-bordered cards, sunrise/sunset row. Test all interactive elements: search, geolocation, map toggle, keyboard nav.

- [ ] **Step 8: Commit**

```bash
git add style.css app.js index.html
git commit -m "design: complete celestial observatory visual overhaul"
```

---

### Task 8: Final Verification Pass

**Files:**
- All three files

- [ ] **Step 1: Cross-browser visual check**

Open in Chrome, Firefox, and Edge (or Safari if available). Verify:
- Google Fonts load correctly (DM Serif Display for headings/times, Inter for body)
- All CSS variables resolve properly
- Star field background renders with noise texture overlay
- Sun arc SVG displays with gradient stroke and labels
- Diff bar renders as instrument gauge with centered marker
- All interactive elements work: search, keyboard nav, geolocation, map, manual coords
- Sunrise/sunset times display correctly
- Favicon appears in browser tab

- [ ] **Step 2: Accessibility check**

- Tab through all interactive elements — focus states should be visible
- Arrow keys navigate search suggestions
- ARIA attributes present in DevTools Accessibility panel
- Screen reader announces search as combobox with suggestions listbox

- [ ] **Step 3: Functional regression check**

- Search for a city, verify suggestions appear and are clickable
- Click "Use My Location", verify geolocation works
- Enter manual coordinates, verify location lookup
- Toggle map, verify it shows/hides
- Click on map, verify location updates
- Verify all four time displays update every second
- Verify sunrise/sunset times appear after location is set
- Verify diff bar needle moves to correct position
- Verify keyboard navigation (ArrowDown/Up/Enter/Escape) works

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: final verification adjustments"
```