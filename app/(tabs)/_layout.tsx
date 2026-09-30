import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#1e293b',
          borderTopColor: '#334155',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#64748b',
        headerStyle: {
          backgroundColor: '#1e293b',
        },
        headerTintColor: '#f1f5f9',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Conexión',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bluetooth" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="raw-eeg"
        options={{
          title: 'EEG',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="pulse" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="brainwaves"
        options={{
          title: 'Ondas',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bar-chart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="recordings"
        options={{
          title: 'Grabaciones',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
