/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface GeocodeResult {
  display_name: string;
  address: {
    village?: string;
    suburb?: string;
    city_district?: string;
    city?: string;
    town?: string;
    road?: string;
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<{ address: string; barangay: string; city: string }> {
  // If offline, don't even try to reach the external geocoding API
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { address: `${lat.toFixed(6)}, ${lon.toFixed(6)} (Offline)`, barangay: '', city: '' };
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`
    );
    
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('Geocoding rate limited or blocked. Using coordinates.');
      }
      throw new Error(`Geocoding failed with status: ${response.status}`);
    }
    
    const data: GeocodeResult = await response.json();
    
    const address = data.display_name || 'Unknown Location';
    const barangay = data.address.village || data.address.suburb || data.address.city_district || '';
    const city = data.address.city || data.address.town || '';
    
    return { address, barangay, city };
  } catch (error) {
    // Only log if it's not a standard network error when offline or similar
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
       console.warn('Network error during geocoding. Fallback to coordinates.');
    } else {
       console.error('Reverse geocoding error:', error);
    }
    return { address: `${lat.toFixed(6)}, ${lon.toFixed(6)}`, barangay: '', city: '' };
  }
}
