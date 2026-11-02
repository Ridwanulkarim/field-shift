import React from "react";
import farmBg from "../../assets/farm-bg.jpg";

const BackgroundCanvas = ({ isBlurMode = false }) => {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 pointer-events-none overflow-hidden"
    >
      {/* Farm Background */}
      <div
        className={`absolute -inset-6 bg-cover bg-center bg-no-repeat transition-all duration-700 ease-out ${
          isBlurMode
            ? "filter blur-[14px] sm:blur-[18px] scale-110 brightness-[0.78] saturate-[1.3]"
            : "scale-100 filter blur-0 brightness-[0.92]"
        }`}
        style={{
          backgroundImage: `
            radial-gradient(
              ellipse at 50% 0%,
              rgba(16, 185, 129, 0.22) 0%,
              transparent 65%
            ),
            linear-gradient(
              180deg,
              rgba(8, 18, 30, 0.45) 0%,
              rgba(5, 12, 22, 0.72) 100%
            ),
            url(${farmBg})
          `,
        }}
      />

      {/* Atmospheric Vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-slate-950/65 pointer-events-none" />
    </div>
  );
};

export default BackgroundCanvas;
