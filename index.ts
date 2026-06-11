// Polyfill Symbol.asyncIterator for React Native / Hermes (fixes OpenRouter streaming loop error)
if (typeof Symbol.asyncIterator === 'undefined') {
  (Symbol as any).asyncIterator = Symbol.for('Symbol.asyncIterator');
}

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
