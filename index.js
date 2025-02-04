import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';
import { enableScreens } from 'react-native-screens';
import { LogBox } from 'react-native';

// Enable screens before any navigation stacks
enableScreens(true);

// Ignore specific warnings
LogBox.ignoreLogs([
  'Warning: Cannot update a component',
  'Non-serializable values were found in the navigation state',
]);

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
