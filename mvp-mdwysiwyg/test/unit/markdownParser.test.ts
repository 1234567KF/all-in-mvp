import { describe, it, expect } from 'vitest';
import { parseMarkdown, renderToHtml } from '../../src/extension/services/markdownParser';

describe('markdownParser', () => {
  describe('parseMarkdown', () => {
    it('should parse basic markdown and return html + headings', () => {
      const content = '# Hello World\n\nThis is a paragraph.';
      const result = parseMarkdown(content);

      expect(result.html).toContain('<h1>');
      expect(result.html).toContain('Hello World');
      expect(result.html).toContain('<p>');
      expect(result.headings).toHaveLength(1);
      expect(result.headings[0].text).toBe('Hello World');
      expect(result.headings[0].level).toBe(1);
    });

    it('should extract nested headings correctly', () => {
      const content = `# H1
## H2a
### H3a
## H2b`;
      const result = parseMarkdown(content);

      expect(result.headings).toHaveLength(1); // 1 root H1
      expect(result.headings[0].children).toHaveLength(2); // H2a, H2b
      expect(result.headings[0].children[0].text).toBe('H2a');
      expect(result.headings[0].children[0].children).toHaveLength(1); // H3a
      expect(result.headings[0].children[1].text).toBe('H2b');
    });

    it('should handle Chinese headings', () => {
      const content = '# 项目背景\n## 一、背景与定位\n### 1.1 痛点场景';
      const result = parseMarkdown(content);

      expect(result.headings).toHaveLength(1);
      expect(result.headings[0].text).toBe('项目背景');
      expect(result.headings[0].children[0].text).toBe('一、背景与定位');
    });

    it('should generate slug IDs for headings', () => {
      const content = '# Hello World\n## 第二章';
      const result = parseMarkdown(content);

      expect(result.headings[0].id).toBe('hello-world');
      expect(result.headings[0].children[0].id).toMatch(/第二章|chapter/);
    });

    it('should handle empty content', () => {
      const result = parseMarkdown('');
      expect(result.headings).toHaveLength(0);
      expect(result.html).toBe('');
    });

    it('should handle content with no headings', () => {
      const content = 'Just a paragraph.\n\nAnother paragraph.';
      const result = parseMarkdown(content);
      expect(result.headings).toHaveLength(0);
      expect(result.html).toContain('Just a paragraph');
    });

    it('should render inline formatting', () => {
      const content = '**bold** and *italic* and `code`';
      const result = parseMarkdown(content);
      expect(result.html).toContain('<strong>bold</strong>');
      expect(result.html).toContain('<em>italic</em>');
      expect(result.html).toContain('<code>code</code>');
    });

    it('should render tables', () => {
      const content = '| A | B |\n|---|---|\n| 1 | 2 |';
      const result = parseMarkdown(content);
      expect(result.html).toContain('<table>');
      expect(result.html).toContain('<th>');
      expect(result.html).toContain('<td>');
    });

    it('should render code blocks', () => {
      const content = '```javascript\nconsole.log("hi");\n```';
      const result = parseMarkdown(content);
      expect(result.html).toContain('<pre>');
      expect(result.html).toContain('<code');
    });

    it('should render mermaid blocks as special container', () => {
      const content = '```mermaid\ngraph TD;\n  A --> B;\n```';
      const result = parseMarkdown(content);
      expect(result.html).toContain('mermaid-container');
      expect(result.html).toContain('mermaid');
    });

    it('should render blockquotes', () => {
      const content = '> This is a quote';
      const result = parseMarkdown(content);
      expect(result.html).toContain('<blockquote>');
    });

    it('should render lists', () => {
      const content = '- item1\n- item2\n\n1. first\n2. second';
      const result = parseMarkdown(content);
      expect(result.html).toContain('<ul>');
      expect(result.html).toContain('<ol>');
      expect(result.html).toContain('<li>');
    });

    it('should handle H1 through H6', () => {
      const content = '# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6';
      const result = parseMarkdown(content);
      expect(result.headings).toHaveLength(1); // H1 is root
      // Walk the tree to verify all levels
      let node = result.headings[0];
      expect(node.level).toBe(1);
      node = node.children[0];
      expect(node.level).toBe(2);
      node = node.children[0];
      expect(node.level).toBe(3);
      node = node.children[0];
      expect(node.level).toBe(4);
      node = node.children[0];
      expect(node.level).toBe(5);
      node = node.children[0];
      expect(node.level).toBe(6);
    });
  });

  describe('renderToHtml', () => {
    it('should return rendered HTML string', () => {
      const html = renderToHtml('# Title\n\nParagraph');
      expect(html).toContain('<h1>');
      expect(html).toContain('<p>');
    });
  });
});
