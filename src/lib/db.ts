/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { IncidentReport } from '../types';

const DB_NAME = 'ShieldReportDB';
const STORE_NAME = 'incidents';
const DRAFT_STORE = 'drafts';
const CURRENT_DRAFT_KEY = 'active_draft';

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 2, { // Bumped version
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
    },
  });
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

export async function deleteReport(tempId: string) {
  const db = await initDB();
  return db.delete(STORE_NAME, tempId);
}
