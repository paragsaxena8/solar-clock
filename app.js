const searchInput = document.getElementById("searchInput");
const suggestionsBox = document.getElementById("suggestions");
const locateBtn = document.getElementById("locateBtn");
const manualBtn = document.getElementById("manualBtn");
const latInput = document.getElementById("latInput");
const lonInput = document.getElementById("lonInput");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const locationName = document.getElementById("locationName");
const solarTimeEl = document.getElementById("solarTime");
const solarLabel = document.getElementById("solarLabel");
const meanTimeEl = document.getElementById("meanTime");
const officialTimeEl = document.getElementById("officialTime");
const tzNameEl = document.getElementById("tzName");
const utcTimeEl = document.getElementById("utcTime");
const sunDot = document.getElementById("sunDot");
const diffBar = document.getElementById("diffBar");
const diffText = document.getElementById("diffText");
const toggleMapBtn = document.getElementById("toggleMapBtn");
const toggleMapLabel = document.getElementById("toggleMapLabel");
const mapSection = document.getElementById("mapSection");

let currentLat = null;
let currentLon = null;
let currentTimezone = null;
let tickInterval = null;
let searchTimer = null;

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

// ---------------- MAP SETUP ----------------
let map = null;
let mapMarker = null;
let currentTileLayer = null;

const tileStyles = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '© <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© OpenStreetMap © CARTO",
    maxZoom: 19,
  },
};

function initMap() {
  if (map) return;
  map = L.map("map", {
    center: [20, 0],
    zoom: 2,
    worldCopyJump: true,
  });
  setMapStyle("streets");

  map.on("click", async (e) => {
    const { lat, lng } = e.latlng;
    showStatus("Looking up location...");
    const info = await reverseGeocode(lat, lng);
    startWithLocation(lat, lng, info.name, info.timezone, false);
  });
}

function setMapStyle(styleKey) {
  if (!map) return;
  const style = tileStyles[styleKey];
  if (currentTileLayer) map.removeLayer(currentTileLayer);
  currentTileLayer = L.tileLayer(style.url, {
    attribution: style.attribution,
    maxZoom: style.maxZoom,
  }).addTo(map);
}

function updateMapMarker(lat, lon, popupText) {
  if (!map) return;
  if (mapMarker) {
    mapMarker.setLatLng([lat, lon]);
  } else {
    const sunIcon = L.divIcon({
      className: "sun-marker",
      html: `<div style="
        width:28px;height:28px;border-radius:50%;
        background:radial-gradient(circle,#fff7cc,#ffb800 60%,#ff8a3d);
        box-shadow:0 0 18px rgba(255,184,0,0.9),0 0 6px rgba(255,255,255,0.8);
        border:2px solid #fff;
        transform:translate(-50%,-50%);
      "></div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    mapMarker = L.marker([lat, lon], { icon: sunIcon }).addTo(map);
  }
  if (popupText) {
    const popupContent = document.createElement("span");
    popupContent.textContent = popupText;
    mapMarker.bindPopup(popupContent).openPopup();
  }
}

toggleMapBtn.addEventListener("click", () => {
  const isHidden = mapSection.classList.contains("hidden");
  if (isHidden) {
    mapSection.classList.remove("hidden");
    toggleMapLabel.textContent = "Hide Map";
    setTimeout(() => {
      initMap();
      map.invalidateSize();
      if (currentLat !== null && currentLon !== null) {
        map.setView([currentLat, currentLon], 6);
        updateMapMarker(currentLat, currentLon, locationName.textContent);
      }
    }, 50);
  } else {
    mapSection.classList.add("hidden");
    toggleMapLabel.textContent = "Show Map";
  }
});

document.querySelectorAll(".map-style-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".map-style-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    setMapStyle(btn.dataset.style);
  });
});

// ---------------- HELPERS ----------------
function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.classList.add("visible");
}
function hideStatus() {
  statusEl.classList.remove("visible");
}

function countryCodeToFlag(code) {
  if (!code || code.length !== 2) return "🌍";
  const A = 0x1f1e6;
  return String.fromCodePoint(
    A + code.toUpperCase().charCodeAt(0) - 65,
    A + code.toUpperCase().charCodeAt(1) - 65
  );
}

// ---------------- SEARCH ----------------
searchInput.addEventListener("input", (e) => {
  const q = e.target.value.trim();
  clearTimeout(searchTimer);
  if (q.length < 2) {
    suggestionsBox.classList.remove("active");
    return;
  }
  searchTimer = setTimeout(() => fetchSuggestions(q), 250);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) {
    suggestionsBox.classList.remove("active");
  }
});

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

function setButtonLoading(btn, isLoading) {
  btn.disabled = isLoading;
  if (isLoading) {
    btn.classList.add("btn-loading");
  } else {
    btn.classList.remove("btn-loading");
  }
}

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

async function reverseGeocode(lat, lon) {
  const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const cached = getCached(cache.geocode, cacheKey, 10 * 60 * 1000);
  if (cached) return cached;
  try {
    // Try Nominatim for a human-readable place name
    let placeName = `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
    try {
      const nomRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
        { headers: { "Accept-Language": "en" } }
      );
      const nom = await nomRes.json();
      if (nom && nom.display_name) {
        const a = nom.address || {};
        const place = a.city || a.town || a.village || a.county || a.state || nom.display_name.split(",")[0];
        const country = a.country || "";
        placeName = country ? `${place}, ${country}` : place;
      }
    } catch (nomErr) { console.warn("Nominatim reverse geocode failed:", nomErr); }

    // Get timezone from Open-Meteo
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1`
    );
    const data = await res.json();
    const tz = data.timezone || "UTC";
    const result = { name: placeName, timezone: tz };
    setCache(cache.geocode, cacheKey, result);
    return result;
  } catch (err) {
    console.warn("Reverse geocode failed:", err);
    const fallback = { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, timezone: "UTC" };
    setCache(cache.geocode, cacheKey, fallback);
    return fallback;
  }
}

function startWithLocation(lat, lon, name, timezone, recenterMap) {
  currentLat = lat;
  currentLon = lon;
  currentTimezone = timezone || "UTC";
  locationName.textContent = name;
  resultsEl.classList.remove("hidden");
  hideStatus();

  // Update map if it exists
  if (map) {
    if (recenterMap) {
      map.setView([lat, lon], 6);
    }
    updateMapMarker(lat, lon, name);
  }

  if (tickInterval) clearInterval(tickInterval);
  updateAll();
  tickInterval = setInterval(updateAll, 1000);
}

// ---------------- TIME LOGIC ----------------
function updateAll() {
  const now = new Date();
  const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
  const B = ((dayOfYear - 81) * 2 * Math.PI) / 365;
  const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);

  const meanHours = (utcHours + currentLon / 15 + 24) % 24;
  const trueHours = (meanHours + EoT / 60 + 24) % 24;

  meanTimeEl.textContent = formatTime(meanHours);
  solarTimeEl.textContent = formatTime(trueHours);

  if (Math.abs(trueHours - 12) < 0.01) {
    solarLabel.textContent = "☀️ Solar noon!";
  } else if (trueHours < 6 || trueHours > 20) {
    solarLabel.textContent = "🌙 Night time";
  } else {
    solarLabel.textContent = "Real time by the sun";
  }

  const t = trueHours / 24;
  const x = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 150 + t * t * 280;
  const y = (1 - t) * (1 - t) * 90 + 2 * (1 - t) * t * -30 + t * t * 90;
  sunDot.setAttribute("cx", x);
  sunDot.setAttribute("cy", y);

  try {
    const tzFormatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: currentTimezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    officialTimeEl.textContent = tzFormatter.format(now);
    tzNameEl.textContent = currentTimezone;
  } catch (tzErr) {
    console.warn("Timezone formatting failed:", tzErr);
    officialTimeEl.textContent = "--:--:--";
    tzNameEl.textContent = "Unknown";
  }

  utcTimeEl.textContent = now.toISOString().slice(11, 19);

  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: currentTimezone,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(now);
    const hh = parseInt(parts.find((p) => p.type === "hour").value);
    const mm = parseInt(parts.find((p) => p.type === "minute").value);
    const ss = parseInt(parts.find((p) => p.type === "second").value);
    const officialHours = hh + mm / 60 + ss / 3600;

    let diff = trueHours - officialHours;
    if (diff > 12) diff -= 24;
    if (diff < -12) diff += 24;
    const absDiff = Math.abs(diff);
    const diffMin = Math.round(absDiff * 60);
    const sign = diff >= 0 ? "ahead of" : "behind";
    diffText.textContent = `Solar time is ${diffMin} minute${diffMin !== 1 ? "s" : ""} ${sign} the official clock.`;
    const pct = Math.min((absDiff / 3) * 100, 100);
    diffBar.style.width = pct + "%";
  } catch (diffErr) {
    console.warn("Diff calculation failed:", diffErr);
    diffText.textContent = "—";
  }
}

function formatTime(hours) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor(((hours - h) * 60 - m) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
