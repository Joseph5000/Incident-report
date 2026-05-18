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

export type UserRole = 'Officer' | 'Supervisor' | 'Admin';

export interface User {
  badgeNumber: string;
  name: string;
  role: UserRole;
}

export interface IncidentReport {
  id?: number;
  tempId: string;
  type: string;
  description: string;
  officerNotes?: string;
  supervisorNotes?: string;
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
  status: 'draft' | 'pending' | 'submitted' | 'rejected' | 'approved';
  submittedBy?: string; // Badge number
  reviewedBy?: string; // Badge number
  createdAt: string;
  updatedAt?: string;
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

export interface AuditLog {
  id: string;
  action: 'CREATE' | 'DELETE' | 'UPDATE' | 'LOGIN';
  entityType: 'BOLO' | 'FEED' | 'REPORT' | 'USER';
  entityId: string;
  details: string;
  performedBy: string;
  timestamp: string;
}
