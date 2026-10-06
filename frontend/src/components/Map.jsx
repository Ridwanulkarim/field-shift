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

      // 1. Esri World Imagery (High-res satellite view - free, no API key required, authentic NASA agro context)
      const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: '&copy; Esri &mdash; Earthstar Geographics'
      });

      // 2. OpenStreetMap Standard (Clean street topography & cities - 100% Free, NO API key required)
      const osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      });

      // Default to Satellite for authentic agricultural Earth Observation context
      satelliteLayer.addTo(map);

      // Add layer switcher (Satellite vs Street Map)
      L.control.layers({
        '🛰️ Satellite': satelliteLayer,
        '🗺️ Street Map': osmLayer
      }, null, { position: 'topright', collapsed: true }).addTo(map);

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
    <div className="bg-[#092619]/90 border border-emerald-500/20 rounded-2xl p-4 sm:p-5 md:p-6 shadow-xl shadow-black/25 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 pb-3.5 border-b border-emerald-800/40">
        <div>
          <h3 className="text-base sm:text-lg font-extrabold text-white flex items-center gap-2 tracking-tight">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
            Bangladesh Geographic & Agro-Ecological Map
          </h3>
          <p className="text-[11px] sm:text-xs text-emerald-300/70 mt-0.5">
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
              className="px-2.5 py-1.5 rounded-xl bg-[#04140d] border border-emerald-700/60 text-[11px] sm:text-xs font-bold text-emerald-300 hover:text-white hover:border-emerald-500 transition-all shadow-sm flex items-center gap-1 cursor-pointer"
              title="Fit all 5 demo fields across Bangladesh"
            >
              <span>🔍</span> Fit All
            </button>
          )}

          <div className="inline-flex rounded-xl bg-[#04140d] p-1 border border-emerald-800/60 text-xs">
            <button
              onClick={() => setMapMode('leaflet')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                mapMode === 'leaflet' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              Leaflet Map
            </button>
            <button
              onClick={() => setMapMode('vector')}
              className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg font-bold transition-all cursor-pointer text-[11px] sm:text-xs ${
                mapMode === 'vector' ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 shadow-sm' : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              AEZ Vector
            </button>
          </div>
        </div>
      </div>

      {/* Map View Area */}
      <div className="relative w-full h-[320px] sm:h-[400px] md:h-[460px] mx-auto bg-[#04140d] rounded-2xl border border-emerald-800/60 overflow-hidden shadow-inner">
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
        <div className="absolute bottom-2 sm:bottom-3 left-2 sm:left-3 right-2 sm:right-3 bg-[#051d12]/92 backdrop-blur-md p-1.5 sm:p-2.5 rounded-xl border border-emerald-800/60 flex items-center justify-between gap-1 text-[9px] sm:text-[10px] text-emerald-200 z-10 pointer-events-auto shadow-lg overflow-x-auto">
          <span className="font-bold text-white hidden sm:inline">Condition:</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Healthy</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Watch</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-orange-400"></span> Moderate</span>
          <span className="flex items-center gap-1 shrink-0"><span className="w-2 h-2 rounded-full bg-rose-400"></span> High</span>
        </div>
      </div>
    </div>
  );
}
