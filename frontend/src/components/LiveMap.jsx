import React, { useEffect, useRef } from "react";
import L from "leaflet";

// Fix default marker paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function LiveMap({ markers = [] }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: true,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; OpenStreetMap &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    // ensure proper size
    setTimeout(() => map.invalidateSize(), 100);
  }, []);

  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const pts = markers.filter((m) => m && Number.isFinite(m.lat) && Number.isFinite(m.lng));
    pts.forEach((m) => {
      const marker = L.marker([m.lat, m.lng]).addTo(layerRef.current);
      if (m.label) marker.bindPopup(`<b>${m.label}</b>${m.subtitle ? `<br/>${m.subtitle}` : ""}`);
    });
    if (pts.length === 1) {
      mapRef.current.setView([pts[0].lat, pts[0].lng], 14);
    } else if (pts.length > 1) {
      const group = L.featureGroup(layerRef.current.getLayers());
      mapRef.current.fitBounds(group.getBounds().pad(0.2));
    }
  }, [markers]);

  return <div ref={ref} className="w-full h-full" data-testid="live-map" />;
}
