/**
 * @file videos/_kit_parts/scenes/Packing.tsx
 * @description Worked example of the kit's 2D parts (docs/kit/parts.md) on an everyday subject: packing a case for
 *   a rainy weekend. One picture drawn by two scenes: scene 1 builds the list and the case, scene 2 continues the
 *   same picture ("cut": "none") and adds the capacity bar, the expired passport, the taxi and the stamp. Each scene
 *   declares only the beats spoken in it; useBeatTimes() answers PAST for the beats an earlier scene spoke (listed
 *   in the scene's props under "done"), so scene 2 opens on the picture scene 1 ended on.
 *   Every part of the kit's 2D set is used once. Text on screen comes from ../data/packing.json; colours are paints
 *   and tokens of the theme; positions are layout pixels.
 */
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { Arrow2, Badge, Brace, CHIP_H, CapacityBar, capacityBarLayout, Chip, Circled, Countdown, FadeIn, HatchDefs, HatchedRect, SceneTitle, Sheet,
  Stamp, Strike, Tag, Text, TextCard, TickCross, contrast, continuesPicture, hatchFill, hatchId, highlight, knockOut, paint, prog,
  textStyle, useBeatTimes, useCharWidth, useClock, useTextCardLayout, useTheme, wrapText } from '@kit';
import type { SceneProps } from '@kit';
import words from '../data/packing.json';

const CARD = { x: 110, y: 290, w: 560 };
/** The right column starts here and ends at 1810. */
const COL = 780;
const CASE = { x: COL, y: 500, w: 1030, h: 120 };
const BAR = { x: COL, y: 700, w: 1030, h: 80 };
const GAP = 14;

export default function Packing({ v }: SceneProps) {
  const th = useTheme();
  const t = useClock();
  const done = ((v.props ?? {}) as { done?: string[] }).done ?? [];
  const at = useBeatTimes(done);
  const list = words.list;

  // --- the list: a text card, a brace over its first two lines, a strike through the shorts ---
  const card = useTextCardLayout({ y: CARD.y, w: CARD.w, lines: list.lines, foot: list.foot });
  const braceX = CARD.x + card.textX + Math.max(card.lineW(1), card.lineW(2)) + GAP;

  // --- the case: chips laid out from their measured widths (data face, smallest size) ---
  const chW = useCharWidth();
  const chipW = (text: string) => text.length * chW + 2 * 14 + 2 * th.stroke;
  const chipY = (CASE.h - CHIP_H) / 2;
  const c = words.chips;
  const x0 = 20;
  const x1 = x0 + chipW(c.clothes) + GAP;
  const x2 = x1 + chipW(c.boots) + GAP;
  const ringX = x2 + chipW(c.umbrella) + 8 + 23;
  const x3 = ringX + 23 + GAP;
  const tickX = x3 + chipW(c.passport) + GAP;

  // --- colours: a hatch line for the rain mark, and the ink that reads best on the blue part of the bar ---
  const blue = paint(th, 'blue');
  const rainId = hatchId(blue, { pitch: 10 });
  const onBlue = contrast(paint(th, 'ink'), blue) >= contrast(paint(th, 'bg'), blue) ? 'ink' : 'bg';
  const surface = paint(th, 'surface');

  // --- the bar: where its first part stands, for the label written inside it ---
  const first = capacityBarLayout({ ...BAR, total: words.bar.total, parts: words.bar.parts }, th.stroke).parts[0];

  return (
    <AbsoluteFill>
      <SceneTitle text={v.title} t={continuesPicture(done) ? 1e3 : t} />

      <TextCard x={CARD.x} y={CARD.y} w={CARD.w} name={list.name} lines={list.lines} foot={list.foot} tag={list.tag} t={t}
        lit={[1, 2, 4]} at={{ 1: at('first'), 2: at('boots'), 4: at('borrowed') }}
        until={{ 1: at('borrowed'), 2: at('borrowed'), 4: at('rain') }} backAt={{ 5: at('off') }}
        markers={[{ line: 4, letter: words.marker, at: at('borrowed'), litAt: at('borrowed'), litUntil: at('rain') }]} />
      <Brace x={braceX} y={card.lineY(1) - card.lineH / 2 + 4} len={2 * card.lineH - 8} side="right" label={words.first}
        at={at('first')} t={t} />
      <Strike x={CARD.x + card.textX - 6} y={card.lineY(5) + 1} len={card.lineW(5) + 12} at={at('off')} t={t} />
      <Arrow2 from={[CARD.x + CARD.w + 10, card.lineY(2)]} to={[COL - 10, CASE.y + CASE.h / 2]} at={at('first')} t={t} />

      {/* the forecast, its source, the rain mark (an SVG circle filled with a hatch pattern), two nights, the taxi */}
      <Text x={COL} y={270} w={600} size="m" text={words.note} shown={prog(t, at('rain'), 0.5)} />
      <Tag x={COL + 600} y={412} text={words.source} shown={prog(t, at('rain'), 0.5)} />
      <FadeIn at={at('rain')} t={t}>
        <svg width={100} height={100} style={{ position: 'absolute', left: 1430, top: 266 }}>
          <HatchDefs id={rainId} color={blue} pitch={10} />
          <circle cx={50} cy={50} r={44} fill={hatchFill(rainId)} stroke={blue} strokeWidth={th.stroke} />
        </svg>
      </FadeIn>
      <Badge x={1625} y={300} text={words.nights.n} />
      <Text x={1660} y={282} text={words.nights.word} color="ink2" />
      <Text x={1675} y={378} text={words.taxi} anchor="end" shown={prog(t, at('taxi'), 0.3)} />
      <Countdown x={1745} y={395} at={at('taxi')} over={10} t={t} />

      {/* the legend: a hatched swatch with its word knocked out of the lines */}
      <FadeIn at={at('borrowed')} t={t}>
        <HatchedRect x={1600} y={458} w={210} h={38} color="surface" radius={th.radius} />
        <div style={{ position: 'absolute', left: 1600, top: 458, width: 210, height: 38, display: 'flex', alignItems: 'center',
          justifyContent: 'center', ...textStyle(th, 's'), lineHeight: 1, ...knockOut(surface) }}>
          {words.legend}
        </div>
      </FadeIn>

      <Sheet x={CASE.x} y={CASE.y} w={CASE.w} h={CASE.h} name={words.case}>
        <FadeIn at={at('first')} t={t}>
          <Chip x={x0} y={chipY} text={c.clothes} color="blue" solid lit={highlight(t, at('first'), at('borrowed'))} />
        </FadeIn>
        <FadeIn at={at('boots')} t={t}>
          <Chip x={x1} y={chipY} text={c.boots} color="brown" solid />
        </FadeIn>
        <FadeIn at={at('borrowed')} t={t}>
          <Chip x={x2} y={chipY} text={c.umbrella} hatch />
          <Circled x={ringX} y={CASE.h / 2} text={words.marker} lit={highlight(t, at('borrowed'), at('rain'))} />
        </FadeIn>
        <FadeIn at={at('passport')} t={t}>
          <Chip x={x3} y={chipY} text={c.passport} ink="red" edge="red" />
        </FadeIn>
        <FadeIn at={at('expired')} t={t}>
          <TickCross x={tickX} y={(CASE.h - 32) / 2} size={32} on="surface" />
          <Text x={tickX + 32 * 2.3 + GAP} y={CASE.h / 2 - 35} text={wrapText(words.expired, 12).join('\n')} />
        </FadeIn>
      </Sheet>

      <CapacityBar x={BAR.x} y={BAR.y} w={BAR.w} h={BAR.h} total={words.bar.total} number={words.bar.number} parts={words.bar.parts}
        callout={{ x: CASE.x + x0, y: CASE.y + chipY + CHIP_H, w: chipW(c.clothes) }} at={at('case')} numberAt={at('case')} t={t} />
      <Text x={first.x + first.w / 2} y={BAR.y + BAR.h / 2 - 17} anchor="middle"
        text={words.bar.first} color={onBlue} shown={prog(t, at('litres'), 0.3)} />

      {/* the stamp lands on the empty end of the case's bar */}
      <Stamp x={BAR.x + BAR.w - 150} y={BAR.y + BAR.h / 2} text={words.stamp} at={at('closed')} t={t} />
    </AbsoluteFill>
  );
}
