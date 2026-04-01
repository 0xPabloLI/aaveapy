import { cn } from '@/lib/utils';

interface DeficitShieldIconProps {
  className?: string;
  ratio?: number | null;
}

export default function DeficitShieldIcon({ className, ratio }: DeficitShieldIconProps) {
  const normalizedRatio = Math.max(0, Math.min(1, ratio ?? 0));
  const outerFillOpacity = 0.05;
  const innerFillOpacity = 0.2;
  // Tiny-deficit boost (<5%): amplify perceived severity where most values cluster.
  const tinyBoost = normalizedRatio <= 0.05
    ? Math.pow(normalizedRatio / 0.05, 0.45) * 0.24
    : 0.24;
  const boostedRatio = Math.min(1, normalizedRatio + tinyBoost);

  // Fine-grained mapping with boosted low-end sensitivity.
  const crackIntensity = Math.pow(boostedRatio, 0.55);
  const crackOpacity = 0.4 + crackIntensity * 0.6;
  const crackStrokeWidth = 1.8 + crackIntensity * 3.6;

  // Stage cracks progressively; thresholds are lower to separate tiny values better.
  const stage1Opacity = Math.max(0, (boostedRatio - 0.03) / 0.97) * 0.75;
  const stage2Opacity = Math.max(0, (boostedRatio - 0.1) / 0.9) * 0.85;
  const stage3Opacity = Math.max(0, (boostedRatio - 0.22) / 0.78) * 0.95;

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={cn('inline-block h-3 w-3 shrink-0 align-[-0.1em]', className)}
      fill="none"
    >
      <path
        d="M50 6 C40 16,27 21,14 21 V49 C14 69,27 86,50 94 C73 86,86 69,86 49 V21 C73 21,60 16,50 6Z"
        fill="currentColor"
        fillOpacity={outerFillOpacity}
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path
        d="M50 20 C42 26,32 29,25 30 V49 C25 63,34 75,50 81 C66 75,75 63,75 49 V30 C68 29,58 26,50 20Z"
        fill="currentColor"
        fillOpacity={innerFillOpacity}
      />
      <path d="M35 33 L44 42 L44 66" stroke="currentColor" strokeOpacity={crackOpacity} strokeWidth={crackStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 33 L27 40" stroke="currentColor" strokeOpacity={crackOpacity} strokeWidth={crackStrokeWidth} strokeLinecap="round" />
      <path d="M44 42 L57 45" stroke="currentColor" strokeOpacity={crackOpacity} strokeWidth={crackStrokeWidth} strokeLinecap="round" />
      <path d="M52 70 L61 69 L66 74" stroke="currentColor" strokeOpacity={crackOpacity} strokeWidth={crackStrokeWidth} strokeLinecap="round" strokeLinejoin="round" />

      {/* Progressive micro-cracks for finer severity granularity */}
      <path d="M58 31 L63 37" stroke="currentColor" strokeOpacity={stage1Opacity} strokeWidth={crackStrokeWidth * 0.68} strokeLinecap="round" />
      <path d="M60 56 L67 59" stroke="currentColor" strokeOpacity={stage2Opacity} strokeWidth={crackStrokeWidth * 0.72} strokeLinecap="round" />
      <path d="M41 58 L36 63" stroke="currentColor" strokeOpacity={stage2Opacity * 0.9} strokeWidth={crackStrokeWidth * 0.7} strokeLinecap="round" />
      <path d="M47 27 L52 31" stroke="currentColor" strokeOpacity={stage3Opacity} strokeWidth={crackStrokeWidth * 0.62} strokeLinecap="round" />
      <path d="M66 45 L71 48" stroke="currentColor" strokeOpacity={stage3Opacity * 0.9} strokeWidth={crackStrokeWidth * 0.58} strokeLinecap="round" />
    </svg>
  );
}
