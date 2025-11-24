import { createSystem, defaultConfig } from '@chakra-ui/react';

// Theme color entrypoint - change these values to update the color scheme
const themeColors = {
  // Primary color palette - using #4287f5 as base
  primary: {
    50: { value: '#eff6ff' },
    100: { value: '#dbeafe' },
    200: { value: '#bfdbfe' },
    300: { value: '#93c5fd' },
    400: { value: '#60a5fa' },
    500: { value: '#4287f5' },
    600: { value: '#2563eb' },
    700: { value: '#1d4ed8' },
    800: { value: '#1e40af' },
    900: { value: '#1e3a8a' },
    950: { value: '#172554' },
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
        // Header background - subtle gray (keeping it subtle)
        'header.bg': { value: { _light: '#f9fafb', _dark: '{colors.primary.800}' } },
        // Main content background - lighter than header
        'main.bg': { value: { _light: '{colors.white}', _dark: '{colors.primary.900}' } },
      },
    },
  },
});

