import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const page = source('../../app/page.tsx');
const layout = source('../../app/layout.tsx');
const navbar = source('../nav/Navbar.tsx');
const hero = source('../hero/Hero.tsx');
const heroScene = source('../hero/HeroRewardScene.tsx');
const background = source('../background/InteractiveBackground.tsx');
const marquee = source('./LandingMarquee.tsx');
const badges = source('./BadgeTiers.tsx');
const wiki = source('./WikiSection.tsx');
const about = source('./AboutUsSection.tsx');
const transactionCard = source('../TransactionCard.tsx');
const networkProfile = source('../../lib/networkProfile.ts');

describe('landing navigation and Devnet safety contract', () => {
  it('renders one shared navbar and complete desktop/mobile destinations', () => {
    expect(layout.match(/<Navbar\s*\/>/g)).toHaveLength(1);
    expect(navbar.match(/href="\/"/g)).toHaveLength(3); // logo plus desktop/mobile Home
    expect(navbar.match(/href="\/dashboard"/g)).toHaveLength(2);
    expect(navbar.match(/href="\/#badges"/g)).toHaveLength(2);
    expect(navbar.match(/href="\/#wiki"/g)).toHaveLength(2);
    expect(navbar.match(/href="\/#about"/g)).toHaveLength(2);
    expect(navbar).toContain('onClick={closeMenu}');
  });

  it('keeps authenticated visitors on Home until the dashboard CTA is used', () => {
    expect(page).not.toMatch(/router\.(push|replace)|redirect\(/);
    expect(page).not.toContain('useSolStreakWallet');
    expect(hero).toContain("if (authenticated) router.push('/dashboard')");
  });

  it('provides exactly one Wiki and About section with stable hash targets', () => {
    expect(page.match(/<LandingMarquee\s*\/>/g)).toHaveLength(1);
    expect(page.match(/<BadgeTiers\s*\/>/g)).toHaveLength(1);
    expect(page.match(/<WikiSection\s*\/>/g)).toHaveLength(1);
    expect(page.match(/<AboutUsSection\s*\/>/g)).toHaveLength(1);
    expect(wiki.match(/id="wiki"/g)).toHaveLength(1);
    expect(about.match(/id="about"/g)).toHaveLength(1);
    expect(wiki.match(/className="wiki-step-number"/g)).toHaveLength(1);
    expect(wiki).toContain('steps.map');
  });

  it('reuses existing artwork and keeps transactions controlled by network flags', () => {
    for (const asset of ['Deposit.png', 'NormalStreak.png', 'Coin.png', 'Chest.png', 'SolStreak.png']) {
      expect(source(asset === 'SolStreak.png' ? './AboutUsSection.tsx' : './ProductFeatures.tsx')).toContain(asset);
    }
    expect(networkProfile).toContain('transactionsEnabled: devnetEnabled && !mainnetEnabled');
    expect(networkProfile).not.toContain('transactionsEnabled: true');
    expect(transactionCard).toContain('Deposit/Withdraw are disabled by the safety flag.');
    expect(transactionCard).toContain('These assets have no financial value.');
  });

  it('uses existing reward artwork for a restrained pointer-responsive hero', () => {
    for (const asset of ['Chest.png', 'Coin.png', 'Diamond.png']) expect(heroScene).toContain(asset);
    expect(heroScene).toContain("(hover: hover) and (pointer: fine)");
    expect(heroScene).toContain("prefers-reduced-motion: reduce");
    expect(heroScene).toContain('requestAnimationFrame');
    expect(background).toContain('distance < 125');
    expect(background).toContain('Math.min(58');
    expect(background).toContain('dot-matrix');
  });

  it('presents accurate cosmetic messaging without inventing streak requirements', () => {
    for (const code of ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND', 'JACKPOT']) {
      expect(badges).toContain(`${code}:`);
    }
    expect(badges).toContain('Wheel eligibility and outcomes are issued by the backend');
    expect(badges).not.toMatch(/DAY 0|DAY 1|day range/i);
    expect(marquee).toContain('Test assets · No financial value');
    expect(hero).not.toContain('0% financial risk');
  });
});
