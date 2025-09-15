import { useState, useEffect } from "react";
import { Play, Users, Mic, Video, MessageSquare, Bot } from "lucide-react";
import { Button } from "./ui/button";

const LiveDemo = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [transcriptText, setTranscriptText] = useState("");

  const demoSteps = [
    {
      title: "Join Meeting",
      description: "Users connect instantly with WebRTC technology",
      action: "4 participants joined",
      icon: Users
    },
    {
      title: "Start Recording", 
      description: "AI begins real-time transcription automatically",
      action: "Recording started",
      icon: Mic
    },
    {
      title: "Live Transcription",
      description: "Speech converted to text with 99.9% accuracy",
      action: "Transcribing...",
      icon: MessageSquare
    },
    {
      title: "AI Analysis",
      description: "Meeting insights and action items generated",
      action: "AI processing complete",
      icon: Bot
    }
  ];

  const sampleTranscript = [
    "Sarah: Let's discuss the Q4 roadmap for our new features.",
    "Mike: I think we should prioritize the mobile app development.",
    "AI Assistant: I've identified 3 action items from this discussion.",
    "Emma: The user feedback suggests focusing on performance improvements.",
    "AI Assistant: Summary generated - 4 key decisions made."
  ];

  useEffect(() => {
    let interval: number;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentStep((prev) => (prev + 1) % demoSteps.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && currentStep === 2) {
      let index = 0;
      const typeInterval = setInterval(() => {
        if (index < sampleTranscript.length) {
          setTranscriptText(sampleTranscript.slice(0, index + 1).join('\n'));
          index++;
        } else {
          clearInterval(typeInterval);
        }
      }, 800);
      return () => clearInterval(typeInterval);
    }
    return () => {}; // Add return for all code paths
  }, [currentStep, isPlaying]);

  const toggleDemo = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      setCurrentStep(0);
      setTranscriptText("");
    }
  };

  return (
    <section className="py-24 pt-12 relative overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-64 h-64 bg-ai-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-ai-secondary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="container mx-auto px-6 relative z-10">
        <div className="text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-ai-primary/20 to-ai-secondary/20 rounded-full px-6 py-3 border border-ai-primary/30 backdrop-blur-sm mb-8">
            <Play className="w-5 h-5 text-ai-primary" />
            <span className="font-semibold">Interactive Demo</span>
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold mb-6">
            See <span className="text-gradient">IntelliMeet</span> in Action
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience how our AI transforms ordinary meetings into intelligent, productive sessions
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Demo Interface */}
          <div className="relative">
            <div className="bg-card/80 backdrop-blur-xl rounded-3xl border border-ai-primary/20 p-8 shadow-glow">
              {/* Demo Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                  <span className="font-medium">Live Meeting Demo</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleDemo}
                    className="border-ai-primary/30 hover:border-ai-primary/50"
                  >
                    {isPlaying ? "Pause" : "Start Demo"}
                    <Play className={`w-4 h-4 ml-2 ${isPlaying ? 'animate-pulse' : ''}`} />
                  </Button>
                </div>
              </div>

              {/* Video Grid Simulation */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[1, 2, 3, 4].map((participant) => (
                  <div
                    key={participant}
                    className={`aspect-video bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl border relative overflow-hidden ${
                      isPlaying ? 'border-ai-primary/40' : 'border-border'
                    } transition-all duration-500`}
                  >
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-ai-primary to-ai-secondary flex items-center justify-center ${
                        isPlaying ? 'animate-pulse' : ''
                      }`}>
                        <Users className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    
                    {/* Participant Controls */}
                    <div className="absolute bottom-2 left-2 flex space-x-1">
                      <div className={`w-6 h-6 rounded-full bg-background/80 flex items-center justify-center ${
                        isPlaying ? 'border border-green-500' : ''
                      }`}>
                        <Mic className="w-3 h-3" />
                      </div>
                      <div className="w-6 h-6 rounded-full bg-background/80 flex items-center justify-center">
                        <Video className="w-3 h-3" />
                      </div>
                    </div>

                    <div className="absolute top-2 right-2">
                      <div className="text-xs bg-background/80 rounded px-2 py-1">
                        User {participant}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Live Transcription Panel */}
              <div className="bg-muted/30 rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2 text-ai-primary" />
                    Live Transcription
                  </span>
                  <div className={`w-2 h-2 rounded-full ${isPlaying && currentStep >= 2 ? 'bg-green-500 animate-pulse' : 'bg-muted'}`} />
                </div>
                <div className="min-h-[100px] max-h-[100px] overflow-y-auto">
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono">
                    {transcriptText || "Transcription will appear here when demo starts..."}
                  </pre>
                </div>
              </div>

              {/* AI Insights Panel */}
              <div className="bg-gradient-to-r from-ai-primary/10 to-ai-secondary/10 rounded-xl p-4 border border-ai-primary/20">
                <div className="flex items-center space-x-2 mb-2">
                  <Bot className="w-4 h-4 text-ai-primary" />
                  <span className="text-sm font-medium">AI Assistant</span>
                  {isPlaying && currentStep === 3 && (
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-ai-primary rounded-full animate-bounce" />
                      <div className="w-1 h-1 bg-ai-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                      <div className="w-1 h-1 bg-ai-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {isPlaying && currentStep >= 3 
                    ? "✅ Meeting summary generated\n📋 3 action items identified\n👥 4 participants analyzed"
                    : "AI insights will appear during the meeting..."
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Demo Steps */}
          <div className="space-y-6">
            {demoSteps.map((step, index) => (
              <div
                key={step.title}
                className={`flex items-start space-x-4 p-6 rounded-2xl border transition-all duration-500 ${
                  isPlaying && currentStep === index
                    ? 'border-ai-primary/50 bg-gradient-to-r from-ai-primary/10 to-ai-secondary/10 shadow-glow'
                    : 'border-border bg-card/50'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-500 ${
                  isPlaying && currentStep === index
                    ? 'bg-gradient-to-br from-ai-primary to-ai-secondary shadow-feature'
                    : 'bg-muted'
                }`}>
                  <step.icon className={`w-6 h-6 ${
                    isPlaying && currentStep === index ? 'text-white' : 'text-muted-foreground'
                  }`} />
                </div>
                
                <div className="flex-1">
                  <h4 className="font-semibold mb-2">{step.title}</h4>
                  <p className="text-sm text-muted-foreground mb-2">{step.description}</p>
                  {isPlaying && currentStep === index && (
                    <div className="text-xs text-ai-primary font-medium animate-fade-in">
                      ⚡ {step.action}
                    </div>
                  )}
                </div>

                {isPlaying && currentStep === index && (
                  <div className="w-2 h-2 bg-ai-primary rounded-full animate-pulse" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default LiveDemo;