import { ArrowRight } from "lucide-react";

interface SplashViewProps {
  onComplete: () => void;
}

export default function SplashView({ onComplete }: SplashViewProps) {
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

      {/* The video plays until the end, then proceeds automatically */}
    </div>
  );
}
