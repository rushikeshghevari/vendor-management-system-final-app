import type { PropsWithChildren } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';

import { GlobalLoadingOverlay } from '@/providers/GlobalLoadingOverlay';
import { ErrorBoundary } from '@/providers/ErrorBoundary';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { store } from '@/store';

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <ErrorBoundary>
      <ReduxProvider store={store}>
        <SafeAreaProvider>
          <ThemeProvider>
            {children}
            <GlobalLoadingOverlay />
          </ThemeProvider>
        </SafeAreaProvider>
      </ReduxProvider>
    </ErrorBoundary>
  );
}
