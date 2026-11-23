import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cajamaster.pos',
  appName: 'CajaMaster POS',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    buildOptions: {
      keystorePath: 'release.keystore',
      keystoreAlias: 'cajamaster_key',
    }
  }
};

export default config;
