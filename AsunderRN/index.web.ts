// APP ENTRY POINT (web browsers).
//
// The drawing library (Skia) is a separate file the browser has to download
// first (public/canvaskit.wasm), so on the web the app waits for that and only
// then loads and shows App.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { registerRootComponent } from 'expo';

LoadSkiaWeb({ locateFile: (file) => `/${file}` }).then(async () => {
  const App = (await import('./App')).default;
  registerRootComponent(App);
});
