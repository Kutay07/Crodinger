import { Stack } from 'expo-router';
import React from 'react';
import { StatusBar } from 'expo-status-bar';

/**
 * @file app/(auth)/_layout.tsx
 * @description Kimlik doğrulama (auth) akışı için layout.
 * Bu layout, kimlik doğrulama ile ilgili ekranları (örn: profil oluşturma) bir Stack Navigator içinde gruplar.
 */
export default function AuthLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="profileSetup" options={{ headerShown: false }} />
        {/* Gelecekte eklenebilecek diğer auth ekranları buraya tanımlanabilir */}
      </Stack>
    </>
  );
} 