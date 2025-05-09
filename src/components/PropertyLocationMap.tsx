// src/components/PropertyLocationMap.tsx
import React, { useEffect, useRef } from "react";
import { Coordinates } from "../lib/types/Listing";
import { useConfig } from "../contexts/ConfigContext";

interface PropertyLocationMapProps {
  coordinates: Coordinates;
  address: string;
}

const PropertyLocationMap: React.FC<PropertyLocationMapProps> = ({
  coordinates,
  address,
}) => {
  const { googleMapsApiKey } = useConfig();
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // In PropertyLocationMap.tsx
    const loadGoogleMapsAPI = async () => {
      try {
        // If Maps is already loaded, just initialize the map
        if (window.google?.maps) {
          initMap();
          return;
        }

        // Properly type the dynamic callback with an interface
        interface WindowWithCallbacks extends Window {
          [key: string]: any;
        }
        const windowWithCallbacks = window as WindowWithCallbacks;

        // Create a proper callback name and function
        const callbackName = `initGoogleMap_${Date.now()}`;
        windowWithCallbacks[callbackName] = () => {
          initMap();
          delete windowWithCallbacks[callbackName];
        };

        // Check if script is already loading
        const existingScript = document.querySelector(
          'script[src*="maps.googleapis.com"]'
        );
        if (existingScript) {
          // If it's loading but no Google Maps yet, wait for it
          if (!window.google?.maps) {
            const checkInterval = setInterval(() => {
              if (window.google?.maps) {
                clearInterval(checkInterval);
                initMap();
              }
            }, 100);
          }
          return;
        }

        // Load the script with proper callback
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&callback=${callbackName}`;
        script.async = true;
        script.defer = true;

        document.head.appendChild(script);
      } catch (err) {
        console.error(
          "Error loading Google Maps:",
          err instanceof Error ? err.message : "An unknown error occurred"
        );
      }
    };

    loadGoogleMapsAPI();
  }, [googleMapsApiKey]);

  const initMap = () => {
    if (!mapRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: coordinates,
      zoom: 15,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_RIGHT,
      },
      streetViewControl: true,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_RIGHT,
      },
      styles: [
        {
          featureType: "poi",
          elementType: "labels",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    // Create a circle overlay
    const circle = new google.maps.Circle({
      strokeColor: "#FF1493",
      strokeOpacity: 0.3,
      strokeWeight: 2,
      fillColor: "#FF1493",
      fillOpacity: 0.1,
      map,
      center: coordinates,
      radius: 300, // Radius in meters
    });

    // Create a custom marker with house icon
    const marker = new google.maps.Marker({
      position: coordinates,
      map: map,
      icon: {
        path: "M21.6 10.4l-9-7.2c-0.4-0.3-0.9-0.3-1.2 0l-9 7.2c-0.3 0.2-0.4 0.5-0.4 0.8v11.2c0 0.6 0.4 1 1 1h6v-6h6v6h6c0.6 0 1-0.4 1-1V11.2c0-0.3-0.1-0.6-0.4-0.8z",
        fillColor: "#FF1493",
        fillOpacity: 1,
        strokeWeight: 0,
        rotation: 0,
        scale: 1.3,
        anchor: new google.maps.Point(12, 12),
      },
      title: "Property Location",
    });

    // Create info window with booking message and address
    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="padding: 2px; font-family: Arial, sans-serif;">
        <style>
          .gm-ui-hover-effect { display: none !important; }
        </style>
        <div style={{ color: '#1A1A1A', fontSize: '1.15em' }}>Exact location provided after booking a house tour.</div>
        <p style="color: #666; font-size: 1.05em;">${address}</p>
      </div>`,
      pixelOffset: new google.maps.Size(0, -10),
    });

    marker.addListener("click", () => {
      infoWindow.open(map, marker);
    });

    // Open info window by default and make circle interactive
    infoWindow.open(map, marker);
    circle.addListener("click", () => {
      infoWindow.open(map, marker);
    });
  };

  return (
    <div>
      <div
        ref={mapRef}
        className="h-[480px] max-w-[1000px] w-full rounded-3xl border-t"
      ></div>
    </div>
  );
};

export default PropertyLocationMap;
