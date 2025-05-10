/**
 * @file CameraComponent.tsx
 * @description Profil kurulumu için kamera bileşeni.
 * Fotoğraf çekme ve izin kontrolü fonksiyonlarını içerir.
 */

import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';

/**
 * CameraComponent prop tipi
 */
interface CameraComponentProps {
  /**
   * Fotoğraf çekildikten sonra çağrılacak olan fonksiyon
   * @param photoUri Çekilen fotoğrafın URI'si
   */
  onPhotoCapture: (photoUri: string) => void;

  /**
   * Kamera kapatıldığında çağrılacak olan fonksiyon
   */
  onClose: () => void;
}

/**
 * Profil fotoğrafı çekmek için kamera bileşeni
 * @param props Bileşen özellikleri
 */
const CameraComponent: React.FC<CameraComponentProps> = ({ onPhotoCapture, onClose }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Kamera izinlerini kontrol et
  React.useEffect(() => {
    (async () => {
      await requestPermission();
    })();
  }, [requestPermission]);

  /**
   * Fotoğraf çeker ve onPhotoCapture callback'ini çağırır
   */
  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          exif: false,
        });
        onPhotoCapture(photo.uri);
      } catch (error) {
        console.error('Fotoğraf çekme hatası:', error);
      }
    }
  };

  // İzin kontrolü
  if (!permission) {
    return <View style={styles.container}><Text>Kamera izinleri kontrol ediliyor...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.warningText}>Kamera izni verilmedi.</Text>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="front"
        ref={cameraRef}
      >
        <View style={styles.controlsContainer}>
          <Text style={styles.cameraText}>
            Profil anahtarlarınızı oluşturmak için fotoğrafınızı çekin
          </Text>

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    padding: 20,
  },
  cameraText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  buttonContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    padding: 10,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
  },
  warningText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
  },
});

export default CameraComponent; 