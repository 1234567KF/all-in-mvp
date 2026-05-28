import * as Diff from 'diff';
import type { DiffChange, DiffStats } from '../types/index';
import { parseMarkdown } from './markdownParser';

let changeIdCounter = 0;
function nextChangeId(): string {
  return `change_${++changeIdCounter}`;
}

interface Section {
  headingId: string;
  headingText: string;
  level: number;
  lines: string[];
}

function splitIntoSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  let current: Section = { headingId: '_preamble', headingText: '', level: 0, lines: [] };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      if (current.lines.length > 0 || current.headingId !== '_preamble') {
        sections.push(current);
      }
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      current = {
        headingId: text.toLowerCase().replace(/[^\w\u4e00-\u9fff]+/g, '-'),
        headingText: text,
        level,
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }
  sections.push(current);
  return sections;
}

export interface DiffResult {
  changes: DiffChange[];
  stats: DiffStats;
}

export function computeDiff(v0: string, v1: string): DiffResult {
  const sections0 = splitIntoSections(v0);
  const sections1 = splitIntoSections(v1);
  const changes: DiffChange[] = [];
  const stats: DiffStats = { inserted: 0, deleted: 0, modified: 0 };

  // Build a map of v0 sections by heading ID
  const sectionMap0 = new Map<string, Section>();
  for (const s of sections0) {
    sectionMap0.set(s.headingId, s);
  }

  const matchedV0Ids = new Set<string>();

  // For each v1 section, find matching v0 section
  for (const s1 of sections1) {
    const s0 = sectionMap0.get(s1.headingId);
    matchedV0Ids.add(s1.headingId);

    if (!s0) {
      // Entirely new section
      changes.push({
        id: nextChangeId(),
        type: 'insert',
        position: { sectionId: s1.headingId, line: 0, column: 0 },
        newText: s1.lines.join('\n'),
        elementType: s1.level > 0 ? 'heading' : 'paragraph',
        accepted: false,
      });
      stats.inserted++;
      continue;
    }

    // Diff within matched sections
    const text0 = s0.lines.join('\n');
    const text1 = s1.lines.join('\n');

    if (text0 === text1) continue;

    // Check heading level change
    if (s0.level !== s1.level && s0.headingText === s1.headingText) {
      changes.push({
        id: nextChangeId(),
        type: 'modify',
        position: { sectionId: s1.headingId, line: 0, column: 0 },
        oldText: `${'!'.repeat(s0.level)} ${s0.headingText}`,
        newText: `${'!'.repeat(s1.level)} ${s1.headingText}`,
        elementType: 'heading',
        accepted: false,
      });
      stats.modified++;
    }

    // Word-level diff for content
    const wordDiff = Diff.diffWords(text0, text1);
    let lineOffset = 0;

    for (const part of wordDiff) {
      if (part.added) {
        changes.push({
          id: nextChangeId(),
          type: 'insert',
          position: { sectionId: s1.headingId, line: lineOffset, column: 0 },
          newText: part.value,
          elementType: 'paragraph',
          accepted: false,
        });
        stats.inserted++;
      } else if (part.removed) {
        changes.push({
          id: nextChangeId(),
          type: 'delete',
          position: { sectionId: s1.headingId, line: lineOffset, column: 0 },
          oldText: part.value,
          elementType: 'paragraph',
          accepted: false,
        });
        stats.deleted++;
      }
      if (!part.added) {
        lineOffset += (part.value.match(/\n/g) || []).length;
      }
    }
  }

  // Deleted sections (in v0 but not in v1)
  for (const s0 of sections0) {
    if (!matchedV0Ids.has(s0.headingId)) {
      changes.push({
        id: nextChangeId(),
        type: 'delete',
        position: { sectionId: s0.headingId, line: 0, column: 0 },
        oldText: s0.lines.join('\n'),
        elementType: s0.level > 0 ? 'heading' : 'paragraph',
        accepted: false,
      });
      stats.deleted++;
    }
  }

  return { changes, stats };
}
