/**
 * The small markdown subset lesson text uses: paragraphs, bulleted and
 * numbered lists, bold and inline code. It parses to plain data that React
 * renders as elements, so lesson text can never inject markup.
 */
export type Inline = { kind: 'text'; text: string } | { kind: 'bold'; children: Inline[] } | { kind: 'code'; text: string };

export type MdBlock = { kind: 'paragraph'; inline: Inline[] } | { kind: 'list'; ordered: boolean; items: Inline[][] };

const BULLET = /^\s*[-*]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

function pushText(out: Inline[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.kind === 'text') last.text += text;
  else out.push({ kind: 'text', text });
}

/** Inline code first, so `**` inside backticks stays literal. Unclosed markers are kept as plain text. */
export function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  let i = 0;
  while (i < src.length) {
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1);
      if (end > i + 1) {
        out.push({ kind: 'code', text: src.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (src.startsWith('**', i)) {
      const end = src.indexOf('**', i + 2);
      if (end > i + 2) {
        out.push({ kind: 'bold', children: parseInline(src.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    const next = [src.indexOf('`', i + 1), src.indexOf('**', i + 1)].filter((n) => n !== -1);
    const stop = next.length > 0 ? Math.min(...next) : src.length;
    pushText(out, src.slice(i, stop));
    i = stop;
  }
  return out;
}

export function parseMarkdown(src: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' ')) });
    para = [];
  };
  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    const bullet = BULLET.exec(raw);
    const numbered = bullet ? null : NUMBERED.exec(raw);
    if (bullet || numbered) {
      flush();
      const ordered = numbered !== null;
      const item = parseInline((bullet ?? numbered)![1].trim());
      const last = blocks[blocks.length - 1];
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
    } else if (line === '') {
      flush();
    } else {
      const last = blocks[blocks.length - 1];
      // A line right under a list item, indented, continues that item.
      if (para.length === 0 && last?.kind === 'list' && /^\s+/.test(raw)) last.items[last.items.length - 1].push({ kind: 'text', text: ` ${line}` });
      else para.push(line);
    }
  }
  flush();
  return blocks;
}
