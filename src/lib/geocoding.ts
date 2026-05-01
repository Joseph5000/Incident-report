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
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'ShieldReport-Accident-System/1.0',
        },
      }
    );
    
    if (!response.ok) throw new Error('Geocoding failed');
    
    const data: GeocodeResult = await response.json();
    
    const address = data.display_name || 'Unknown Location';
    const barangay = data.address.village || data.address.suburb || data.address.city_district || '';
    const city = data.address.city || data.address.town || '';
    
    return { address, barangay, city };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return { address: `${lat}, ${lon}`, barangay: '', city: '' };
  }
}
