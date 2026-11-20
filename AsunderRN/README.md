# Asunder RN

The same radio as the Swift app, written in React Native (TypeScript) so one set of code runs on iPhone, on Android, and in a web browser. iPhone and Android are the product. The web version is a quick preview.

The Swift app (`../Asunder`, `../AsunderCore`) is still in the repo, untouched, so you can run the two side by side.

## Before anything: put Node on your PATH

Every command below needs Node.js (the program that runs JavaScript tools). It is installed at `~/.local/node/bin`, but your terminal doesn't know to look there yet.

For one terminal window, paste this first:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```

To make it permanent, add that same line to the end of the file `~/.zshrc` (open it with `open -e ~/.zshrc`), save, and open a new terminal window. Check it worked:

```bash
node --version
```

It should print `v24` and some more numbers.

All commands on this page are run from inside the `AsunderRN` folder:

```bash
cd AsunderRN
```

The first time (and whenever `package.json` changes), fetch the libraries:

```bash
npm install
```

## Run it in a web browser (quickest)

```bash
npm run web
```

A browser tab opens. Click or tap the wheel once to start the sound (browsers don't let a page make noise until you touch it). Drag the wheel sideways to tune.

The web version is a preview: it has no haptics, no lock-screen controls, and its sound runs in an older, simpler way than on a phone. Use it to look at layout and try the dial, not to judge the sound.

## Run it on the iPhone simulator

You need Xcode installed. The first time, also fetch CocoaPods (the tool that links the native iPhone libraries):

```bash
bundle config set --local path vendor/bundle
```

```bash
bundle install
```

Then build and launch:

```bash
npx expo run:ios --device "iPhone 17"
```

The first build takes a long time (it downloads about 400 MB of prebuilt native libraries, which took about 20 minutes here, and compiles them). Later builds are much faster. When it finishes, the simulator opens the app and this terminal keeps running: it is now the "bundler", the thing that feeds your code to the app. Leave it open while you work.

Two harmless surprises:
- The command can end with an error about `osascript` or "System Events". That is only Expo trying to bring the Simulator window to the front without permission. The build itself worked; switch to the Simulator yourself.
- The very first touch after the app opens may go to the developer menu's one-time hint instead of the wheel. Touch again.

This is a Debug build: it loads your code from the bundler and is slower. To try the build that would ship (no bundler, code compiled in):

```bash
npx expo run:ios --configuration Release --device "iPhone 17" --no-bundler
```

To run on your real iPhone, plug it in and run `npx expo run:ios --device` and pick it from the list. Xcode will need your Apple Developer team for signing: open `ios/AsunderRN.xcworkspace` in Xcode once and set the team under Signing & Capabilities. (The simulator can't do haptics, and background audio only means something on a real phone.)

## Run it on Android

Not possible on this Mac yet: it needs Android Studio and the Android SDK, which aren't installed. **The Android version has never been built or run.** Once the SDK is installed the command is:

```bash
npx expo run:android
```

## Run the tests

```bash
npm test
```

This runs the same tests the Swift core has, ported one for one, plus `SwiftParity`, which checks the TypeScript core against numbers written out by the real Swift code (`src/core/__tests__/fixtures/swift-golden.json`).

To check the types (catches typos and wrong arguments without running anything):

```bash
npm run typecheck
```

## What has been checked, and what hasn't (Nov 19)

Checked:
- `npm run typecheck` is clean. `npm test`: 13 suites, 225 tests pass, 1 is a `todo` (a Swift test that never really tested anything; it needs your decision).
- iPhone 17 simulator, Debug and Release: the app opens with no error screen and the layout matches the web version. A flick coasts and slows; a slow drag follows the finger.
- The audio thread runs our sound code all the time, and a temporary loudness meter (now removed) showed real sound coming out at 48 kHz.
- Audio CPU on the simulator: about 23–24% of one Mac core in Release (Swift's sound code: about 0.14%), measured Nov 19. The Nov 20 speed-ups should bring that down a lot (about 2.3 times on a computer) but haven't been measured on the simulator yet. The full numbers and what they mean are in `docs/Build Foundation.md`, section 3.

Not checked yet:
- **Nobody has listened to it.** The sound was measured, not heard.
- Haptics: built into the app, but the simulator can't play them. The feel of the ticks is untested.
- Anything on a real iPhone: CPU and battery, background and lock-screen audio, phone-call interruptions, unplugging headphones.
- Android: never built or run (no Android SDK on this Mac).
- The `rn-tests` CI job has not run yet (it runs on the first push).

## Changing how it feels: `Tuning.ts`

Every feel number is in one file: [`src/core/Tuning.ts`](src/core/Tuning.ts). Each one has a comment saying what turning it up or down does.

After you save a change, do a **full reload**: click on the terminal where the bundler is running and press `r`.

Why not just save? Normally the app refreshes itself when you save a file, and that is enough for layout and colors. But the radio is built once when the app opens and kept running, and the audio thread took its own copy of the Tuning numbers at that moment. A normal refresh doesn't replace that copy, so a changed sound number (static volume and color, the filter, the Carrier, fades) would silently do nothing. Pressing `r` restarts the app's code from scratch, which is always right. Make it a habit after any Tuning change.

### One catch: the Swift comparison test

`SwiftParity` checks that `Tuning.ts` has the same numbers as `Tuning.swift`, and that the sound and the dial come out the same. So when you change a number in `Tuning.ts`, that test fails until the Swift side matches. That is the test doing its job, not a bug. To bring them back in line, make the same change in `../AsunderCore/Sources/AsunderCore/Tuning.swift`, then regenerate the saved numbers:

```bash
npm run golden
```

All the other tests still tell you whether you broke something.

## Where things are

```
App.tsx               The top of the app. Makes the bench once and shows the screen.
src/core/             The pure logic, ported file for file from AsunderCore (Swift).
  Tuning.ts           Every feel number.
  World.ts            The shared world's numbers (don't change these to tune feel).
  __tests__/          The tests.
src/dial/             The dial: its live model, the touch handling, the wheel and scale drawings.
src/audio/            The radio's sound. ReceiverAudio.native.ts is phones, .web.ts is the browser.
src/haptics/          Ticks and the lock pulse.
src/ContentView.tsx   The screen layout (placeholder until the look phase).
modules/asunder-haptics/   Our own small native module: Core Haptics on iPhone, the vibrator on Android.
plugins/              Small build fixes applied when Expo generates the ios/ folder.
tools/swift-golden/   The Swift program behind `npm run golden`.
ios/, android/        Generated by Expo. Not kept in git. Don't edit by hand.
```

Two rules for `src/core` that are easy to trip over:

1. Every file there starts with `'worklet';`. That line lets the code run on the audio thread and the screen thread as well as the normal one. Because of how that works, **a helper function has to be written above the first place it is used** in the file. If you put it below, everything still works on your Mac's tests of the maths, but the phone app breaks. One test (`DeclarationOrder`) exists just to catch this, so run `npm test` after moving code around.
2. Nothing in `src/core` may import React, React Native or any library. It is plain arithmetic, so the tests can run anywhere.
