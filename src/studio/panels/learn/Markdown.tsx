import { Fragment } from 'react';
import { parseMarkdown, type Inline } from './markdown';

function InlineText({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) => {
        if (p.kind === 'code') {
          return (
            <code key={i} className="rounded bg-bg px-1 py-0.5 font-mono text-[12px] text-accent">
              {p.text}
            </code>
          );
        }
        if (p.kind === 'bold') {
          return (
            <strong key={i} className="font-semibold text-fg">
              <InlineText parts={p.children} />
            </strong>
          );
        }
        return <Fragment key={i}>{p.text}</Fragment>;
      })}
    </>
  );
}

/** Lesson text as React elements. No HTML string is ever produced. */
export function Markdown({ source }: { source: string }) {
  return (
    <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-fg/90">
      {parseMarkdown(source).map((b, i) => {
        if (b.kind === 'paragraph') {
          return (
            <p key={i}>
              <InlineText parts={b.inline} />
            </p>
          );
        }
        const List = b.ordered ? 'ol' : 'ul';
        return (
          <List key={i} className={b.ordered ? 'list-decimal pl-5' : 'list-disc pl-5'}>
            {b.items.map((item, j) => (
              <li key={j} className="pl-0.5">
                <InlineText parts={item} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
