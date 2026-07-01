import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  globalLoading: boolean;
  toast: { message: string; variant: 'success' | 'error' | 'info' } | null;
}

const initialState: UiState = {
  globalLoading: false,
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading(state, action: PayloadAction<boolean>) {
      state.globalLoading = action.payload;
    },
    showToast(state, action: PayloadAction<UiState['toast']>) {
      state.toast = action.payload;
    },
    clearToast(state) {
      state.toast = null;
    },
  },
});

export const { setGlobalLoading, showToast, clearToast } = uiSlice.actions;
export default uiSlice.reducer;
