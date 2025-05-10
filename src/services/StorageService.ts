import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * @file StorageService.ts
 * @description Kullanıcı profili gibi verileri cihazın yerel depolamasında (AsyncStorage) saklamak ve yüklemek için servis.
 */

const USER_PROFILE_KEY = 'userProfile';

export interface UserProfile {
  username: string;
  publicKey: string;
  privateKey: string;
}

/**
 * Kullanıcının profilini (username, publicKey, privateKey) AsyncStorage'a kaydeder.
 * @async
 * @param {UserProfile} profile Kaydedilecek kullanıcı profili.
 * @returns {Promise<void>} Kaydetme işlemi tamamlandığında çözülen bir promise döner.
 */
export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(profile);
    await AsyncStorage.setItem(USER_PROFILE_KEY, jsonValue);
    console.log('Kullanıcı profili başarıyla kaydedildi.');
  } catch (e) {
    console.error('Kullanıcı profili kaydedilirken hata oluştu:', e);
    // Hata yönetimi burada yapılabilir, örneğin kullanıcıya bildirim gösterme
    throw e; // veya hatayı yukarıya fırlat
  }
};

/**
 * Kullanıcının profilini AsyncStorage'dan yükler.
 * @async
 * @returns {Promise<UserProfile | null>} Yüklenen kullanıcı profilini veya profil bulunamazsa null değerini içeren bir promise döner.
 */
export const loadUserProfile = async (): Promise<UserProfile | null> => {
  try {
    const jsonValue = await AsyncStorage.getItem(USER_PROFILE_KEY);
    if (jsonValue != null) {
      const profile: UserProfile = JSON.parse(jsonValue);
      console.log('Kullanıcı profili başarıyla yüklendi.');
      return profile;
    } else {
      console.log('Kaydedilmiş kullanıcı profili bulunamadı.');
      return null;
    }
  } catch (e) {
    console.error('Kullanıcı profili yüklenirken hata oluştu:', e);
    return null; // veya hatayı yukarıya fırlat
  }
};

/**
 * Kullanıcının profilini AsyncStorage'dan siler.
 * Bu fonksiyon genellikle test veya hesap sıfırlama işlemleri için kullanılır.
 * @async
 * @returns {Promise<void>} Silme işlemi tamamlandığında çözülen bir promise döner.
 */
export const clearUserProfile = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(USER_PROFILE_KEY);
    console.log('Kullanıcı profili başarıyla silindi.');
  } catch (e) {
    console.error('Kullanıcı profili silinirken hata oluştu:', e);
    // Hata yönetimi
    throw e;
  }
};
