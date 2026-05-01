/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  barangay?: string;
  city?: string;
  timestamp: string;
}

export interface IncidentReport {
  id?: number;
  tempId: string;
  type: string;
  description: string;
  location: LocationData;
  images: string[]; // Base64 or Blob URLs for preview
  signatures: { name: string; type: string; data: string }[];
  status: 'draft' | 'pending' | 'submitted';
  createdAt: string;
}

export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: Date;
}
