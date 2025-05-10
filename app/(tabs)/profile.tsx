import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, StatusBar } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { loadUserProfile, clearUserProfile } from '../../src/services/StorageService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Clipboard from '@react-native-clipboard/clipboard';

/**
 * @file app/(tabs)/profile.tsx
 * @description Kullanıcının profil bilgilerini görüntüleyebileceği ve yönetebileceği ekran.
 * Custom header, kullanıcı bilgileri, anahtar kopyalama ve profil sıfırlama özelliklerini içerir.
 */

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ username: string; publicKey: string; privateKey: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      // Android için StatusBar arka plan rengini ayarla (isteğe bağlı, header ile aynı olabilir)
      StatusBar.setBackgroundColor('#113842', true);
      return () => {
        // İsteğe bağlı: Ekrandan çıkıldığında varsayılan stile dön
        // StatusBar.setBarStyle('default');
        // StatusBar.setBackgroundColor('white', true);
      };
    }, [])
  );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userProfile = await loadUserProfile();
        setProfile(userProfile);
        setLoading(false);
      } catch (error) {
        console.error('Profil yüklenirken hata oluştu:', error);
        Alert.alert('Hata', 'Profil bilgileri yüklenemedi');
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleClearProfile = async () => {
    Alert.alert(
      'Profili Temizle ve Sıfırla',
      'Tüm yerel profil bilgilerinizi silmek ve uygulamayı sıfırlamak istediğinize emin misiniz? Bu işlem geri alınamaz.',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sıfırla',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearUserProfile();
              router.replace('/(auth)/profileSetup');
            } catch (error) {
              console.error('Profil temizlenirken hata oluştu:', error);
              Alert.alert('Hata', 'Profil temizlenirken bir sorun oluştu.');
            }
          },
        },
      ]
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('Kopyalandı', `${label} panoya kopyalandı.`);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#113842" />
        <Text style={styles.loadingText}>Profil yükleniyor...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Profil bilgileri bulunamadı.</Text>
        <TouchableOpacity style={styles.buttonLarge} onPress={() => router.replace('/(auth)/profileSetup')}>
          <Text style={styles.buttonLargeText}>Profil Oluştur</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const getAvatarLetter = () => {
    return profile.username ? profile.username.charAt(0).toUpperCase() : '?';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#113842', '#24768b']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil</Text>
        <View style={{ width: 28 }} />{/* Sağ tarafta boşluk bırakmak için */}
      </LinearGradient>

      <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContentContainer}>
        <View style={styles.profileInfoContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{getAvatarLetter()}</Text>
          </View>
          <Text style={styles.usernameText}>{profile.username}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Kullanıcı Adı</Text>
          <View style={styles.infoRow}>
            <Ionicons name="person-outline" size={24} color="#113842" style={styles.infoIcon} />
            <Text style={styles.infoValue}>{profile.username}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Genel Anahtar (Public Key)</Text>
          <View style={styles.keyContainer}>
            <Ionicons name="key-outline" size={24} color="#113842" style={styles.infoIcon} />
            <Text style={styles.keyValue} numberOfLines={3} ellipsizeMode="middle">
              {profile.publicKey}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.copyButton}
            onPress={() => copyToClipboard(profile.publicKey, 'Genel Anahtar')}
          >
            <Ionicons name="copy-outline" size={20} color="#113842" />
            <Text style={styles.copyButtonText}>Kopyala</Text>
          </TouchableOpacity>
        </View>

        {/* Private Key'i gösterme gereksinimi olmadığı için kaldırıldı. Sadece StorageService'de kullanılır. */}
        {/*
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Özel Anahtar (Private Key)</Text>
          <View style={styles.keyContainer}>
            <Ionicons name="lock-closed-outline" size={24} color="#4A4A4A" style={styles.infoIcon} />
            <Text style={[styles.keyValue, styles.privateKeyText]} numberOfLines={2} ellipsizeMode="middle">
              Bu anahtar gizlidir ve sadece cihazınızda saklanır.
            </Text>
          </View>
           <Text style={styles.securityNote}>Bu anahtar yalnızca cihazınızda saklanır ve uygulamanın düzgün çalışması için gereklidir. Asla kimseyle paylaşmayın.</Text>
        </View>
        */}

        <View style={styles.dangerZone}>
          <TouchableOpacity
            style={[styles.buttonLarge, styles.resetButton]}
            onPress={handleClearProfile}
          >
            <Ionicons name="trash-outline" size={22} color="#ffffff" style={styles.buttonIcon} />
            <Text style={styles.buttonLargeText}>Profili Temizle ve Sıfırla</Text>
          </TouchableOpacity>
          <Text style={styles.resetWarningText}>
            Bu işlem tüm yerel kullanıcı verilerinizi (anahtarlar dahil) silecek ve sizi profil oluşturma ekranına yönlendirecektir.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8', // Açık gri arka plan
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: ((StatusBar.currentHeight || 0) + 1), // StatusBar yüksekliği kadar padding
    paddingBottom: 15,
    paddingHorizontal: 15,
  },
  backButton: {
    padding: 5, // Dokunma alanını genişlet
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f0f4f8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#555',
  },
  errorText: {
    fontSize: 18,
    color: '#d9534f', // Kırmızı tonu
    marginBottom: 20,
    textAlign: 'center',
  },
  profileInfoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#113842',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    elevation: 5, // Android gölge
    shadowColor: '#000', // iOS gölge
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  avatarText: {
    color: 'white',
    fontSize: 60,
    fontWeight: 'bold',
  },
  usernameText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    elevation: 3, // Android gölge
    shadowColor: '#000', // iOS gölge
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#004a99', // Koyu mavi
    marginBottom: 15,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoIcon: {
    marginRight: 12,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    flex: 1, // Text'in sığması için
  },
  keyContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start', // Ikon ve metin üstten hizalı olsun
    marginBottom: 10,
  },
  keyValue: {
    fontSize: 14,
    color: '#555',
    fontFamily: 'monospace', // Anahtarlar için monospace font
    flex: 1,
    lineHeight: 20,
  },
  privateKeyText: {
    color: '#4A4A4A',
    fontStyle: 'italic',
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e7f0f7', // Açık mavi arka plan
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignSelf: 'flex-start', // Butonu sola yasla
    marginTop: 10,
  },
  copyButtonText: {
    color: '#113842',
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '500',
  },
  dangerZone: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fff0f0', // Açık kırmızımsı arka plan
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f5c6cb', // Kırmızımsı border
  },
  resetButton: {
    backgroundColor: '#d9534f', // Kırmızı renk
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: {
    backgroundColor: '#113842',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
    width: '100%', // Butonun genişliği
  },
  buttonLargeText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  buttonIcon: {
    marginRight: 10,
  },
  resetWarningText: {
    fontSize: 13,
    color: '#721c24', // Koyu kırmızı metin
    textAlign: 'center',
    lineHeight: 18,
  },
  // Eski stiller (artık kullanılmayanlar kaldırıldı veya güncellendi)
  // button, buttonText, logoutButton, logoutButtonText, vb. gibi stiller
  // profileHeader, sectionTitle, infoLabel, securityNote gibi eski düzenin stilleri
  // de yeni kart yapısı ve tasarımla değiştirildi/kaldırıldı.
}); 