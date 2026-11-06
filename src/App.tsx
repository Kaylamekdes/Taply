import { useLoopVisibility, useMagnetic, useReveal, useScrollFx } from './hooks/useReveal'
import { Navigation } from './components/Navigation'
import { Hero } from './components/Hero'
import { ProblemSection } from './components/ProblemSection'
import { HowItWorks } from './components/HowItWorks'
import { FeaturesSection } from './components/FeaturesSection'
import { DigitalProfileSection } from './components/DigitalProfileSection'
import { YourCardSection } from './components/YourCardSection'
import { PricingSection } from './components/PricingSection'
import { FAQSection } from './components/FAQSection'
import { RealWorldSection } from './components/RealWorldSection'
import { FinalCTA } from './components/FinalCTA'
import { Footer } from './components/Footer'
import { IntroSequence } from './components/IntroSequence'

export default function App() {
  useReveal()
  useLoopVisibility()
  useScrollFx()
  useMagnetic()

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navigation />
      <main id="main">
        <Hero />
        <ProblemSection />
        <HowItWorks />
        <FeaturesSection />
        <DigitalProfileSection />
        <YourCardSection />
        <PricingSection />
        <FAQSection />
        <RealWorldSection />
        <FinalCTA />
      </main>
      <Footer />
      <IntroSequence />
    </>
  )
}
