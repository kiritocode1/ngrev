import { VideoTracker } from "@/components/video-tracker";
import { ThemeSwitcher } from "@/components/theme-switcher";

export default function Page() {
    return (
        <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8">
            <header className="max-w-4xl mx-auto mb-8 text-center">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent mb-2">
                    ngrev
                </h1>
                <p className="text-gray-400">
                    Real-time object tracking with constellation visualization
                </p>
                <div className="mt-4">
                    <ThemeSwitcher />
                </div>
            </header>

            <VideoTracker />
        </main>
    );
}