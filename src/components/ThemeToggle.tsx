import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const ThemeToggle = () => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const applyTransition = () => {
    document.documentElement.classList.add('theme-transition');
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 350);
  };

  const handleToggle = () => {
    applyTransition();
    // Simple toggle: if current is dark, switch to light; otherwise switch to dark
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  if (!mounted) {
    return (
      <div className="h-9 w-9 rounded-full bg-muted animate-pulse" />
    );
  }

  const isDark = resolvedTheme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="utility"
          size="icon"
          onClick={handleToggle}
          className="relative h-9 w-9 rounded-full text-interactive transition-colors duration-200
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isDark ? (
            <Moon className="h-4 w-4 text-success" />
          ) : (
            <Sun className="h-4 w-4 text-success" />
          )}
          <span className="sr-only">{isDark ? 'Dark mode' : 'Light mode'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="ds-text-11 whitespace-nowrap">
        Switch to {isDark ? 'light' : 'dark'} mode
      </TooltipContent>
    </Tooltip>
  );
};

export default ThemeToggle;
