import Navigation from "../components/Navigation";
import Hero from "../components/Hero";
import Features from "../components/Features";
import TechStack from "../components/TechStack";
import CTA from "../components/CTA";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main>
        <Hero />
        <TechStack />
        <Features />
        <CTA />
      </main>
    </div>
  );
};

export default Index;