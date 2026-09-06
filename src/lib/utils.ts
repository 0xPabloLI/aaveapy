import { extendTailwindMerge } from "tailwind-merge";
import type { ClassValue } from "clsx";

// clsx's runtime is inlined below rather than imported: rolldown's module
// concatenation has been observed gluing the clsx package into the
// vendor-blockchain chunk (rainbowkit/wagmi also depend on it), which would
// make every cn() call site — including sync first-paint UI — statically reach
// vendor-blockchain (~400 KB gzip) via the shared utils chunk. The advancedChunks
// group for clsx plus the build-time first-paint guard are the other two legs
// of this defence; the type-only import above is erased at build time.
function classNames(...inputs: ClassValue[]): string {
  let out = '';
  for (const input of inputs) {
    if (!input || typeof input === 'boolean') continue;
    if (typeof input === 'string' || typeof input === 'number') {
      out = out ? `${out} ${input}` : String(input);
    } else if (Array.isArray(input)) {
      const nested = classNames(...input);
      if (nested) out = out ? `${out} ${nested}` : nested;
    } else {
      for (const key of Object.keys(input)) {
        if (input[key]) out = out ? `${out} ${key}` : key;
      }
    }
  }
  return out;
}

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { 'ds-text': ['8', '9', '10', '11', '12', '13', '14', '16', '18', '20', '24', '36'] }
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(classNames(inputs));
}
