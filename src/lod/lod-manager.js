const DEFAULT_OPTS = { highBudget: 3, upgradeAt: 150, downgradeAt: 200 };

export function createLodManager(opts = {}) {
  const { highBudget, upgradeAt, downgradeAt } = { ...DEFAULT_OPTS, ...opts };
  /** @type {Map<string, 'high'|'low'>} */
  const lastLod = new Map();

  function decide(list) {
    // Priority queue: selected → hovered → closest visible (by distance)
    const selected = list.filter(b => b.selected);
    const hovered  = list.filter(b => b.hovered && !b.selected);
    const others   = list.filter(b => !b.selected && !b.hovered && b.visible)
                          .sort((a, b) => a.distance - b.distance);

    const promoted = new Set();
    function promote(b) {
      if (promoted.size >= highBudget) return;
      promoted.add(b.id);
    }

    selected.forEach(promote);
    hovered.forEach(promote);
    for (const b of others) { if (promoted.size >= highBudget) break; promote(b); }

    const out = list.map(b => {
      // Apply hysteresis on plain distance-driven decisions:
      let lod;
      if (b.selected || b.hovered) lod = 'high';
      else if (!promoted.has(b.id)) lod = 'low';
      else {
        const prev = lastLod.get(b.id);
        if (b.distance < upgradeAt) lod = 'high';
        else if (b.distance > downgradeAt) lod = 'low';
        else lod = prev ?? 'low';
      }
      lastLod.set(b.id, lod);
      return { id: b.id, lod };
    });
    return out;
  }

  return { decide, _internal: { lastLod } };
}
