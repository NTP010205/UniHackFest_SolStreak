import { GlassCard } from '@/components/ui/GlassCard';

const sections = [
  ['Privy wallet', 'Connect with email or SMS. SolStreak uses only the Privy embedded Solana wallet and asks for your signature before each transaction.'],
  ['Safe transaction lifecycle', 'Preparing, signature approval, submission, confirmation and reporting are displayed separately. A submitted transaction is never blindly resent.'],
  ['Verified streaks', 'The backend verifies confirmed Devnet USDC deposits before updating streak state. Browser animation and local state are never proof of success.'],
  ['Cosmetic wheel', 'Eligibility and outcomes come from the backend. Badges have no financial value and cannot be transferred or redeemed.'],
];
export function DocsView() { return <section id="how-it-works" className="mx-auto max-w-7xl px-4 py-20 sm:px-6"><div className="mx-auto max-w-2xl text-center"><p className="eyebrow">How it works</p><h2 className="mt-2 font-display text-3xl font-bold text-white sm:text-4xl">Real Web3 flows, clear human feedback.</h2></div><div className="mt-10 grid gap-4 md:grid-cols-2">{sections.map(([title, body]) => <GlassCard key={title} className="p-6" tilt={false}><h3 className="font-display text-lg font-semibold text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{body}</p></GlassCard>)}</div></section>; }
