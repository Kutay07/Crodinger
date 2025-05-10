import React, { useState, useRef } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { checkUsernameExists, createUserProfile } from '../../src/services/FirebaseService';
import { generateKeyPair } from '../../src/services/CryptoService';
import { saveUserProfile, UserProfile } from '../../src/services/StorageService';
import CameraComponent from '../../src/components/CameraComponent';

/**
 * @file app/(auth)/profileSetup.tsx
 * @description Kullanıcının ilk defa profil oluşturacağı ekran.
 * Kullanıcıdan bir kullanıcı adı alır, fotoğrafın amacını açıklar, kamera ile fotoğraf çektirir,
 * çekilen fotoğrafı onaylatır, bu fotoğrafı kullanarak anahtar çifti üretir (CryptoService),
 * kullanıcı adının benzersizliğini kontrol eder (FirebaseService),
 * ve bilgileri hem Firebase'e hem de yerel depolamaya kaydeder.
 */
export default function ProfileSetupScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [setupStep, setSetupStep] = useState<'username' | 'photoInfo' | 'camera' | 'photoPreview' | 'processing'>('username');

  /**
   * Kullanıcı adı kontrolünü yaparak fotoğraf bilgilendirme adımına geçer
   */
  const handleUsernameStep = async () => {
    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      Alert.alert('Geçersiz Kullanıcı Adı', 'Kullanıcı adı en az 3 karakter olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      const usernameTaken = await checkUsernameExists(trimmedUsername);
      if (usernameTaken) {
        Alert.alert('Kullanıcı Adı Alınmış', 'Bu kullanıcı adı zaten kullanılıyor. Lütfen farklı bir kullanıcı adı seçin.');
        return;
      }
      // İleri git: Fotoğraf bilgilendirme adımına
      setSetupStep('photoInfo');
    } catch (error) {
      console.error("Kullanıcı adı kontrolü sırasında hata:", error);
      Alert.alert('İşlem Başarısız', 'Kullanıcı adı kontrol edilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fotoğraf bilgilendirme adımından kamera adımına geçer.
   */
  const handlePhotoInfoStep = () => {
    setSetupStep('camera');
  };

  /**
   * Fotoğraf çekildiğinde çağrılır ve fotoğraf önizleme adımına geçer.
   */
  const handlePhotoCapture = (photoUri: string) => {
    setPhoto(photoUri);
    setSetupStep('photoPreview');
  };

  /**
   * Kullanıcı çekilen fotoğrafı onayladığında profili oluşturur.
   */
  const handleConfirmPhoto = async () => {
    if (!photo) {
      Alert.alert('Hata', 'Onaylanacak bir fotoğraf bulunamadı.');
      setSetupStep('photoInfo'); // Geri dön
      return;
    }
    setSetupStep('processing'); // İşlem adımına geç
    setLoading(true);
    try {
      const { publicKey, privateKey } = await generateKeyPair(photo, username);
      await createUserProfile(username, publicKey);
      const profileToSave: UserProfile = { username, publicKey, privateKey };
      await saveUserProfile(profileToSave);
      Alert.alert('Profil Oluşturuldu!', 'Hesabınız başarıyla oluşturuldu. Sohbet etmeye başlayabilirsiniz.');
      router.replace('/(tabs)/chatList');
    } catch (error: any) {
      console.error("Profil oluşturma sırasında hata:", error);
      let errorMessage = 'Profil oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.';
      if (error.message && typeof error.message === 'string') {
        if (error.message.includes('network')) {
          errorMessage = 'Ağ bağlantısı hatası. Lütfen internet bağlantınızı kontrol edin.';
        } else if (error.message.includes('permission')) {
          errorMessage = 'İzin hatası. Firestore kurallarınızı kontrol edin.';
        }
      }
      Alert.alert('İşlem Başarısız', errorMessage);
      setSetupStep('username'); // Hata durumunda en başa dön
      setPhoto(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Kullanıcı fotoğrafı yeniden çekmek istediğinde.
   */
  const handleRetakePhoto = () => {
    setPhoto(null);
    setSetupStep('camera');
  };

  if (setupStep === 'camera') {
    return (
      <CameraComponent
        onPhotoCapture={handlePhotoCapture}
        onClose={() => setSetupStep('photoInfo')} // Geri dönülecek adımı güncelle
      />
    );
  }

  return (
    <LinearGradient
      colors={['#113842', '#24768b']} // Example blue gradient
      style={styles.gradientContainer}
    >
      <View style={styles.innerContainer}>
        {setupStep === 'username' && (
          <>
            <Image source={require('../../assets/logo_full_transparent.png')} style={styles.logo} />
            <Text style={styles.title}>Hoş Geldiniz!</Text>
            <Text style={styles.subtitle}>Başlamak için bir kullanıcı adı oluşturun.</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Kullanıcı adınız (en az 3 karakter)"
              placeholderTextColor="#B0BEC5"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleUsernameStep}
              editable={!loading}
            />
            {loading ? (
              <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
            ) : (
              <TouchableOpacity style={styles.button} onPress={handleUsernameStep} disabled={loading || username.trim().length < 3}>
                <Text style={styles.buttonText}>Devam Et</Text>
              </TouchableOpacity>
            )}
          </>
        )}

        {setupStep === 'photoInfo' && (
          <>
            <Text style={styles.title}>Güvenli Anahtarınız İçin Bir Adım Daha</Text>
            <Text style={styles.infoText}>
              Uygulama güvenliğiniz, benzersiz bir fotoğrafınızla oluşturulan kriptografik anahtarlara dayanır.
              Bu fotoğraf hiçbir yerde saklanmaz veya paylaşılmaz; yalnızca size özel anahtarların üretilmesi için kullanılır.
              Lütfen net bir fotoğraf çekin.
            </Text>
            <TouchableOpacity style={styles.button} onPress={handlePhotoInfoStep}>
              <Text style={styles.buttonText}>Kamerayı Aç</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.backButton]} onPress={() => setSetupStep('username')}>
              <Text style={styles.buttonText}>Geri Dön</Text>
            </TouchableOpacity>
          </>
        )}

        {setupStep === 'photoPreview' && photo && (
          <>
            <Text style={styles.title}>Fotoğrafınızı Onaylayın</Text>
            <Image source={{ uri: photo }} style={styles.photoPreview} />
            <TouchableOpacity style={styles.button} onPress={handleConfirmPhoto}>
              <Text style={styles.buttonText}>Bu Fotoğrafı Kullan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.retakeButton]} onPress={handleRetakePhoto}>
              <Text style={styles.buttonText}>Yeniden Çek</Text>
            </TouchableOpacity>
          </>
        )}

        {setupStep === 'processing' && (
          <View style={styles.processingContainer}>
            <Text style={styles.processingText}>
              Fotoğrafınız işleniyor ve güvenli anahtarlarınız oluşturuluyor...
            </Text>
            {photo && ( // Still show photo during processing for context
              <Image source={{ uri: photo }} style={styles.photoPreviewSmall} />
            )}
            <ActivityIndicator size="large" color="#FFFFFF" style={styles.loader} />
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: { // Added for gradient
    flex: 1,
  },
  innerContainer: { // Renamed from container
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center', // Center content
    padding: 30, // Increased padding
  },
  title: {
    fontSize: 28, // Increased size
    fontWeight: 'bold', // Bolder
    textAlign: 'center',
    marginBottom: 20,
    color: '#FFFFFF', // White text for gradient
  },
  subtitle: {
    fontSize: 18, // Increased size
    textAlign: 'center',
    marginBottom: 30,
    color: '#E0E0E0', // Lighter white
  },
  input: {
    width: '100%', // Full width
    borderWidth: 1,
    borderColor: '#B0BEC5', // Lighter border
    backgroundColor: 'rgba(255, 255, 255, 0.1)', // Slightly transparent white
    paddingHorizontal: 20, // Increased padding
    paddingVertical: 15, // Increased padding
    fontSize: 16,
    borderRadius: 10, // More rounded
    marginBottom: 25,
    color: '#FFFFFF', // White text
  },
  loader: {
    marginTop: 20,
  },
  button: { // New button style
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25, // Pill shape
    alignItems: 'center',
    justifyContent: 'center',
    width: '80%', // Responsive width
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: { // New button text style
    color: '#113842',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: 'transparent',
    borderColor: '#FFFFFF',
    borderWidth: 1,
  },
  // backButtonText: { // If specific text style needed for back button
  //   color: '#FFFFFF',
  // },
  retakeButton: { // Style for retake button
    backgroundColor: '#FF6B6B', // A contrasting color like coral/red
  },
  // retakeButtonText: { // If specific text style needed for retake button
  //    color: '#FFFFFF',
  // },
  infoText: { // For the photo information step
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#E0E0E0',
    lineHeight: 24, // Better readability
  },
  photoPreview: {
    width: 250, // Larger preview
    height: 250,
    borderRadius: 15, // More rounded
    marginBottom: 30,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  photoPreviewSmall: { // For processing screen
    width: 150,
    height: 150,
    borderRadius: 10,
    marginBottom: 20,
  },
  processingContainer: {
    alignItems: 'center',
  },
  processingText: {
    fontSize: 18, // Larger text
    textAlign: 'center',
    marginBottom: 20,
    color: '#E0E0E0',
  },
  logo: {
    width: "100%",
    height: 200,
    marginBottom: 20,
  },
}); 