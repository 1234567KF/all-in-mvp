import { describe, it, expect } from 'vitest';
import { computeDiff } from '../../src/extension/services/diffEngine';

describe('diffEngine', () => {
  describe('computeDiff', () => {
    it('should return empty changes for identical content', () => {
      const content = '# Title\n\nSame paragraph.';
      const result = computeDiff(content, content);
      expect(result.changes).toHaveLength(0);
      expect(result.stats.inserted).toBe(0);
      expect(result.stats.deleted).toBe(0);
      expect(result.stats.modified).toBe(0);
    });

    it('should detect inserted text', () => {
      const v0 = '# Title\n\nOriginal paragraph.';
      const v1 = '# Title\n\nOriginal paragraph with new words.';
      const result = computeDiff(v0, v1);

      expect(result.changes.length).toBeGreaterThan(0);
      const inserts = result.changes.filter((c) => c.type === 'insert');
      expect(inserts.length).toBeGreaterThan(0);
      expect(result.stats.inserted).toBeGreaterThan(0);
    });

    it('should detect deleted text', () => {
      const v0 = '# Title\n\nThis is a long paragraph with many words.';
      const v1 = '# Title\n\nThis is a paragraph.';
      const result = computeDiff(v0, v1);

      const deletes = result.changes.filter((c) => c.type === 'delete');
      expect(deletes.length).toBeGreaterThan(0);
      expect(result.stats.deleted).toBeGreaterThan(0);
    });

    it('should detect new sections', () => {
      const v0 = '# Title\n\nParagraph.';
      const v1 = '# Title\n\nParagraph.\n\n## New Section\n\nNew content.';
      const result = computeDiff(v0, v1);

      const inserts = result.changes.filter((c) => c.type === 'insert');
      expect(inserts.length).toBeGreaterThan(0);
    });

    it('should detect deleted sections', () => {
      const v0 = '# Title\n\n## Section A\n\nContent A.\n\n## Section B\n\nContent B.';
      const v1 = '# Title\n\n## Section A\n\nContent A.';
      const result = computeDiff(v0, v1);

      const deletes = result.changes.filter((c) => c.type === 'delete');
      expect(deletes.length).toBeGreaterThan(0);
    });

    it('should detect heading level changes', () => {
      const v0 = '# Title\n\n## Section\n\nContent.';
      const v1 = '# Title\n\n### Section\n\nContent.';
      const result = computeDiff(v0, v1);

      const modifies = result.changes.filter((c) => c.type === 'modify');
      expect(modifies.length).toBeGreaterThan(0);
      expect(modifies[0].elementType).toBe('heading');
    });

    it('should handle empty v0 (all inserts)', () => {
      const v0 = '';
      const v1 = '# Title\n\nNew content.';
      const result = computeDiff(v0, v1);

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.stats.inserted).toBeGreaterThan(0);
    });

    it('should handle empty v1 (all deletes)', () => {
      const v0 = '# Title\n\nExisting content.';
      const v1 = '';
      const result = computeDiff(v0, v1);

      expect(result.changes.length).toBeGreaterThan(0);
      expect(result.stats.deleted).toBeGreaterThan(0);
    });

    it('should assign unique IDs to each change', () => {
      const v0 = '# Title\n\nOld text.';
      const v1 = '# Title\n\nNew text.';
      const result = computeDiff(v0, v1);

      const ids = result.changes.map((c) => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should set accepted to false by default', () => {
      const v0 = 'Old.';
      const v1 = 'New.';
      const result = computeDiff(v0, v1);

      for (const change of result.changes) {
        expect(change.accepted).toBe(false);
      }
    });

    it('should handle Chinese text diff', () => {
      const v0 = '# 标题\n\n这是原始内容。';
      const v1 = '# 标题\n\n这是修改后的新内容。';
      const result = computeDiff(v0, v1);

      expect(result.changes.length).toBeGreaterThan(0);
    });

    it('should track section IDs for diff positions', () => {
      const v0 = '# Main Title\n\n## Section A\n\nContent.';
      const v1 = '# Main Title\n\n## Section A\n\nNew content.';
      const result = computeDiff(v0, v1);

      for (const change of result.changes) {
        expect(change.position.sectionId).toBeTruthy();
      }
    });
  });
});
