const messages = [
  'Verified on-chain streaks',
  'Solana Devnet',
  'Cosmetic badge tiers',
  'Wallet-approved actions',
  'Lucky Wheel rewards',
  'Test assets · No financial value',
] as const;

export function LandingMarquee() {
  const repeatedMessages = [...messages, ...messages];

  return (
    <section className="landing-marquee" aria-label="SolStreak product highlights">
      <div className="landing-marquee-track">
        {repeatedMessages.map((message, index) => (
          <span key={`${message}-${index}`} aria-hidden={index >= messages.length}>
            <span className="landing-marquee-star" aria-hidden="true">✦</span>
            {message}
          </span>
        ))}
      </div>
    </section>
  );
}
