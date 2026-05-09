import { describe, it, expect, beforeEach } from 'vitest';
import { createSidebar } from '@/ui/sidebar.js';
import manifest from '@/data/bodies.json';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('sidebar', () => {
  it('renders one section per category', () => {
    createSidebar({ manifest });
    const heads = document.querySelectorAll('.sb-category');
    expect(heads.length).toBe(6);
  });
  it('search filters across all categories', () => {
    createSidebar({ manifest });
    const input = document.querySelector('.sb-search');
    input.value = 'titan'; input.dispatchEvent(new Event('input'));
    const visible = [...document.querySelectorAll('.sb-item')].filter(el => !el.classList.contains('sb-hidden'));
    expect(visible.length).toBe(1);
    expect(visible[0].textContent.toLowerCase()).toContain('titan');
  });
  it('emits onDragStart with body id', () => {
    let payload = null;
    createSidebar({ manifest, onDragStart: (id) => (payload = id) });
    const item = document.querySelector('[data-body-id="earth"]');
    item.dispatchEvent(new Event('dragstart', { bubbles: true }));
    expect(payload).toBe('earth');
  });
});
