import { describe, it, expect } from 'vitest';
import { createLodManager } from '@/lod/lod-manager.js';

const HIGH_BUDGET = 3;

function bodies(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: 'b' + i,
    distance: 100 + i * 10,
    visible: true,
    selected: false,
    hovered: false,
  }));
}

describe('LOD manager', () => {
  it('promotes selected body even when far', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[4].distance = 9999; list[4].selected = true;
    const decisions = m.decide(list);
    expect(decisions.find(d => d.id === 'b4').lod).toBe('high');
  });

  it('honors priority order: selected, hovered, then closest visible', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[4].selected = true;          // far but selected
    list[3].hovered = true;           // far-ish but hovered
    list[0].distance = 50;            // closest visible
    list[1].distance = 60;            // next closest visible
    const decisions = m.decide(list);
    const high = decisions.filter(d => d.lod === 'high').map(d => d.id).sort();
    expect(high).toEqual(['b0','b3','b4']); // selected + hovered + 1 closest
  });

  it('hysteresis: a body at 175 stays in current state', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET, upgradeAt: 150, downgradeAt: 200 });
    const list = bodies(1); list[0].distance = 100;
    let d = m.decide(list); expect(d[0].lod).toBe('high');
    list[0].distance = 175;            // inside hysteresis band
    d = m.decide(list); expect(d[0].lod).toBe('high'); // sticky high
    list[0].distance = 250;
    d = m.decide(list); expect(d[0].lod).toBe('low');
    list[0].distance = 175;
    d = m.decide(list); expect(d[0].lod).toBe('low'); // sticky low
  });

  it('skips invisible bodies when filling closest-visible slots', () => {
    const m = createLodManager({ highBudget: HIGH_BUDGET });
    const list = bodies(5);
    list[0].visible = false; list[1].visible = false;
    const decisions = m.decide(list);
    const highIds = decisions.filter(d => d.lod === 'high').map(d => d.id);
    expect(highIds).toEqual(['b2','b3','b4']);
  });
});
