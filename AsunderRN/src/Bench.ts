import { createReceiverAudio } from './audio/ReceiverAudio';
import type { ReceiverAudio } from './audio/ReceiverAudio.types';
import { createDialModel } from './dial/DialModel';
import type { DialModel } from './dial/DialModel';
import { prepareHaptics } from './haptics/Haptics';

/**
 * Everything on the bench, made once when the app opens and kept for as long
 * as it runs. Phase 3 adds the analyzer and the scope here.
 *
 * It's made in App.tsx (not inside a screen) because React can re-create
 * screens whenever it likes, and there must only ever be one radio.
 */
export interface Bench {
  audio: ReceiverAudio;
  dial: DialModel;
}

export function createBench(): Bench {
  const audio = createReceiverAudio();
  prepareHaptics();
  return {
    audio: audio,
    dial: createDialModel(audio),
  };
}
