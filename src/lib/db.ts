/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { openDB, IDBPDatabase } from 'idb';
import { IncidentReport } from '../types';

const DB_NAME = 'ShieldReportDB';
const STORE_NAME = 'incidents';

export async function initDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'tempId',
        });
        store.createIndex('status', 'status');
      }
    },
  });
}

export async function saveDraft(report: IncidentReport) {
  const db = await initDB();
  return db.put(STORE_NAME, report);
}

export async function getAllReports(): Promise<IncidentReport[]> {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function deleteReport(tempId: string) {
  const db = await initDB();
  return db.delete(STORE_NAME, tempId);
}
