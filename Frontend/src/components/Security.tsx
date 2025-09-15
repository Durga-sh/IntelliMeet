import { Shield, Lock, Eye, Server, Globe, Zap } from "lucide-react";

const Security = () => {
  const securityFeatures = [
    {
      icon: Shield,
      title: "End-to-End Encryption",
      description: "All communications are encrypted using AES-256 encryption standards, ensuring your meetings remain private and secure.",
      badge: "AES-256"
    },
    {
      icon: Lock,
      title: "Zero-Knowledge Architecture", 
      description: "We can't access your meeting content. Your data is encrypted before it reaches our servers using your unique keys.",
      badge: "Zero Access"
    },
    {
      icon: Server,
      title: "SOC 2 Type II Compliant",
      description: "Independently audited security controls meeting the highest industry standards for data protection.",
      badge: "Certified"
    },
    {
      icon: Eye,
      title: "Privacy by Design",
      description: "Built from the ground up with privacy in mind. No tracking, no data mining, no unauthorized access.",
      badge: "GDPR Ready"
    },
    {
      icon: Globe,
      title: "Global Data Residency",
      description: "Choose where your data is stored and processed with our distributed infrastructure across multiple regions.",
      badge: "Multi-Region"
    },
    {
      icon: Zap,
      title: "Real-time Threat Detection",
      description: "Advanced AI-powered monitoring detects and prevents security threats in real-time.",
      badge: "24/7 Active"
    }
  ];

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 w-full h-full opacity-5">
          {/* Security pattern background */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute w-1 h-1 bg-ai-primary rounded-full opacity-20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="absolute top-20 right-20 w-96 h-96 bg-ai-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-green-500/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-ai-primary/20 rounded-full px-6 py-3 border border-green-500/30 backdrop-blur-sm mb-8">
            <Shield className="w-5 h-5 text-green-500 animate-pulse" />
            <span className="font-semibold">Security & Privacy</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            <span className="text-gradient">Secure</span> by Design
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your privacy is our priority. Built with security-first principles and modern encryption standards.
          </p>
        </div>

        {/* Security Features Grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {securityFeatures.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative p-8 rounded-3xl bg-card/80 backdrop-blur-xl border border-ai-primary/20 hover:border-green-500/40 hover:shadow-glow transition-all duration-500 animate-slide-in"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Security badge */}
              <div className="absolute top-6 right-6 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-xs font-medium text-green-500">
                {feature.badge}
              </div>

              {/* Icon */}
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-ai-primary/20 flex items-center justify-center mb-6 group-hover:shadow-feature transition-all duration-500">
                <feature.icon className="w-8 h-8 text-green-500 group-hover:scale-110 transition-transform duration-300" />
              </div>

              <h3 className="text-xl font-bold mb-4 group-hover:text-green-500 transition-colors">
                {feature.title}
              </h3>
              
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-ai-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl" />
            </div>
          ))}
        </div>

        {/* Trust & Transparency */}
        <div className="mt-16 text-center">
          <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-gradient-to-r from-green-500/10 to-ai-primary/10 border border-green-500/20">
            <Shield className="w-16 h-16 mx-auto mb-6 text-green-500" />
            <h3 className="text-2xl font-bold mb-4">Your Data, Your Control</h3>
            <p className="text-muted-foreground leading-relaxed">
              We believe in complete transparency. View our security documentation, 
              audit reports, and compliance certifications. Your trust is earned through 
              action, not promises.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Security;