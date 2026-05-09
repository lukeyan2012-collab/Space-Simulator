const ALIAS_MAP = {
  ganymede: ['ganymede', 'ganimedes', 'ganymade'],
};

export function resolveCandidates(name, lod /* 'high' | 'low' */) {
  const lc = String(name).toLowerCase();
  const stems = ALIAS_MAP[lc] ?? [lc];
  const suffixes = lod === 'high' ? ['_4k', '_1k', ''] : ['_1k', ''];
  const out = [];
  for (const sfx of suffixes) for (const stem of stems) out.push(`${stem}${sfx}.glb`);
  return out;
}
