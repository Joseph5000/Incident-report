/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MapContainer, TileLayer, Marker, useMap, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

// Fix for default marker icons in React-Leaflet
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import shadowIcon from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: shadowIcon,
});

interface MapProps {
  center: [number, number];
  accuracy?: number;
  zoom?: number;
}

function ChangeView({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 15, { animate: true });
  }, [center, map]);
  return null;
}

export default function Map({ center, accuracy, zoom = 15 }: MapProps) {
  return (
    <div className="h-full w-full rounded-2xl overflow-hidden border border-slate-100 shadow-inner bg-slate-100 relative z-0 isolate">
      <MapContainer 
        center={center} 
        zoom={zoom} 
        scrollWheelZoom={false}
        className="h-full w-full grayscale-[0.2]"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          crossOrigin={true}
        />
        <div className="absolute bottom-4 left-4 z-[1000] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-2">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-600">Maps Cached for Offline</span>
          </div>
        </div>
        <Marker position={center}>
          <Popup>
            Incident Verified
          </Popup>
        </Marker>
        {accuracy && (
          <>
            <Circle
              center={center}
              radius={accuracy}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
                color: '#3b82f6',
                weight: 1.5,
                dashArray: '5, 10',
                lineCap: 'round'
              }}
            />
            {/* Inner "pulse" indicator */}
            <Circle
              center={center}
              radius={Math.max(2, accuracy * 0.1)}
              pathOptions={{
                fillColor: '#3b82f6',
                fillOpacity: 0.4,
                color: 'transparent',
                stroke: false
              }}
            />
          </>
        )}
        <ChangeView center={center} />
      </MapContainer>
    </div>
  );
}
