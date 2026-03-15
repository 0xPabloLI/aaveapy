import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

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
  return twMerge(clsx(inputs));
}
