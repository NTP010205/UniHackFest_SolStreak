import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const adminLab = readFileSync(new URL('./AdminLab.tsx', import.meta.url), 'utf8');
const wheel = readFileSync(new URL('./LuckyWheel.tsx', import.meta.url), 'utf8');
const collection = readFileSync(new URL('./BadgeCollection.tsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../app/dashboard/page.tsx', import.meta.url), 'utf8');

describe('Admin cosmetic spin frontend contract', () => {
  it('keeps the wheel as the sole admin spin entry point', () => {
    expect(adminLab).not.toContain("'/api/admin/spin'");
    expect(adminLab).toContain('Admin test mode enabled');
    expect(adminLab).toContain('href="#lucky-wheel"');
    expect(wheel).toContain('spinRequestFor(isDevnetAdmin');
    expect(wheel).toContain('crypto.randomUUID()');
    expect(wheel).toContain("transition('manual_request')");
    expect(wheel).toContain('onClick={() => void handleSpin()}');
    expect(wheel).toContain('∞ Admin test spins');
  });

  it('does not request a spin from an effect or refresh callback', () => {
    expect(wheel.match(/fetch\(/g)).toHaveLength(1);
    expect(wheel.indexOf('fetch(')).toBeGreaterThan(wheel.indexOf('async function handleSpin'));
    expect(wheel).toContain("transition('animation_completed')");
    expect(wheel).toContain('onSpinComplete?.()');
  });

  it('uses shared artwork for inventory, history, and reward presentation', () => {
    expect(collection).toContain('BADGE_ARTWORK_CODES.map');
    expect(collection.match(/<BadgeArtworkImage/g)).toHaveLength(2);
    expect(wheel).toContain('<BadgeArtworkImage code={persistedResult.badgeCode}');
    expect(wheel).toContain('persistedResult.awardCount');
    expect(collection).toContain("data-owned={owned ? 'true' : 'false'}");
    expect(collection).toContain('Awarded {owned.awardCount}×');
    expect(collection).not.toMatch(/awardCount\s*\+/);
  });

  it('renders exactly one full inventory after Admin Lab and no legacy collection', () => {
    expect(dashboard.match(/<BadgeCollection\b/g)).toHaveLength(1);
    expect(dashboard).not.toMatch(/<Leaderboard\b|from ['"]@\/components\/Leaderboard['"]/);
    expect(dashboard.indexOf('<BadgeCollection')).toBeGreaterThan(dashboard.indexOf('<AdminLab'));
    expect(collection).not.toContain('spin available');
    expect(collection).not.toMatch(/glyph\[|text-2xl[^>]*>\{.*◆/);
    expect(collection).toContain('BADGE_ARTWORK_CODES.map');
  });
});
