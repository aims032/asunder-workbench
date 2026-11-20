import { requireOptionalNativeModule } from 'expo';

import type { AsunderHapticsNative } from './AsunderHaptics.types';

// The native module, or null where it doesn't exist (for example in tests).
// Callers write `AsunderHaptics?.tick(...)`, so a missing module does nothing.
export default requireOptionalNativeModule<AsunderHapticsNative>('AsunderHaptics');
