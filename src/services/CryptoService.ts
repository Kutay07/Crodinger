/**
 * @file CryptoService.ts
 * @description Şifreleme ve şifre çözme işlemleri için servis.
 * Kullanıcı fotoğrafından benzersiz kriptografik anahtar çiftleri üretme,
 * mesaj şifreleme ve mesaj çözme fonksiyonlarını içerir.
 */

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Buffer } from 'buffer';
import {
  CameraView,
  CameraCapturedPicture,
  CameraType,
  useCameraPermissions,
  Camera,
} from 'expo-camera';

// Opsiyonel EC kütüphanesi, kurulması gerekiyor
import { ec as EC } from 'elliptic';

// Secure Store için anahtar sabitleri
const PRIVATE_KEY_STORAGE_KEY = 'SafeZone_PRIVATE_KEY';
const PUBLIC_KEY_STORAGE_KEY = 'SafeZone_PUBLIC_KEY';
const USERNAME_STORAGE_KEY = 'SafeZone_USERNAME';

// p256 eğrisini kullanıyoruz (daha hızlı ve mobil cihazlar için optimize)
const ec = new EC('p256');

/**
 * Kamera ile ilgili yardımcı fonksiyonlar
 */
export const CameraHelper = {
  /**
   * Kamera izinlerini kontrol eder
   * @returns {Promise<boolean>} Kamera izni verilip verilmediği
   */
  requestPermissions: async (): Promise<boolean> => {
    try {
      // Camera sınıfı üzerinden izin istiyoruz
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Kamera izini isteme hatası:', error);
      return false;
    }
  },

  /**
   * Ön kamerayı kullanarak bir fotoğraf çeker
   * @param {React.RefObject<CameraView | null>} cameraRef - Kamera referansı
   * @returns {Promise<CameraCapturedPicture | null>} Çekilen fotoğraf
   */
  takeFrontCameraPhoto: async (
    cameraRef: React.RefObject<CameraView | null>
  ): Promise<CameraCapturedPicture | null> => {
    try {
      if (!cameraRef.current) return null;

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        exif: false,
      });

      return photo;
    } catch (error) {
      console.error('Fotoğraf çekme hatası:', error);
      return null;
    }
  },
};

/**
 * Kamera ile çekilen fotoğraftan bit dizisi çıkarır (en az 66 bit uzunluğunda)
 * @param {string} photoUri Fotoğrafın URI'si
 * @returns {Promise<string>} Çıkarılan bit dizisi
 */
const extractBitsFromPhoto = async (photoUri: string): Promise<string> => {
  try {
    // Base64 formatında fotoğraf verisini oku
    let base64Data = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Hash işlemi uygula
    const hashData = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Data
    );

    // Hash'i bit dizisine çevir (en az 66 bit)
    let bits = '';
    for (let i = 0; i < 33 && i < hashData.length / 2; i++) {
      // Her hex karakterini 4 bite çevir
      const hexChar = hashData.charAt(i);
      const decimal = parseInt(hexChar, 16);
      const binary = decimal.toString(2).padStart(4, '0');
      bits += binary.slice(0, 2); // Her hex karakterinden 2 bit al
    }

    // Toplam en az 66 bit olmasını sağla
    return bits.padEnd(66, '0');
  } catch (error) {
    console.error('Fotoğraftan bit çıkarma sırasında hata:', error);
    throw error;
  }
};

/**
 * Fotoğrafı işleyerek normalize eden fonksiyon
 * @param {string} photoUri Fotoğrafın URI'si
 * @returns {Promise<string>} İşlenmiş fotoğrafın URI'si
 */
const processPhoto = async (photoUri: string): Promise<string> => {
  try {
    // Fotoğrafı işle ve normalize et (boyutlandır)
    const processedPhoto = await manipulateAsync(
      photoUri,
      [{ resize: { width: 256, height: 256 } }],
      { format: SaveFormat.PNG }
    );

    return processedPhoto.uri;
  } catch (error) {
    console.error('Fotoğraf işleme sırasında hata:', error);
    throw error;
  }
};

/**
 * Yeni bir Elliptic Curve anahtar çifti (public ve private) üretir.
 * Kullanıcının çektiği fotoğraftan entropy kaynağı olarak yararlanır.
 * @async
 * @param {string} photoUri Kullanıcının çektiği fotoğrafın URI'si
 * @param {string} username Kullanıcının adı (ek entropy için)
 * @returns {Promise<{ publicKey: string, privateKey: string }>} Üretilen public ve private anahtar çiftini içeren bir promise döner.
 */
export const generateKeyPair = async (
  photoUri: string,
  username: string
): Promise<{ publicKey: string; privateKey: string }> => {
  try {
    // 1. Fotoğrafı işle
    const processedPhotoUri = await processPhoto(photoUri);

    // 2. Fotoğraftan bit dizisi çıkar
    const bitString = await extractBitsFromPhoto(processedPhotoUri);

    // 3. Bit dizisine kullanıcı adını ekleyerek entropy'i artır
    const saltedBits =
      bitString + (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, username));

    // 4. Salted diziden hash oluştur (private key temeli)
    const privateKeyBase = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      saltedBits
    );

    // 5. Elliptic Curve (ECC) anahtarı oluştur
    const keyPair = ec.keyFromPrivate(privateKeyBase, 'hex');

    // Önemli: Anahtarları tutarlı formatta üretip sakla
    const privateKeyHex = keyPair.getPrivate('hex');

    // PublicKey'i hex formatında sakla (en uyumlu format)
    const publicKeyHex = keyPair.getPublic('hex');

    console.log('Anahtar çifti başarıyla oluşturuldu:');
    console.log('- Public key formatı (hex):', publicKeyHex.substring(0, 20) + '...');
    console.log('- Private key formatı (hex):', privateKeyHex.substring(0, 10) + '...');

    // 6. Oluşturulan anahtarları SecureStore'a kaydet
    await SecureStore.setItemAsync(PRIVATE_KEY_STORAGE_KEY, privateKeyHex);
    await SecureStore.setItemAsync(PUBLIC_KEY_STORAGE_KEY, publicKeyHex);
    await SecureStore.setItemAsync(USERNAME_STORAGE_KEY, username);

    console.log('Anahtarlar başarıyla oluşturuldu ve kaydedildi');

    return {
      publicKey: publicKeyHex,
      privateKey: privateKeyHex,
    };
  } catch (error: any) {
    console.error('Anahtar üretimi sırasında hata:', error);
    console.error('Hata detayı:', error.message);
    throw error;
  }
};

/**
 * Kullanıcının anahtarları daha önce oluşturulup kaydedilmiş mi kontrol eder
 * @returns {Promise<boolean>} Anahtarlar varsa true, yoksa false döner
 */
export const hasStoredKeys = async (): Promise<boolean> => {
  try {
    const publicKey = await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
    const privateKey = await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
    return !!(publicKey && privateKey);
  } catch (error) {
    console.error('Anahtar kontrolü sırasında hata:', error);
    return false;
  }
};

/**
 * Kaydedilmiş kullanıcı adını döndürür
 * @returns {Promise<string | null>} Kullanıcı adı veya null
 */
export const getStoredUsername = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(USERNAME_STORAGE_KEY);
  } catch (error) {
    console.error('Kullanıcı adı alma sırasında hata:', error);
    return null;
  }
};

/**
 * Kaydedilmiş public key'i döndürür
 * @returns {Promise<string | null>} Public key veya null
 */
export const getStoredPublicKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(PUBLIC_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Public key alma sırasında hata:', error);
    return null;
  }
};

/**
 * Kaydedilmiş private key'i döndürür
 * @returns {Promise<string | null>} Private key veya null
 */
const getStoredPrivateKey = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync(PRIVATE_KEY_STORAGE_KEY);
  } catch (error) {
    console.error('Private key alma sırasında hata:', error);
    return null;
  }
};

/**
 * Verilen bir mesajı alıcının public anahtarı ile şifreler.
 * NOT: Gerçek şifreleme yerine geçici olarak basit bir Base64 kodlama kullanılıyor.
 * @async
 * @param {string} message Şifrelenecek orijinal mesaj.
 * @param {string} recipientPublicKey Alıcının public anahtarı (şu an için kullanılmıyor).
 * @returns {Promise<string>} Şifrelenmiş mesajı içeren bir promise döner.
 */
export const encryptMessage = async (
  message: string,
  recipientPublicKey: string
): Promise<string> => {
  try {
    console.log('Basit şifreleme (Base64) kullanılıyor (geçici çözüm)');

    // Veriyi hazırla (mesaj ve zaman damgası)
    const dataToEncrypt = JSON.stringify({
      content: message,
      timestamp: Date.now(),
      // Gerçek şifrelemede kullanılacak bilgileri ekle (ileride kullanılmak üzere)
      meta: {
        type: 'temporary-base64',
        recipientPublicKey: recipientPublicKey.substring(0, 10) + '...',
      },
    });

    // Base64 formatına çevir
    const base64Encoded = Buffer.from(dataToEncrypt).toString('base64');

    return base64Encoded;
  } catch (error: any) {
    console.error('Şifreleme sırasında hata:', error);
    console.error('Hata detayı:', error.message);
    // Hata durumunda bile çalışmaya devam et - basit bir string döndür
    return Buffer.from(`error_message_${message}_${Date.now()}`).toString('base64');
  }
};

/**
 * Şifrelenmiş bir mesajı kullanıcının private anahtarı ile çözer.
 * NOT: Gerçek çözme yerine geçici olarak basit bir Base64 çözme kullanılıyor.
 * @async
 * @param {string} encryptedPackage Çözülecek şifreli mesaj paketi.
 * @returns {Promise<string>} Çözülmüş orijinal mesajı içeren bir promise döner.
 */
export const decryptMessage = async (encryptedPackage: string): Promise<string> => {
  try {
    console.log('Basit çözme (Base64) kullanılıyor (geçici çözüm)');

    // Base64'ten çöz
    const decodedJSON = Buffer.from(encryptedPackage, 'base64').toString('utf-8');

    try {
      // JSON parse
      const decoded = JSON.parse(decodedJSON);

      // İçerik varsa döndür
      if (decoded.content) {
        return decoded.content;
      }

      // İçerik yoksa ham veriyi döndür
      return decodedJSON;
    } catch (parseError) {
      // JSON parse hatası olursa ham veriyi döndür
      return decodedJSON;
    }
  } catch (error: any) {
    console.error('Çözme sırasında hata:', error);
    console.error('Hata detayı:', error.message);

    // Hata durumunda bile bir şeyler döndür
    return '[Çözülemeyen mesaj]';
  }
};
