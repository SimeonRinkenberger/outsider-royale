import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Loader2 } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';

const OfflineBanner: React.FC = () => {
  const { isOnline, isReconnecting } = useNetwork();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-50 bg-destructive text-destructive-foreground px-4 pb-3 shadow-lg"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            {isReconnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>No internet connection</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineBanner;
