import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { loadUserProfile } from '../src/services/StorageService'; // 경로 수정 필요할 수 있음

/**
 * @file app/index.tsx
 * @description Uygulamanın başlangıç noktası.
 * Kullanıcının yerel depolamada kayıtlı bir profili olup olmadığını kontrol eder.
 * Profil varsa (tabs) ekran grubuna, yoksa (auth)/profileSetup ekranına yönlendirir.
 */
export default function AppRoot() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userProfileExists, setUserProfileExists] = useState(false);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const profile = await loadUserProfile();
        if (profile) {
          setUserProfileExists(true);
        } else {
          setUserProfileExists(false);
        }
      } catch (error) {
        console.error("Profil kontrolü sırasında hata:", error);
        setUserProfileExists(false); // Hata durumunda da profil yokmuş gibi davran
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
        <Text>Yükleniyor...</Text>
      </View>
    );
  }

  if (userProfileExists) {
    // Kullanıcı profili var, ana sekmelere yönlendir
    return <Redirect href="/(tabs)/chatList" />;
  } else {
    // Kullanıcı profili yok, profil oluşturma ekranına yönlendir
    return <Redirect href="/(auth)/profileSetup" />;
  }
}
