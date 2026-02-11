import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.wordoutsider.app',
  appName: 'Outsider Royale',
  webDir: 'dist',
  server: {
    url: 'https://4b9de44f-1c68-4ee8-8e08-f7594c181759.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
