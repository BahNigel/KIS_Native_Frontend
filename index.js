/**
 * @format
 */
// index.js
import { AppRegistry, View } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

function Root() {
  return (
    <View style={{ marginTop: 40, flex: 1 }}>
      <App />
    </View>
  );
}

AppRegistry.registerComponent(appName, () => Root);
