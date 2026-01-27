import { BlueKitLogo } from './BlueKitLogo';

export { BlueKitLogo };

export const Logos = {
  blueKit: BlueKitLogo,
} as const;

export type LogoName = keyof typeof Logos;

export const ActiveLogo = Logos.blueKit;
