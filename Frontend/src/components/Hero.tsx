import { Button } from "./ui/button";
import { ArrowRight, Play, Brain, Users, MessageSquare, Video, Mic, Share2, Bot } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Hero = () => {
  const navigate = useNavigate();
  const [activeFeature, setActiveFeature] = useState(0);
  const [typedText, setTypedText] = useState("");
  
  const features = ["Video Calls", "AI Transcription", "Smart Summaries", "Live Collaboration"];
  const aiMessages = [
    "🤖 AI: Meeting summary generated",
    "🎯 AI: Action items identified", 
    "📝 AI: Transcribing in real-time",
    "💡 AI: Suggesting next steps"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % features.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const text = features[activeFeature];
    let index = 0;
    setTypedText("");
    
    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setTypedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(typeInterval);
      }
    }, 100);
    
    return () => clearInterval(typeInterval);
  }, [activeFeature]);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated neural network background */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-2 h-2 bg-ai-primary rounded-full animate-ping" />
        <div className="absolute top-40 right-32 w-1 h-1 bg-ai-secondary rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
        <div className="absolute bottom-40 left-40 w-1.5 h-1.5 bg-ai-accent rounded-full animate-ping" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-20 right-20 w-2 h-2 bg-ai-glow rounded-full animate-ping" style={{ animationDelay: '1.5s' }} />
        
        {/* Connecting lines */}
        <svg className="absolute inset-0 w-full h-full opacity-20">
          <defs>
            <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--ai-primary))" />
              <stop offset="100%" stopColor="hsl(var(--ai-secondary))" />
            </linearGradient>
          </defs>
          <line x1="10%" y1="20%" x2="80%" y2="30%" stroke="url(#lineGradient)" strokeWidth="1" opacity="0.3" />
          <line x1="20%" y1="70%" x2="70%" y2="40%" stroke="url(#lineGradient)" strokeWidth="1" opacity="0.3" />
          <line x1="30%" y1="80%" x2="80%" y2="80%" stroke="url(#lineGradient)" strokeWidth="1" opacity="0.3" />
        </svg>
      </div>
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left content */}
          <div className="space-y-8 animate-slide-in">
            <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-ai-primary/20 to-ai-secondary/20 rounded-full px-6 py-3 border border-ai-primary/30 backdrop-blur-sm">
              <Brain className="w-5 h-5 text-ai-primary animate-pulse" />
              <span className="font-medium bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent">
                Next-Gen AI Collaboration
              </span>
            </div>
            
            <h1 className="text-4xl lg:text-6xl font-black leading-tight">
              Where{" "}
              <span className="relative">
                <span className="text-gradient">{typedText}</span>
                <span className="absolute -right-1 top-0 w-0.5 h-full bg-ai-primary animate-pulse" />
              </span>
              <br />
              <span className="text-3xl lg:text-4xl font-normal text-muted-foreground">
                Meet Intelligence
              </span>
            </h1>
            
            <p className="text-xl text-muted-foreground leading-relaxed max-w-lg">
              The first video platform where AI doesn't just watch—it participates. 
              Real-time transcription, intelligent summaries, and collaborative insights that evolve with your team.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                variant="hero" 
                size="lg" 
                className="group relative overflow-hidden"
                onClick={() => navigate('/video-call')}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-ai-primary to-ai-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10">Join Room</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform relative z-10" />
              </Button>
              
              <Button variant="ai-outline" size="lg" className="group">
                <Play className="w-5 h-5 group-hover:scale-110 transition-transform" />
                Watch Magic Happen
              </Button>
            </div>
            
            <div className="grid grid-cols-3 gap-6 pt-8">
              <div className="text-center">
                <div className="text-2xl font-bold text-ai-primary">99.9%</div>
                <div className="text-sm text-muted-foreground">Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-ai-secondary">Real-time</div>
                <div className="text-sm text-muted-foreground">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-ai-accent">24/7</div>
                <div className="text-sm text-muted-foreground">AI Support</div>
              </div>
            </div>
          </div>
          
          {/* Right content - Interactive demo */}
          <div className="relative animate-scale-in">
            {/* Main video interface mockup */}
            <div className="relative bg-gradient-to-br from-card via-card/95 to-card/90 backdrop-blur-xl rounded-3xl p-8 shadow-glow border border-ai-primary/20">
              {/* Video grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="relative aspect-video bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl overflow-hidden">
                    <div className="absolute inset-2 flex items-center justify-center">
                      <div className="w-12 h-12 rounded-full bg-ai-primary/20 flex items-center justify-center">
                        <Users className="w-6 h-6 text-ai-primary" />
                      </div>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-background/80 backdrop-blur-sm rounded-md px-2 py-1">
                      <span className="text-xs font-medium">User {i}</span>
                    </div>
                    {i === 1 && (
                      <div className="absolute top-2 right-2 flex space-x-1">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                        <Mic className="w-3 h-3 text-ai-primary" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* AI Chat Panel */}
              <div className="bg-gradient-to-r from-ai-primary/10 to-ai-secondary/10 rounded-2xl p-4 border border-ai-primary/20">
                <div className="flex items-center space-x-2 mb-3">
                  <Bot className="w-5 h-5 text-ai-primary" />
                  <span className="font-semibold text-sm">AI Assistant</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  {aiMessages.map((message, index) => (
                    <div 
                      key={index}
                      className={`text-xs p-2 rounded-lg transition-all duration-500 ${
                        index === activeFeature 
                          ? 'bg-ai-primary/20 text-ai-primary border border-ai-primary/30' 
                          : 'bg-muted/30 text-muted-foreground opacity-50'
                      }`}
                    >
                      {message}
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Floating action buttons */}
              <div className="absolute -right-4 top-1/2 -translate-y-1/2 flex flex-col space-y-3">
                <div className="w-12 h-12 bg-ai-primary rounded-2xl flex items-center justify-center shadow-feature animate-float">
                  <Video className="w-6 h-6 text-white" />
                </div>
                <div className="w-12 h-12 bg-ai-secondary rounded-2xl flex items-center justify-center shadow-feature animate-float" style={{ animationDelay: '0.5s' }}>
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div className="w-12 h-12 bg-ai-accent rounded-2xl flex items-center justify-center shadow-feature animate-float" style={{ animationDelay: '1s' }}>
                  <Share2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            
            {/* Floating AI features */}
            <div className="absolute -top-8 -left-8 bg-gradient-to-r from-ai-primary to-ai-secondary text-white px-6 py-3 rounded-2xl shadow-feature animate-float">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-sm font-medium">Live Transcription Active</span>
              </div>
            </div>
            
            <div className="absolute -bottom-8 -right-8 bg-gradient-to-r from-ai-secondary to-ai-glow text-white px-6 py-3 rounded-2xl shadow-feature animate-float" style={{ animationDelay: '0.7s' }}>
              <div className="flex items-center space-x-2">
                <Brain className="w-4 h-4" />
                <span className="text-sm font-medium">AI Insights Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;