// A BUILD FIX, not app code. You should never need to change this.
//
// The problem it solves: the sound library that runs our code on the audio
// thread (react-native-audio-worklets) refuses to install on iOS unless a
// setting called RCT_NEW_ARCH_ENABLED is "1". React Native 0.88 always turns
// that setting on, but only AFTER the libraries have been checked, so the
// install fails with "requires React Native New Architecture".
//
// The fix: write the setting at the very top of the iOS Podfile (the list of
// native libraries), before anything is checked. The ios/ folder is generated,
// so the line is added by this "config plugin" every time Expo generates it.
// It is switched on in app.json, under "plugins".
const { withPodfile } = require('expo/config-plugins');

const LINE = "ENV['RCT_NEW_ARCH_ENABLED'] = '1' # added by plugins/withNewArchFlag.js";

module.exports = function withNewArchFlag(config) {
  return withPodfile(config, (podfile) => {
    // Add the line once, even if Expo runs this plugin again.
    if (!podfile.modResults.contents.includes(LINE)) {
      podfile.modResults.contents = LINE + '\n' + podfile.modResults.contents;
    }
    return podfile;
  });
};
