// Leaflet map (outside Alpine reactivity)
let map = null;
let mapMarker = null;
let currentTileLayer = null;

const tileStyles = {
  streets: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics",
    maxZoom: 19,
  },
  terrain: {
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    maxZoom: 17,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    maxZoom: 19,
  },
};

function solarClock() {
  return {
    // UI State
    searchQuery: "",
    suggestions: [],
    suggestionsVisible: false,
    focusedIndex: -1,
    resultsVisible: false,
    mapVisible: false,
    coordsVisible: false,
    statusMsg: "",
    statusVisible: false,
    locateLoading: false,
    coordsLoading: false,
    activeMapStyle: "streets",

    // Display Data
    locationName: "—",
    solarTime: "--:--:--",
    solarLabel: "Real time by the sun",
    meanTime: "--:--:--",
    officialTime: "--:--:--",
    tzName: "—",
    utcTime: "--:--:--",
    diffBadge: "—",
    diffAhead: true,
    diffDirection: "behind",
    diffBarLeft: "50%",
    sunriseLabel: "--:--",
    sunsetLabel: "--:--",
    sunDotX: 150,
    sunDotY: 20,
    latValue: "",
    lonValue: "",

    // Internal
    currentLat: null,
    currentLon: null,
    currentTimezone: null,
    currentSunrise: null,
    currentSunset: null,
    tickInterval: null,
    cache: { geocode: new Map(), search: new Map() },

    // Lifecycle
    init() {
      this.$watch("mapVisible", (value) => {
        if (value) {
          this.$nextTick(() => {
            this.initMap();
            if (map) map.invalidateSize();
            if (this.currentLat !== null) {
              map.setView([this.currentLat, this.currentLon], 6);
              this.updateMapMarker(this.currentLat, this.currentLon, this.locationName);
            }
          });
        }
      });
    },

    // Cache
    getCached(cacheMap, key, ttlMs) {
      const entry = cacheMap.get(key);
      if (!entry) return null;
      if (Date.now() - entry.timestamp > ttlMs) {
        cacheMap.delete(key);
        return null;
      }
      return entry.data;
    },

    setCache(cacheMap, key, data) {
      cacheMap.set(key, { data, timestamp: Date.now() });
    },

    // Map
    initMap() {
      if (map) return;
      map = L.map("map", { center: [20, 0], zoom: 2, worldCopyJump: true });
      this.setMapStyle(this.activeMapStyle);
      map.on("click", async (e) => {
        const { lat, lng } = e.latlng;
        this.showStatus("Looking up location...");
        const info = await this.reverseGeocode(lat, lng);
        this.startWithLocation(lat, lng, info.name, info.timezone, info.sunrise, info.sunset, false);
      });
    },

    setMapStyle(styleKey) {
      this.activeMapStyle = styleKey;
      if (!map) return;
      const style = tileStyles[styleKey];
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      currentTileLayer = L.tileLayer(style.url, {
        attribution: style.attribution,
        maxZoom: style.maxZoom,
      }).addTo(map);
    },

    updateMapMarker(lat, lon, popupText) {
      if (!map) return;
      if (mapMarker) {
        mapMarker.setLatLng([lat, lon]);
      } else {
        const sunIcon = L.divIcon({
          className: "sun-marker",
          html: `<div style="
            width:28px;height:28px;border-radius:50%;
            background:radial-gradient(circle,#f0d878,#d4af37 60%,#c48a3f);
            box-shadow:0 0 18px rgba(212,175,55,0.9),0 0 6px rgba(232,228,217,0.8);
            border:2px solid #e8e4d9;
            transform:translate(-50%,-50%);
          "></div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        mapMarker = L.marker([lat, lon], { icon: sunIcon }).addTo(map);
      }
      if (popupText) {
        const el = document.createElement("span");
        el.textContent = popupText;
        mapMarker.bindPopup(el).openPopup();
      }
    },

    // Status
    showStatus(msg) {
      this.statusMsg = msg;
      this.statusVisible = true;
    },

    hideStatus() {
      this.statusVisible = false;
    },

    // Helpers
    countryCodeToFlag(code) {
      if (!code || code.length !== 2) return "🌍";
      const A = 0x1f1e6;
      return String.fromCodePoint(
        A + code.toUpperCase().charCodeAt(0) - 65,
        A + code.toUpperCase().charCodeAt(1) - 65
      );
    },

    // Search
    fetchSuggestions() {
      const q = this.searchQuery.trim();
      if (q.length < 2) {
        this.suggestionsVisible = false;
        this.suggestions = [];
        return;
      }
      const cached = this.getCached(this.cache.search, q, 5 * 60 * 1000);
      if (cached) {
        this.suggestions = cached;
        this.suggestionsVisible = true;
        this.focusedIndex = -1;
        return;
      }
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
      )
        .then((res) => res.json())
        .then((data) => {
          const results = (data.results || []).map((r) => ({
            lat: r.latitude,
            lon: r.longitude,
            timezone: r.timezone || "",
            name: r.name,
            flag: this.countryCodeToFlag(r.country_code),
            meta: (r.admin1 ? r.admin1 + ", " : "") + r.country,
            fullName: r.name + (r.admin1 ? ", " + r.admin1 : "") + ", " + r.country,
          }));
          this.setCache(this.cache.search, q, results);
          this.suggestions = results;
          this.suggestionsVisible = true;
          this.focusedIndex = -1;
        })
        .catch((err) => {
          console.warn("Search failed:", err);
          this.showStatus("Search failed. Check your connection.");
        });
    },

    handleSearchKeydown(e) {
      if (!this.suggestions.length || !this.suggestionsVisible) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, this.suggestions.length - 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
      } else if (e.key === "Enter" && this.focusedIndex >= 0) {
        e.preventDefault();
        this.selectSuggestion(this.suggestions[this.focusedIndex]);
      } else if (e.key === "Escape") {
        this.closeSuggestions();
      }
    },

    selectSuggestion(s) {
      this.searchQuery = s.fullName;
      this.closeSuggestions();
      this.startWithLocation(s.lat, s.lon, s.fullName, s.timezone, null, null, true);
    },

    closeSuggestions() {
      this.suggestionsVisible = false;
      this.focusedIndex = -1;
    },

    // Location Actions
    async useMyLocation() {
      if (!navigator.geolocation) {
        this.showStatus("Geolocation not supported.");
        return;
      }
      this.locateLoading = true;
      this.showStatus("Getting your location...");
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const info = await this.reverseGeocode(lat, lon);
        this.startWithLocation(lat, lon, info.name, info.timezone, info.sunrise, info.sunset, true);
      } catch {
        this.showStatus("Location denied. Please enter coordinates manually.");
      } finally {
        this.locateLoading = false;
      }
    },

    async goToCoords() {
      const lat = parseFloat(this.latValue);
      const lon = parseFloat(this.lonValue);
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        this.showStatus("Enter valid latitude (-90 to 90) and longitude (-180 to 180).");
        return;
      }
      this.coordsLoading = true;
      this.showStatus("Looking up location...");
      try {
        const info = await this.reverseGeocode(lat, lon);
        this.startWithLocation(lat, lon, info.name, info.timezone, info.sunrise, info.sunset, true);
      } finally {
        this.coordsLoading = false;
      }
    },

    toggleMap() {
      if (!this.mapVisible) {
        this.mapVisible = true;
        this.coordsVisible = false;
      } else {
        this.mapVisible = false;
      }
    },

    toggleCoords() {
      if (!this.coordsVisible) {
        this.coordsVisible = true;
        this.mapVisible = false;
      } else {
        this.coordsVisible = false;
      }
    },

    // API
    async reverseGeocode(lat, lon) {
      const cacheKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const cached = this.getCached(this.cache.geocode, cacheKey, 10 * 60 * 1000);
      if (cached) return cached;
      try {
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
        } catch (nomErr) {
          console.warn("Nominatim reverse geocode failed:", nomErr);
        }
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&timezone=auto&forecast_days=1&daily=sunrise,sunset`
        );
        const data = await res.json();
        const tz = data.timezone || "UTC";
        const daily = data.daily || {};
        const result = {
          name: placeName,
          timezone: tz,
          sunrise: daily.sunrise ? daily.sunrise[0] : null,
          sunset: daily.sunset ? daily.sunset[0] : null,
        };
        this.setCache(this.cache.geocode, cacheKey, result);
        return result;
      } catch (err) {
        console.warn("Reverse geocode failed:", err);
        const fallback = { name: `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`, timezone: "UTC", sunrise: null, sunset: null };
        this.setCache(this.cache.geocode, cacheKey, fallback);
        return fallback;
      }
    },

    // Core
    startWithLocation(lat, lon, name, timezone, sunrise, sunset, recenterMap) {
      this.currentLat = lat;
      this.currentLon = lon;
      this.currentTimezone = timezone || "UTC";
      this.currentSunrise = sunrise;
      this.currentSunset = sunset;
      this.locationName = name;
      this.resultsVisible = true;
      this.hideStatus();
      this.$nextTick(() => {
        document.querySelector(".results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      if (!this.currentSunrise || !this.currentSunset) {
        this.reverseGeocode(lat, lon)
          .then((info) => {
            this.currentSunrise = info.sunrise;
            this.currentSunset = info.sunset;
          })
          .catch((err) => console.warn("Could not fetch sunrise/sunset:", err));
      }

      if (map) {
        if (recenterMap) map.setView([lat, lon], 6);
        this.updateMapMarker(lat, lon, name);
      }

      if (this.tickInterval) clearInterval(this.tickInterval);
      this.updateAll();
      this.tickInterval = setInterval(() => this.updateAll(), 1000);
    },

    updateAll() {
      const now = new Date();
      const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
      const dayOfYear = Math.floor((now - new Date(Date.UTC(now.getUTCFullYear(), 0, 0))) / 86400000);
      const B = ((dayOfYear - 81) * 2 * Math.PI) / 365;
      const EoT = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
      const meanHours = (utcHours + this.currentLon / 15 + 24) % 24;
      const trueHours = (meanHours + EoT / 60 + 24) % 24;

      this.meanTime = this.formatTime(meanHours);
      this.solarTime = this.formatTime(trueHours);

      if (this.currentSunrise) {
        try {
          const sr = new Date(this.currentSunrise);
          this.sunriseLabel = this.formatTimeFromMinutes(sr.getHours() + sr.getMinutes() / 60);
        } catch {
          this.sunriseLabel = "--:--";
        }
      } else {
        this.sunriseLabel = "--:--";
      }

      if (this.currentSunset) {
        try {
          const ss = new Date(this.currentSunset);
          this.sunsetLabel = this.formatTimeFromMinutes(ss.getHours() + ss.getMinutes() / 60);
        } catch {
          this.sunsetLabel = "--:--";
        }
      } else {
        this.sunsetLabel = "--:--";
      }

      if (Math.abs(trueHours - 12) < 0.01) {
        this.solarLabel = "☀ Solar noon!";
      } else if (this.currentSunrise && this.currentSunset) {
        const srH = new Date(this.currentSunrise).getHours() + new Date(this.currentSunrise).getMinutes() / 60;
        const ssH = new Date(this.currentSunset).getHours() + new Date(this.currentSunset).getMinutes() / 60;
        this.solarLabel = trueHours < srH || trueHours > ssH ? "🌙 Night time" : "Real time by the sun";
      } else if (trueHours < 6 || trueHours > 20) {
        this.solarLabel = "🌙 Night time";
      } else {
        this.solarLabel = "Real time by the sun";
      }

      const t = trueHours / 24;
      this.sunDotX = (1 - t) * (1 - t) * 20 + 2 * (1 - t) * t * 150 + t * t * 280;
      this.sunDotY = (1 - t) * (1 - t) * 90 + 2 * (1 - t) * t * -30 + t * t * 90;

      try {
        const tzFormatter = new Intl.DateTimeFormat("en-GB", {
          timeZone: this.currentTimezone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        this.officialTime = tzFormatter.format(now);
        this.tzName = this.currentTimezone;
      } catch {
        this.officialTime = "--:--:--";
        this.tzName = "Unknown";
      }

      this.utcTime = now.toISOString().slice(11, 19);

      try {
        const parts = new Intl.DateTimeFormat("en-GB", {
          timeZone: this.currentTimezone,
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
        const diffMin = Math.round(Math.abs(diff) * 60);
        const sign = diff >= 0 ? "ahead of" : "behind";
        let diffDisplay;
        if (diffMin >= 60) {
          const hrs = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          diffDisplay = mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        } else {
          diffDisplay = `${diffMin}m`;
        }
        this.diffBadge = diffDisplay;
        this.diffAhead = diff >= 0;
        this.diffDirection = sign;
        const needlePos = 50 + (diff / 120) * 50;
        this.diffBarLeft = Math.max(2, Math.min(98, needlePos)) + "%";
      } catch {
        this.diffBadge = "—";
        this.diffAhead = true;
        this.diffDirection = "behind";
      }
    },

    formatTime(hours) {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      const s = Math.floor(((hours - h) * 60 - m) * 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    },

    formatTimeFromMinutes(hours) {
      const h = Math.floor(hours);
      const m = Math.floor((hours - h) * 60);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    },
  };
}