/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  address?: string;
  barangay?: string;
  city?: string;
  timestamp: string;
}

export interface InvolvementRecord {
  id: string;
  type: 'Suspect' | 'Witness' | 'Victim' | 'Reporting Person';
  name: string;
  description?: string;
  dateOfBirth?: string;
  contact?: string;
}

export interface WitnessRecord {
  id: string;
  name: string;
  phone: string;
  address: string;
  statement: string;
  timestamp: string;
}

export interface VehicleRecord {
  id: string;
  plate: string;
  make: string;
  model: string;
  color: string;
  year?: string;
  notes?: string;
}

export interface AudioNote {
  id: string;
  data: string; // Base64 string
  duration: number;
  timestamp: string;
}

export interface VideoEvidence {
  id: string;
  data: string; // Blob URL or Base64 string
  timestamp: string;
}

export interface IncidentReport {
  id?: number;
  tempId: string;
  type: string;
  description: string;
  officerNotes?: string;
  location: LocationData;
  images: string[]; 
  videos?: VideoEvidence[];
  witnesses?: WitnessRecord[];
  signatures: { name: string; type: string; data: string }[];
  involvement: InvolvementRecord[];
  vehicles: VehicleRecord[];
  audioNotes: AudioNote[];
  impoundDetails?: {
    towCompany: string;
    lotNumber: string;
    reason: string;
    inventoryNotes: string;
  };
  status: 'draft' | 'pending' | 'submitted';
  createdAt: string;
}

export interface BoloAlert {
  id: string;
  type: 'Person' | 'Vehicle' | 'Alert';
  title: string;
  description: string;
  imageUrl?: string;
  timestamp: string;
  priority: 'Low' | 'Medium' | 'High' | 'Emergency';
}

export type UnitStatus = 'Available' | 'En Route' | 'On Scene' | 'Busy' | 'Off Duty';

export interface TacticalFeedItem {
  id: string;
  type: 'Dispatch' | 'Department' | 'BOLO';
  content: string;
  timestamp: string;
}

export interface ExifData {
  latitude?: number;
  longitude?: number;
  timestamp?: Date;
}
