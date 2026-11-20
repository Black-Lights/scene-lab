/**
 * @file videos/_kit_blocks/scenes/Shop.tsx
 * @description Worked example of the kit's Lanes, LedgerSlip and PhraseCard (docs/kit/blocks.md): who does what in the
 *   bakery in the morning. Three lanes (baker, shop, customer): a step on the baker's lane, trays carried to the shop
 *   as a one-row slip, a question from the customer and the answer carried back as a chip, both through the till (a lane
 *   box on those two arrows). Beside it, the rule of the house on a card that is stamped when it holds. Text on screen
 *   comes from ../data/bakery.json.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Chip, LedgerSlip, Lanes, PhraseCard, SceneTitle, useBeat, useClock } from '@kit';
import type { LaneArrow, SceneProps } from '@kit';
import words from '../data/bakery.json';

const LANES = { x: 110, y: 270, w: 1240, h: 560, laneW: 220 };
const SLIP_W = 340;
const SLIP_H = 80;
const CARD = { x: 1410, y: 330, w: 400 };

export default function Shop({ v }: SceneProps) {
  const t = useClock();
  const s = words.shop;
  const at = { shape: useBeat('shape'), trays: useBeat('trays'), ask: useBeat('ask'), hand: useBeat('hand'), rule: useBeat('rule') };
  const arrows: LaneArrow[] = [
    { id: 'shape', from: 'baker', to: 'baker', at: at.shape, label: s.labels.shape },
    { id: 'trays', from: 'baker', to: 'shop', at: at.trays, label: s.labels.trays, carryH: SLIP_H,
      carry: (dim: number) => <div style={{ position: 'relative', width: SLIP_W, height: SLIP_H }}><LedgerSlip x={0} y={0} w={SLIP_W} row={s.tray} dim={dim} /></div> },
    { id: 'ask', from: 'customer', to: 'shop', at: at.ask, label: s.labels.ask },
    { id: 'hand', from: 'shop', to: 'customer', at: at.hand, label: s.labels.hand, color: 'a',
      carry: (dim: number) => <Chip text={s.loaf} color="brown" solid dim={dim} /> },
  ];

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={t} />
      <Lanes {...LANES} lanes={s.lanes} arrows={arrows} t={t} />
      <PhraseCard x={CARD.x} y={CARD.y} w={CARD.w} head={s.rule.head} n={s.rule.n} phrase={s.rule.phrase} at={at.trays}
        stamp={{ text: s.rule.stamp, at: at.rule }} t={t} />
    </AbsoluteFill>
  );
}
