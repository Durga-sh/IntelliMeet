import { CheckCircle, X, Star, Zap, Users, Building2, Crown, ArrowRight } from "lucide-react";
import { Button } from "./ui/button";

const Pricing = () => {

  const plans = [
    {
      name: "Starter",
      description: "Perfect for small teams getting started",
      price: "Free",
      period: "forever",
      badge: "",
      icon: Users,
      color: "ai-primary",
      features: [
        { name: "Up to 5 participants", included: true },
        { name: "30 minutes per meeting", included: true },
        { name: "Basic transcription", included: true },
        { name: "Standard video quality", included: true },
        { name: "Email support", included: true },
        { name: "AI summaries", included: false },
        { name: "Advanced analytics", included: false },
        { name: "Custom branding", included: false },
        { name: "Priority support", included: false }
      ],
      cta: "Get Started Free",
      popular: false
    },
    {
      name: "Professional",
      description: "For growing teams that need more power",
      price: "$15",
      period: "per user/month",
      badge: "Most Popular",
      icon: Zap,
      color: "ai-secondary",
      features: [
        { name: "Up to 50 participants", included: true },
        { name: "Unlimited meeting duration", included: true },
        { name: "AI-powered transcription", included: true },
        { name: "HD video quality", included: true },
        { name: "Priority email support", included: true },
        { name: "AI summaries & insights", included: true },
        { name: "Meeting analytics", included: true },
        { name: "Custom branding", included: false },
        { name: "Dedicated support", included: false }
      ],
      cta: "Start 14-Day Trial",
      popular: true
    },
    {
      name: "Enterprise",
      description: "For large organizations with advanced needs",
      price: "Custom",
      period: "pricing",
      badge: "Advanced",
      icon: Building2,
      color: "ai-accent",
      features: [
        { name: "Unlimited participants", included: true },
        { name: "Unlimited meeting duration", included: true },
        { name: "Advanced AI features", included: true },
        { name: "4K video quality", included: true },
        { name: "24/7 phone support", included: true },
        { name: "Custom AI training", included: true },
        { name: "Advanced analytics & reporting", included: true },
        { name: "Full white-label solution", included: true },
        { name: "Dedicated success manager", included: true }
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  const addOns = [
    {
      name: "Advanced Analytics",
      description: "Deep insights into meeting patterns and team productivity",
      price: "$5",
      period: "per user/month"
    },
    {
      name: "Custom AI Training",
      description: "Train our AI on your company's specific terminology and processes",
      price: "$500",
      period: "one-time setup"
    },
    {
      name: "Priority Support",
      description: "24/7 phone and chat support with < 1 hour response time",
      price: "$10",
      period: "per user/month"
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-ai-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-ai-secondary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-ai-primary/20 to-ai-secondary/20 rounded-full px-6 py-3 border border-ai-primary/30 backdrop-blur-sm mb-8">
            <Crown className="w-5 h-5 text-ai-primary" />
            <span className="font-semibold">Simple Pricing</span>
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            Plans that <span className="text-gradient">Scale with You</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From startups to enterprises, we have the perfect plan for your team. 
            All plans include our core AI features.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative p-8 rounded-3xl border transition-all duration-500 animate-slide-in ${
                plan.popular
                  ? 'border-ai-secondary/50 bg-gradient-to-br from-card via-card/95 to-card/90 shadow-glow scale-105'
                  : 'border-ai-primary/20 bg-card/80 hover:border-ai-primary/40 hover:shadow-glow'
              } backdrop-blur-xl`}
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-ai-secondary to-ai-accent text-white px-6 py-2 rounded-full text-sm font-medium flex items-center space-x-2">
                    <Star className="w-4 h-4 fill-white" />
                    <span>{plan.badge}</span>
                  </div>
                </div>
              )}

              {/* Plan icon */}
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
                plan.popular 
                  ? `bg-gradient-to-br from-${plan.color} to-${plan.color}/80 shadow-feature`
                  : `bg-${plan.color}/10 border border-${plan.color}/20`
              }`}>
                <plan.icon className={`w-8 h-8 ${
                  plan.popular ? 'text-white' : `text-${plan.color}`
                }`} />
              </div>

              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm mb-6">{plan.description}</p>
                
                <div className="flex items-baseline space-x-2 mb-6">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-muted-foreground">/{plan.period}</span>
                </div>
              </div>

              {/* Features list */}
              <div className="space-y-4 mb-8">
                {plan.features.map((feature) => (
                  <div key={feature.name} className="flex items-center space-x-3">
                    {feature.included ? (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    ) : (
                      <X className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className={`text-sm ${
                      feature.included ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {feature.name}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA Button */}
              <Button
                variant={plan.popular ? "hero" : "outline"}
                size="lg"
                className={`w-full group ${
                  plan.popular 
                    ? '' 
                    : 'border-ai-primary/30 hover:border-ai-primary/50 hover:bg-ai-primary/10'
                }`}
              >
                <span>{plan.cta}</span>
                <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
          ))}
        </div>

        {/* Add-ons Section */}
        <div className="mb-16">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Powerful Add-ons</h3>
            <p className="text-muted-foreground">Enhance your plan with specialized features</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {addOns.map((addon) => (
              <div
                key={addon.name}
                className="p-6 rounded-2xl bg-card/50 backdrop-blur-sm border border-ai-primary/20 hover:border-ai-primary/40 transition-all duration-300"
              >
                <h4 className="font-semibold mb-2">{addon.name}</h4>
                <p className="text-sm text-muted-foreground mb-4">{addon.description}</p>
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-ai-primary">{addon.price}</span>
                  <span className="text-sm text-muted-foreground">/{addon.period}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Money-back guarantee */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center space-x-4 p-6 rounded-2xl bg-gradient-to-r from-green-500/10 to-ai-primary/10 border border-green-500/20">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-500" />
            </div>
            <div className="text-left">
              <div className="font-semibold">30-Day Money-Back Guarantee</div>
              <div className="text-sm text-muted-foreground">
                Not satisfied? Get a full refund, no questions asked.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;