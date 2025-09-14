import { useState } from "react";
import { Code, Database, Cloud, Cpu, Zap, Globe } from "lucide-react";

const techStack = [
  {
    category: "Frontend",
    icon: Code,
    technologies: [
      { name: "React 18", description: "Component-based UI with hooks" },
      { name: "TypeScript", description: "Type-safe development" },
      { name: "Vite", description: "Lightning-fast build tool" },
      { name: "Tailwind CSS", description: "Utility-first styling" }
    ],
    color: "ai-primary"
  },
  {
    category: "Real-time",
    icon: Zap,
    technologies: [
      { name: "WebRTC", description: "Peer-to-peer video/audio" },
      { name: "Socket.io", description: "WebSocket connections" },
      { name: "WebSockets", description: "Bidirectional communication" },
      { name: "Stream API", description: "Media streaming" }
    ],
    color: "ai-secondary"
  },
  {
    category: "AI/ML",
    icon: Cpu,
    technologies: [
      { name: "OpenAI Whisper", description: "Speech-to-text transcription" },
      { name: "GPT-4", description: "Intelligent chat assistant" },
      { name: "NLP APIs", description: "Natural language processing" },
      { name: "TensorFlow.js", description: "Client-side ML" }
    ],
    color: "ai-accent"
  },
  {
    category: "Backend", 
    icon: Database,
    technologies: [
      { name: "Node.js", description: "JavaScript runtime" },
      { name: "Express", description: "Web application framework" },
      { name: "PostgreSQL", description: "Relational database" },
      { name: "Redis", description: "In-memory caching" }
    ],
    color: "ai-glow"
  },
  {
    category: "Infrastructure",
    icon: Cloud,
    technologies: [
      { name: "AWS", description: "Cloud infrastructure" },
      { name: "Docker", description: "Containerization" },
      { name: "Kubernetes", description: "Container orchestration" },
      { name: "CDN", description: "Global content delivery" }
    ],
    color: "ai-primary"
  },
  {
    category: "Security",
    icon: Globe,
    technologies: [
      { name: "JWT", description: "Token-based authentication" },
      { name: "OAuth 2.0", description: "Secure authorization" },
      { name: "E2E Encryption", description: "End-to-end security" },
      { name: "RBAC", description: "Role-based access control" }
    ],
    color: "ai-secondary"
  }
];

const TechStack = () => {
  const [activeCategory, setActiveCategory] = useState(0);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-muted/20 to-background" />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-secondary/50 rounded-full px-6 py-3 border border-ai-primary/20 mb-8">
            <Code className="w-5 h-5 text-ai-primary" />
            <span className="font-semibold">Built with Modern Tech</span>
          </div>
          
          <h2 className="text-5xl lg:text-6xl font-black mb-6">
            The Technology{" "}
            <span className="text-gradient">Powering Innovation</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto">
            Every line of code, every API call, every real-time connection is engineered 
            for performance, scalability, and the seamless user experience you deserve.
          </p>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-16">
          {techStack.map((category, index) => (
            <button
              key={category.category}
              onClick={() => setActiveCategory(index)}
              className={`flex items-center space-x-3 px-6 py-4 rounded-2xl border transition-all duration-300 ${
                activeCategory === index
                  ? `border-${category.color}/50 bg-gradient-to-r from-${category.color}/20 to-${category.color}/10 text-${category.color} shadow-feature`
                  : 'border-muted/30 bg-card/50 text-muted-foreground hover:border-ai-primary/30'
              }`}
            >
              <category.icon className="w-5 h-5" />
              <span className="font-semibold">{category.category}</span>
            </button>
          ))}
        </div>

        {/* Active category details */}
        <div className="relative">
          {techStack.map((category, categoryIndex) => (
            <div
              key={category.category}
              className={`transition-all duration-500 ${
                activeCategory === categoryIndex 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8 absolute inset-0 pointer-events-none'
              }`}
            >
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {category.technologies.map((tech, techIndex) => (
                  <div
                    key={tech.name}
                    className="group relative bg-card/80 backdrop-blur-sm border border-ai-primary/20 rounded-2xl p-6 hover:shadow-glow transition-all duration-300 animate-scale-in"
                    style={{ animationDelay: `${techIndex * 0.1}s` }}
                  >
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br from-${category.color} to-${category.color}/80 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                      <category.icon className="w-6 h-6 text-white" />
                    </div>
                    
                    <h3 className="text-lg font-bold mb-2 group-hover:text-ai-primary transition-colors">
                      {tech.name}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground">
                      {tech.description}
                    </p>
                    
                    <div className={`absolute inset-0 bg-gradient-to-br from-${category.color}/5 to-${category.color}/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Performance metrics */}
        <div className="mt-24 text-center">
          <h3 className="text-3xl font-bold mb-12">Performance Benchmarks</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-ai-primary/20 to-ai-secondary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative bg-card/90 backdrop-blur-sm border border-ai-primary/20 rounded-2xl p-8">
                <div className="text-4xl font-black text-ai-primary mb-2">0.1s</div>
                <div className="text-muted-foreground">Initial Load Time</div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-ai-secondary/20 to-ai-accent/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative bg-card/90 backdrop-blur-sm border border-ai-secondary/20 rounded-2xl p-8">
                <div className="text-4xl font-black text-ai-secondary mb-2">50ms</div>
                <div className="text-muted-foreground">WebRTC Latency</div>
              </div>
            </div>
            
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-br from-ai-accent/20 to-ai-glow/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all" />
              <div className="relative bg-card/90 backdrop-blur-sm border border-ai-accent/20 rounded-2xl p-8">
                <div className="text-4xl font-black text-ai-accent mb-2">99.9%</div>
                <div className="text-muted-foreground">Uptime SLA</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TechStack;