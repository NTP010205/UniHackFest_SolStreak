import { GlassCard } from '@/components/ui/GlassCard';

const sections = [
  ['01', 'Privy wallet', 'Connect with email or SMS. SolStreak uses the Privy embedded Solana wallet and asks for approval before each transaction.'],
  ['02', 'Visible lifecycle', 'Preparation, wallet approval, submission, confirmation, and reporting are displayed as separate states.'],
  ['03', 'Verified streaks', 'The backend verifies a confirmed Devnet deposit before updating streak state. Browser animation is never proof of success.'],
  ['04', 'Cosmetic wheel', 'Eligibility and outcomes come from the backend. Badges cannot be transferred, traded, or redeemed.'],
];
export function DocsView() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="landing-anchor mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-3xl text-center">
        <p className="eyebrow">How it works</p>
        <h2 id="how-it-works-title" className="section-title mt-3">Real Web3 flows, clear human feedback.</h2>
        <p className="section-description mx-auto mt-5">The interface explains what is happening without pretending that a visual state is an on-chain result.</p>
      </div>
      <ol className="process-grid">
        {sections.map(([number, title, body]) => (
          <li key={number} className="process-step">
            <span className="process-number">{number}</span>
            <GlassCard className="h-full p-6" tilt={false}>
              <h3 className="font-display text-lg font-semibold text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </GlassCard>
          </li>
        ))}
      </ol>
    </section>
  );
}
