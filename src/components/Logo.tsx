import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative w-14 h-12 shrink-0">
        <svg viewBox="0 0 120 100" className="w-full h-full drop-shadow-lg">
          {/* Suitcase Handle */}
          <path d="M40,25 Q40,10 60,10 Q80,10 80,25" fill="none" stroke="#0056b3" strokeWidth="6" />
          
          {/* Suitcase Body */}
          <rect x="10" y="25" width="100" height="65" rx="20" fill="#0066CC" />
          
          {/* Wheels/Stands */}
          <rect x="25" y="85" width="15" height="10" rx="4" fill="#004a99" />
          <rect x="80" y="85" width="15" height="10" rx="4" fill="#004a99" />

          {/* Plane Swish */}
          <path 
            d="M20,50 Q60,40 100,35" 
            fill="none" 
            stroke="white" 
            strokeWidth="3" 
            strokeLinecap="round"
            opacity="0.9"
          />
          <path 
            d="M95,30 L105,35 L95,40 Z" 
            fill="white" 
          />

          {/* Text inside suitcase */}
          <text x="60" y="68" textAnchor="middle" className="font-sans font-black text-[22px] tracking-tight">
            <tspan fill="white">Trip</tspan>
            <tspan fill="#FF8C00">Hub</tspan>
          </text>
        </svg>
      </div>
    </div>
  );
};

export default Logo;
