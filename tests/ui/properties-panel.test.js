import { describe, it, expect, beforeEach } from 'vitest';
import { createPropertiesPanel } from '@/ui/properties-panel.js';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('properties panel', () => {
  it('shows nothing when no selection', () => {
    createPropertiesPanel();
    expect(document.querySelector('.props-empty')).toBeTruthy();
  });
  it('renders body data on update', () => {
    const p = createPropertiesPanel();
    p.update({
      body: { displayName: 'Earth', realMass_kg: 5.972e24, description: 'Home' },
      state: { mass: 5.972e24, position: [1,2,3], velocity: [0,30000,0] },
      lod: 'high',
    });
    expect(document.querySelector('.props-name').textContent).toContain('Earth');
    expect(document.querySelector('.props-lod').textContent).toContain('high');
  });
  it('clearing the panel restores empty state', () => {
    const p = createPropertiesPanel();
    p.update({ body:{displayName:'X'}, state:{mass:1,position:[0,0,0],velocity:[0,0,0]}, lod:'low' });
    p.update(null);
    expect(document.querySelector('.props-empty')).toBeTruthy();
  });
});
