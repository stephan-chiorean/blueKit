import { createSystem, defaultConfig } from '@chakra-ui/react';

// Theme color entrypoint - change these values to update the color scheme
const themeColors = {
  // Primary color palette - using #4287f5 as base
  primary: {
    50: { value: '#eff6ff' },
    100: { value: '#FFE6BF' },
    200: { value: '#FAEDE3' },
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
      breakpoints: {
        sm: { value: '30em' },
        md: { value: '48em' },
        lg: { value: '62em' },
        xl: { value: '80em' },
        '2xl': { value: '96em' },
        '3xl': { value: '120em' }, // 1920px for widescreen monitors
      },
    },
    semanticTokens: {
      colors: {
        primary: {
          solid: { value: '{colors.primary.600}' },
          contrast: { value: '{colors.primary.50}' },
          fg: { value: { _light: '{colors.primary.700}', _dark: '{colors.primary.200}' } },
          muted: { value: '{colors.primary.100}' },
          subtle: { value: { _light: '{colors.primary.200}', _dark: '{colors.primary.800}' } },
          emphasized: { value: '{colors.primary.300}' },
          focusRing: { value: '{colors.primary.500}' },
          border: { value: '{colors.primary.200}' },
        },
        // Hover/selected background for cards and interactive elements
        'primary.hover.bg': { value: { _light: '{colors.primary.50}', _dark: 'rgba(66, 135, 245, 0.3)' } },
        // Priority-based subtle backgrounds for task cards
        'blue.subtle': { value: { _light: '{colors.blue.100}', _dark: 'rgba(59, 130, 246, 0.15)' } },
        'red.subtle': { value: { _light: '{colors.red.100}', _dark: 'rgba(239, 68, 68, 0.15)' } },
        'purple.subtle': { value: { _light: '{colors.purple.100}', _dark: 'rgba(168, 85, 247, 0.15)' } },
        'yellow.subtle': { value: { _light: '{colors.yellow.100}', _dark: 'rgba(234, 179, 8, 0.15)' } },
        'orange.subtle': { value: { _light: '{colors.orange.100}', _dark: 'rgba(249, 115, 22, 0.15)' } },
        // Subtle background for cards, tabs, header - consistent across the app
        // Using Chakra UI's default subtle background (gray.100 in light, gray.800 in dark)
        'bg.subtle': { value: { _light: '{colors.gray.100}', _dark: '{colors.gray.950}' } },
        // Surface background for selected states (e.g., view mode switcher)
        'bg.surface': { value: { _light: 'white', _dark: '{colors.gray.900}' } },
        // Header background - same as subtle background (cards/tabs)
        'header.bg': { value: { _light: '{colors.gray.100}', _dark: '{colors.gray.950}' } },
        // Main content background - darker than header/tabs/cards in dark mode (neutral dark gray/black)
        'main.bg': { value: { _light: '{colors.white}', _dark: '{colors.gray.950}' } },
        // Text color - uses blue in dark mode
        'text.primary': { value: { _light: '{colors.gray.900}', _dark: '{colors.primary.200}' } },
        'text.secondary': { value: { _light: '{colors.gray.600}', _dark: '{colors.primary.400}' } },
        'text.tertiary': { value: { _light: '{colors.gray.500}', _dark: '#A69385' } },
        // Default foreground color - uses blue in dark mode
        fg: { value: { _light: '{colors.gray.900}', _dark: '{colors.primary.200}' } },
        'fg.muted': { value: { _light: '{colors.gray.600}', _dark: '{colors.primary.400}' } },
      },
    },
  },
});

