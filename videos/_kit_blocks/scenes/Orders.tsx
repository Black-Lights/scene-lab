/**
 * @file videos/_kit_blocks/scenes/Orders.tsx
 * @description Worked example of the kit's Ledger and CodeBlock (docs/kit/blocks.md) on an everyday subject: a week
 *   in a bakery. Left, the week's orders grow row by row on their spoken words (a chip per day, the row's colour washed
 *   behind its text, an item chip, a reference, a hatched row for an order that came in by phone, a running count and
 *   a bracket over the regular orders). Right, the recipe lights line by line, a new step arrives and opens its row, and
 *   a word is underlined. Text on screen comes from ../data/bakery.json; colours are paints of the theme.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { CodeBlock, Ledger, SceneTitle, useBeat, useClock } from '@kit';
import type { LedgerRow, SceneProps } from '@kit';
import words from '../data/bakery.json';

const LIST = { x: 110, y: 300, w: 860 };
const FILE = { x: 1090, y: 300, w: 720 };

export default function Orders({ v }: SceneProps) {
  const t = useClock();
  const [mon, tue, wed] = [useBeat('mon'), useBeat('tue'), useBeat('wed')];
  const [flour, starter, fold] = [useBeat('flour'), useBeat('starter'), useBeat('fold')];
  const o = words.orders;
  const rows: LedgerRow[] = o.rows.map((r, i) => ({ ...r, at: [mon, tue, wed][i] }));
  // The running count steps with each order as it arrives.
  const count = t < mon ? 0 : t < tue ? o.counts[0] : t < wed ? o.counts[1] : o.counts[2];
  const r = words.recipe;

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <Ledger x={LIST.x} y={LIST.y} w={LIST.w} name={o.name} rows={rows} count={count} unit={o.unit} t={t}
        spans={[{ from: 'mon', to: 'tue', at: wed }]} />
      <CodeBlock x={FILE.x} y={FILE.y} w={FILE.w} name={r.name} lines={r.lines} tag={r.tag} t={t}
        lit={[1, 4]} at={{ 1: flour, 4: starter, 5: fold }} until={{ 1: starter, 4: fold }} arrive={[5]}
        marks={[{ line: 4, text: r.mark, at: starter }]} />
    </AbsoluteFill>
  );
}
