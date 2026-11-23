// THE SCOPE'S PICTURES: which picture each phone line carries, and the
// pictures Asunder can show when she takes the screen over.
//
// ALL PLACEHOLDERS. Each line's real picture is Evan's footage of that place
// in the mill ([SCENE FEED: Evan]). To swap one in, put the file in
// assets/scope/ and change its line below. Photos (PNG or JPG) work now;
// video clips and vector art come next.
//
// `require(...)` is how React Native bundles a file into the app.

/** The picture each phone line carries (key = the line's jack name). */
export const LINE_PICTURES: Record<string, number> = {
  'line-1': require('../../assets/scope/placeholder-line-1.png'),
  'line-2': require('../../assets/scope/placeholder-line-2.png'),
  'line-3': require('../../assets/scope/placeholder-line-3.png'),
  'line-4': require('../../assets/scope/placeholder-line-4.png'),
  'line-5': require('../../assets/scope/placeholder-line-5.png'),
  'line-6': require('../../assets/scope/placeholder-line-6.png'),
};

/**
 * The pictures Asunder can show (key = the `picture` name in a
 * ScopeOverride, see core/Scope.ts). Keep these small, like 64 x 48: each
 * pixel of the file becomes one big crisp square on the scope.
 */
export const OVERRIDE_PICTURES: Record<string, number> = {
  placeholder: require('../../assets/scope/placeholder-override.png'),
};
