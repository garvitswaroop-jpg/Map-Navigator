// For separate frontend hosting, set this to your deployed backend URL, e.g. https://your-api.onrender.com
// Leave empty when frontend and backend are served from the same domain.
const API_BASE = "";

const map = L.map("map").setView([28.6139, 77.2090], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

let startPlace = null;
let endPlace = null;
let startMarker = null;
let endMarker = null;
let routeLayers = [];
let selectedRoute = 0;

const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;

async function checkApi() {
  try {
    const response = await fetch(apiUrl("/api/health"));
    if (!response.ok) throw new Error("API unavailable");
    $("apiStatus").textContent = "API connected";
    $("apiStatus").className = "status ok";
  } catch {
    $("apiStatus").textContent = "API not connected";
    $("apiStatus").className = "status bad";
  }
}

function setMessage(message, isError = false) {
  $("message").textContent = message;
  $("message").className = isError ? "message error" : "message";
}

async function searchPlace(kind) {
  const input = kind === "from" ? $("fromInput") : $("toInput");
  const resultsBox = kind === "from" ? $("fromResults") : $("toResults");
  const query = input.value.trim();
  if (query.length < 2) return setMessage("Enter at least 2 characters to search.", true);

  resultsBox.innerHTML = "";
  setMessage("Searching for places…");
  try {
    const response = await fetch(apiUrl(`/api/search?q=${encodeURIComponent(query)}`));
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Search failed.");
    if (!data.results.length) return setMessage("No matching places found. Try a more specific search.", true);

    data.results.forEach((place) => {
      const button = document.createElement("button");
      button.className = "result";
      const name = document.createElement("strong");
      name.textContent = place.name;
      const address = document.createElement("small");
      address.textContent = place.address;
      button.append(name, address);
      button.addEventListener("click", () => choosePlace(kind, place));
      resultsBox.appendChild(button);
    });
    setMessage("Select the correct result from the list.");
  } catch (error) {
    setMessage(error.message, true);
  }
}

function choosePlace(kind, place) {
  if (kind === "from") {
    startPlace = place;
    $("fromInput").value = place.name;
    $("fromResults").innerHTML = "";
    if (startMarker) map.removeLayer(startMarker);
    startMarker = L.marker([place.lat, place.lon]).addTo(map).bindPopup("Starting point: " + place.name);
  } else {
    endPlace = place;
    $("toInput").value = place.name;
    $("toResults").innerHTML = "";
    if (endMarker) map.removeLayer(endMarker);
    endMarker = L.marker([place.lat, place.lon]).addTo(map).bindPopup("Destination: " + place.name);
  }
  map.setView([place.lat, place.lon], 13);
  $("routeBtn").disabled = !(startPlace && endPlace);
  setMessage(`${kind === "from" ? "Starting point" : "Destination"} selected.`);
}

function clearRoutes() {
  routeLayers.forEach(layer => map.removeLayer(layer));
  routeLayers = [];
}

async function findRoute() {
  if (!startPlace || !endPlace) return;
  $("routeBtn").disabled = true;
  setMessage("Calculating route…");
  clearRoutes();
  try {
    const response = await fetch(apiUrl("/api/route"), {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        start: {lat: startPlace.lat, lon: startPlace.lon},
        end: {lat: endPlace.lat, lon: endPlace.lon}
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not calculate route.");

    data.routes.forEach((route, index) => {
      const layer = L.geoJSON(route.geometry, {
        style: {color: index === 0 ? "#2563eb" : "#94a3b8", weight: index === 0 ? 6 : 4, opacity: index === 0 ? 0.9 : 0.65, dashArray: index === 0 ? null : "7 7"}
      }).addTo(map);
      routeLayers.push(layer);
    });
    selectedRoute = 0;
    showRouteInfo(data.routes);
    const allLayers = L.featureGroup(routeLayers);
    map.fitBounds(allLayers.getBounds(), {padding: [45, 45]});
    setMessage("Route calculated successfully.");
  } catch (error) {
    setMessage(error.message, true);
  } finally {
    $("routeBtn").disabled = false;
  }
}

function showRouteInfo(routes) {
  const route = routes[selectedRoute];
  $("routeInfo").classList.remove("hidden");
  $("distance").textContent = `${route.distance_km} km`;
  $("duration").textContent = route.duration_min < 60
    ? `${route.duration_min} min`
    : `${Math.floor(route.duration_min / 60)} hr ${route.duration_min % 60} min`;

  const alternatives = $("alternatives");
  alternatives.innerHTML = "";
  routes.forEach((item, index) => {
    if (index === 0) return;
    const row = document.createElement("div");
    row.className = "alternative";
    row.textContent = `Alternative ${index}: ${item.distance_km} km · ${item.duration_min} min `;
    const button = document.createElement("button");
    button.textContent = "Show";
    button.addEventListener("click", () => {
      selectedRoute = index;
      routeLayers.forEach((layer, i) => layer.setStyle({color: i === index ? "#2563eb" : "#94a3b8", weight: i === index ? 6 : 4, opacity: i === index ? 0.9 : 0.55}));
      showRouteInfo(routes);
    });
    row.appendChild(button);
    alternatives.appendChild(row);
  });
}

function useCurrentLocation() {
  if (!navigator.geolocation) return setMessage("Geolocation is not supported by this browser.", true);
  setMessage("Getting your current location…");
  navigator.geolocation.getCurrentPosition(
    position => {
      const place = {
        name: "My current location",
        address: "Device location",
        lat: position.coords.latitude,
        lon: position.coords.longitude
      };
      choosePlace("from", place);
      map.setView([place.lat, place.lon], 15);
    },
    () => setMessage("Location permission was denied or your position is unavailable.", true),
    {enableHighAccuracy: true, timeout: 10000}
  );
}

$("fromSearch").addEventListener("click", () => searchPlace("from"));
$("toSearch").addEventListener("click", () => searchPlace("to"));
$("fromInput").addEventListener("keydown", e => { if (e.key === "Enter") searchPlace("from"); });
$("toInput").addEventListener("keydown", e => { if (e.key === "Enter") searchPlace("to"); });
$("routeBtn").addEventListener("click", findRoute);
$("locateBtn").addEventListener("click", useCurrentLocation);
checkApi();
