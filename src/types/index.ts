import { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';

/**
 * @file src/types/index.ts
 * @description Uygulama genelinde kullanılacak temel TypeScript tip tanımları.
 */

/**
 * Firestore'daki `/users/{username}` belgesinin yapısını tanımlar.
 */
export interface FirestoreUser {
  publicKey: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  // username alanı belge ID'si olarak kullanılır, bu yüzden burada ayrıca tanımlanmaz.
}

/**
 * Şifrelenmiş metinleri kullanıcı adına göre mapleyen yapı.
 * Örn: { "alice": "U2FsdGVkX1...", "bob": "U2FsdGVkX1..." }
 */
export interface EncryptedTextsMap {
  [username: string]: string;
}

/**
 * Her kullanıcı için mesajın okunup okunmadığını takip eden yapı.
 * Örn: { "alice": true, "bob": false }
 */
export interface ReadStatusMap {
  [username: string]: boolean;
}

/**
 * Firestore'daki `/chats/{chatId}` belgesinin `lastMessage` alanının yapısı.
 */
export interface FirestoreLastMessageData {
  encryptedTexts: EncryptedTextsMap; // Şifrelenmiş mesajlar
  senderUsername: string;
  timestamp: FirebaseFirestoreTypes.Timestamp;
  readStatus?: ReadStatusMap; // Mesajın okunup okunmadığını takip eder
}

/**
 * Firestore'daki `/chats/{chatId}` belgesinin yapısını tanımlar.
 */
export interface FirestoreChat {
  participants: string[]; // username array
  lastMessage?: FirestoreLastMessageData;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
  // chatId alanı belge ID'si olarak kullanılır.
}

/**
 * Firestore'daki `/chats/{chatId}/messages/{messageId}` belgesinin yapısını tanımlar.
 */
export interface FirestoreMessageData {
  encryptedTexts: EncryptedTextsMap; // Şifrelenmiş mesajlar
  senderUsername: string;
  timestamp: FirebaseFirestoreTypes.Timestamp;
  readStatus?: ReadStatusMap; // Mesajın okunup okunmadığını takip eder
  // messageId alanı belge ID'si olarak kullanılır.
}

// Firestore'dan okunan tam döküman tipleri (ID'ler ile birlikte)
export type FirestoreUserDocument = { username: string } & FirestoreUser;
export type FirestoreChatDocument = { id: string } & FirestoreChat;
export type FirestoreMessageDocument = { id: string } & FirestoreMessageData;

export {}; // Dosyanın modül olarak algılanmasını sağlar
