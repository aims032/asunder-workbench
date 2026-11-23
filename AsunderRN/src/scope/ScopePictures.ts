import { Image } from 'react-native';

// THE SCOPE'S PICTURES: which picture each phone line carries, and the
// pictures Asunder can show when she takes the screen over.
//
// ALL PLACEHOLDERS. Each line's real picture is Evan's footage of that place
// in the mill ([SCENE FEED: Evan]). To swap one in, put the file in
// assets/scope/ and change its line below:
//   - a photo (PNG or JPG):        { kind: 'image', file: require('...') }
//   - a video clip (MP4 or MOV):   { kind: 'video', file: require('...') }
// Clips loop with their sound off. Phone clips and Apple Motion exports
// (H.264 or HEVC) both work; ProRes is too big for a phone app, so export
// Motion clips as H.264 or HEVC.
//
// `require(...)` is how React Native bundles a file into the app.

/** One picture: a still or a moving one. */
export type ScopePicture =
  | { kind: 'image'; file: number }
  | { kind: 'video'; file: number };

/** The picture each phone line carries (key = the line's jack name). */
export const LINE_PICTURES: Record<string, ScopePicture> = {
  'line-1': { kind: 'image', file: require('../../assets/scope/placeholder-line-1.png') },
  'line-2': { kind: 'video', file: require('../../assets/scope/placeholder-line-2.mp4') },
  'line-3': { kind: 'image', file: require('../../assets/scope/placeholder-line-3.png') },
  'line-4': { kind: 'image', file: require('../../assets/scope/placeholder-line-4.png') },
  'line-5': { kind: 'image', file: require('../../assets/scope/placeholder-line-5.png') },
  'line-6': { kind: 'image', file: require('../../assets/scope/placeholder-line-6.png') },
};

/**
 * The pictures Asunder can show (key = the `picture` name in a
 * ScopeOverride, see core/Scope.ts). Keep these small, like 64 x 48: each
 * pixel of the file becomes one big crisp square on the scope.
 */
export const OVERRIDE_PICTURES: Record<string, number> = {
  placeholder: require('../../assets/scope/placeholder-override.png'),
};

/**
 * Where a bundled file lives, as an address the video player can open.
 * (Pictures don't need this: useImage takes the require() directly.)
 */
export function bundledFileUri(file: number): string | null {
  // On the web a bundled file is already an address; on phones, ask React Native.
  const asAny = file as unknown;
  if (typeof asAny === 'string') {
    return asAny;
  }
  if (asAny && typeof asAny === 'object' && 'uri' in asAny) {
    return String((asAny as { uri: string }).uri);
  }
  return Image.resolveAssetSource(file)?.uri ?? null;
}
