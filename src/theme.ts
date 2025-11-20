import { createSystem, defaultConfig } from '@chakra-ui/react';

// Theme color entrypoint - change these values to update the color scheme
const themeColors = {
  // Primary color palette - using subtle gray tones
  primary: {
    50: { value: '#f9fafb' },
    100: { value: '#f3f4f6' },
    200: { value: '#e5e7eb' },
    300: { value: '#d1d5db' },
    400: { value: '#9ca3af' },
    500: { value: '#6b7280' },
    600: { value: '#4b5563' },
    700: { value: '#374151' },
    800: { value: '#1f2937' },
    900: { value: '#111827' },
    950: { value: '#030712' },
  },
};

export const system = createSystem(defaultConfig, {
  theme: {
    tokens: {
      colors: {
        ...themeColors,
      },
    },
    semanticTokens: {
      colors: {
        primary: {
          solid: { value: '{colors.primary.600}' },
          contrast: { value: '{colors.primary.50}' },
          fg: { value: { _light: '{colors.primary.700}', _dark: '{colors.primary.300}' } },
          muted: { value: '{colors.primary.100}' },
          subtle: { value: '{colors.primary.200}' },
          emphasized: { value: '{colors.primary.300}' },
          focusRing: { value: '{colors.primary.500}' },
          border: { value: '{colors.primary.200}' },
        },
        // Header background - slightly darker than nav sidebar
        'header.bg': { value: { _light: '{colors.primary.100}', _dark: '{colors.primary.800}' } },
        // Main content background - lighter than header
        'main.bg': { value: { _light: '{colors.white}', _dark: '{colors.primary.900}' } },
      },
    },
  },
});

