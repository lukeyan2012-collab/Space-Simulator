import { describe, it, expect, beforeEach } from 'vitest';
import { createSidebar } from '@/ui/sidebar.js';
import manifest from '@/data/bodies.json';

beforeEach(() => { document.body.innerHTML = '<div id="ui-root"></div>'; });

describe('sidebar', () => {
  it('renders one category button per category, horizontally', () => {
    createSidebar({ manifest });
    const buttons = document.querySelectorAll('.sb-cat');
    expect(buttons.length).toBe(6);
    const labels = [...buttons].map(b => b.textContent);
    expect(labels).toEqual(['Planets','Moons','Stars','Star Remnants & Nebulae','Asteroids','Satellites']);
  });

  it('does not show any items until a category is clicked', () => {
    createSidebar({ manifest });
    expect(document.querySelectorAll('.sb-item').length).toBe(0);
  });

  it('clicking a category reveals only its bodies; clicking it again collapses', () => {
    createSidebar({ manifest });
    const planetsBtn = [...document.querySelectorAll('.sb-cat')].find(b => b.textContent === 'Planets');
    planetsBtn.click();
    const items = document.querySelectorAll('.sb-item');
    expect(items.length).toBe(8); // 8 planets
    expect([...items].some(i => i.textContent.includes('Earth'))).toBe(true);
    expect([...items].some(i => i.textContent.includes('The Moon'))).toBe(false);
    planetsBtn.click();
    expect(document.querySelectorAll('.sb-item').length).toBe(0);
  });

  it('search filters across all categories regardless of active selection', () => {
    createSidebar({ manifest });
    const input = document.querySelector('.sb-search');
    input.value = 'titan'; input.dispatchEvent(new Event('input'));
    const items = document.querySelectorAll('.sb-item');
    expect(items.length).toBe(1);
    expect(items[0].textContent.toLowerCase()).toContain('titan');
  });

  it('clearing search restores the previously-active category items', () => {
    createSidebar({ manifest });
    [...document.querySelectorAll('.sb-cat')].find(b => b.textContent === 'Moons').click();
    const initialCount = document.querySelectorAll('.sb-item').length;
    const input = document.querySelector('.sb-search');
    input.value = 'earth'; input.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.sb-item').length).toBe(1);
    input.value = ''; input.dispatchEvent(new Event('input'));
    expect(document.querySelectorAll('.sb-item').length).toBe(initialCount);
  });

  it('emits onDragStart with body id (after the category is open)', () => {
    let payload = null;
    createSidebar({ manifest, onDragStart: (id) => (payload = id) });
    [...document.querySelectorAll('.sb-cat')].find(b => b.textContent === 'Planets').click();
    const item = document.querySelector('[data-body-id="earth"]');
    // jsdom may not expose DragEvent; a plain Event with type 'dragstart' still triggers the listener
    item.dispatchEvent(new Event('dragstart', { bubbles: true }));
    expect(payload).toBe('earth');
  });
});
