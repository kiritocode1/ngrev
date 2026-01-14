import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { VideoTrackerModern } from "@/components/video-tracker-modern";

export default function Page() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Brutalist Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1 hover:bg-accent" />
          <div className="h-4 w-px bg-border" />
          <nav className="flex items-center gap-6 text-mono text-xs uppercase tracking-widest">
            <span className="text-muted-foreground">01.</span>
            <span className="text-foreground font-medium">Video Tracker</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-mono text-xs text-muted-foreground hidden md:block">
            NGREV.BUILD
          </span>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 lg:p-8">
        {/* Hero Section */}
        <div className="mb-8 md:mb-12">
          <div className="flex items-baseline gap-4 mb-4">
            <span className="text-mono text-xs text-muted-foreground">[X].0PX</span>
            <span className="text-mono text-xs text-muted-foreground">[Y].0PX</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-4">
            Constellation
            <br />
            Tracker<span className="text-muted-foreground">™</span>
          </h1>
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8 text-sm text-muted-foreground max-w-xl">
            <p>
              Real-time object detection and motion tracking with interconnected visualization.
            </p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 text-mono text-xs uppercase">
          <div className="space-y-1">
            <span className="text-muted-foreground block">Detection</span>
            <span className="text-foreground">TensorFlow.js</span>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground block">Models</span>
            <span className="text-foreground">COCO-SSD</span>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground block">Export</span>
            <span className="text-foreground">mediabunny</span>
          </div>
          <div className="space-y-1">
            <span className="text-muted-foreground block">Version</span>
            <span className="text-foreground">01.0.0</span>
          </div>
        </div>

        {/* Video Component */}
        <VideoTrackerModern />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-3 flex items-center justify-between text-mono text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">PROJECT BY</span>
          <span className="font-medium">BLANK</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <span className="text-muted-foreground">EFFECTS PLATFORM</span>
        </div>
      </footer>
    </div>
  );
}
