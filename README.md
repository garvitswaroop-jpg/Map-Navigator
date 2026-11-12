# Map Navigator – Minor Project

A beginner-friendly map navigation web application using Flask, Leaflet, OpenStreetMap, Nominatim and OSRM.

## Features
- Search locations through the backend API
- Interactive OpenStreetMap
- Driving route calculation
- Distance and estimated travel time
- Alternative routes when returned by OSRM
- Use device location (browser permission required)
- Responsive layout

## Requirements
- Python 3.10+
- Internet connection

## Run locally

From the project root:

```bash
cd backend
python -m venv venv
```

Activate the environment:

Windows:
```bash
venv\Scripts\activate
```

macOS/Linux:
```bash
source venv/bin/activate
```

Install dependencies and start:

```bash
pip install -r requirements.txt
python app.py
```

Open http://127.0.0.1:5000

## API endpoints

### GET /api/health
Checks whether the backend is running.

### GET /api/search?q=India%20Gate
Searches for locations. Returns up to five results with name, address, latitude and longitude.

### POST /api/route
Request JSON:
```json
{
  "start": {"lat": 28.6129, "lon": 77.2295},
  "end": {"lat": 28.6562, "lon": 77.2410}
}
```

Returns route geometry, distance in kilometres and estimated duration in minutes.

## Deployment

### Option A: Deploy frontend and backend together (simplest)
1. Push this project to a GitHub repository.
2. Create a Render Web Service and connect the repository.
3. Set Root Directory to `backend`.
4. Build Command: `pip install -r requirements.txt`
5. Start Command: `gunicorn app:app`
6. Important: for this combined setup, the backend must be able to serve the `frontend` folder. In `backend/app.py`, the relative static path works when running from the backend directory in the supplied Render configuration.
7. Deploy. The frontend and API will share the same Render URL.

### Option B: Separate frontend and backend
For a separate static frontend deployment:
1. Deploy `backend` as a Render Web Service using the settings above.
2. Deploy `frontend` as a Render Static Site. Publish directory: `frontend`.
3. In `frontend/app.js`, change `const API_BASE = "";` to your backend URL, for example `https://map-navigator-api.onrender.com`.
4. In `backend/app.py`, restrict CORS to your frontend domain instead of allowing all origins before production.

## Important notes
- Nominatim and the public OSRM demo server are community services with usage policies, rate limits and no uptime guarantee. This is a student demo, not a production navigation service.
- Use a descriptive User-Agent and do not send frequent or bulk geocoding requests.
- Browser geolocation generally requires HTTPS (or localhost).
- Route distance and duration are estimates, not live traffic predictions.
