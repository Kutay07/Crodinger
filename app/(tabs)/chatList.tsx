import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, StatusBar, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { streamChatsForUser } from '../../src/services/FirebaseService';
import { loadUserProfile } from '../../src/services/StorageService';
import { FirestoreChatDocument, FirestoreLastMessageData } from '../../src/types';
import { decryptMessage } from '../../src/services/CryptoService';

/**
 * @file app/(tabs)/chatList.tsx
 * @description Kullanıcının mevcut sohbetlerini listelediği ekran.
 * Firebase'den gerçek zamanlı olarak sohbetleri dinler.
 */

/**
 * Timestamp kontrolü ve güvenli Date dönüşümü için yardımcı fonksiyon
 * @param timestamp Firestore timestamp veya null
 * @returns Date nesnesi
 */
const getValidDate = (timestamp: any): Date => {
  try {
    // Firestore timestamp ise toDate() metodunu kullan
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    // Sayı ise (Unix timestamp) doğrudan Date oluştur
    else if (timestamp && typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    // Hiçbiri değilse şu anki zamanı kullan
    return new Date();
  } catch (error) {
    console.log('ChatList - Timestamp dönüştürme hatası:', error);
    return new Date();
  }
};

// Sohbet nesnesini genişletilmiş tip ile tanımla
interface ChatWithDecryptedMessage extends FirestoreChatDocument {
  decryptedLastMessageText?: string;
}

// Kullanıcı profili için tip tanımı (StorageService'den dönen tipe göre)
interface UserProfile {
  username: string;
  publicKey: string;
  privateKey: string;
  // Gerekirse diğer alanlar eklenebilir
}

/**
 * Kullanıcının mevcut sohbetlerini gerçek zamanlı olarak listeleyen ekran
 * @returns {JSX.Element} Sohbet listesi ekranı
 */
export default function ChatListScreen() {
  const router = useRouter();
  const [chats, setChats] = useState<ChatWithDecryptedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  // Firestore listener'ı takip etmek için useRef
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Bu useEffect, bileşen bağlandığında dinlemeyi başlatır ve temizleme işlevini döndürür
  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#113842');
    }

    return () => {
      // Bileşen unmount olduğunda Firestore dinleyicisini temizle
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Ekran odaklandığında kullanıcı bilgilerini yükle ve sohbetleri dinle
  useFocusEffect(
    React.useCallback(() => {
      const setupChatListener = async () => {
        // Önceki dinleyiciyi temizle
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
          unsubscribeRef.current = null;
        }

        setLoading(true);
        try {
          const profile = await loadUserProfile();
          if (!profile || !profile.username) { // privateKey kontrolü de eklenebilir
            console.error("Kullanıcı profili veya privateKey bulunamadı!");
            router.replace('/(auth)/profileSetup');
            return;
          }
          // UserProfile tipine uygun olarak cast et
          setCurrentUserProfile(profile as UserProfile);

          unsubscribeRef.current = streamChatsForUser(profile.username, async (fetchedChats) => {
            if (!profile || !profile.username) {
              console.log("Sohbetler işlenirken kullanıcı profili mevcut değil.");
              setChats([]);
              setLoading(false);
              return;
            }

            const processedChats: ChatWithDecryptedMessage[] = await Promise.all(
              fetchedChats.map(async (chat) => {
                let decryptedText: string | undefined = undefined;
                if (chat.lastMessage && chat.lastMessage.encryptedTexts && profile.username) {
                  const encryptedTextForUser = chat.lastMessage.encryptedTexts[profile.username];
                  if (encryptedTextForUser) {
                    try {
                      decryptedText = await decryptMessage(encryptedTextForUser);
                    } catch (e) {
                      console.error(`Mesaj çözülürken hata (${chat.id}):`, e);
                      decryptedText = "[Mesaj çözülemedi]";
                    }
                  } else {
                    // Mevcut kullanıcı için şifreli metin yoksa (belki kendi gönderdiği mesaj ve sadece diğerleri için şifrelendi)
                    // Ya da lastMessage henüz yok veya boş.
                    // Bu durumu `getLastMessagePreview` içinde ele alacağız.
                  }
                }
                return { ...chat, decryptedLastMessageText: decryptedText };
              })
            );
            setChats(processedChats);
            setLoading(false);
          });

        } catch (error) {
          console.error("Sohbet listesi yüklenirken hata:", error);
          setLoading(false);
        }
      };

      setupChatListener();
    }, [])
  );

  /**
   * Sohbetin diğer katılımcısının adını bulur
   * @param {FirestoreChatDocument} chat Sohbet nesnesi
   * @param {string} currentUsername Mevcut kullanıcının adı
   * @returns {string} Diğer katılımcının adı
   */
  const getOtherParticipantName = (chat: FirestoreChatDocument, currentUsername?: string) => {
    if (!currentUsername || !chat.participants) return 'Bilinmeyen Kullanıcı';
    // participants dizisindeki, mevcut kullanıcı olmayan ilk elemanı döndür
    return chat.participants.find(username => username !== currentUsername) || 'Bilinmeyen Kullanıcı';
  };

  /**
   * Son mesaj önizlemesini oluşturur
   * @param {ChatWithDecryptedMessage} chat Genişletilmiş sohbet nesnesi
   * @param {string} currentUsername Mevcut kullanıcının adı
   * @returns {string} Son mesaj önizlemesi
   */
  const getLastMessagePreview = (chat: ChatWithDecryptedMessage, currentUsername?: string) => {
    if (!chat.lastMessage) return 'Henüz mesaj yok';

    const sender = chat.lastMessage.senderUsername === currentUsername ? 'Sen' : chat.lastMessage.senderUsername;
    const senderName = sender || 'Bilinmeyen';

    if (chat.decryptedLastMessageText) {
      return `${senderName}: ${chat.decryptedLastMessageText}`;
    } else if (chat.lastMessage.encryptedTexts && currentUsername && chat.lastMessage.encryptedTexts[currentUsername]) {
      // Eğer şifre çözme işlemi devam ediyorsa veya başarısız olduysa, ama metin var.
      // Bu durum yukarıdaki map içinde handle ediliyor ([Mesaj çözülemedi] veya undefined)
      // Eğer decryptedLastMessageText tanımsızsa ve encryptedText varsa ama çözülemediyse, yukarıdaki map bunu [Mesaj çözülemedi] yapar.
      // Eğer decryptedLastMessageText tanımsızsa ve encryptedText yoksa (örn. başka bir kullanıcı için şifreli metin yoksa),
      // bu durumda "Mesaj yükleniyor..." gibi bir şey gösterilebilir veya boş bırakılabilir.
      // Şimdilik, eğer decryptedLastMessageText yoksa ve sender varsa, sadece zamanı gösterelim (eski davranışa benzer bir fallback).
      const date = getValidDate(chat.lastMessage.timestamp);
      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `${senderName} · ${time}`; // Fallback to time if decryption not available/failed initially
    }

    return 'Henüz mesaj yok'; // Genel fallback
  };

  /**
   * Sohbete tıklama işleyicisi
   * @param {string} chatId Sohbet ID'si
   * @param {string} otherParticipantUsername Diğer katılımcının adı
   */
  const handleChatPress = (chatId: string, otherParticipantUsername: string) => {
    router.push({
      pathname: "/(tabs)/chat/[chatId]",
      params: { chatId, otherUser: otherParticipantUsername }
    });
  };

  if (loading) {
    return <View style={styles.centered}>
      <ActivityIndicator size="large" color="#113842" />
      <Text style={styles.loadingText}>Sohbetler yükleniyor...</Text>
    </View>;
  }

  if (chats.length === 0) {
    return <View style={styles.centered}>
      <Text style={styles.emptyText}>Henüz hiç sohbetiniz yok.</Text>
      <Text style={styles.emptySubtext}>Kullanıcılar sekmesinden yeni bir sohbet başlatabilirsiniz.</Text>
    </View>;
  }

  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const otherParticipant = getOtherParticipantName(item, currentUserProfile?.username);
        return (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => handleChatPress(item.id, otherParticipant)}
          >
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{otherParticipant.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.chatInfo}>
              <Text style={styles.participantName}>{otherParticipant}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {getLastMessagePreview(item, currentUserProfile?.username)}
              </Text>
            </View>
            {item.lastMessage && (
              <View style={styles.timestampContainer}>
                <Text style={styles.timestamp}>
                  {getValidDate(item.lastMessage.timestamp).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric'
                  })}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
      style={styles.list}
      contentContainerStyle={styles.listContent}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#777',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  list: {
    backgroundColor: '#fff',
  },
  listContent: {
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#113842',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  timestampContainer: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
  },
}); 