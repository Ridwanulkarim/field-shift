import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getConditionBadge } from '../utils/formatting';

/**
 * Leaflet & GeoJSON Agro-Ecological Map Component (Spec Section 46, 51)
 * Renders real Leaflet instance with satellite imagery, street map,
 * field marker pins, and boundary_geojson polygon highlighting.
 */
export default function Map({ fields = [], selectedFieldId, onSelectField }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const geojsonLayerRef = useRef(null);
  const markersLayerRef = useRef(null);
  const [mapMode, setMapMode] = useState('leaflet'); // 'leaflet' | 'vector'

  const selectedField = fields.find(f => f.id === selectedFieldId) || fields[0];

  const isInitialLoadRef = useRef(true);

  // Strict bounds bounding Bangladesh (with comfortable padding):
  // Southwest: [20.4, 87.8], Northeast: [26.8, 92.9]
  const bangladeshBounds = L.latLngBounds(
    [20.4, 87.8],
    [26.8, 92.9]
  );

  const handleFitAll = () => {
    if (mapInstanceRef.current && fields.length > 0) {
      const bounds = L.latLngBounds(fields.map(f => [f.latitude, f.longitude]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 8.5 });
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (mapMode !== 'leaflet') return;
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [23.85, 90.2],
        zoom: 7.4,
        minZoom: 7.0,
        maxZoom: 18,
        maxBounds: bangladeshBounds,
        maxBoundsViscosity: 1.0,
        zoomControl: true,
        attributionControl: false
      });

      // 1. Esri World Imagery (Pure high-res satellite view - free, 0 API keys, zero foreign labels)
      const satelliteImagery = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri &mdash; Earthstar Geographics'
      });

      // 2. Clean Street / Topo Map (Roads, rivers & terrain with ZERO foreign labels)
      const streetMapLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri &mdash; OpenStreetMap contributors'
      });

      // Default to Satellite view as original
      satelliteImagery.addTo(map);

      // Bangladesh Major Cities & Regional Centers (Only Bangladesh places, no foreign country places)
      const bdPlaces = [
        { name: 'Dhaka', lat: 23.8103, lon: 90.4125 },
        { name: 'Chattogram', lat: 22.3569, lon: 91.7832 },
        { name: 'Rajshahi', lat: 24.3745, lon: 88.6042 },
        { name: 'Khulna', lat: 22.8456, lon: 89.5403 },
        { name: 'Barishal', lat: 22.7010, lon: 90.3535 },
        { name: 'Sylhet', lat: 24.8949, lon: 91.8687 },
        { name: 'Rangpur', lat: 25.7439, lon: 89.2752 },
        { name: 'Mymensingh', lat: 24.7471, lon: 90.4203 },
        { name: 'Dinajpur', lat: 25.6279, lon: 88.6332 },
        { name: 'Bogura', lat: 24.8465, lon: 89.3777 },
        { name: 'Cumilla', lat: 23.4607, lon: 91.1809 },
        { name: 'Jashore', lat: 23.1664, lon: 89.2081 },
        { name: "Cox's Bazar", lat: 21.4272, lon: 92.0058 },
        { name: 'Kushtia', lat: 23.9013, lon: 89.1205 },
        { name: 'Pabna', lat: 24.0123, lon: 89.2467 },
        { name: 'Tangail', lat: 24.2513, lon: 89.9167 },
        { name: 'Faridpur', lat: 23.6071, lon: 89.8429 },
        { name: 'Brahmanbaria', lat: 23.9608, lon: 91.1115 },
        { name: 'Noakhali', lat: 22.8724, lon: 91.0973 },
        { name: 'Sirajganj', lat: 24.4534, lon: 89.7008 },
        { name: 'Naogaon', lat: 24.7936, lon: 88.9318 },
        { name: 'Natore', lat: 24.4102, lon: 88.9796 },
        { name: 'Chapai Nawabganj', lat: 24.5965, lon: 88.2775 },
        { name: 'Satkhira', lat: 22.7185, lon: 89.0705 }
      ];

      const citiesLayer = L.layerGroup();
      bdPlaces.forEach((p) => {
        const icon = L.divIcon({
          className: 'bd-city-label',
          html: `<div style="display:flex;align-items:center;gap:3px;transform:translate(-50%,-50%);pointer-events:none;background:rgba(4,20,13,0.75);padding:1px 5px;border-radius:5px;border:1px solid rgba(52,211,153,0.35);box-shadow:0 1px 3px rgba(0,0,0,0.4);">
            <span style="width:4px;height:4px;border-radius:50%;background:#38bdf8;box-shadow:0 0 3px #38bdf8;display:inline-block;"></span>
            <span style="font-size:9.5px;font-weight:700;color:#ffffff;font-family:sans-serif;letter-spacing:-0.2px;white-space:nowrap;">${p.name}</span>
          </div>`,
          iconSize: [0, 0]
        });
        L.marker([p.lat, p.lon], { icon, interactive: false }).addTo(citiesLayer);
      });
      citiesLayer.addTo(map);

      // Add layer switcher (Satellite vs Street Map) + Bangladesh Cities overlay
      L.control.layers(
        {
          '🛰️ Satellite': satelliteImagery,
          '🗺️ Street Map': streetMapLayer
        },
        {
          '📍 Bangladesh Cities': citiesLayer
        },
        { position: 'topright', collapsed: true }
      ).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      geojsonLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;

      // Invalidate size after container renders
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);
    }

    const map = mapInstanceRef.current;
    if (map) {
      map.invalidateSize();
    }

    // Refresh field marker pins (all 5 fields rendered)
    if (markersLayerRef.current) {
      markersLayerRef.current.clearLayers();

      fields.forEach((f) => {
        const isSelected = f.id === selectedFieldId;
        const badge = getConditionBadge(f.condition_score?.label);

        const marker = L.circleMarker([f.latitude, f.longitude], {
          radius: isSelected ? 12 : 9,
          color: isSelected ? '#38bdf8' : '#0f172a',
          weight: isSelected ? 3.5 : 2,
          fillColor: badge.color,
          fillOpacity: 0.95
        });

        const district = f.name.includes('(') ? f.name.split('(')[1].replace(')', '') : f.name;
        marker.bindTooltip(`
          <div style="font-family: sans-serif; font-size: 11px; padding: 4px; min-width: 140px;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 2px;">Field #${f.id}: ${district}</div>
            <div style="font-size: 10px; color: #475569; font-family: monospace;">${f.latitude.toFixed(4)}°N, ${f.longitude.toFixed(4)}°E</div>
            <div style="font-size: 10px; font-weight: 700; color: #0284c7; margin-top: 2px;">Crop: ${f.current_crop} (${f.current_crop_family})</div>
            <div style="font-size: 10px; font-weight: 700; color: #166534; margin-top: 1px;">Condition: ${f.condition_score?.score || 'N/A'}/100 • ${f.condition_score?.label || ''}</div>
          </div>
        `, { direction: 'top', offset: [0, -10] });

        marker.on('click', () => {
          onSelectField(f.id);
        });

        markersLayerRef.current.addLayer(marker);
      });
    }

    // Render boundary_geojson for selected field if present
    if (geojsonLayerRef.current) {
      geojsonLayerRef.current.clearLayers();

      if (selectedField?.boundary_geojson) {
        const geoData = typeof selectedField.boundary_geojson === 'string'
          ? JSON.parse(selectedField.boundary_geojson)
          : selectedField.boundary_geojson;

        const polygonLayer = L.geoJSON(geoData, {
          style: {
            color: '#38bdf8',
            weight: 3,
            fillColor: '#0284c7',
            fillOpacity: 0.35,
            dashArray: '4 4'
          }
        });

        geojsonLayerRef.current.addLayer(polygonLayer);
      }
    }

    // National overview on initial load (shows all 5 pins), flyTo on subsequent selection
    if (map && fields.length > 0) {
      if (isInitialLoadRef.current) {
        const bounds = L.latLngBounds(fields.map(f => [f.latitude, f.longitude]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
        isInitialLoadRef.current = false;
      } else if (selectedField) {
        map.flyTo([selectedField.latitude, selectedField.longitude], 9, {
          duration: 0.8
        });
      }
    }
  }, [mapMode, fields, selectedFieldId, selectedField]);

  // Clean up Leaflet on unmount or mode switch
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapMode]);

  // SVG Fallback Coordinate Projector
  const minLon = 87.8;
  const maxLon = 92.8;
  const minLat = 20.5;
  const maxLat = 26.8;
  const projectCoords = (lat, lon) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * 400 + 50;
    const y = ((maxLat - lat) / (maxLat - minLat)) * 520 + 30;
    return { x, y };
  };

  return (
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-5 sm:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-3.5 border-b border-emerald-800/40">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2 tracking-tight">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            Bangladesh Geographic & Agro-Ecological Map
          </h3>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            {mapMode === 'leaflet'
              ? 'Real-Time Leaflet Map (Satellite & OpenStreetMap) with Field GeoJSON'
              : 'Bangladesh Agro-Ecological Zones (AEZ) Vector Map'}
          </p>
        </div>

        {/* View Mode Toggle & Fit All Action */}
        <div className="flex items-center gap-2 flex-wrap">
          {mapMode === 'leaflet' && (
            <button
              onClick={handleFitAll}
              className="px-2.5 py-1.5 rounded-xl bg-[#04140d] border border-emerald-700/60 text-xs font-bold text-emerald-300 hover:text-white hover:border-emerald-500 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              title="Fit all 5 demo fields across Bangladesh"
            >
              <span>🔍</span> Fit All 5 Fields
            </button>
          )}

          <div className="inline-flex rounded-xl bg-[#04140d] p-1 border border-emerald-800/60 text-xs">
            <button
              onClick={() => setMapMode('leaflet')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mapMode === 'leaflet' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              Leaflet Map
            </button>
            <button
              onClick={() => setMapMode('vector')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                mapMode === 'vector' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              AEZ Vector Map
            </button>
          </div>
        </div>
      </div>

      {/* Map View Area */}
      <div className="relative w-full aspect-[4/5] max-w-[500px] mx-auto bg-[#04140d] rounded-2xl border border-emerald-800/60 overflow-hidden shadow-inner">
        {mapMode === 'leaflet' ? (
          <div ref={mapContainerRef} className="w-full h-full z-0" />
        ) : (
          <svg viewBox="0 0 500 580" className="w-full h-full select-none p-3">
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#34d399" floodOpacity="0.5" />
              </filter>
            </defs>

            {/* Bangladesh Boundary Silhouette */}
            <path
              d="M 120 40 L 180 35 L 230 45 L 260 70 L 250 110 L 290 120 L 330 110 L 360 140 
                 L 410 160 L 440 210 L 430 250 L 410 270 L 440 330 L 460 380 L 440 460 
                 L 410 470 L 390 420 L 340 400 L 310 440 L 280 430 L 260 470 L 220 480 
                 L 180 460 L 160 410 L 140 370 L 110 330 L 130 280 L 110 240 L 120 180 
                 L 90 130 L 100 80 Z"
              fill="#062516"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeOpacity="0.4"
            />
            {/* Major River Arteries */}
            <path d="M 170 80 Q 210 180 230 240 T 290 340 T 320 440" fill="none" stroke="#22d3ee" strokeWidth="2.5" opacity="0.35" />
            <path d="M 110 245 Q 180 270 230 240" fill="none" stroke="#22d3ee" strokeWidth="2" opacity="0.35" />

            {/* Field Location Pins */}
            {fields.map((f) => {
              const { x, y } = projectCoords(f.latitude, f.longitude);
              const isSelected = f.id === selectedFieldId;
              const badge = getConditionBadge(f.condition_score?.label);

              return (
                <g
                  key={f.id}
                  className="cursor-pointer transition-transform duration-200"
                  onClick={() => onSelectField(f.id)}
                >
                  {isSelected && (
                    <circle cx={x} cy={y} r="18" fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 2" />
                  )}
                  <circle cx={x} cy={y} r={isSelected ? "11" : "8"} fill={badge.color} stroke="#04140d" strokeWidth="2" filter={isSelected ? "url(#glow)" : undefined} />
                  <circle cx={x} cy={y} r={isSelected ? "4" : "3"} fill="#ffffff" />
                  <text x={x + 14} y={y + 4} fill={isSelected ? '#34d399' : '#e2e8f0'} fontSize={isSelected ? "12" : "11"} fontWeight={isSelected ? "700" : "500"}>
                    {f.name.split('(')[1]?.replace(')', '') || f.name.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* Floating Controls & Legend */}
        <div className="absolute bottom-3 left-3 right-3 bg-[#051d12]/92 backdrop-blur-md p-2.5 rounded-xl border border-emerald-800/60 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-emerald-200 z-10 pointer-events-auto shadow-lg">
          <span className="font-bold text-white">Condition:</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Healthy (75-100)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Watch (50-74)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Moderate (25-49)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400"></span> High (0-24)</span>
        </div>
      </div>
    </div>
  );
}
