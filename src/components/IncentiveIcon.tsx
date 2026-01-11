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
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M1 7C2.5 4 3.5 4 5 7C6.5 10 7.5 10 9 7C10.5 4 11.5 4 12 7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
