// Show the circuit route and seven locations.
const { route, points } = window.MONACO_DATA;
const stops = points.features;
const chapterRoot = document.querySelector("#chapters");
for (const f of stops) {
  const p = f.properties;
  const s = document.createElement("article");
  s.className = "chapter";
  s.id = "stop-" + p.Order;
  s.dataset.order = p.Order;
  s.innerHTML = `<span class="order">0${p.Order}</span><p class="place">${p.Name} / ${p.Zone}</p><h3>${p.Heading}</h3><p>${p.Description}</p><button type="button" data-focus="${p.Order}">Locate on the map </button>`;
  if (p.Order === 3)
    s.innerHTML +=
      '<img class="chapter-photo" src="images/fairmont-hairpin.jpg" alt="Fairmont Hairpin in 2005"><p class="photo-credit">Fairmont Hairpin, 2005. Photo: <a href="https://commons.wikimedia.org/wiki/File:Monaco_Grand_Hotel_Hairpin.jpg">Jeff Wilcox</a>, <a href="https://creativecommons.org/licenses/by/2.0/">CC BY 2.0</a>.</p>';
  chapterRoot.append(s);
}
const xy = route.features[0].geometry.coordinates;
const minX = Math.min(...xy.map((p) => p[0])),
  maxX = Math.max(...xy.map((p) => p[0])),
  minY = Math.min(...xy.map((p) => p[1])),
  maxY = Math.max(...xy.map((p) => p[1]));
const cos = Math.cos((43.737 * Math.PI) / 180),
  scale = Math.min(350 / ((maxX - minX) * cos), 400 / (maxY - minY));
const project = ([x, y]) => [
  65 + (x - minX) * cos * scale,
  55 + (maxY - y) * scale,
];
const d = xy
  .map(
    (p, i) =>
      (i ? "L" : "M") +
      project(p)
        .map((x) => x.toFixed(2))
        .join(","),
  )
  .join(" ");
document.querySelector("#circuit-art").innerHTML =
  `<path d="${d}" fill="none" stroke="#ffffff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#d63c30" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>` +
  stops
    .map((f) => {
      const [x, y] = project(f.geometry.coordinates);
      return `<circle cx="${x}" cy="${y}" r="6" fill="#102b32" stroke="white" stroke-width="2"/>`;
    })
    .join("");
const map = L.map("map", { scrollWheelZoom: false });
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution:
    '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
})
  .addTo(map)
  .on("tileerror", () => {
    document.querySelector("#map-status").textContent =
      "Basemap unavailable. Route and story points remain interactive.";
  });
L.geoJSON(route, {
  style: { color: "#ffffff", weight: 8, opacity: 0.95 },
}).addTo(map);
const routeLayer = L.geoJSON(route, {
  style: { color: "#d63c30", weight: 4, opacity: 1 },
}).addTo(map);
const bounds = routeLayer.getBounds().pad(0.13);
map.fitBounds(bounds);
L.control.scale({ imperial: false }).addTo(map);
const markers = new Map();
let active = null;
let suppressObserverUntil = 0;
for (const f of stops) {
  const p = f.properties;
  const marker = L.marker(
    [f.geometry.coordinates[1], f.geometry.coordinates[0]],
    {
      icon: L.divIcon({
        className: "number-marker",
        html: String(p.Order),
        iconSize: [29, 29],
        iconAnchor: [14, 14],
      }),
      title: p.Name,
      alt: p.Name,
    },
  );
  marker.bindPopup(
    `<h3>${p.Order}. ${p.Name}</h3><p>${p.Heading}</p><small>Approximate location</small>`,
  );
  marker.addTo(map);
  markers.set(p.Order, marker);
  marker.on("click", () => {
    suppressObserverUntil = Date.now() + 1600;
    focus(p.Order, true, false);
    document
      .querySelector("#stop-" + p.Order)
      .scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "center",
      });
  });
}
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
function focus(order, popup = false, move = true) {
  if (active !== null) {
    markers.get(active).getElement()?.classList.remove("selected");
    document.querySelector("#stop-" + active)?.classList.remove("active");
  }
  active = order;
  const m = markers.get(order);
  m.getElement()?.classList.add("selected");
  document.querySelector("#stop-" + order).classList.add("active");
  if (move) map.setView(m.getLatLng(), 17, { animate: !reduced });
  if (popup) m.openPopup();
  document.querySelector("#map-status").textContent =
    order + " / 7 - " + stops[order - 1].properties.Name;
}
document
  .querySelectorAll("[data-focus]")
  .forEach((b) =>
    b.addEventListener("click", () => focus(Number(b.dataset.focus), true)),
  );
document.querySelector("#overview").addEventListener("click", () => {
  suppressObserverUntil = Date.now() + 1600;
  map.closePopup();
  map.fitBounds(bounds, { animate: !reduced });
  if (active) {
    markers.get(active).getElement()?.classList.remove("selected");
    document.querySelector("#stop-" + active).classList.remove("active");
    active = null;
  }
  document.querySelector("#map-status").textContent =
    "Full route - seven story stops.";
});
const observer = new IntersectionObserver(
  (entries) => {
    if (Date.now() < suppressObserverUntil) return;
    for (const e of entries)
      if (e.isIntersecting) focus(Number(e.target.dataset.order));
  },
  { rootMargin: "-30% 0px -40% 0px", threshold: 0 },
);
document.querySelectorAll(".chapter").forEach((c) => observer.observe(c));
const storyUrl = window.MONACO_CONFIG?.storymapUrl;
if (storyUrl) {
  try {
    const u = new URL(storyUrl);
    if (u.protocol !== "https:" || u.hostname !== "storymaps.arcgis.com")
      throw Error("Use a public ArcGIS StoryMap URL");
    document.querySelector("#storymap").src = u.href;
    document.querySelector("#storymap-link").href = u.href;
  } catch (e) {
    console.error(e.message);
  }
}
