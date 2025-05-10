import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, TouchableOpacity, Dimensions, Image, TextInput, Keyboard, StatusBar, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getAllUsers, getOrCreateChatId } from '../../src/services/FirebaseService';
import { loadUserProfile } from '../../src/services/StorageService';
import { FirestoreUserDocument } from '../../src/types';
import { Ionicons } from '@expo/vector-icons';

/**
 * @file app/(tabs)/userList.tsx
 * @description Sistemdeki diğer kullanıcıları listeleyip yeni sohbet başlatma ekranı.
 * Firebase'den tüm kullanıcıları çeker, mevcut kullanıcıyı listeden çıkarır.
 * Kullanıcı adı veya public key'e göre arama yapabilme özelliği sunar.
 */

const { width } = Dimensions.get('window');
const CARD_MARGIN = 16;
const CARD_WIDTH = width - (CARD_MARGIN * 2);

/**
 * Rastgele bir renk kodu oluşturur
 * @param {string} username - Kullanıcı adı
 * @returns {string} - HEX renk kodu
 */
const getAvatarColor = (username: string): string => {
  // Username'den basit bir hash oluştur
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Hue değerini 0-360 arasında belirle (canlı renkler için)
  const h = Math.abs(hash) % 360;

  // Pastel tonlar için sabit saturation ve lightness değerleri
  return `hsl(${h}, 65%, 60%)`;
};

/**
 * Kullanıcı kartı props tipi
 */
interface UserCardProps {
  user: FirestoreUserDocument;
  onStartChat: (user: FirestoreUserDocument) => void;
  isLoading: boolean;
}

/**
 * Arama çubuğu props tipi
 */
interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onClear: () => void;
  searchMode: 'username' | 'publicKey';
  onToggleSearchMode: () => void;
}

/**
 * Modern arama çubuğu bileşeni
 */
const SearchBar = ({ value, onChangeText, onClear, searchMode, onToggleSearchMode }: SearchBarProps) => {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#97A5C0" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`${searchMode === 'username' ? 'Kullanıcı Adı' : 'Public Key'} ile ara...`}
          placeholderTextColor="#97A5C0"
          value={value}
          onChangeText={onChangeText}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {value.length > 0 && (
          <TouchableOpacity onPress={onClear} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#97A5C0" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        style={styles.toggleModeButton}
        onPress={onToggleSearchMode}
        activeOpacity={0.7}
      >
        <Ionicons
          name={searchMode === 'username' ? 'person' : 'key'}
          size={18}
          color="#FFF"
        />
      </TouchableOpacity>
    </View>
  );
};

/**
 * Kullanıcı kartını render eden bileşen
 */
const UserCard = ({ user, onStartChat, isLoading }: UserCardProps) => {
  const avatarColor = getAvatarColor(user.username);
  const formattedDate = user.createdAt.toDate().toLocaleDateString('tr-TR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Public key'in kısa gösterimi
  const formatPublicKey = (key: string) => {
    if (!key) return '';
    if (key.length <= 16) return key;
    return `${key.substring(0, 8)}...${key.substring(key.length - 8)}`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.avatarText}>{user.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.username}</Text>
          <View style={styles.metaContainer}>
            <Ionicons name="calendar-outline" size={12} color="#777" />
            <Text style={styles.userMeta}>{formattedDate}</Text>
          </View>
          <View style={styles.metaContainer}>
            <Ionicons name="key-outline" size={12} color="#777" />
            <Text style={styles.userMeta}>{formatPublicKey(user.publicKey || '')}</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.cardFooter}>
        <View style={styles.creationDateContainer}>
          <Ionicons name="time-outline" size={16} color="#555" />
          <Text style={styles.creationDateText}>Oluşturulma: {formattedDate}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.chatButton,
            isLoading && styles.chatButtonLoading
          ]}
          onPress={() => onStartChat(user)}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="chatbubble-outline" size={16} color="#FFF" style={styles.buttonIcon} />
              <Text style={styles.chatButtonText}>Sohbet Başlat</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Sistemdeki diğer kullanıcıları listeleyip yeni sohbet başlatma ekranı
 * @returns {JSX.Element} Kullanıcı listesi ekranı
 */
export default function UserListScreen() {
  const router = useRouter();
  const [allUsers, setAllUsers] = useState<FirestoreUserDocument[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<FirestoreUserDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ username: string } | null>(null);
  const [startingChat, setStartingChat] = useState<string | null>(null); // Hangi kullanıcıyla sohbet başlatılıyor
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'username' | 'publicKey'>('username');

  // StatusBar'ı güncelle
  useFocusEffect(
    React.useCallback(() => {
      StatusBar.setBarStyle('light-content');
      if (Platform.OS === 'android') {
        StatusBar.setBackgroundColor('#113842'); // Ana tema rengi
      }
      return () => {
        // İsteğe bağlı: Ekrandan çıkıldığında varsayılan stile dön
        // StatusBar.setBarStyle('default');
        // if (Platform.OS === 'android') {
        //   StatusBar.setBackgroundColor('white');
        // }
      };
    }, [])
  );

  // Kullanıcı listesini yükle
  useFocusEffect(
    React.useCallback(() => {
      const fetchCurrentUserAndUsers = async () => {
        setLoading(true);
        try {
          // Mevcut kullanıcıyı AsyncStorage'dan yükle
          const profile = await loadUserProfile();
          if (profile) {
            setCurrentUser({ username: profile.username });
          } else {
            Alert.alert("Hata", "Kullanıcı profili yüklenemedi! Lütfen yeniden profil oluşturun.");
            router.replace('/(auth)/profileSetup');
            return;
          }

          // Tüm kullanıcıları Firestore'dan çek
          const users = await getAllUsers();

          // Mevcut kullanıcıyı listeden çıkar
          if (profile) {
            const filteredUsersList = users.filter(user => user.username !== profile.username);
            setAllUsers(filteredUsersList);
          } else {
            setAllUsers(users);
          }

        } catch (error) {
          console.error("Kullanıcılar yüklenirken hata:", error);
          Alert.alert("Hata", "Kullanıcı listesi yüklenemedi. Lütfen internet bağlantınızı kontrol edin.");
        } finally {
          setLoading(false);
        }
      };
      fetchCurrentUserAndUsers();
    }, [])
  );

  // Arama sorgusuna veya arama moduna göre kullanıcıları filtrele
  useEffect(() => {
    if (!currentUser) return;

    if (searchQuery.trim() === '') {
      setFilteredUsers([]); // Arama kutusu boşsa listeyi temizle
      return;
    }

    const lowercasedQuery = searchQuery.toLowerCase();
    const filtered = allUsers.filter(user => {
      if (searchMode === 'username') {
        return user.username.toLowerCase().includes(lowercasedQuery);
      } else {
        // Public key araması
        return user.publicKey && user.publicKey.toLowerCase().includes(lowercasedQuery);
      }
    });
    setFilteredUsers(filtered);
  }, [searchQuery, allUsers, currentUser, searchMode]);

  const handleClearSearch = () => {
    setSearchQuery('');
    Keyboard.dismiss();
  };

  const toggleSearchMode = () => {
    setSearchMode(prev => prev === 'username' ? 'publicKey' : 'username');
    setSearchQuery('');
  };

  /**
   * Seçilen kullanıcı ile sohbet başlatır
   * @param {FirestoreUserDocument} otherUser Sohbet başlatılacak diğer kullanıcı
   */
  const handleStartChat = async (otherUser: FirestoreUserDocument) => {
    if (!currentUser) {
      Alert.alert("Hata", "Sohbet başlatmak için mevcut kullanıcı bilgisi gerekli.");
      return;
    }

    try {
      setStartingChat(otherUser.username); // Başlattığımız sohbetin yüklenme durumunu takip et

      // FirebaseService ile chatId'yi al/oluştur
      const chatId = await getOrCreateChatId(currentUser.username, otherUser.username);

      setStartingChat(null); // Yükleme durumunu sıfırla

      // Sohbet ekranına yönlendir
      router.push({
        pathname: "/(tabs)/chat/[chatId]",
        params: { chatId, otherUser: otherUser.username }
      });
    } catch (error) {
      setStartingChat(null);
      console.error("Sohbet başlatılırken hata:", error);
      Alert.alert("Hata", "Sohbet başlatılamadı. Lütfen tekrar deneyin.");
    }
  };

  const renderEmptyListComponent = () => {
    if (searchQuery.trim() === '' && allUsers.length > 0) {
      return (
        <View style={styles.emptyStateContainer}>
          <Ionicons name="search-circle-outline" size={80} color="#bdc3c7" />
          <Text style={styles.emptyStateText}>
            Kullanıcıları bulmak için yukarıdaki arama kutusunu kullanın.
          </Text>
          <Text style={styles.emptyStateSubText}>
            Kullanıcı adına veya genel anahtara göre arama yapabilirsiniz.
          </Text>
        </View>
      );
    }
    if (loading) {
      return null; // Yükleniyorken bir şey gösterme, ana yükleme göstergesi aktif
    }
    return (
      <View style={styles.emptyStateContainer}>
        <Ionicons name="sad-outline" size={80} color="#bdc3c7" />
        <Text style={styles.emptyStateText}>Kullanıcı bulunamadı</Text>
        <Text style={styles.emptyStateSubText}>
          Arama kriterlerinize uyan bir kullanıcı yok veya sistemde kayıtlı kullanıcı bulunmuyor.
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#113842" />
        <Text style={styles.loadingText}>Kullanıcılar yükleniyor...</Text>
      </View>
    );
  }

  if (allUsers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="people" size={64} color="#CCCCCC" />
        </View>
        <Text style={styles.emptyText}>Sistemde başka kullanıcı bulunmuyor.</Text>
        <Text style={styles.emptySubtext}>Arkadaşlarınızı uygulamaya davet edin!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onClear={handleClearSearch}
        searchMode={searchMode}
        onToggleSearchMode={toggleSearchMode}
      />

      {filteredUsers.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={48} color="#CCCCCC" />
          <Text style={styles.noResultsText}>Arama sonuçları</Text>
          <Text style={styles.noResultsSubText}>Arama modunu değiştirin ve aramaya başlayın</Text>
        </View>
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.username}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onStartChat={handleStartChat}
              isLoading={startingChat === item.username}
            />
          )}
          ListEmptyComponent={renderEmptyListComponent}
          contentContainerStyle={styles.listContentContainer}
          keyboardShouldPersistTaps="handled" // Klavyeyi kapatmadan butona basabilmek için
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    padding: 20,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: CARD_MARGIN,
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 36,
    fontSize: 15,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    padding: 4,
  },
  toggleModeButton: {
    backgroundColor: '#113842',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsSubText: {
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
    maxWidth: '80%',
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: 'white',
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  userMeta: {
    fontSize: 12,
    color: '#777',
    marginLeft: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creationDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creationDateText: {
    fontSize: 13,
    color: '#555',
    marginLeft: 6,
    fontWeight: '500',
  },
  chatButton: {
    backgroundColor: '#113842',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  chatButtonLoading: {
    backgroundColor: '#78A5DC',
  },
  buttonIcon: {
    marginRight: 6,
  },
  chatButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    marginTop: Dimensions.get('window').height / 6, // Ortalamak için biraz yukarıdan başlat
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#7f8c8d',
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubText: {
    fontSize: 14,
    color: '#95a5a6',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
}); 