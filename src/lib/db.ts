/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { IncidentReport } from '../types';

const DB_NAME = 'ShieldReportDB';
const STORE_NAME = 'incidents';
const DRAFT_STORE = 'drafts';
const BOLO_STORE = 'bolos';
const FEED_STORE = 'tactical_feed';
const AUDIT_STORE = 'audit_logs';
const CURRENT_DRAFT_KEY = 'active_draft';

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 4, { // Bumped version to 4
    upgrade(db, oldVersion) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'tempId',
        });
        store.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains(DRAFT_STORE)) {
        db.createObjectStore(DRAFT_STORE);
      }
      if (!db.objectStoreNames.contains(BOLO_STORE)) {
        db.createObjectStore(BOLO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(FEED_STORE)) {
        db.createObjectStore(FEED_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(AUDIT_STORE)) {
        db.createObjectStore(AUDIT_STORE, { keyPath: 'id' });
      }
    },
  });
}

// BOLO Actions
export async function saveBolo(bolo: any) {
  const db = await initDB();
  return db.put(BOLO_STORE, bolo);
}

export async function getAllBolos() {
  const db = await initDB();
  return db.getAll(BOLO_STORE);
}

export async function deleteBolo(id: string) {
  const db = await initDB();
  return db.delete(BOLO_STORE, id);
}

// Feed Actions
export async function saveFeedItem(item: any) {
  const db = await initDB();
  return db.put(FEED_STORE, item);
}

export async function getAllFeedItems() {
  const db = await initDB();
  return db.getAll(FEED_STORE);
}

export async function deleteFeedItem(id: string) {
  const db = await initDB();
  return db.delete(FEED_STORE, id);
}

// Audit Actions
export async function saveAuditLog(log: any) {
  const db = await initDB();
  return db.put(AUDIT_STORE, log);
}

export async function getAllAuditLogs() {
  const db = await initDB();
  return db.getAll(AUDIT_STORE);
}

export async function saveDraft(report: IncidentReport) {
  const db = await initDB();
  return db.put(STORE_NAME, report);
}

export async function setFormDraft(report: Partial<IncidentReport>) {
  const db = await initDB();
  return db.put(DRAFT_STORE, report, CURRENT_DRAFT_KEY);
}

export async function getFormDraft(): Promise<Partial<IncidentReport> | null> {
  const db = await initDB();
  return db.get(DRAFT_STORE, CURRENT_DRAFT_KEY);
}

export async function clearFormDraft() {
  const db = await initDB();
  return db.delete(DRAFT_STORE, CURRENT_DRAFT_KEY);
}

export async function getAllReports(): Promise<IncidentReport[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export const getDrafts = getAllReports;

export async function deleteReport(tempId: string) {
  const db = await initDB();
  return db.delete(STORE_NAME, tempId);
}
