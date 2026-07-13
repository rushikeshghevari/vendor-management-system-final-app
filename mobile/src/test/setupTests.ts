// EXPO_PUBLIC_* vars are normally inlined by Expo's Metro/babel config at bundle
// time — Jest never runs through Metro, so src/config/env.ts needs these set manually.
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:5000/api/v1';
process.env.EXPO_PUBLIC_API_TIMEOUT = '15000';
process.env.EXPO_PUBLIC_APP_ENV = 'development';

// In-memory fake for expo-secure-store so tests can exercise real read/write/clear
// logic in src/utils/secureStorage.ts without touching native keychain APIs.
const mockSecureStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key: string) => Promise.resolve(mockSecureStore.get(key) ?? null)),
  setItemAsync: jest.fn((key: string, value: string) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key: string) => {
    mockSecureStore.delete(key);
    return Promise.resolve();
  }),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
  launchCameraAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  MediaTypeOptions: { Images: 'Images' },
}));

// @gorhom/bottom-sheet (used by NotificationDetailsSheet) pulls in react-native-reanimated,
// whose native module (via the separate react-native-worklets package on this version) throws
// at import time outside a real native runtime — Jest never runs one, and the classic
// `react-native-reanimated/mock` doesn't fully cover this split reanimated/worklets setup.
// Mocking bottom-sheet itself at the module boundary sidesteps that entirely; no test here
// exercises the sheet's real gesture/animation behavior, only that screens render around it.
jest.mock('@gorhom/bottom-sheet', () => {
  const React = require('react');
  const passthrough = ({ children = null }: { children?: React.ReactNode }) => children;
  const BottomSheetModal = React.forwardRef((props: { children?: React.ReactNode }, ref: unknown) => {
    React.useImperativeHandle(ref, () => ({ present: jest.fn(), dismiss: jest.fn(), close: jest.fn(), expand: jest.fn(), collapse: jest.fn(), snapToIndex: jest.fn() }));
    return props.children ?? null;
  });
  return {
    __esModule: true,
    BottomSheetModal,
    BottomSheetView: passthrough,
    BottomSheetBackdrop: () => null,
    BottomSheetModalProvider: passthrough,
  };
});
