import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Search, Bell, User, Zap, Heart, Star } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="px-4 py-4 flex items-center justify-between max-w-md mx-auto">
          <h1 className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            MyApp
          </h1>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Bell className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 pb-24 pt-6 max-w-md mx-auto space-y-6">
        {/* Welcome Card */}
        <Card className="p-6 bg-gradient-primary text-primary-foreground shadow-card border-0">
          <h2 className="text-2xl font-bold mb-2">Welcome Back!</h2>
          <p className="text-primary-foreground/90 mb-4">
            Your mobile app is ready to use
          </p>
          <Button 
            variant="secondary" 
            className="w-full bg-white/20 hover:bg-white/30 text-white border-white/30"
          >
            Get Started
          </Button>
        </Card>

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4 hover:shadow-card transition-all cursor-pointer active:scale-95 bg-gradient-card border-border">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-sm">Quick Start</span>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-card transition-all cursor-pointer active:scale-95 bg-gradient-card border-border">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-accent/10">
                  <Heart className="h-6 w-6 text-accent" />
                </div>
                <span className="font-medium text-sm">Favorites</span>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-card transition-all cursor-pointer active:scale-95 bg-gradient-card border-border">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-primary/10">
                  <Star className="h-6 w-6 text-primary" />
                </div>
                <span className="font-medium text-sm">Featured</span>
              </div>
            </Card>
            <Card className="p-4 hover:shadow-card transition-all cursor-pointer active:scale-95 bg-gradient-card border-border">
              <div className="flex flex-col items-center text-center space-y-2">
                <div className="p-3 rounded-full bg-accent/10">
                  <Search className="h-6 w-6 text-accent" />
                </div>
                <span className="font-medium text-sm">Explore</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground px-1">Recent Activity</h3>
          {[1, 2, 3].map((item) => (
            <Card key={item} className="p-4 hover:shadow-card transition-all cursor-pointer active:scale-[0.98] bg-gradient-card border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium">Activity {item}</h4>
                    <p className="text-sm text-muted-foreground">Just now</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">View</Button>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-around">
          <Button variant="ghost" size="icon" className="flex-col h-auto py-2 text-primary">
            <Home className="h-5 w-5 mb-1" />
            <span className="text-xs font-medium">Home</span>
          </Button>
          <Button variant="ghost" size="icon" className="flex-col h-auto py-2">
            <Search className="h-5 w-5 mb-1" />
            <span className="text-xs">Search</span>
          </Button>
          <Button variant="ghost" size="icon" className="flex-col h-auto py-2">
            <Bell className="h-5 w-5 mb-1" />
            <span className="text-xs">Alerts</span>
          </Button>
          <Button variant="ghost" size="icon" className="flex-col h-auto py-2">
            <User className="h-5 w-5 mb-1" />
            <span className="text-xs">Profile</span>
          </Button>
        </div>
      </nav>
    </div>
  );
};

export default Index;
