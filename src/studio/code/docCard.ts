import type { RegistryEntry } from '@/engine/script';
import { kindLabel, signatureOf, tiersOf, unitsOf, whereUsable } from '../reference/entryDocs';

/** Small DOM builder. Text always goes in through textContent, so registry text can never become markup. */
function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = style;
  if (text !== undefined) node.textContent = text;
  return node;
}

const MONO = 'font-family:var(--font-mono);font-size:12px;';

/** The short card shown beside an autocomplete option. */
export function completionInfo(e: RegistryEntry): HTMLElement {
  const box = el('div', 'display:flex;flex-direction:column;gap:6px;');
  box.append(el('code', `${MONO}color:var(--color-accent);`, signatureOf(e)), el('div', 'color:var(--color-fg);', e.summary), el('div', 'color:var(--color-muted);', unitsOf(e)));
  return box;
}

/**
 * The hover card: summary, signature, units, description and example, plus
 * a button that inserts the example. Built with plain DOM because
 * CodeMirror tooltips live outside React.
 */
export function hoverCard(e: RegistryEntry, onInsert: () => void): HTMLElement {
  const box = el('div', 'display:flex;flex-direction:column;gap:8px;padding:12px;max-width:380px;font-size:12px;line-height:1.5;font-family:var(--font-sans);');
  const head = el('div', 'display:flex;align-items:center;gap:8px;');
  head.append(
    el('code', `${MONO}font-size:13px;font-weight:600;color:var(--color-fg);`, e.name),
    el('span', 'font-size:10px;text-transform:uppercase;letter-spacing:0.04em;color:var(--color-muted);border:1px solid var(--color-border-strong);border-radius:4px;padding:0 5px;', kindLabel(e)),
  );
  const signature = el('code', `${MONO}color:var(--color-accent);background:var(--color-bg);border-radius:5px;padding:4px 6px;white-space:pre-wrap;`, signatureOf(e));
  const facts = el('div', 'color:var(--color-muted);', `${unitsOf(e)} ${whereUsable(e)} ${tiersOf(e)}`);
  const example = el('pre', `${MONO}margin:0;color:var(--color-fg);background:var(--color-bg);border:1px solid var(--color-border);border-radius:6px;padding:6px 8px;white-space:pre-wrap;`, e.example);
  const button = el(
    'button',
    'align-self:flex-start;font:500 12px var(--font-sans);color:var(--color-fg);background:var(--color-surface-3);border:1px solid var(--color-border-strong);border-radius:6px;padding:3px 10px;cursor:pointer;',
    'Insert example',
  ) as HTMLButtonElement;
  button.type = 'button';
  button.addEventListener('mousedown', (ev) => ev.preventDefault());
  button.addEventListener('click', onInsert);
  box.append(head, el('div', 'color:var(--color-fg);', e.summary), signature, facts, el('div', 'color:var(--color-muted);', e.description), example, button);
  return box;
}
