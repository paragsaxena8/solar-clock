# Real Solar Time

True time based on the sun, not politics.

## What It Does

Your clock shows the time your government assigned to your timezone. But the sun doesn't follow timezone boundaries. **Real Solar Time** shows you what time it *actually* is by the sun at any location on Earth.

- **True Solar Time** — calculated using the Equation of Time and your exact longitude
- **Mean Solar Time** — based on longitude alone, ignoring the Equation of Time
- **Official Timezone Time** — what your clock says
- **Time Difference** — how far solar time diverges from the official clock, visualized on a gauge

In places like western India or western China, the sun can be over an hour off from the official time. This app makes that difference visible.

## How It Works

1. **Search** a city or country
2. **Use your location** via GPS
3. **Pick a point** on the interactive map
4. **Enter coordinates** manually

The app calculates solar time in real-time using:

- The **Equation of Time** correction for Earth's orbital eccentricity and axial tilt
- **Longitude-based mean solar time**
- **Timezone offset** from UTC via the Open-Meteo API

Sunrise and sunset data comes from the Open-Meteo forecast API, showing the sun's position on the arc throughout the day.

## Tech Stack

- **Alpine.js** — reactive UI with minimal overhead
- **Leaflet** — interactive map with multiple tile styles (streets, satellite, terrain, dark)
- **Open-Meteo Geocoding** — city/country search
- **Open-Meteo Forecast** — sunrise/sunset and timezone data
- **Nominatim** — reverse geocoding for map clicks
- **Open Props** — design tokens and normalize
- **Vanilla CSS** — dark celestial theme with gold accents, no framework

## Design

Dark celestial theme inspired by nighttime observation — a subtle star field background, gold gradient typography, and an instrument-gauge diff bar. The sun arc visualizes the sun's path from sunrise to sunset with a moving dot tracking its current position.

Fully responsive across desktop, tablet, and mobile.

## Running Locally

```bash
# Just serve the files — no build step needed
npx serve .
# or
python -m http.server 8000
```

Open the URL in your browser. No installation, no dependencies to install.

## Credits

- Map tiles by [OpenStreetMap](https://www.openstreetmap.org/) contributors
- Geocoding by [Open-Meteo](https://open-meteo.com/)
- Solar calculations based on the [Equation of Time](https://en.wikipedia.org/wiki/Equation_of_time)
- Designed by Parag with AI assistance (Claude Code)

## License

MIT