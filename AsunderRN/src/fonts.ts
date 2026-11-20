import { Platform } from 'react-native';

/**
 * The phone's own fixed-width font, where every digit is the same width, so
 * the readout doesn't jiggle as the numbers change. It has a different name
 * on each kind of device. (Placeholder: the real look comes in Phase 4.)
 */
export const MONOSPACED_FONT = Platform.select({
  ios: 'ui-monospace',
  default: 'monospace',
});
