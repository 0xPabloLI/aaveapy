import { Skeleton } from '@/components/ui/skeleton';
import { TableRow, TableCell } from '@/components/ui/table';

export default function ReservesTableDesktopSkeleton() {
  return (
    <>
      {Array.from({ length: 10 }).map((_, i) => (
        <TableRow key={i} className="border-b border-border/30">
          <TableCell className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-0-5)] ds-row-pad text-center">
            <div className="flex items-center justify-center gap-[var(--ds-space-2)]">
              <Skeleton variant="gradient" className="w-7 h-7 rounded-full border-transparent" />
              <Skeleton variant="default" className="h-4 w-14 rounded-md" />
            </div>
          </TableCell>
          <TableCell className="px-[var(--ds-space-0-5)] ds-row-pad text-center hidden md:table-cell">
            <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
          </TableCell>
          <TableCell className="pl-[var(--ds-space-0-5)] pr-[var(--ds-space-1)] ds-row-pad text-center hidden md:table-cell">
            <Skeleton variant="subtle" className="h-6 w-20 rounded-full mx-auto" />
          </TableCell>
          <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center hidden md:table-cell">
            <Skeleton variant="subtle" className="h-4 w-16 rounded-md mx-auto" />
          </TableCell>
          <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center">
            <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
              <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 2 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
              <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 2 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
            </div>
          </TableCell>
          <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center hidden md:table-cell">
            <Skeleton variant="subtle" className={`h-5 rounded-md mx-auto ${i % 2 === 0 ? 'w-16' : 'w-14'}`} />
          </TableCell>
          <TableCell className="px-[var(--ds-space-1-5)] ds-row-pad text-center">
            <div className="flex flex-col items-center gap-[var(--ds-space-1)]">
              <Skeleton variant="gradient" className={`h-5 rounded-md ${i % 3 === 0 ? 'w-16' : 'w-[4.5rem]'}`} />
              <Skeleton variant="subtle" className={`h-3 rounded-full border-transparent ${i % 3 === 0 ? 'w-20' : 'w-[4.5rem]'}`} />
            </div>
          </TableCell>
          <TableCell className="pl-[var(--ds-space-1-5)] pr-[var(--ds-space-2)] ds-row-pad text-center hidden md:table-cell">
            <Skeleton variant="subtle" className="h-4 w-12 rounded-md mx-auto" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
