import os
import requests
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
HEADERS = {"User-Agent": "MapNavigatorMinorProject/1.0 (student project)"}


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "message": "Map Navigator API is running"})


@app.get("/api/search")
def search_location():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify({"error": "Please enter at least 2 characters."}), 400

    try:
        response = requests.get(
            NOMINATIM_URL,
            params={"q": query, "format": "jsonv2", "limit": 5},
            headers=HEADERS,
            timeout=15,
        )
        response.raise_for_status()
        places = response.json()
        results = [
            {
                "name": place.get("name") or place.get("display_name", "Unknown place"),
                "address": place.get("display_name", ""),
                "lat": float(place["lat"]),
                "lon": float(place["lon"]),
            }
            for place in places
        ]
        return jsonify({"results": results})
    except requests.RequestException:
        return jsonify({"error": "Location search service is temporarily unavailable."}), 502
    except (ValueError, KeyError):
        return jsonify({"error": "Could not process location search results."}), 502


@app.post("/api/route")
def calculate_route():
    data = request.get_json(silent=True) or {}
    try:
        start = data["start"]
        end = data["end"]
        start_lon, start_lat = float(start["lon"]), float(start["lat"])
        end_lon, end_lat = float(end["lon"]), float(end["lat"])
    except (KeyError, TypeError, ValueError):
        return jsonify({"error": "Send start and end as objects containing numeric lat and lon."}), 400

    coordinates = f"{start_lon},{start_lat};{end_lon},{end_lat}"
    try:
        response = requests.get(
            f"{OSRM_URL}/{coordinates}",
            params={"overview": "full", "geometries": "geojson", "steps": "false", "alternatives": "true"},
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        if payload.get("code") != "Ok" or not payload.get("routes"):
            return jsonify({"error": "No driving route could be found for these locations."}), 404

        routes = []
        for route in payload["routes"]:
            routes.append({
                "distance_km": round(route["distance"] / 1000, 2),
                "duration_min": round(route["duration"] / 60),
                "geometry": route["geometry"],
            })
        return jsonify({"routes": routes})
    except requests.RequestException:
        return jsonify({"error": "Routing service is temporarily unavailable."}), 502


@app.get("/")
def index():
    return send_from_directory(".", "index.html")

@app.get("/<path:path>")
def frontend_files(path):
    return send_from_directory(".", path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
