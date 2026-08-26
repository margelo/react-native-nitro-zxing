import {
  createStaticNavigation,
  type StaticParamList,
} from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { VisionCamera } from 'react-native-vision-camera'
import { BenchmarkScreen } from './screens/BenchmarkScreen'
import { PermissionsScreen } from './screens/PermissionsScreen'
import { ScanScreen } from './screens/ScanScreen'

const RootStack = createNativeStackNavigator({
  initialRouteName:
    VisionCamera.cameraPermissionStatus === 'authorized'
      ? 'Scan'
      : 'Permissions',
  screens: {
    Permissions: PermissionsScreen,
    Scan: {
      screen: ScanScreen,
      options: {
        orientation: 'portrait_up',
      },
    },
    Benchmark: {
      screen: BenchmarkScreen,
      options: {
        orientation: 'portrait_up',
      },
    },
  },
  screenOptions: {
    navigationBarHidden: true,
    headerShown: false,
    contentStyle: {
      backgroundColor: 'black',
    },
  },
})

type RootStackParamList = StaticParamList<typeof RootStack>

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

const Navigation = createStaticNavigation(RootStack)

function App() {
  return <Navigation />
}

export default App
