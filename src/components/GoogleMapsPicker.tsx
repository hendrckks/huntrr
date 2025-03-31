// src/components/GoogleMapsPicker.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Coordinates } from '../lib/types/Listing';
import { useConfig } from '../contexts/ConfigContext';

interface GoogleMapsPickerProps {
  initialCoordinates?: Coordinates;
  onLocationSelect: (coordinates: Coordinates) => void;
}

const GoogleMapsPicker: React.FC<GoogleMapsPickerProps> = ({
  initialCoordinates,
  onLocationSelect,
}): JSX.Element => {
  const { googleMapsApiKey } = useConfig();
  const [coordinates, setCoordinates] = useState<Coordinates>(
    initialCoordinates || { lat: 0, lng: 0 }
  );
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string>('');
  const [searchAddress, setSearchAddress] = useState('');
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    const loadGoogleMapsAPI = () => {
      if (window.google && window.google.maps && window.google.maps.places) {
        initMap();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (!window.google || !window.google.maps || !window.google.maps.places) {
          console.error('Google Maps Places library failed to load properly. Please refresh the page.');
          return;
        }
        initMap();
      };
      script.onerror = () => console.error('Failed to load Google Maps. Please check your internet connection and try again.');
      document.head.appendChild(script);
    };

    loadGoogleMapsAPI();
  }, [googleMapsApiKey]);

  // Initialize map
  const initMap = () => {
    if (!mapRef.current) return;

    // Use initial coordinates or default to a general location
    const startingCoordinates = initialCoordinates || { lat: 0, lng: 0 };
    
    // Create map
    const map = new google.maps.Map(mapRef.current, {
      center: startingCoordinates,
      zoom: 15,
      mapTypeControl: true,
      mapTypeControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_RIGHT
      },
      streetViewControl: true,
      fullscreenControl: true,
      fullscreenControlOptions: {
        position: google.maps.ControlPosition.BOTTOM_RIGHT
      },
    });
    googleMapRef.current = map;

    // Create marker
    const marker = new google.maps.Marker({
      position: startingCoordinates,
      map: map,
      draggable: true,
      animation: google.maps.Animation.DROP,
    });
    markerRef.current = marker;

    // Handle marker drag
    marker.addListener('dragend', () => {
      const position = marker.getPosition();
      if (position) {
        const newCoords = { lat: position.lat(), lng: position.lng() };
        setCoordinates(newCoords);
        onLocationSelect(newCoords);
        // Optionally reverse geocode to get address
        reverseGeocode(newCoords);
      }
    });

    // Handle map click
    map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        marker.setPosition(event.latLng);
        const newCoords = { lat: event.latLng.lat(), lng: event.latLng.lng() };
        setCoordinates(newCoords);
        onLocationSelect(newCoords);
        // Optionally reverse geocode to get address
        reverseGeocode(newCoords);
      }
    });

    // Initialize search box
    const searchInput = document.getElementById('map-search') as HTMLInputElement;
    if (!searchInput) {
      console.error('Search input element not found');
      return;
    }
    if (!google.maps.places) {
      console.error('Places library not loaded');
      console.error('Google Maps Places library failed to load. Please refresh the page.');
      return;
    }
    const searchBox = new google.maps.places.SearchBox(searchInput);
    
    // Connect search box to map
    map.controls[google.maps.ControlPosition.TOP_CENTER].push(
      document.getElementById('map-search-container') as HTMLElement
    );
    
    // Bias the search results toward the map's current viewport
    map.addListener('bounds_changed', () => {
      searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
    });

    // Handle search selection
    searchBox.addListener('places_changed', () => {
      const places = searchBox.getPlaces();
      if (!places || places.length === 0) return;

      const place = places[0];
      if (!place.geometry || !place.geometry.location) return;

      // Set the marker position to the searched location
      const position = place.geometry.location;
      const newCoords = { lat: position.lat(), lng: position.lng() };
      marker.setPosition(position);
      map.setCenter(position);
      setCoordinates(newCoords);
      onLocationSelect(newCoords);
    });

    setMapLoaded(true);
  };

  // Reverse geocode coordinates to address
  const reverseGeocode = (coords: Coordinates) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        setSearchAddress(results[0].formatted_address);
      }
    });
  };

  // Search by address
  const handleAddressSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchAddress.trim()) return;

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: searchAddress }, (results, status) => {
      if (status === 'OK' && results && results[0] && results[0].geometry && results[0].geometry.location) {
        const position = results[0].geometry.location;
        const newCoords = { lat: position.lat(), lng: position.lng() };
        
        if (markerRef.current && googleMapRef.current) {
          markerRef.current.setPosition(position);
          googleMapRef.current.setCenter(position);
          googleMapRef.current.setZoom(15);
        }
        
        setCoordinates(newCoords);
        onLocationSelect(newCoords);
      }
    });
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by your browser');
      return;
    }

    setError('');
    setIsLocating(true);

    // Try to get high accuracy location first
    const getHighAccuracyLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handlePositionSuccess(position);
        },
        (error) => {
          // If high accuracy fails, try with lower accuracy
          if (error.code === error.TIMEOUT) {
            getLowAccuracyLocation();
          } else {
            handlePositionError(error);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    // Fallback to low accuracy location
    const getLowAccuracyLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handlePositionSuccess(position);
        },
        handlePositionError,
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 30000
        }
      );
    };

    const handlePositionSuccess = (position: GeolocationPosition) => {
      const newCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude
      };
    
      if (markerRef.current && googleMapRef.current) {
        const latLng = new google.maps.LatLng(newCoords.lat, newCoords.lng);
        markerRef.current.setPosition(latLng);
        googleMapRef.current.setCenter(latLng);
        googleMapRef.current.setZoom(15);
    
        // Remove any existing accuracy circles
        if (window.accuracyCircle) {
          window.accuracyCircle.setMap(null);
        }
    
        // Create accuracy circle with dynamic styling based on accuracy level
        if (position.coords.accuracy) {
          const accuracy = position.coords.accuracy;
          const accuracyLevel = accuracy <= 10 ? 'high' : accuracy <= 50 ? 'medium' : 'low';
          
          const circleOptions = {
            map: googleMapRef.current,
            center: latLng,
            radius: accuracy,
            strokeColor: accuracyLevel === 'high' ? '#4CAF50' : accuracyLevel === 'medium' ? '#FFC107' : '#FF5722',
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: accuracyLevel === 'high' ? '#4CAF50' : accuracyLevel === 'medium' ? '#FFC107' : '#FF5722',
            fillOpacity: 0.15
          };
    
          window.accuracyCircle = new google.maps.Circle(circleOptions);
    
          // Add accuracy indicator text
          const accuracyText = document.createElement('div');
          accuracyText.className = 'bg-white px-2 py-1 rounded shadow text-sm';
          accuracyText.innerHTML = `Location accuracy: ${Math.round(accuracy)}m`;
          
          googleMapRef.current.controls[google.maps.ControlPosition.TOP_RIGHT].push(accuracyText);
        }
      }
    
      setCoordinates(newCoords);
      onLocationSelect(newCoords);
      reverseGeocode(newCoords);
      setIsLocating(false);
    };

    const handlePositionError = (error: GeolocationPositionError) => {
      setIsLocating(false);
      switch(error.code) {
        case error.PERMISSION_DENIED:
          setError('Please allow access to your location to use this feature');
          break;
        case error.POSITION_UNAVAILABLE:
          setError('Location information is unavailable. Please try again.');
          break;
        case error.TIMEOUT:
          setError('The request to get user location timed out. Please try again.');
          break;
        default:
          setError('An unknown error occurred while getting location. Please try again.');
          break;
      }
    };

    // Start with high accuracy attempt
    getHighAccuracyLocation();
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-4 text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}
      <div id="map-search-container" className="w-full  text-sm">
        <div className="flex gap-2">
          <input
            id="map-search"
            type="text"
            placeholder="Search for an address"
            className="flex-1 p-3 border rounded"
            value={searchAddress}
            onChange={(e) => setSearchAddress(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddressSearch(e);
              }
            }}
          />
          <button 
            type="button" 
            onClick={handleAddressSearch}
            className="px-4 py-3 bg-primary text-white rounded"
          >
            Search
          </button>
          <button
            type="button"
            onClick={getCurrentLocation}
            disabled={isLocating}
            className="px-4 py-3 bg-primary text-white rounded flex items-center gap-2 disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            {isLocating ? 'Getting Location...' : 'Current Location'}
          </button>
        </div>
      </div>
      
      <div 
        ref={mapRef} 
        className="h-96 w-full rounded border"
      ></div>
      
      {coordinates.lat !== 0 && coordinates.lng !== 0 && (
        <div className="text-sm text-gray-500">
          Selected coordinates: {coordinates.lat.toFixed(6)}, {coordinates.lng.toFixed(6)}
        </div>
      )}
    </div>
  );
};

export default GoogleMapsPicker;


declare global {
  interface Window {
    accuracyCircle?: google.maps.Circle;
  }
}