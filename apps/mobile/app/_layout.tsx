import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';


export default function RootLayout() {
  return (
    <>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sevas/[id]" options={{ presentation: 'modal', title: 'Seva Details' }} />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
