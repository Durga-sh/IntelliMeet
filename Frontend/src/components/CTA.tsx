import { Button } from "./ui/button";
import { ArrowRight, Sparkles, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const benefits = [
  "14-day free trial",
  "No setup fees",
  "Cancel anytime",
  "24/7 support"
];

const CTA = () => {
  const navigate = useNavigate();
  
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-hero opacity-5" />
      <div className="absolute top-10 left-10 w-96 h-96 bg-ai-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-ai-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-secondary/50 rounded-full px-6 py-3 border border-ai-primary/20">
            <Sparkles className="w-5 h-5 text-ai-primary" />
            <span className="font-medium">Ready to Transform Your Meetings?</span>
          </div>
          
          <h2 className="text-4xl lg:text-6xl font-bold leading-tight">
            Start Your AI-Powered{" "}
            <span className="text-gradient">Collaboration Journey</span>
          </h2>

          <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
            Join thousands of teams already using IntelliMeet to revolutionize their remote work. 
            Experience the power of AI-enhanced collaboration today.
          </p>
          
          {/* Benefits list */}
          <div className="flex flex-wrap justify-center gap-6 my-8">
            {benefits.map((benefit, index) => (
              <div 
                key={benefit}
                className="flex items-center space-x-2 animate-slide-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CheckCircle className="w-5 h-5 text-ai-primary" />
                <span className="text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-12">
            <Button 
              variant="hero" 
              size="lg" 
              className="group text-lg px-8 py-4"
              onClick={() => navigate('/video-call')}
            >
              Join Room Now
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button variant="ai-outline" size="lg" className="text-lg px-8 py-4">
              Schedule Demo
            </Button>
          </div>
          
          {/* Trust indicators */}
          <div className="pt-12 border-t border-border/50 mt-16">
            <p className="text-sm text-muted-foreground mb-6">
              Trusted by innovative teams worldwide
            </p>
            
            <div className="flex justify-center items-center space-x-8 opacity-60">
              <div className="w-24 h-8 bg-muted/30 rounded animate-pulse" />
              <div className="w-20 h-8 bg-muted/30 rounded animate-pulse" />
              <div className="w-28 h-8 bg-muted/30 rounded animate-pulse" />
              <div className="w-24 h-8 bg-muted/30 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;