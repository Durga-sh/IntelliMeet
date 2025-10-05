import { Button } from "./ui/button";
import { Brain, Menu, X, Sparkles, Zap, LogOut, User } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const Navigation = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();

  const navItems = [
    { label: "Tech Stack", href: "#tech" },
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "#pricing" },
    { label: "Docs", href: "#docs" }
  ];

  const handleSignInClick = () => {
    navigate('/login');
  };

  const handleLogout = () => {
    logoutUser();
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      isScrolled 
        ? 'bg-background/95 backdrop-blur-xl border-b border-ai-primary/20 shadow-glow' 
        : 'bg-background/80 backdrop-blur-lg border-b border-border/30'
    }`}>
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-ai-primary to-ai-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div className="absolute -top-1 -right-1">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              </div>
            </div>
            <div>
              <span className="text-xl font-black bg-gradient-to-r from-ai-primary to-ai-secondary bg-clip-text text-transparent">
                IntelliMeet
              </span>
              <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3 text-ai-primary" />
                <span>AI-Powered</span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                className="relative text-muted-foreground hover:text-ai-primary transition-colors duration-200 font-medium group"
              >
                {item.label}
                <div className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-ai-primary to-ai-secondary group-hover:w-full transition-all duration-300" />
              </a>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  <span>Welcome, {user.name}</span>
                </div>
                <Button variant="ghost" className="relative group" onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                  <div className="absolute inset-0 bg-gradient-to-r from-ai-primary/10 to-ai-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" className="relative group" onClick={handleSignInClick}>
                  Sign In
                  <div className="absolute inset-0 bg-gradient-to-r from-ai-primary/10 to-ai-secondary/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg" />
                </Button>
                
                <Button 
                  variant="ai" 
                  className="relative group overflow-hidden"
                  onClick={() => navigate('/video-call')}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-ai-primary to-ai-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="relative z-10 flex items-center space-x-2">
                    <Zap className="w-4 h-4" />
                    <span>Join Room</span>
                  </span>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-ai-primary/10 transition-colors"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-ai-primary" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-ai-primary/20 animate-fade-in">
            <div className="flex flex-col space-y-4">
              {navItems.map((item) => (
                <a
                  key={item.label}
                  href={item.href}
                  className="text-muted-foreground hover:text-ai-primary transition-colors duration-200 py-3 px-4 rounded-lg hover:bg-ai-primary/10 font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <div className="pt-4 space-y-3">
                {user ? (
                  <>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground px-4 py-2">
                      <User className="w-4 h-4" />
                      <span>Welcome, {user.name}</span>
                    </div>
                    <Button variant="ghost" className="w-full" onClick={handleLogout}>
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="w-full" onClick={handleSignInClick}>Sign In</Button>
                    <Button 
                      variant="ai" 
                      className="w-full"
                      onClick={() => navigate('/video-call')}
                    >
                      <Zap className="w-4 h-4 mr-2" />
                      Join Room
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;