/**
 * @file videos/_kit_blocks/scenes/Sales.tsx
 * @description Worked example of the kit's Bars, OutputPane and PhraseCard (docs/kit/blocks.md and chart.md): the
 *   bakery's week in numbers. A ranked column of the loaves sold arrives row by row, the best seller is ringed, and the
 *   mask takes out what sold out. The till prints the week character by character and its total lights on its spoken
 *   words. A myth card is struck through when the numbers have shown it wrong. Text on screen comes from
 *   ../data/bakery.json.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Bars, OutputPane, PhraseCard, SceneTitle, useBarsLayout, useBeat, useClock } from '@kit';
import type { BarRow, SceneProps } from '@kit';
import words from '../data/bakery.json';

const CHART = { x: 170, y: 380, w: 760 };
const PANE = { x: 1090, y: 330, w: 720 };
const CARD = { x: 1090, y: 600, w: 520 };

export default function Sales({ v }: SceneProps) {
  const t = useClock();
  const s = words.sales;
  const at = { sat: useBeat('sat'), best: useBeat('best'), out: useBeat('out'), till: useBeat('till'), total: useBeat('total'), wrong: useBeat('wrong') };
  const rows: BarRow[] = s.rows;
  const lay = useBarsLayout(rows, { labels: 2 });

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <Bars x={CHART.x + lay.left} y={CHART.y} w={CHART.w - lay.left} label={s.label} rows={rows} tag={s.tag} t={t}
        at={at.sat} picked={1} pickedAt={at.best} maskAt={at.out} maskLabel={s.mask} />
      <OutputPane x={PANE.x} y={PANE.y} w={PANE.w} name={s.till.name} text={s.till.text} rows={2} at={at.till} writeAt={at.till} t={t}
        spans={[{ text: s.till.span, at: at.total }]} />
      <PhraseCard x={CARD.x} y={CARD.y} w={CARD.w} head={s.myth.head} phrase={s.myth.phrase} at={at.sat}
        underline={{ text: s.myth.underline, at: at.out }} struckAt={at.wrong} t={t} />
    </AbsoluteFill>
  );
}
