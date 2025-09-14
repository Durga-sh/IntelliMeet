import { Bot, Video, MessageSquare, Brain, Sparkles, Zap, Eye, Shield, FileText } from "lucide-react";
import { useState } from "react";

const features = [
  {
    icon: Video,
    title: "WebRTC Video Calls",
    description: "Peer-to-peer video with screen sharing and multi-user support. Built for seamless real-time communication.",
    tech: "WebRTC",
    color: "ai-primary",
    demo: "4-way video grid active"
  },
  {
    icon: MessageSquare,
    title: "Socket.io Live Chat", 
    description: "Real-time group messaging with delivery receipts and typing indicators powered by WebSocket technology.",
    tech: "Socket.io",
    color: "ai-secondary", 
    demo: "Messages flowing in real-time"
  },
  {
    icon: Brain,
    title: "Whisper Transcription",
    description: "OpenAI Whisper integration for live speech-to-text with speaker identification and 99% accuracy.",
    tech: "Whisper API",
    color: "ai-accent",
    demo: "Converting speech to text live"
  },
  {
    icon: Bot,
    title: "AI Meeting Assistant",
    description: "ChatGPT-powered bot that answers questions, summarizes discussions, and provides contextual assistance.",
    tech: "GPT Integration",
    color: "ai-glow",
    demo: "AI generating meeting insights"
  },
  {
    icon: FileText,
    title: "Smart Summaries",
    description: "Automatically generate meeting notes, extract action items, and highlight key decisions using AI.",
    tech: "NLP Processing", 
    color: "ai-primary",
    demo: "Summarizing 45min meeting"
  },
  {
    icon: Zap,
    title: "Real-time Sync",
    description: "Instant synchronization across all devices with WebSocket connections and state management.",
    tech: "WebSocket",
    color: "ai-secondary",
    demo: "Syncing across 12 devices"
  }
];

const Features = () => {
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  return (
    <section id="features" className="py-24 relative overflow-hidden">
      {/* Animated tech pattern background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 opacity-5">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-px h-px bg-ai-primary rounded-full animate-ping"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-20 animate-fade-in">
          <div className="inline-flex items-center space-x-3 bg-gradient-to-r from-ai-primary/20 to-ai-secondary/20 rounded-full px-6 py-3 border border-ai-primary/30 backdrop-blur-sm mb-8">
            <Sparkles className="w-5 h-5 text-ai-primary animate-pulse" />
            <span className="font-semibold">Cutting-Edge Technology Stack</span>
            <div className="w-2 h-2 bg-ai-secondary rounded-full animate-pulse" />
          </div>
          
          <h2 className="text-5xl lg:text-7xl font-black mb-8">
            The Tech Behind the{" "}
            <span className="text-gradient">Magic</span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-4xl mx-auto leading-relaxed">
            Built with modern web technologies and AI APIs. Each feature represents hours of engineering 
            to deliver seamless real-time collaboration experiences.
          </p>
        </div>

        {/* Interactive feature grid */}
        <div className="grid lg:grid-cols-3 gap-8 mb-20">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="group relative"
              onMouseEnter={() => setHoveredFeature(index)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              {/* Feature card */}
              <div className={`relative overflow-hidden rounded-3xl border transition-all duration-500 ${
                hoveredFeature === index 
                  ? 'border-ai-primary/50 shadow-glow scale-105 bg-gradient-to-br from-card via-card/95 to-card/90' 
                  : 'border-ai-primary/20 bg-card/80'
              } backdrop-blur-xl p-8 animate-scale-in`}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                {/* Tech badge */}
                <div className={`inline-flex items-center space-x-2 rounded-full px-4 py-2 mb-6 text-xs font-medium border ${
                  hoveredFeature === index
                    ? `bg-${feature.color}/20 border-${feature.color}/40 text-${feature.color}`
                    : 'bg-muted/30 border-muted/40 text-muted-foreground'
                } transition-all duration-300`}>
                  <Zap className="w-3 h-3" />
                  <span>{feature.tech}</span>
                </div>

                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 ${
                  hoveredFeature === index 
                    ? `bg-gradient-to-br from-${feature.color} to-${feature.color}/80 shadow-feature` 
                    : 'bg-muted/20'
                }`}>
                  <feature.icon className={`w-8 h-8 transition-colors duration-300 ${
                    hoveredFeature === index ? 'text-white' : `text-${feature.color}`
                  }`} />
                </div>

                <h3 className="text-2xl font-bold mb-4 group-hover:text-ai-primary transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-muted-foreground leading-relaxed mb-6">
                  {feature.description}
                </p>

                {/* Demo status */}
                <div className={`inline-flex items-center space-x-2 text-sm ${
                  hoveredFeature === index ? 'text-ai-primary' : 'text-muted-foreground'
                } transition-colors duration-300`}>
                  <Eye className="w-4 h-4" />
                  <span className="font-medium">{feature.demo}</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>

                {/* Hover overlay */}
                <div className={`absolute inset-0 bg-gradient-to-br from-ai-primary/5 to-ai-secondary/5 transition-opacity duration-300 ${
                  hoveredFeature === index ? 'opacity-100' : 'opacity-0'
                }`} />
              </div>
            </div>
          ))}
        </div>

        {/* Live metrics dashboard */}
        <div className="relative">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold mb-4">Live Platform Metrics</h3>
            <p className="text-muted-foreground">Real-time data from our production environment</p>
          </div>
          
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 animate-fade-in">
            <div className="text-center group">
              <div className="relative mb-4">
                <div className="text-4xl font-black text-ai-primary mb-2 group-hover:scale-110 transition-transform">
                  1.2M+
                </div>
                <div className="absolute -top-2 -right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="text-sm text-muted-foreground font-medium">Active Connections</div>
            </div>
            
            <div className="text-center group">
              <div className="text-4xl font-black text-ai-secondary mb-2 group-hover:scale-110 transition-transform">
                99.97%
              </div>
              <div className="text-sm text-muted-foreground font-medium">Transcription Accuracy</div>
            </div>
            
            <div className="text-center group">
              <div className="text-4xl font-black text-ai-accent mb-2 group-hover:scale-110 transition-transform">
                &lt;50ms
              </div>
              <div className="text-sm text-muted-foreground font-medium">WebRTC Latency</div>
            </div>
            
            <div className="text-center group">
              <div className="text-4xl font-black text-ai-glow mb-2 group-hover:scale-110 transition-transform">
                24/7
              </div>
              <div className="text-sm text-muted-foreground font-medium">AI Processing</div>
            </div>
            
            <div className="text-center group">
              <div className="relative mb-4">
                <div className="text-4xl font-black text-ai-primary mb-2 group-hover:scale-110 transition-transform">
                  150+
                </div>
                <Shield className="absolute -top-1 -right-1 w-4 h-4 text-green-500" />
              </div>
              <div className="text-sm text-muted-foreground font-medium">Enterprise Clients</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;