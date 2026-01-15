import { ThemeSwitcher } from "@/components/theme-switcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { VideoTrackerModern } from "@/components/video-tracker-modern";

export default function Page() {
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1 hover:bg-accent" />
          <div className="h-4 w-px bg-border" />
          <nav className="flex items-center gap-6 text-mono text-xs uppercase tracking-widest">
            <span className="text-muted-foreground">01.</span>
            <span className="text-foreground font-medium">Observe</span>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-mono text-xs text-muted-foreground hidden md:block">
            ©NGREV
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
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-none mb-6">
            The Art of
            <br />
            Seeing Motion<span className="text-muted-foreground">™</span>
          </h1>
          <div className="flex flex-col gap-4 text-sm text-muted-foreground max-w-xl mb-6">
            <p className="leading-relaxed">
              Every movement tells a story. We capture the poetry of change—
              the subtle dance of pixels, the geometry of displacement.
            </p>
            <p className="text-mono text-[10px] uppercase tracking-widest opacity-70">
              "To see a world in a grain of sand, and heaven in a wild flower"
            </p>
          </div>
        </div>

        {/* Active Ingredients */}
        <div className="mb-8">
          <span className="text-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-4 block">
            Active Ingredients
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-mono text-xs uppercase">
            <div className="space-y-1">
              <span className="text-muted-foreground block">Method</span>
              <span className="text-foreground">Frame Differencing</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block">Philosophy</span>
              <span className="text-foreground">Motion as Truth</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block">Render</span>
              <span className="text-foreground">Constellation</span>
            </div>
            <div className="space-y-1">
              <span className="text-muted-foreground block">Iteration</span>
              <span className="text-foreground">01.1</span>
            </div>
          </div>
        </div>

        {/* Chapters */}
        <div className="mb-8">
          <div className="flex items-center gap-8 text-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            <span>Chapters</span>
            <div className="flex gap-4">
              <span className="text-foreground">01. Observe</span>
              <span>02. Track</span>
              <span>03. Connect</span>
            </div>
          </div>
        </div>

        {/* Video Component */}
        <VideoTrackerModern />
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-4 flex items-center justify-between text-mono text-xs">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">PROJECT BY</span>
          <span className="font-medium">BLANK</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <span className="text-muted-foreground italic text-[10px] normal-case">
            "Movement is the song of the body."
          </span>
        </div>
        <div className="flex items-center gap-4">
          {/* Barcode-style element */}
          <div className="flex gap-[2px] h-6">
            {[1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1].map((w, i) => (
              <div
                key={i}
                className="bg-foreground"
                style={{ width: `${w}px` }}
              />
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
