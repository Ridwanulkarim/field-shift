import React from 'react';

/**
 * Official NASA-Agritech Brand Emblem for FIELD SHIFT
 * Features a precision orbital satellite trajectory intersecting
 * a geometric climate-resilient crop leaf structure with telemetry coordinates.
 */
export default function BrandLogo({ className = "w-10 h-10" }) {
  return (
    <div className={`relative ${className} shrink-0`}>
      <svg
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(16,185,129,0.35)]"
      >
        <defs>
          {/* Brand Gradient: Vibrant Mint to NASA Satellite Cyan */}
          <linearGradient id="logo-em-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="55%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>

          {/* Orbit Gradient */}
          <linearGradient id="logo-orbit-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#10b981" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>

          {/* Badge Background */}
          <linearGradient id="logo-badge-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f2238" />
            <stop offset="100%" stopColor="#081422" />
          </linearGradient>

          {/* Soft Glow Filter */}
          <filter id="logo-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="glow" />
            <feComposite in="SourceGraphic" in2="glow" operator="over" />
          </filter>
        </defs>

        {/* Squircle Badge Frame */}
        <rect
          x="1.5"
          y="1.5"
          width="41"
          height="41"
          rx="12"
          fill="url(#logo-badge-bg)"
          stroke="url(#logo-em-grad)"
          strokeWidth="1.5"
        />

        {/* Subtle Radar Range Rings */}
        <circle cx="22" cy="22" r="16" stroke="#10b981" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.3" />
        <circle cx="22" cy="22" r="10" stroke="#06b6d4" strokeWidth="0.5" opacity="0.2" />

        {/* Elliptical Satellite Orbit (35-degree tilt) */}
        <ellipse
          cx="22"
          cy="22"
          rx="16.5"
          ry="7.5"
          transform="rotate(-32 22 22)"
          stroke="url(#logo-orbit-grad)"
          strokeWidth="1.75"
          strokeLinecap="round"
        />

        {/* Active Satellite Node on Orbit */}
        <g transform="translate(33, 11)">
          <circle cx="0" cy="0" r="2.2" fill="#38bdf8" filter="url(#logo-glow)" />
          <circle cx="0" cy="0" r="4" stroke="#38bdf8" strokeWidth="0.75" opacity="0.6" />
        </g>

        {/* Central Climate-Resilient Crop Sprout / Hex Vein Structure */}
        {/* Central Stem */}
        <path
          d="M22 31.5V19.5"
          stroke="url(#logo-em-grad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Right Foliage Leaf */}
        <path
          d="M22 22C25.5 22 29 19.5 29 15.5C25 15.5 22 18 22 22Z"
          fill="url(#logo-em-grad)"
          opacity="0.95"
        />

        {/* Left Foliage Leaf */}
        <path
          d="M22 25.5C18 25.5 14.5 23 14.5 18.5C18.5 18.5 22 21 22 25.5Z"
          fill="url(#logo-em-grad)"
          opacity="0.95"
        />

        {/* Central Bud Apex (Sunlit Precision Tip) */}
        <circle cx="22" cy="15.5" r="1.5" fill="#ffffff" filter="url(#logo-glow)" />
      </svg>
    </div>
  );
}
