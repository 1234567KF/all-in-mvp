import MarkdownIt from 'markdown-it';
import type { Heading } from '../types/index';

// Derive Token type from markdown-it parse result
type MdToken = ReturnType<MarkdownIt['parse']>[number];

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
});

// Custom plugin: detect mermaid fenced blocks
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx];
  if (token.info.trim() === 'mermaid') {
    return `<div class="mermaid-container"><div class="mermaid">${md.utils.escapeHtml(token.content)}</div></div>`;
  }
  return defaultFence!(tokens, idx, options, env, self);
};

export interface ParseResult {
  html: string;
  headings: Heading[];
  tokens: MdToken[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function parseMarkdown(content: string): ParseResult {
  const tokens = md.parse(content, {});
  const html = md.render(content);
  const headings = extractHeadings(tokens);
  return { html, headings, tokens };
}

function extractHeadings(tokens: MdToken[]): Heading[] {
  const flat: { level: number; text: string; id: string }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.type === 'heading_open') {
      const level = parseInt(token.tag.slice(1), 10);
      const inlineToken = tokens[i + 1];
      const text = inlineToken?.content || '';
      const id = slugify(text);
      flat.push({ level, text, id });
    }
  }

  return buildHeadingTree(flat);
}

function buildHeadingTree(
  flat: { level: number; text: string; id: string }[]
): Heading[] {
  const root: Heading[] = [];
  const stack: { heading: Heading; level: number }[] = [];

  for (const item of flat) {
    const heading: Heading = {
      id: item.id,
      level: item.level,
      text: item.text,
      children: [],
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= item.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(heading);
    } else {
      stack[stack.length - 1].heading.children.push(heading);
    }

    stack.push({ heading, level: item.level });
  }

  return root;
}

export function renderToHtml(content: string): string {
  return md.render(content);
}
