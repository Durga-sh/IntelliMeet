import Navigation from "../components/Navigation";
import Hero from "../components/Hero";
import Features from "../components/Features";
import LiveDemo from "../components/LiveDemo";
import Security from "../components/Security";
import Pricing from "../components/Pricing";
import CTA from "../components/CTA";
import Footer from "../components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <Hero />
        <Features />
        <LiveDemo />
        <Security />
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Index;