import React from 'react';

interface IncentiveIconProps {
  width?: number;
  height?: number;
  className?: string;
}

export function IncentiveIcon({ width = 12, height = 12, className = '' }: IncentiveIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="7.2"
        cy="7.2"
        r="7.2"
        stroke="currentColor"
        strokeWidth="1.5"
        transform="matrix(1 0 0 -1 .8 15.2)"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="m4.557 8.082.891 1.132a1 1 0 0 0 1.591-.026l1.75-2.376a1 1 0 0 1 1.591-.026l1.064 1.35"
      />
    </svg>
  );
}
