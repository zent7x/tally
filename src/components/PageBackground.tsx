import { type ReactNode } from "react";
import { RevealWaveImage } from "@/components/ui/reveal-wave-image";
import bgSrc from "@/assets/bg/ledger-wave.jpg";

export function PageBackground({ children }: { children: ReactNode }) {
  return (
    <div className="page-shell">
      <div className="page-bg" aria-hidden="true">
        <RevealWaveImage
          src={bgSrc}
          trackWindow
          waveSpeed={1.25}
          waveFrequency={1.45}
          waveAmplitude={1.15}
          revealRadius={0.36}
          revealSoftness={0.42}
          pixelSize={3.25}
          mouseRadius={0.4}
          baseColorMix={0.08}
        />
        <div className="page-bg-veil" />
      </div>
      <div className="page-fg">{children}</div>
    </div>
  );
}
