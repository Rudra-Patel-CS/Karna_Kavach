import { useState, useEffect } from "react";
import { SkipForward } from "lucide-react";

interface SplashViewProps {
  onComplete: () => void;
}

export default function SplashView({ onComplete }: SplashViewProps) {
  const [showSkip, setShowSkip] = useState(false);

  // Show the skip button after a brief delay so the intro feels intentional
  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="splash-container" className="fixed inset-0 w-full h-full bg-black flex flex-col justify-between overflow-hidden z-50">
      <video
        autoPlay
        muted
        playsInline
        onEnded={onComplete}
        onError={onComplete}
        className="absolute inset-0 w-full h-full object-contain"
        src="https://res.cloudinary.com/dvpihuyiy/video/upload/v1781522599/video_is_good_but_the_fisherma_bs8i0j.mp4"
      />

      {/* Skip button — appears after 1.2s */}
      {showSkip && (
        <button
          onClick={onComplete}
          className="absolute bottom-8 right-8 z-10 flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 hover:border-white/40 rounded-full text-white text-sm font-semibold tracking-wide transition-all duration-300 cursor-pointer group animate-[fadeIn_0.4s_ease-out]"
          style={{ animation: "fadeIn 0.4s ease-out" }}
        >
          Skip
          <SkipForward className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}
    </div>
  );
}
