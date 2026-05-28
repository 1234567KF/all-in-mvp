import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useUiStore } from '../../src/webview/stores/uiStore';
import { useDocumentStore } from '../../src/webview/stores/documentStore';
import { demoDiffChanges as _rawChanges, demoRevisions as _rawRevisions } from '../../src/webview/demo-data';
import type { DiffChange } from '../../src/webview/types/index';

// Deep clone to prevent shared object mutation across tests
function freshChanges(): DiffChange[] { return JSON.parse(JSON.stringify(_rawChanges)); }
function freshRevisions() { return JSON.parse(JSON.stringify(_rawRevisions)); }

describe('UI Store — Button Behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('toggles view mode between card and flow', () => {
    const ui = useUiStore();
    expect(ui.viewMode).toBe('card');

    ui.setViewMode('flow');
    expect(ui.viewMode).toBe('flow');

    ui.setViewMode('card');
    expect(ui.viewMode).toBe('card');
  });

  it('toggles edit mode on/off', () => {
    const ui = useUiStore();
    expect(ui.editMode).toBe(false);

    ui.toggleEditMode();
    expect(ui.editMode).toBe(true);

    ui.toggleEditMode();
    expect(ui.editMode).toBe(false);
  });

  it('toggles diff visibility on/off', () => {
    const ui = useUiStore();
    expect(ui.diffVisible).toBe(true);

    ui.toggleDiffVisible();
    expect(ui.diffVisible).toBe(false);

    ui.toggleDiffVisible();
    expect(ui.diffVisible).toBe(true);
  });

  it('toggles dark mode', () => {
    const ui = useUiStore();
    expect(ui.darkMode).toBe(false);

    ui.toggleDarkMode();
    expect(ui.darkMode).toBe(true);

    ui.toggleDarkMode();
    expect(ui.darkMode).toBe(false);
  });

  it('shows and auto-dismisses toast', async () => {
    const ui = useUiStore();
    expect(ui.toast).toBe(null);

    ui.showToast('测试消息');
    expect(ui.toast).toBe('测试消息');

    await new Promise(r => setTimeout(r, 2100));
    expect(ui.toast).toBe(null);
  });

  it('toggles outline panel collapse', () => {
    const ui = useUiStore();
    expect(ui.outlineCollapsed).toBe(false);

    ui.toggleOutline();
    expect(ui.outlineCollapsed).toBe(true);

    ui.toggleOutline();
    expect(ui.outlineCollapsed).toBe(false);
  });

  it('toggles revision panel collapse', () => {
    const ui = useUiStore();
    expect(ui.revisionCollapsed).toBe(false);

    ui.toggleRevision();
    expect(ui.revisionCollapsed).toBe(true);
  });

  it('sets and clears active heading', () => {
    const ui = useUiStore();
    expect(ui.activeHeadingId).toBe(null);

    ui.setActiveHeading('test-heading');
    expect(ui.activeHeadingId).toBe('test-heading');

    ui.setActiveHeading(null);
    expect(ui.activeHeadingId).toBe(null);
  });
});

describe('Document Store — Accept/Reject Behavior', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('acceptAllChanges marks all changes as accepted and resets stats', () => {
    const doc = useDocumentStore();
    doc.setDiffResult(freshChanges(), { inserted: 140, deleted: 48, modified: 6 });

    expect(doc.diffChanges.length).toBeGreaterThan(0);
    expect(doc.diffChanges.every(c => c.accepted)).toBe(false);

    doc.acceptAllChanges();

    expect(doc.diffChanges.every(c => c.accepted)).toBe(true);
    expect(doc.diffStats.inserted).toBe(0);
    expect(doc.diffStats.deleted).toBe(0);
    expect(doc.diffStats.modified).toBe(0);
  });

  it('rejectAllChanges clears all changes and resets stats', () => {
    const doc = useDocumentStore();
    doc.setDiffResult(freshChanges(), { inserted: 140, deleted: 48, modified: 6 });

    doc.rejectAllChanges();

    expect(doc.diffChanges.length).toBe(0);
    expect(doc.diffStats.inserted).toBe(0);
    expect(doc.diffStats.deleted).toBe(0);
    expect(doc.diffStats.modified).toBe(0);
  });

  it('acceptChange marks a single change as accepted', () => {
    const doc = useDocumentStore();
    doc.setDiffResult(freshChanges(), { inserted: 140, deleted: 48, modified: 6 });

    doc.acceptChange('dc1');

    const dc1 = doc.diffChanges.find(c => c.id === 'dc1');
    expect(dc1?.accepted).toBe(true);

    const dc2 = doc.diffChanges.find(c => c.id === 'dc2');
    expect(dc2?.accepted).toBe(false);
  });

  it('rejectChange removes a single change from the list', () => {
    const doc = useDocumentStore();
    doc.setDiffResult(freshChanges(), { inserted: 140, deleted: 48, modified: 6 });
    const initialCount = doc.diffChanges.length;

    doc.rejectChange('dc1');

    expect(doc.diffChanges.length).toBe(initialCount - 1);
    expect(doc.diffChanges.find(c => c.id === 'dc1')).toBeUndefined();
  });

  it('setBaseVersionLocal sets base version and hasBaseVersion returns true', () => {
    const doc = useDocumentStore();
    expect(doc.hasBaseVersion).toBe(false);

    doc.setBaseVersionLocal({ content: '# test', markedAt: new Date().toISOString(), filePath: 'test.md' });
    expect(doc.hasBaseVersion).toBe(true);
    expect(doc.baseVersion?.content).toBe('# test');
  });

  it('clearBaseVersionLocal removes base version and clears diff', () => {
    const doc = useDocumentStore();
    doc.setBaseVersionLocal({ content: '# test', markedAt: new Date().toISOString(), filePath: 'test.md' });
    doc.setDiffResult(freshChanges(), { inserted: 10, deleted: 5, modified: 2 });

    doc.clearBaseVersionLocal();

    expect(doc.hasBaseVersion).toBe(false);
    expect(doc.baseVersion).toBe(null);
    expect(doc.diffChanges.length).toBe(0);
    expect(doc.diffStats.inserted).toBe(0);
  });
});

describe('Demo Data Integrity', () => {
  it('raw demoDiffChanges has valid structure with accepted=false', () => {
    const changes = freshChanges();
    expect(changes.length).toBeGreaterThan(0);
    changes.forEach((c: DiffChange) => {
      expect(c.id).toBeTruthy();
      expect(['insert', 'delete', 'modify']).toContain(c.type);
      expect(c.accepted).toBe(false);
      expect(c.position).toBeDefined();
      expect(c.position.sectionId).toBeTruthy();
    });
  });

  it('demoRevisions have non-empty changes arrays', () => {
    const revisions = freshRevisions();
    revisions.forEach((rev: any) => {
      expect(rev.changes.length).toBeGreaterThan(0);
      rev.changes.forEach((c: any) => {
        expect(c.id).toBeTruthy();
        expect(['insert', 'delete', 'modify']).toContain(c.type);
      });
    });
  });

  it('demoRevisions stats are positive', () => {
    const revisions = freshRevisions();
    revisions.forEach((rev: any) => {
      const totalOps = rev.stats.inserted + rev.stats.deleted + rev.stats.modified;
      expect(totalOps).toBeGreaterThan(0);
    });
  });
});
