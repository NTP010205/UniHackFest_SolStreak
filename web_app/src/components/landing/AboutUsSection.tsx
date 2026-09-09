import Image from 'next/image';
export function AboutUsSection() {
  const statements = [
    ['01', 'Make progress visible', 'Saving is easy to postpone. SolStreak turns a small action into a streak users can understand at a glance.'],
    ['02', 'Keep proof separate from polish', 'Animations celebrate progress, while confirmed network data remains the source of truth.'],
    ['03', 'Reward discipline cosmetically', 'Badges are designed as memories of participation—not promises of profit or transferable assets.'],
  ] as const;

  return (
    <section id="about" aria-labelledby="about-title" className="landing-anchor mx-auto max-w-7xl px-4 py-24 sm:px-6">
      <div className="about-panel">
        <div className="about-emblem" aria-hidden="true">
          <div className="about-emblem-ring" />
          <Image src="/assets/images/SolStreak.png" alt="" width={237} height={300} className="relative z-10 h-44 w-36 object-contain sm:h-52 sm:w-44" />
        </div>
        <div>
          <p className="eyebrow text-violet-300">The SolStreak manifesto</p>
          <h2 id="about-title" className="section-title mt-3">Why we built this experience.</h2>
          <p className="section-description mt-5">
            SolStreak is an independent UniHackFest project exploring a clearer, more
            approachable saving habit on Solana Devnet.
          </p>
          <div className="about-statements">
            {statements.map(([number, title, body]) => (
              <article key={number}>
                <span>{number}</span>
                <div><h3>{title}</h3><p>{body}</p></div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
