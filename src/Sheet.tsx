/**
 * @file Sheet.tsx
 * @description Contact sheet for one asset query (make.py --assets): up to 12 numbered candidates from every
 *   provider, each with its source and licence, so the spec writer picks with "pick": n after one image read.
 *   A tool view, not part of any video.
 */
import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { Glyph } from './draw';
import type { IconData } from './draw';

export type SheetItem = { n: number; thumb?: string | null; svg?: IconData | null; title: string; meta: string; flags: string[] };
export type SheetProps = { title: string; items: SheetItem[] };

export const Sheet = ({ title, items }: SheetProps) => (
  <AbsoluteFill style={{ background: '#ECEEF1', fontFamily: 'Segoe UI, sans-serif', color: '#15191F', padding: '24px 32px' }}>
    <div style={{ fontSize: 34, fontWeight: 700, marginBottom: 14 }}>{title}</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      {items.map((it) => (
        <div key={it.n} style={{ background: '#FFFFFF', borderRadius: 10, height: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ height: 196, background: '#D9DDE3', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {it.thumb ? <Img src={staticFile(it.thumb)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : null}
            {it.svg ? <Glyph icon={it.svg} size={120} color="#15191F" /> : null}
            {!it.thumb && !it.svg ? <div style={{ fontSize: 22, padding: 16, textAlign: 'center' }}>{it.title}</div> : null}
            <div style={{ position: 'absolute', left: 8, top: 8, background: '#15191F', color: '#FFFFFF', fontSize: 30, fontWeight: 700, padding: '0 12px', borderRadius: 8 }}>
              {it.n}
            </div>
            {it.flags.length ? (
              <div style={{ position: 'absolute', right: 8, top: 8, background: '#B0261A', color: '#FFFFFF', fontSize: 20, fontWeight: 700, padding: '2px 10px', borderRadius: 8 }}>
                {it.flags.join(' ')}
              </div>
            ) : null}
          </div>
          <div style={{ padding: '8px 12px', fontSize: 20, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
            <div style={{ color: '#3A4350' }}>{it.meta}</div>
          </div>
        </div>
      ))}
    </div>
  </AbsoluteFill>
);
