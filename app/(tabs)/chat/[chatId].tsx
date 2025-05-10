import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, Button, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { streamMessagesForChat, sendMessage, getUserPublicKey, markMessageAsRead } from '../../../src/services/FirebaseService';
import { loadUserProfile } from '../../../src/services/StorageService';
import { encryptMessage, decryptMessage } from '../../../src/services/CryptoService';
import { FirestoreMessageDocument } from '../../../src/types';
import { Ionicons } from '@expo/vector-icons';
import MessageBubble from '../../../src/components/MessageBubble';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * @file app/(tabs)/chat/[chatId].tsx
 * @description Belirli bir sohbetteki mesajları gösteren ve yeni mesaj göndermeye yarayan ekran.
 * Mesajlar gerçek zamanlı olarak dinlenir ve şifreleme/çözme işlemleri yapılır.
 */

interface Message {
  id: string;
  text: string;
  sender: string;
  timestamp: Date;
}

/**
 * Özel header bileşeni props tipi
 */
interface ChatHeaderProps {
  title: string;
  onBack: () => void;
}

/**
 * Özel header bileşeni
 */
const ChatHeader = ({ title, onBack }: ChatHeaderProps) => {
  return (
    <SafeAreaView>
      <LinearGradient
        colors={['#113842', '#24768b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerContainer}
      >
        <StatusBar
          barStyle="light-content"
          backgroundColor="#113842"
          translucent={false}
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.headerRight} />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

/**
 * Firestore timestamp değerini geçerli bir Date nesnesine dönüştürür
 * @param timestamp Firestore timestamp veya null/undefined
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
    console.log('Timestamp dönüştürme hatası:', error);
    return new Date();
  }
};

export default function ChatScreen() {
  const router = useRouter();
  const { chatId, otherUser } = useLocalSearchParams<{ chatId: string; otherUser?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [encryptedMessages, setEncryptedMessages] = useState<FirestoreMessageDocument[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string; privateKey: string; publicKey: string } | null>(null);
  const [otherUserPublicKey, setOtherUserPublicKey] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);

  // Create a ref for the FlatList
  const flatListRef = useRef<FlatList>(null);

  // Mevcut kullanıcıyı ve diğer kullanıcının public key'ini yükle
  useFocusEffect(
    useCallback(() => {
      const loadInitialData = async () => {
        setLoading(true);
        try {
          const profile = await loadUserProfile();
          if (profile) {
            setCurrentUser(profile);
          } else {
            Alert.alert("Hata", "Kullanıcı profili yüklenemedi.");
            router.back();
            return;
          }

          if (otherUser) {
            // Diğer kullanıcının public key'ini al
            const publicKey = await getUserPublicKey(otherUser);
            if (publicKey) {
              setOtherUserPublicKey(publicKey);
              setParticipants([profile.username, otherUser]);
            } else {
              Alert.alert("Hata", `${otherUser} kullanıcısının public key'i bulunamadı.`);
            }
          }

        } catch (error) {
          console.error("Sohbet başlangıç verileri yüklenirken hata:", error);
          Alert.alert("Hata", "Sohbet verileri yüklenirken bir sorun oluştu.");
        }
      };

      if (otherUser) {
        loadInitialData();
      }
    }, [otherUser, chatId])
  );

  useEffect(() => {
    if (!chatId || !currentUser?.username) return;

    // Gerçek zamanlı mesaj dinleme
    const unsubscribe = streamMessagesForChat(chatId, async (encryptedMsgs) => {
      try {
        // Şifreli mesajları state'e kaydet (görüldü bilgisi için)
        setEncryptedMessages(encryptedMsgs);

        // Şifreli mesajları çöz
        const decryptedMessages: Message[] = await Promise.all(
          encryptedMsgs.map(async (encryptedMsg) => {
            try {
              // Mevcut kullanıcı için şifrelenmiş mesaj metnini al
              const encryptedText = encryptedMsg.encryptedTexts[currentUser.username];

              if (!encryptedText) {
                console.error(`Bu mesajın şifreli metni bulunamadı: ${encryptedMsg.id}`);
                return {
                  id: encryptedMsg.id,
                  text: "[Şifrelenemedi veya bulunamadı]",
                  sender: encryptedMsg.senderUsername,
                  timestamp: getValidDate(encryptedMsg.timestamp),
                };
              }

              // Şifreli metni mevcut kullanıcının private key'i ile çöz
              const decryptedText = await decryptMessage(encryptedText);

              return {
                id: encryptedMsg.id,
                text: decryptedText,
                sender: encryptedMsg.senderUsername,
                timestamp: getValidDate(encryptedMsg.timestamp),
              };
            } catch (error) {
              console.error(`Mesaj çözülürken hata (${encryptedMsg.id}):`, error);
              return {
                id: encryptedMsg.id,
                text: "[Çözülemeyen mesaj]",
                sender: encryptedMsg.senderUsername,
                timestamp: getValidDate(encryptedMsg.timestamp),
              };
            }
          })
        );

        // Mesajları zaman damgasına göre sırala
        const sortedMessages = decryptedMessages.sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        setMessages(sortedMessages);
        setLoading(false);
      } catch (error) {
        console.error("Mesajlar işlenirken hata:", error);
        setLoading(false);
      }
    });

    // Component unmount olduğunda veya chatId değiştiğinde dinlemeyi durdur
    return () => unsubscribe();
  }, [chatId, currentUser]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && !loading && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages, loading]);

  const handleSendMessage = async () => {
    if (newMessage.trim().length === 0 || !currentUser || !otherUser || !otherUserPublicKey) {
      Alert.alert("Uyarı", "Mesaj boş olamaz veya gerekli bilgiler eksik.");
      return;
    }

    const messageToSend = newMessage.trim();
    setNewMessage(''); // Input'u hemen temizle

    try {
      // Şifrelenmiş mesajları katılımcılar için hazırla
      const encryptedTexts: { [username: string]: string } = {};

      // Debug için anahtar formatı kontrolü
      console.log("Şifrelemede kullanılan public key formatları:");
      console.log("- Alıcı public key formatı:",
        otherUserPublicKey.length > 50
          ? otherUserPublicKey.substring(0, 25) + "..." + otherUserPublicKey.substring(otherUserPublicKey.length - 25)
          : otherUserPublicKey
      );
      console.log("- Kendim public key formatı:",
        currentUser.publicKey.length > 50
          ? currentUser.publicKey.substring(0, 25) + "..." + currentUser.publicKey.substring(currentUser.publicKey.length - 25)
          : currentUser.publicKey
      );

      try {
        // Diğer kullanıcı için şifrele
        encryptedTexts[otherUser] = await encryptMessage(messageToSend, otherUserPublicKey);
      } catch (error: any) {
        console.error(`Alıcı için şifreleme hatası: ${error.message}`);
        Alert.alert("Hata", `Mesaj alıcı için şifrelenemedi: ${error.message}`);
        setNewMessage(messageToSend); // Hata durumunda input'a geri yükle
        return;
      }

      try {
        // Kendim için şifrele (kendi mesajlarımı da görmek için)
        encryptedTexts[currentUser.username] = await encryptMessage(messageToSend, currentUser.publicKey);
      } catch (error: any) {
        console.error(`Kendin için şifreleme hatası: ${error.message}`);
        Alert.alert("Hata", `Mesaj kendiniz için şifrelenemedi: ${error.message}`);
        setNewMessage(messageToSend); // Hata durumunda input'a geri yükle
        return;
      }

      // Mesajı gönder
      await sendMessage(chatId, currentUser.username, encryptedTexts);

      console.log(`Mesaj gönderildi: "${messageToSend}" kime: ${otherUser}, kimden: ${currentUser.username}`);

      // Not: Gerçek zamanlı dinleme ile mesajlar otomatik güncellenecek
    } catch (error: any) {
      console.error("Mesaj gönderilirken hata:", error);
      Alert.alert("Hata", `Mesaj gönderilemedi: ${error.message}`);
      setNewMessage(messageToSend); // Hata durumunda input'a geri yükle
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  // After the handleSendMessage function, add a new function to mark messages as read
  const handleMessageRead = useCallback(async (messageId: string) => {
    if (!chatId || !currentUser?.username) return;

    // Find the message in the encrypted messages array
    const messageToMark = encryptedMessages.find(msg => msg.id === messageId);

    // Only mark messages if they are from other users and not already marked as read
    if (messageToMark &&
      messageToMark.senderUsername !== currentUser.username &&
      messageToMark.readStatus &&
      !messageToMark.readStatus[currentUser.username]) {

      try {
        // Call the markMessageAsRead function to update Firestore
        await markMessageAsRead(chatId, messageId, currentUser.username);
        console.log(`Mesaj okundu olarak işaretlendi: ${messageId}`);
      } catch (error) {
        console.error(`Mesaj okundu işaretlenirken hata: ${messageId}`, error);
      }
    }
  }, [chatId, currentUser, encryptedMessages]);

  // Then modify the FlatList onViewableItemsChanged to mark messages as read when they appear on screen
  // Add these new state variables and refs at the top of the component
  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };
  const viewableItemsChangedRef = React.useRef<((info: { viewableItems: any[]; changed: any[] }) => void) | null>(null);

  // Set the reference callback
  useEffect(() => {
    viewableItemsChangedRef.current = ({ viewableItems }) => {
      // For each viewable message, mark it as read if needed
      viewableItems.forEach(viewableItem => {
        if (viewableItem.isViewable) {
          handleMessageRead(viewableItem.item.id);
        }
      });
    };
  }, [handleMessageRead]);

  if (loading || !currentUser) {
    return (
      <View style={styles.container}>
        <ChatHeader title={otherUser ? `${otherUser}` : 'Sohbet'} onBack={handleGoBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#113842" />
          <Text style={styles.loadingText}>Mesajlar yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChatHeader title={otherUser ? `${otherUser}` : 'Sohbet'} onBack={handleGoBack} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoidingContainer}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              text={item.text}
              timestamp={item.timestamp}
              isCurrentUser={item.sender === currentUser?.username}
              readStatus={encryptedMessages.find(msg => msg.id === item.id)?.readStatus}
              participants={participants}
              currentUsername={currentUser?.username || ''}
            />
          )}
          contentContainerStyle={styles.messageListContent}
          onViewableItemsChanged={viewableItemsChangedRef.current}
          viewabilityConfig={viewabilityConfig}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Mesajınızı yazın..."
            placeholderTextColor='#c0c0c0'
            onSubmitEditing={handleSendMessage}
            multiline={false}
          />
          <TouchableOpacity
            style={[styles.sendButton, newMessage.trim().length === 0 && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={newMessage.trim().length === 0}
            activeOpacity={0.7}
          >
            <Ionicons
              name="send"
              size={20}
              color={"#FFFFFF"}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  messageListContent: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  messageBubble: {
    padding: 10,
    borderRadius: 15,
    marginVertical: 5,
    maxWidth: '80%',
  },
  myMessage: {
    backgroundColor: '#dcf8c6',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  otherMessage: {
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
    borderWidth: 1,
    borderColor: '#eee'
  },
  messageText: {
    fontSize: 16,
    color: '#333',
  },
  timestamp: {
    fontSize: 10,
    color: '#999',
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    marginRight: 10,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  headerContainer: {
    paddingTop: StatusBar.currentHeight,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    height: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'left',
  },
  headerRight: {
    width: 40,
    height: 40,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#113842',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#68b4b4',
  },
}); 