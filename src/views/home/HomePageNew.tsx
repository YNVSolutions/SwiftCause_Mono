'use client';

import { Navbar, HeroSection, FeaturesSection, DemoSection } from './components';

interface HomePageProps {
  onSignup: () => void;
  onNavigate: (screen: string) => void;
}

export function HomePage({ onSignup, onNavigate }: HomePageProps) {
  return (
    <div className="min-h-screen selection:bg-[#0f5132] selection:text-white">
      <Navbar onSignup={onSignup} onNavigate={onNavigate} />

      <main>
        <HeroSection onSignup={onSignup} />
        <FeaturesSection />
        <DemoSection />

        {/* TODO: Add FAQ, Contact, and Footer sections */}
      </main>
    </div>
  );
}
