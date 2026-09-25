import { Tabs } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: COLORS.primary,
        },
        headerTintColor: COLORS.surface,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.text.secondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
        },
      }}
    >
      <Tabs.Screen
        name="home/index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="temple/index"
        options={{
          title: 'Temple',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="temple-hindu" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sevas/index"
        options={{
          title: 'Sevas',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="hands-pray" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events/index"
        options={{
          title: 'Events',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="calendar-month" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="gallery/index"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="image-multiple" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai/index"
        options={{
          title: 'Raya AI',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="robot" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => <MaterialCommunityIcons name="menu" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
