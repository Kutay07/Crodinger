import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
  getDocs,
  serverTimestamp,
  type FirestoreError,
  query,
  where,
  orderBy,
  onSnapshot,
  writeBatch,
} from '@react-native-firebase/firestore';
import {
  FirestoreUser,
  FirestoreUserDocument,
  FirestoreChat,
  FirestoreChatDocument,
  FirestoreMessageDocument,
  FirestoreMessageData,
  EncryptedTextsMap,
} from '../types';

/**
 * @file FirebaseService.ts
 * @description Firestore veritabanı ile etkileşim için servis (Modüler API).
 * Kullanıcı profilleri, sohbetler ve mesajlarla ilgili CRUD (Create, Read, Update, Delete)
 * ve dinleme (streaming) işlemlerini içerir.
 */

const db = getFirestore();
const USERS_COLLECTION = 'users';
const CHATS_COLLECTION = 'chats'; // Faz 3'te kullanılacak

/**
 * Belirtilen kullanıcı adının Firestore 'users' koleksiyonunda zaten var olup olmadığını kontrol eder.
 * @async
 * @param {string} username Kontrol edilecek kullanıcı adı.
 * @returns {Promise<boolean>} Kullanıcı adı varsa `true`, yoksa `false` döner.
 * @throws Firestore hatası durumunda hata fırlatır.
 */
export const checkUsernameExists = async (username: string): Promise<boolean> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, username);
    const userSnap = await getDoc(userRef);
    return userSnap.exists(); // .exists() bir fonksiyondur.
  } catch (error) {
    console.error(`Kullanıcı adı (${username}) kontrol edilirken hata:`, error);
    throw error as FirestoreError;
  }
};

/**
 * Firestore 'users' koleksiyonuna yeni bir kullanıcı profili kaydeder.
 * `username` belge ID'si olarak kullanılır.
 * @async
 * @param {string} username Yeni kullanıcının adı (belge ID'si olacak).
 * @param {string} publicKey Kullanıcının PEM formatındaki public anahtarı.
 * @returns {Promise<void>} Profil başarıyla oluşturulduğunda çözümlenir.
 * @throws Firestore hatası durumunda hata fırlatır.
 */
export const createUserProfile = async (username: string, publicKey: string): Promise<void> => {
  try {
    const userProfileData: FirestoreUser = {
      publicKey,
      createdAt: serverTimestamp() as any, // serverTimestamp() özel bir marker obje döner, cast gerekebilir.
    };
    const userRef = doc(db, USERS_COLLECTION, username);
    await setDoc(userRef, userProfileData);
    console.log(`Kullanıcı profili (${username}) başarıyla oluşturuldu.`);
  } catch (error) {
    console.error(`Kullanıcı profili (${username}) oluşturulurken hata:`, error);
    throw error as FirestoreError;
  }
};

/**
 * Belirtilen kullanıcı adına ait public anahtarı (PEM formatında string) Firestore 'users' koleksiyonundan çeker.
 * @async
 * @param {string} username Public anahtarı alınacak kullanıcının adı.
 * @returns {Promise<string | null>} Kullanıcının public anahtarını veya kullanıcı bulunamazsa `null` döner.
 * @throws Firestore hatası durumunda hata fırlatır.
 */
export const getUserPublicKey = async (username: string): Promise<string | null> => {
  try {
    const userRef = doc(db, USERS_COLLECTION, username);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      // .exists() bir fonksiyondur.
      const userData = userSnap.data() as FirestoreUser;
      return userData.publicKey;
    }
    return null;
  } catch (error) {
    console.error(`Kullanıcı (${username}) public anahtarı alınırken hata:`, error);
    throw error as FirestoreError;
  }
};

/**
 * Firestore 'users' koleksiyonundaki tüm kullanıcıların listesini (belge ID'si olarak username ve diğer alanlar) çeker.
 * @async
 * @returns {Promise<FirestoreUserDocument[]>} Kullanıcıların listesini içeren bir dizi döner. Her kullanıcı `{ username: string, ...FirestoreUser }` formatındadır.
 * @throws Firestore hatası durumunda hata fırlatır.
 */
export const getAllUsers = async (): Promise<FirestoreUserDocument[]> => {
  try {
    const usersCollectionRef = collection(db, USERS_COLLECTION);
    const querySnapshot = await getDocs(usersCollectionRef);
    if (querySnapshot.empty) {
      return [];
    }
    return querySnapshot.docs.map((documentSnapshot) => ({
      username: documentSnapshot.id,
      ...(documentSnapshot.data() as FirestoreUser),
    }));
  } catch (error) {
    console.error('Tüm kullanıcılar alınırken hata:', error);
    throw error as FirestoreError;
  }
};

// --- Faz 3 Fonksiyonları --- (Taslak olarak eklendi, implementasyonları Faz 3'te yapılacak)

/**
 * İki kullanıcı adı için standart bir sohbet ID'si (chatId) oluşturur.
 * Kullanıcı adları alfabetik olarak sıralanır ve aralarına `_` konur.
 * @param {string} user1Username Birinci kullanıcının adı.
 * @param {string} user2Username İkinci kullanıcının adı.
 * @returns {string} Oluşturulan chatId.
 */
export const generateChatId = (user1Username: string, user2Username: string): string => {
  const sortedUsernames = [user1Username, user2Username].sort();
  return sortedUsernames.join('_');
};

/**
 * Verilen iki kullanıcı adı için bir chatId oluşturur veya mevcutsa onu alır.
 * Eğer bu chatId ile Firestore chats koleksiyonunda bir belge yoksa, yeni bir sohbet belgesi oluşturur.
 * @async
 * @param {string} currentUserUsername Mevcut (giriş yapmış) kullanıcının adı.
 * @param {string} otherUserUsername Sohbet başlatılacak diğer kullanıcının adı.
 * @returns {Promise<string>} Sohbetin ID'sini (chatId) döner.
 * @throws Firestore hatası veya diğer hatalar durumunda hata fırlatır.
 */
export const getOrCreateChatId = async (
  currentUserUsername: string,
  otherUserUsername: string
): Promise<string> => {
  const chatId = generateChatId(currentUserUsername, otherUserUsername);
  try {
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);

    if (!chatSnap.exists()) {
      await setDoc(chatRef, {
        participants: [currentUserUsername, otherUserUsername].sort(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        // lastMessage başlangıçta olmayabilir veya boş olabilir
      });
      console.log(
        `Yeni sohbet (${chatId}) oluşturuldu: ${currentUserUsername} ve ${otherUserUsername}`
      );
    }
    return chatId;
  } catch (error) {
    console.error(`Sohbet (${chatId}) alınırken/oluşturulurken hata:`, error);
    throw error as FirestoreError;
  }
};

/**
 * Belirtilen kullanıcının dahil olduğu tüm sohbetleri gerçek zamanlı olarak dinler.
 * Bu fonksiyon, Firestore veritabanındaki sohbetleri kullanıcının adına göre filtreler
 * ve güncellemeleri gerçek zamanlı olarak takip eder.
 *
 * @param {string} username Dinlenecek kullanıcının adı.
 * @param {(chats: FirestoreChatDocument[]) => void} onChatsLoaded Sohbetler yüklendiğinde veya güncellendiğinde çağrılacak callback.
 * @returns {() => void} Dinlemeyi durdurmak için kullanılabilecek bir unsubscribe fonksiyonu.
 */
export const streamChatsForUser = (
  username: string,
  onChatsLoaded: (chats: FirestoreChatDocument[]) => void
): (() => void) => {
  try {
    // 'chats' koleksiyonunda, 'participants' dizisinde username'i içeren sohbetleri sorgula.
    // 'updatedAt' alanına göre azalan sırayla sırala (en yeni sohbet en üstte)
    const chatsRef = collection(db, CHATS_COLLECTION);
    const q = query(
      chatsRef,
      where('participants', 'array-contains', username),
      orderBy('updatedAt', 'desc')
    );

    // Firestore'da gerçek zamanlı dinleme başlat
    // onSnapshot, sorguyla eşleşen belgelerdeki değişiklikleri dinler ve her değişiklikte callback'i çağırır
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // Dinleme başarılı şekilde kuruldu, sonuçları işle
        const chats: FirestoreChatDocument[] = querySnapshot.docs.map((doc) => ({
          id: doc.id, // chatId
          ...(doc.data() as FirestoreChat),
        }));

        console.log(`${username} için ${chats.length} sohbet yüklendi.`);
        // Callback'e sohbetleri gönder
        onChatsLoaded(chats);
      },
      (error) => {
        // Dinleme sırasında bir hata oluştu
        console.error(`Sohbetleri dinlerken hata (${username}):`, error);
        // Hata durumunda boş bir dizi göndermek, UI'ın hata durumunda bile gösterilmesini sağlar
        onChatsLoaded([]);
      }
    );

    // Dinlemeyi durdurmak için kullanılabilecek fonksiyonu döndür
    return unsubscribe;
  } catch (error) {
    // Dinleme başlatma sırasında bir hata oluştu
    console.error(`Sohbet dinleyici oluşturulurken hata (${username}):`, error);
    // Hata durumunda dummy unsubscribe döndür, böylece client kodu hata alıp çökmez
    return () => {};
  }
};

/**
 * Belirli bir sohbetteki mesajları gerçek zamanlı olarak dinler.
 * @param {string} chatId Mesajları dinlenecek sohbetin ID'si.
 * @param {(messages: FirestoreMessageDocument[]) => void} onMessagesLoaded Mesajlar yüklendiğinde veya güncellendiğinde çağrılacak callback.
 * @returns {() => void} Dinlemeyi durdurmak için kullanılabilecek bir unsubscribe fonksiyonu.
 */
export const streamMessagesForChat = (
  chatId: string,
  onMessagesLoaded: (messages: FirestoreMessageDocument[]) => void
): (() => void) => {
  try {
    // Alt koleksiyon: chats/{chatId}/messages
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, 'messages');

    // timestamp alanına göre artan sırada sorgula (eski mesajlar önce)
    const q = query(messagesRef, orderBy('timestamp', 'asc'));

    // Gerçek zamanlı dinleme başlat
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        // Dinleme başarılı, sonuçları işle
        const messages: FirestoreMessageDocument[] = querySnapshot.docs.map((doc) => ({
          id: doc.id, // messageId
          ...(doc.data() as FirestoreMessageData),
        }));

        console.log(`${chatId} sohbeti için ${messages.length} mesaj yüklendi.`);
        // Callback'e mesajları gönder
        onMessagesLoaded(messages);
      },
      (error) => {
        // Dinleme sırasında hata
        console.error(`Mesajları dinlerken hata (${chatId}):`, error);
        // Hata durumunda boş dizi gönder
        onMessagesLoaded([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    // Dinleme başlatma sırasında hata
    console.error(`Mesaj dinleyicisi oluşturulurken hata (${chatId}):`, error);
    // Dummy unsubscribe
    return () => {};
  }
};

/**
 * Belirli bir sohbete yeni bir mesaj gönderir. Mesaj, her bir katılımcı için ayrı ayrı şifrelenmiş olmalıdır.
 * @param {string} chatId Mesajın gönderileceği sohbetin ID'si.
 * @param {string} senderUsername Mesajı gönderen kullanıcının adı.
 * @param {EncryptedTextsMap} encryptedTexts Her katılımcı için şifrelenmiş mesajlar.
 * @returns {Promise<void>} İşlem tamamlandığında çözülen promise.
 */
export const sendMessage = async (
  chatId: string,
  senderUsername: string,
  encryptedTexts: EncryptedTextsMap
): Promise<void> => {
  try {
    // Kullanıcı adlarını encryptedTexts'den al - bunlar mesajın şifrelendiği katılımcılardır
    const participants = Object.keys(encryptedTexts);

    // Başlangıç read status'ü oluştur - gönderen otomatik olarak okudu kabul edilir
    const readStatus: { [username: string]: boolean } = {};
    participants.forEach((username) => {
      // Gönderen için true, diğerleri için false
      readStatus[username] = username === senderUsername;
    });

    // 1. Mesaj verisi hazırla
    const messageData: FirestoreMessageData = {
      encryptedTexts, // şifrelenmiş metinler map'i
      senderUsername,
      timestamp: serverTimestamp() as any, // serverTimestamp() marker object, cast gerekli
      readStatus, // okundu bilgileri
    };

    // Firestore'a batch (toplu işlem) başlat
    // Firebase API değişikliği: firestore().batch() yerine writeBatch() kullanılmalıdır
    const batch = writeBatch(db);

    // 2. Alt koleksiyona yeni mesaj ekle
    const messagesRef = collection(db, CHATS_COLLECTION, chatId, 'messages');
    const newMessageRef = doc(messagesRef); // Otomatik ID ile yeni belge
    batch.set(newMessageRef, messageData);

    // 3. Sohbet belgesinin lastMessage ve updatedAt alanlarını güncelle
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    batch.update(chatRef, {
      lastMessage: {
        encryptedTexts,
        senderUsername,
        timestamp: serverTimestamp(),
        readStatus, // okundu bilgileri
      },
      updatedAt: serverTimestamp(),
    });

    // 4. Batch'i kaydet
    await batch.commit();

    console.log(`Yeni mesaj başarıyla gönderildi. chatId: ${chatId}, sender: ${senderUsername}`);
  } catch (error) {
    console.error(`Mesaj gönderilirken hata (${chatId}):`, error);
    throw error;
  }
};

/**
 * Belirli bir mesajı kullanıcı için okundu olarak işaretler.
 * Hem mesaj belgesini hem de sohbetin lastMessage alanını günceller.
 * @async
 * @param {string} chatId Mesajın ait olduğu sohbetin ID'si.
 * @param {string} messageId Okundu işaretlenecek mesajın ID'si.
 * @param {string} username Mesajı okuyan kullanıcının adı.
 * @returns {Promise<void>} İşlem tamamlandığında çözülen promise.
 */
export const markMessageAsRead = async (
  chatId: string,
  messageId: string,
  username: string
): Promise<void> => {
  try {
    // Firestore'a batch (toplu işlem) başlat
    // Firebase API değişikliği: firestore().batch() yerine writeBatch() kullanılmalıdır
    const batch = writeBatch(db);

    // 1. Mesaj belgesini al
    const messageRef = doc(db, CHATS_COLLECTION, chatId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (!messageSnap.exists()) {
      console.error(`Okundu işaretlenecek mesaj bulunamadı: ${messageId}`);
      return;
    }

    const messageData = messageSnap.data() as FirestoreMessageData;

    // 2. readStatus nesnesini güncelle veya oluştur
    const updatedReadStatus = messageData.readStatus || {};
    updatedReadStatus[username] = true;

    // 3. Mesajı güncelle
    batch.update(messageRef, { readStatus: updatedReadStatus });

    // 4. Eğer bu son mesajsa, sohbetteki lastMessage'ı da güncelle
    const chatRef = doc(db, CHATS_COLLECTION, chatId);
    const chatSnap = await getDoc(chatRef);

    if (chatSnap.exists()) {
      const chatData = chatSnap.data() as FirestoreChat;

      // Eğer bu mesaj sohbetin son mesajıysa, lastMessage'ı da güncelle
      if (
        chatData.lastMessage &&
        chatData.lastMessage.timestamp &&
        messageData.timestamp &&
        chatData.lastMessage.timestamp.isEqual(messageData.timestamp)
      ) {
        // Son mesajın readStatus'ünü güncelle
        batch.update(chatRef, {
          'lastMessage.readStatus': updatedReadStatus,
        });
      }
    }

    // 5. Batch'i kaydet
    await batch.commit();
    console.log(
      `Mesaj okundu olarak işaretlendi. chatId: ${chatId}, messageId: ${messageId}, username: ${username}`
    );
  } catch (error) {
    console.error(`Mesaj okundu işaretlenirken hata (${chatId}/${messageId}):`, error);
    throw error;
  }
};
