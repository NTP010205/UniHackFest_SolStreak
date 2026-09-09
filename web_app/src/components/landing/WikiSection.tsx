const steps = [
  ['1', 'Connect', 'Sign in with Privy and use the embedded Solana wallet created for your account.'],
  ['2', 'Fund test assets', 'Use the official faucets to fund Devnet SOL for fees and Circle Devnet USDC for testing.'],
  ['3', 'Deposit', 'Open the dashboard, choose an amount, review the Devnet warning, and approve only when the safety flag is enabled.'],
  ['4', 'Track and collect', 'Follow the confirmed streak, earn spin entitlements, and collect cosmetic badges.'],
] as const;

export function WikiSection() {
  return (
    <section id="wiki" aria-labelledby="wiki-title" className="landing-anchor wiki-section">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[.8fr_1.2fr]">
          <div className="wiki-intro">
            <p className="eyebrow text-cyan-300">Protocol resources</p>
            <h2 id="wiki-title" className="section-title mt-3">Start safely on Solana Devnet.</h2>
            <p className="section-description mt-5">
              Everything on this environment exists for product testing. Read the flow,
              fund only test assets, and approve only the transaction you expect.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer" className="resource-link">Solana faucet <span>↗</span></a>
              <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer" className="resource-link">Circle faucet <span>↗</span></a>
              <a href="https://github.com/NTP010205/UniHackFest_SolStreak" target="_blank" rel="noreferrer" className="resource-link">GitHub <span>↗</span></a>
            </div>
            <p className="wiki-warning">Devnet assets, streaks, spins, and badges have no financial value.</p>
          </div>

          <ol className="wiki-steps">
            {steps.map(([number, title, body]) => (
              <li key={number}>
                <span className="wiki-step-number">{number}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
