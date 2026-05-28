import * as vscode from 'vscode';
import type { RevisionStore, Revision, DiffChange } from '../types/index';

function getRevisionFilePath(mdFilePath: string): string {
  const uri = vscode.Uri.file(mdFilePath);
  const dir = uri.fsPath.replace(/[/\\][^/\\]+$/, '');
  const fileName = uri.fsPath.replace(/^.*[/\\]/, '');
  return vscode.Uri.file(`${dir}/.${fileName}.revisions.json`).fsPath;
}

export async function loadRevisionStore(filePath: string): Promise<RevisionStore> {
  const revPath = getRevisionFilePath(filePath);
  try {
    const uri = vscode.Uri.file(revPath);
    const bytes = await vscode.workspace.fs.readFile(uri);
    const json = Buffer.from(bytes).toString('utf-8');
    return JSON.parse(json) as RevisionStore;
  } catch {
    return {
      version: 1,
      filePath,
      baseVersion: null,
      revisions: [],
    };
  }
}

export async function saveRevisionStore(store: RevisionStore): Promise<void> {
  const revPath = getRevisionFilePath(store.filePath);
  const uri = vscode.Uri.file(revPath);
  const json = JSON.stringify(store, null, 2);
  await vscode.workspace.fs.writeFile(uri, Buffer.from(json, 'utf-8'));
}

export async function setBaseVersion(filePath: string, content: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  store.baseVersion = {
    content,
    markedAt: new Date().toISOString(),
    filePath,
  };
  store.revisions = [];
  await saveRevisionStore(store);
  return store;
}

export async function clearBaseVersion(filePath: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  store.baseVersion = null;
  store.revisions = [];
  await saveRevisionStore(store);
  return store;
}

export async function acceptChange(filePath: string, changeId: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  for (const rev of store.revisions) {
    const idx = rev.changes.findIndex((c) => c.id === changeId);
    if (idx !== -1) {
      rev.changes[idx].accepted = true;
      rev.changes.splice(idx, 1);
      if (rev.changes.length === 0) {
        rev.status = 'accepted';
      }
      break;
    }
  }
  await saveRevisionStore(store);
  return store;
}

export async function rejectChange(filePath: string, changeId: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  for (const rev of store.revisions) {
    const idx = rev.changes.findIndex((c) => c.id === changeId);
    if (idx !== -1) {
      rev.changes.splice(idx, 1);
      if (rev.changes.length === 0) {
        rev.status = 'rejected';
      }
      break;
    }
  }
  await saveRevisionStore(store);
  return store;
}

export async function acceptAllChanges(filePath: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  store.revisions = store.revisions.map((r) => ({
    ...r,
    status: 'accepted' as const,
    changes: [],
  }));
  await saveRevisionStore(store);
  return store;
}

export async function rejectAllChanges(filePath: string): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  store.revisions = store.revisions.map((r) => ({
    ...r,
    status: 'rejected' as const,
    changes: [],
  }));
  await saveRevisionStore(store);
  return store;
}

export async function addRevision(
  filePath: string,
  changes: DiffChange[],
  triggerer: 'ai' | 'human'
): Promise<RevisionStore> {
  const store = await loadRevisionStore(filePath);
  const revision: Revision = {
    id: `rev_${Date.now()}`,
    timestamp: new Date().toISOString(),
    triggerer,
    changes,
    stats: {
      inserted: changes.filter((c) => c.type === 'insert').length,
      deleted: changes.filter((c) => c.type === 'delete').length,
      modified: changes.filter((c) => c.type === 'modify').length,
    },
    status: 'pending',
  };
  store.revisions.unshift(revision);
  await saveRevisionStore(store);
  return store;
}
