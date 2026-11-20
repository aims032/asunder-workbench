// A BUILD FIX, not app code. You should never need to change this.
//
// The problem it solves: Xcode has a build setting called "User Script
// Sandboxing". When it is on, the shell scripts that run during a build may
// only write files they declared in advance. React Native's script that packs
// the JavaScript into the app ("Bundle React Native code and images") writes
// files it has not declared, so the build fails at the very end with
// "Sandbox: bash ... Operation not permitted".
//
// Expo leaves the setting off. It gets turned on if you accept Xcode's
// "Update to recommended settings" prompt, so decline that prompt.
//
// The fix: set it to NO on every build configuration in the Xcode project.
// The ios/ folder is generated, so this "config plugin" does it every time
// Expo generates the folder. It is switched on in app.json, under "plugins".
const { withXcodeProject } = require('expo/config-plugins');

const SETTING = 'ENABLE_USER_SCRIPT_SANDBOXING';

module.exports = function withScriptSandboxOff(config) {
  return withXcodeProject(config, (project) => {
    // Every Debug and Release configuration, for the project and the app.
    const configurations = project.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      // The list also holds plain comment strings; skip those.
      if (entry && typeof entry === 'object' && entry.buildSettings) {
        entry.buildSettings[SETTING] = 'NO';
      }
    }
    return project;
  });
};
