import { describe, it, expect } from 'vitest';
import { controlPanelNav, controlPanelRouteById, routeIsActive } from './ControlPanel.svelte';

describe('ControlPanel route map', () => {
  it('defines the canonical route order for the site', () => {
    expect(controlPanelNav.map((route) => route.id)).toEqual([
      'welcome',
      'draw',
      'oracle',
      'records',
      'about',
      'devs',
    ]);
  });

  it('uses the current canonical hrefs and epithets', () => {
    expect(controlPanelRouteById.draw.href).toBe('/draw');
    expect(controlPanelRouteById.oracle.href).toBe('/oracle');
    expect(controlPanelRouteById.records.href).toBe('/records');
    expect(controlPanelRouteById.about.href).toBe('/about');
    expect(controlPanelRouteById.devs.epithet).toBe('δεῦς');
  });

  it('marks only auth routes as gated', () => {
    expect(controlPanelRouteById.draw.authedOnly).toBeUndefined();
    expect(controlPanelRouteById.about.authedOnly).toBeUndefined();
    expect(controlPanelRouteById.oracle.authedOnly).toBe(true);
    expect(controlPanelRouteById.records.authedOnly).toBe(true);
  });

  it('computes active routes for root and nested paths', () => {
    expect(routeIsActive('/', '/')).toBe(true);
    expect(routeIsActive('/draw', '/')).toBe(false);
    expect(routeIsActive('/oracle', '/oracle')).toBe(true);
    expect(routeIsActive('/oracle/session/123', '/oracle')).toBe(true);
    expect(routeIsActive('/records', '/oracle')).toBe(false);
  });
});
