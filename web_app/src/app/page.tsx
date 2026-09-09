import { InteractiveBackground } from '@/components/background/InteractiveBackground';
import { AboutUsSection } from '@/components/landing/AboutUsSection';
import { BadgeTiers } from '@/components/landing/BadgeTiers';
import { LandingMarquee } from '@/components/landing/LandingMarquee';
import { ProductFeatures } from '@/components/landing/ProductFeatures';
import { WikiSection } from '@/components/landing/WikiSection';
import { Hero } from '@/components/hero/Hero';
import { DocsView } from '@/components/views/DocsView';

export default function LandingPage() {
  return (
    <div className="relative overflow-clip">
      <InteractiveBackground />
      <div className="relative z-10">
        <Hero />
        <LandingMarquee />
        <ProductFeatures />
        <BadgeTiers />
        <DocsView />
        <WikiSection />
        <AboutUsSection />
      </div>
    </div>
  );
}
