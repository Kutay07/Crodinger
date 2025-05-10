import { Tabs, useRouter, usePathname, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useRef } from 'react';
import { TouchableOpacity, Text, View, StyleSheet, SafeAreaView, Dimensions, Platform, Animated, StatusBar as RNStatusBar, Image } from 'react-native';
import { loadUserProfile } from '../../src/services/StorageService';
import { Ionicons } from '@expo/vector-icons';
import { Ionicons as IconsType } from '@expo/vector-icons/build/Icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * @file app/(tabs)/_layout.tsx
 * @description Ana uygulama akışı için sekmeli (tabs) layout.
 * Bu layout, Sohbet Listesi (ChatList), Kullanıcı Listesi (UserList) ve Profil ekranlarını içerir.
 */

/**
 * Profil avatarı bileşeni props tipi
 */
interface ProfileAvatarProps {
  username: string | null;
  onPress: () => void;
}

/**
 * Profil avatarı bileşeni
 */
function ProfileAvatar({ username, onPress }: ProfileAvatarProps) {
  return (
    <TouchableOpacity style={styles.avatarContainer} onPress={onPress}>
      <Text style={styles.avatarText}>{username ? username.charAt(0).toUpperCase() : '?'}</Text>
    </TouchableOpacity>
  );
}

/**
 * TabBar'daki her sekme için özel bir buton bileşeni props tipi
 */
interface TabBarButtonProps {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  isFocused: boolean;
  onPress: () => void;
}

/**
 * TabBar'daki her sekme için özel bir buton bileşeni
 */
function TabBarButton({ icon, label, isFocused, onPress }: TabBarButtonProps) {
  const iconName = isFocused
    ? (icon.replace('-outline', '') as React.ComponentProps<typeof Ionicons>['name'])
    : icon;

  return (
    <TouchableOpacity
      style={styles.tabButtonContainer} // Outer container for centering the pill/content
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.tabButton,
          isFocused && styles.tabButtonFocused
        ]}
      >
        <Ionicons
          name={iconName}
          size={isFocused ? 22 : 24} // Slightly smaller icon when in pill
          color={isFocused ? "#113842" : "#FFFFFF"}
          style={isFocused ? styles.iconFocused : {}}
        />
        <Text style={[
          styles.tabLabel,
          isFocused && styles.tabLabelFocused
        ]}>
          {label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Custom header component with gradient background
function GradientHeader(props: any) {
  // StatusBar'ı burada ayarlayalım
  useEffect(() => {
    RNStatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('#113842');
    }
  }, []);

  return (
    <SafeAreaView>
      <LinearGradient
        colors={['#113842', '#24768b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <Image
            source={require('../../assets/logo_text_transparent.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>{props.options.title}</Text>
          <View style={styles.headerRight}>
            {props.options.headerRight && props.options.headerRight()}
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

export default function TabLayout() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const params = useLocalSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const profile = await loadUserProfile();
        if (profile) {
          setUsername(profile.username);
        }
      } catch (error) {
        console.error('Kullanıcı adı alınırken hata:', error);
      }
    };

    fetchUsername();

    // StatusBar'ı ana bileşende ayarla
    RNStatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      RNStatusBar.setBackgroundColor('#113842');
    }
  }, []);

  const navigateToProfile = () => {
    router.push('/(tabs)/profile');
  };

  // Sohbet ekranı için dinamik başlık oluştur
  const getChatScreenTitle = () => {
    // Chat path'indeyse ve otherUser parametresi varsa kullan
    if (pathname.includes('/chat/') && params.otherUser) {
      return `Sohbet: ${params.otherUser}`;
    }
    return 'Sohbet'; // Varsayılan başlık
  };

  return (
    <>
      <Tabs
        screenOptions={{
          header: (props) => <GradientHeader {...props} />,
          headerRight: () => (
            <ProfileAvatar username={username} onPress={navigateToProfile} />
          ),
          headerShown: true,
          tabBarStyle: styles.tabBar,
          tabBarShowLabel: false,
          headerTitleStyle: {
            fontWeight: '600',
            fontSize: 18,
            color: '#fff'
          },
        }}
        tabBar={({ navigation, state, descriptors }) => {
          // Eğer chat ekranındaysak tab bar'ı gösterme
          const currentRoute = state.routes[state.index];
          if (currentRoute.name.includes('chat/')) {
            return null;
          }

          return (
            <View style={styles.tabBarOuterContainer}>
              <LinearGradient
                colors={['#113842', '#24768b']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.tabBarGradient}
              >
                {state.routes.map((route, index) => {
                  // Gizlenmiş sekmeleri gösterme (profile ve chat)
                  if (route.name === 'profile' || route.name.includes('chat/')) {
                    return null;
                  }

                  const { options } = descriptors[route.key];
                  const isFocused = state.index === index;

                  let iconName: React.ComponentProps<typeof Ionicons>['name'];
                  if (route.name === 'chatList') {
                    iconName = isFocused ? 'chatbubbles-sharp' : 'chatbubbles-outline';
                  } else if (route.name === 'userList') {
                    iconName = isFocused ? 'people-sharp' : 'people-outline';
                  } else {
                    iconName = 'alert-circle-outline'; // Fallback icon
                  }

                  const label = route.name === 'chatList' ? 'Sohbetler' : 'Kullanıcılar';

                  const onPress = () => {
                    const event = navigation.emit({
                      type: 'tabPress',
                      target: route.key,
                      canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                      navigation.navigate(route.name);
                    }
                  };

                  return (
                    <TabBarButton
                      key={route.key}
                      icon={iconName} // Pass the updated iconName
                      label={label}
                      isFocused={isFocused}
                      onPress={onPress}
                    />
                  );
                })}
              </LinearGradient>
            </View>
          );
        }}
      >
        <Tabs.Screen
          name="chatList"
          options={{
            title: 'Sohbetler',
          }}
        />
        <Tabs.Screen
          name="userList"
          options={{
            title: 'Kullanıcılar',
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'Profil',
            tabBarButton: () => null, // Tab bar'da gösterme
            headerShown: false, // TabLayout'un kendi header'ını bu ekran için gizleriz
            // böylece profile.tsx kendi header'ını yönetebilir.
          }}
        />
        <Tabs.Screen
          name="chat/[chatId]"
          options={{
            href: null, // Bu ekranın tab barda görünmemesini sağlar
            title: getChatScreenTitle(),
            headerShown: false, // Sohbet ekranında header'ı gizle
          }}
        />
      </Tabs>
    </>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#113842',
  },
  tabBar: {
    display: 'none', // Varsayılan tab bar'ı gizle
  },
  tabBarOuterContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
    // borderRadius must match tabBarGradient to clip shadow correctly if needed, but usually not necessary here
  },
  tabBarGradient: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 30,
    paddingHorizontal: 5, // Reduced padding to give more space for content, adjust as needed
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden', // Prevents children from overflowing the rounded corners
  },
  tabButtonContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%', // Ensure the container fills the gradient bar height for consistent touch area
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 22,
    overflow: 'hidden', // Ensure the button itself clips its content/background to the border radius
  },
  tabButtonFocused: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, // Override horizontal padding for focused state
    // borderRadius and overflow are inherited from tabButton, no need to repeat
    // shadow for the pill itself if needed
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  iconFocused: {
    marginRight: 6,
  },
  tabLabel: {
    fontSize: 12,
    color: '#E0E0E0',
    fontWeight: '500',
  },
  tabLabelFocused: {
    color: '#113842',
    fontWeight: '600',
    fontSize: 12,
  },
  headerGradient: {
    paddingTop: RNStatusBar.currentHeight,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
    height: 46,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
    marginLeft: 50,
  },
  headerLogo: {
    width: 100, // Adjust as needed
    height: 30, // Adjust as needed
    marginLeft: 5, // Add some margin if needed
    position: 'absolute',
  },
  headerRight: {
    width: 40,
    alignItems: 'center',
  },
}); 