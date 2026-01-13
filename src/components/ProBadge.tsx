/**
 * ProBadge Component
 * 
 * Small badge to indicate Pro features or Pro status.
 */

import React from 'react';
import { Crown, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProBadgeProps {
  variant?: 'default' | 'small' | 'inline' | 'lock';
  className?: string;
}

export function ProBadge({ variant = 'default', className }: ProBadgeProps) {
  if (variant === 'lock') {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-5 h-5 rounded-full bg-muted',
          className
        )}
      >
        <Lock className="h-3 w-3 text-muted-foreground" />
      </div>
    );
  }

  if (variant === 'small') {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary/10 text-primary',
          className
        )}
      >
        <Crown className="h-2.5 w-2.5" />
        PRO
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 text-primary',
          className
        )}
      >
        <Crown className="h-3.5 w-3.5" />
      </span>
    );
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-gradient-primary text-white',
        className
      )}
    >
      <Crown className="h-3 w-3" />
      PRO
    </div>
  );
}

export default ProBadge;
