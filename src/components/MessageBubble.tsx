import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, ColorValue } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface MessageBubbleProps {
  text: string;
  timestamp: Date;
  isCurrentUser: boolean;
  readStatus?: {
    [username: string]: boolean;
  };
  participants: string[];
  currentUsername: string;
}

type GradientColors = [string, string];

/**
 * Mesaj balonları bileşeni. Görüldü durumuna göre arka plan rengini değiştirir.
 * Durumlar:
 * 1. Mesaj gönderildi (kimse okumadı)
 * 2. Bazıları okudu (gönderen dışında en az bir kişi okudu ama hepsi değil)
 * 3. Herkes okudu (gönderen dışındaki tüm katılımcılar okudu)
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  text,
  timestamp,
  isCurrentUser,
  readStatus = {},
  participants,
  currentUsername,
}) => {
  // Mesajın okunma durumunu hesapla
  const getReadStatus = (): 'sent' | 'partial' | 'read' => {
    // Kendim dışındaki katılımcılar
    const otherParticipants = participants.filter(username => username !== currentUsername);

    if (otherParticipants.length === 0) return 'read'; // Tek kişilik sohbet

    // Okuyan diğer katılımcı sayısı
    const readCount = otherParticipants.filter(username => readStatus[username]).length;

    if (readCount === 0) return 'sent'; // Kimse okumadı
    if (readCount === otherParticipants.length) return 'read'; // Herkes okudu
    return 'partial'; // Bazıları okudu
  };

  // Duruma göre gradyan renkleri
  const getGradientColors = (): GradientColors => {
    const status = getReadStatus();

    if (isCurrentUser) {
      // Gönderen kullanıcının mesajları için renkler
      if (status === 'sent') return ['#113842', '#113842']; // Gönderildi - mavi tonları
      if (status === 'partial') return ['#113842', '#e9dab5']; // Bazıları gördü - daha açık mavi
      return ['#2d95b0', '#113842']; // Herkes gördü - yeşil
    } else {
      // Diğer kullanıcıların mesajları için renkler
      return ['#f1f1f1', '#333333']; // Gri tonları
    }
  };

  // Okundu ikonunu belirle
  const getReadIcon = (): React.ReactNode => {
    if (!isCurrentUser) return null; // Sadece gönderen için göster

    const status = getReadStatus();

    if (status === 'sent') {
      return <Ionicons name="checkmark" size={14} color="#fff" />;
    } else if (status === 'partial') {
      return <Ionicons name="checkmark-done" size={14} color="#fff" />;
    } else {
      return <Ionicons name="checkmark-done" size={14} color="#fff" />;
    }
  };

  // Mesaj metni rengi
  const getTextColor = (): string => {
    return isCurrentUser ? '#ffffff' : '#333333';
  };

  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
    ]}>
      <LinearGradient
        colors={getGradientColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.bubble,
          isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
        ]}
      >
        <Text style={[styles.text, { color: getTextColor() }]}>{text}</Text>

        <View style={styles.footer}>
          <Text style={[
            styles.timestamp,
            { color: isCurrentUser ? 'rgba(255,255,255,0.8)' : '#999' }
          ]}>
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {getReadIcon()}
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  currentUserBubble: {
    borderBottomRightRadius: 4,
    paddingHorizontal: 12,
  },
  otherUserBubble: {
    borderBottomLeftRadius: 4,
    paddingHorizontal: 12,
  },
  text: {
    fontSize: 16,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 3,
  },
  timestamp: {
    fontSize: 11,
    marginRight: 4,
  },
});

export default MessageBubble; 