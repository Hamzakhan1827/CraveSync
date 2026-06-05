import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView,
  TextInput, Alert, ActivityIndicator, Image, Animated, KeyboardAvoidingView, Platform, StatusBar, RefreshControl, Modal, Pressable, Keyboard, Dimensions, Linking
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { supabase } from './lib/supabase';
import { ChevronRight, X, ThumbsUp, ThumbsDown, Send, ArrowLeft, Clock, Search, Eye, EyeOff, Home, PlusCircle, User, Menu, Heart, Camera, LogOut, Info, MessageCircle, PenTool, Trash2 } from 'lucide-react-native';
import { CraveSyncLogo, CraveSyncMark } from './CraveSyncLogo';
import { Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { validatePasswordStrength, RateLimiter, validateEmail, validateUsername as validateUsernameUtil } from './lib/authUtils';

// --- CONSTANTS & HELPERS ---
const FOOD_PLACEHOLDER = 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=80';
const DIARY_PAGE_SIZE = 30;
const SCREEN_WIDTH = Dimensions.get('window').width;

const compressImage = async (uri: string): Promise<string> => {
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );
    return result.uri;
  } catch {
    return uri;
  }
};
const getItemImage = (item: any) => item?.image_url || FOOD_PLACEHOLDER;
const getRestaurantImage = (rest: any) => rest?.logo_url || FOOD_PLACEHOLDER;

const getPriceRange = (items: any[]): string | null => {
  if (!items.length) return null;
  const avg = items.reduce((s, it) => s + (it.price || 0), 0) / items.length;
  if (avg < 500) return '$';
  if (avg < 1500) return '$$';
  return '$$$';
};

const isOpenNow = (hours: string | null | undefined): boolean | null => {
  if (!hours) return null;
  try {
    const m = hours.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!m) return null;
    const toMins = (h: number, min: number, p?: string) => {
      let hr = h;
      if (p) {
        if (p.toUpperCase() === 'PM' && h !== 12) hr += 12;
        if (p.toUpperCase() === 'AM' && h === 12) hr = 0;
      }
      return hr * 60 + min;
    };
    const open = toMins(+m[1], +m[2], m[3]);
    let close = toMins(+m[4], +m[5], m[6]);
    // handle past-midnight close (e.g. open 10 PM, close 2 AM)
    if (close <= open) close += 24 * 60;
    const now = new Date();
    let cur = now.getHours() * 60 + now.getMinutes();
    if (cur < open && close > 24 * 60) cur += 24 * 60;
    return cur >= open && cur <= close;
  } catch { return null; }
};

const calcStreak = (entries: any[]): number => {
  if (!entries.length) return 0;
  const days = [...new Set(entries.map((e: any) => {
    const d = new Date(e.created_at); d.setHours(0, 0, 0, 0); return d.getTime();
  }))].sort((a, b) => b - a);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const ydayMs = todayMs - 86400000;
  if (days[0] < ydayMs) return 0;
  let streak = 0;
  let expected = days[0] >= todayMs ? todayMs : ydayMs;
  for (const day of days) {
    if (day === expected) { streak++; expected -= 86400000; }
    else if (day < expected) break;
  }
  return streak;
};

const ONBOARDING_SLIDES = [
  { emoji: '🍽️', title: 'Welcome to CraveSync', desc: 'Your personal food memory — track every bite, every craving, every wow moment.' },
  { emoji: '⭐', title: 'Discover & Review', desc: 'Find restaurants, try dishes, and share your honest opinion with a simple thumbs up or down.' },
  { emoji: '📔', title: 'Build Your Diary', desc: 'Every review is private first. Only you see your food notes — the restaurant only sees public feedback.' },
];

export default function App() {
  // --- CORE STATE ---
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<'home' | 'review' | 'profile'>('home');
  const [homeView, setHomeView] = useState<'landing' | 'search'>('landing');
  const [selectedRestaurant, setSelectedRestaurant] = useState<any>(null);
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [menuSearchQuery, setMenuSearchQuery] = useState('');
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [diarySearchQuery, setDiarySearchQuery] = useState('');
  const [expandedDiaryRest, setExpandedDiaryRest] = useState<string | null>(null);
  const [diaryReviewLimit, setDiaryReviewLimit] = useState(3);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [username, setUsername] = useState('');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [itemReviews, setItemReviews] = useState<any[]>([]);
  const [reviewOffset, setReviewOffset] = useState(0);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [loadingMoreReviews, setLoadingMoreReviews] = useState(false);
  const [ratingThumbs, setRatingThumbs] = useState<boolean | null>(null);
  const [privateNote, setPrivateNote] = useState('');
  const [publicNote, setPublicNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [existingReviewId, setExistingReviewId] = useState<string | null>(null);
  const [existingReviewCreatedAt, setExistingReviewCreatedAt] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showLimit, setShowLimit] = useState(false);
  const [limitMsg, setLimitMsg] = useState({ title: 'Daily Limit Reached', body: "You've posted 5 reviews today.\nCome back tomorrow for more!" });
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [reviewStats, setReviewStats] = useState<Record<string, { up: number; total: number }>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [menuLoading, setMenuLoading] = useState(false);

  // --- PROFILE STATE ---
  const [profileUsername, setProfileUsername] = useState('');
  const [profileAvatar, setProfileAvatar] = useState(0);
  const [editingUsername, setEditingUsername] = useState(false);
  const [savingUsername, setSavingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [usernameLastChanged, setUsernameLastChanged] = useState<Date | null>(null);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarAnim = useRef(new Animated.Value(-300)).current;
  const sidebarOverlayAnim = useRef(new Animated.Value(0)).current;
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editedReviewIds, setEditedReviewIds] = useState<Set<string>>(new Set());
  // Home dropdown search
  const [searchDropdownVisible, setSearchDropdownVisible] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [homeSearchText, setHomeSearchText] = useState('');
  const [homeDropdownRestaurants, setHomeDropdownRestaurants] = useState<any[]>([]);
  const [homeDropdownDishes, setHomeDropdownDishes] = useState<any[]>([]);
  const homeSearchInputRef = useRef<TextInput>(null);
  const mainScrollRef = useRef<ScrollView>(null);

  // --- NEW STATE (13 changes) ---
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [onboardingSlide, setOnboardingSlide] = useState(0);
  const [favourites, setFavourites] = useState<string[]>([]);
  const [likedItems, setLikedItems] = useState<string[]>([]);
  const [likedItemDetails, setLikedItemDetails] = useState<any[]>([]);
  const [trendingDishes, setTrendingDishes] = useState<any[]>([]);
  const [restaurantRatings, setRestaurantRatings] = useState<Record<string, { pct: number; total: number }>>({});
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [menuSearchResults, setMenuSearchResults] = useState<any[]>([]);
  const [reviewStreak, setReviewStreak] = useState(0);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [diaryPage, setDiaryPage] = useState(0);
  const [diaryHasMore, setDiaryHasMore] = useState(false);
  const [diaryLoadingMore, setDiaryLoadingMore] = useState(false);

  const AVATAR_EMOJIS = ['🧑‍🍳', '🦊', '🐼', '🐨', '🐸', '🦁', '🐻', '🐙'];

  // Rate limiter for authentication attempts (5 minutes = 300000ms)
  const authRateLimiter = useRef(new RateLimiter('cravesync_auth_attempts', 5, 300000)).current;

  const getAvatarIndex = (name: string) => {
    // Deterministic hash based on name
    let hash = 0;
    const n = name || 'Deleted User';
    for (let i = 0; i < n.length; i++) hash = n.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash) % AVATAR_EMOJIS.length;
  };

  const canEditUsername = () => {
    if (!usernameLastChanged) return true;
    return (Date.now() - usernameLastChanged.getTime()) / (1000 * 60 * 60 * 24) >= 30;
  };

  const openSidebar = () => {
    sidebarOverlayAnim.setValue(0);
    setSidebarOpen(true);
    Animated.parallel([
      Animated.timing(sidebarAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(sidebarOverlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
  };

  const closeSidebar = () => {
    Animated.parallel([
      Animated.timing(sidebarAnim, { toValue: -300, duration: 250, useNativeDriver: true }),
      Animated.timing(sidebarOverlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setSidebarOpen(false));
  };

  const navigateFromSidebar = (tab: 'home' | 'review' | 'profile') => {
    closeSidebar();
    setTimeout(() => { setCurrentTab(tab); setSelectedRestaurant(null); setDetailItem(null); setHomeView('landing'); setSearchQuery(''); setMenuSearchResults([]); }, 250);
  };

  const validateUsername = (u: string): string | null => {
    const result = validateUsernameUtil(u);
    return result.isValid ? null : result.error || 'Invalid username';
  };

  // --- EFFECTS ---
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setReviewStreak(calcStreak(diaryEntries));
  }, [diaryEntries]);

  // Search history helpers
  const loadSearchHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem('cravesync_search_history');
      if (raw) setSearchHistory(JSON.parse(raw));
    } catch {}
  };

  const saveSearchToHistory = async (term: string) => {
    try {
      const trimmed = term.trim();
      if (!trimmed) return;
      const existing = searchHistory.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...existing].slice(0, 3);
      setSearchHistory(updated);
      await AsyncStorage.setItem('cravesync_search_history', JSON.stringify(updated));
    } catch {}
  };

  // Live results for home dropdown
  useEffect(() => {
    if (homeSearchText.length < 2) {
      setHomeDropdownRestaurants([]);
      setHomeDropdownDishes([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const [rests, dishes] = await Promise.all([
          supabase.from('restaurants').select('id, name, logo_url, address, cuisine_type').ilike('name', `%${homeSearchText}%`).limit(5),
          supabase.from('menu_items').select('id, name, price, image_url, menu_categories!inner(id, name, restaurant_id, restaurants(id, name))').ilike('name', `%${homeSearchText}%`).limit(5),
        ]);
        setHomeDropdownRestaurants(rests.data || []);
        setHomeDropdownDishes(dishes.data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [homeSearchText]);

  useEffect(() => {
    if (homeView !== 'search' || searchQuery.length < 2) { setMenuSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data, error } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, menu_categories!inner(id, name, restaurant_id, restaurants(id, name))')
          .ilike('name', `%${searchQuery}%`)
          .limit(8);
        if (error) {
          console.error('Search error:', error);
          setMenuSearchResults([]);
          return;
        }
        setMenuSearchResults(data || []);
      } catch (err) {
        console.error('Unexpected search error:', err);
        setMenuSearchResults([]);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery, homeView]);

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((currentTime - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  const fadeAnims = useRef<Animated.Value[]>([]);
  const slideAnims = useRef<Animated.Value[]>([]);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.username) setProfileUsername(user.user_metadata.username);
      if (typeof user?.user_metadata?.avatar_index === 'number') {
        setProfileAvatar(user.user_metadata.avatar_index);
        await supabase.from('users').update({ avatar_url: user.user_metadata.avatar_index.toString() }).eq('id', user.id);
      }
      if (user?.user_metadata?.username_last_changed) setUsernameLastChanged(new Date(user.user_metadata.username_last_changed));
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    AsyncStorage.getItem('cravesync_onboarding_v1').then(val => setOnboardingDone(val === 'done'));

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setSession(session);
      if (session) {
        fetchRestaurants();
        fetchDiary(session.user.id);
        loadUserProfile();
        fetchFavourites(session.user.id);
        fetchLikedItems(session.user.id);
        fetchTrending();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setResetPasswordMode(true);
        return;
      }
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setDiaryEntries([]);
        setDiaryPage(0);
        setDiaryHasMore(false);
        setRestaurants([]);
        setFavourites([]);
        setLikedItems([]);
        setLikedItemDetails([]);
        setTrendingDishes([]);
        return;
      }
      setSession(session);
      if (session) {
        fetchRestaurants();
        fetchDiary(session.user.id);
        loadUserProfile();
        fetchFavourites(session.user.id);
        fetchLikedItems(session.user.id);
        fetchTrending();
      }
    });

    const handleDeepLink = async (url: string) => {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params: Record<string, string> = {};
      fragment.split('&').forEach(p => { const [k, ...rest] = p.split('='); if (k) params[k] = decodeURIComponent(rest.join('=')); });
      if (params.type === 'recovery' && params.access_token) {
        await supabase.auth.setSession({ access_token: params.access_token, refresh_token: params.refresh_token || '' });
      }
    };

    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url); });
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));

    return () => { subscription.unsubscribe(); linkSub.remove(); };
  }, []);

  // --- DATA FETCHING ---

  const fetchRestaurantRatings = async (restIds: string[]) => {
    try {
      const { data: cats } = await supabase.from('menu_categories').select('id, restaurant_id').in('restaurant_id', restIds);
      if (!cats?.length) return;
      const catIds = cats.map((c: any) => c.id);
      const { data: items } = await supabase.from('menu_items').select('id, category_id').in('category_id', catIds);
      if (!items?.length) return;
      const itemIds = items.map((it: any) => it.id);
      const { data: revs } = await supabase.from('reviews_public').select('menu_item_id, rating_thumbs').in('menu_item_id', itemIds).not('rating_thumbs', 'is', null).limit(1000);
      const catToRest: Record<string, string> = {};
      cats.forEach((c: any) => { catToRest[c.id] = c.restaurant_id; });
      const itemToRest: Record<string, string> = {};
      items.forEach((it: any) => { itemToRest[it.id] = catToRest[it.category_id]; });
      const stats: Record<string, { up: number; total: number }> = {};
      (revs || []).forEach((r: any) => {
        const rid = itemToRest[r.menu_item_id];
        if (!rid) return;
        if (!stats[rid]) stats[rid] = { up: 0, total: 0 };
        stats[rid].total++;
        if (r.rating_thumbs) stats[rid].up++;
      });
      const ratings: Record<string, { pct: number; total: number }> = {};
      Object.entries(stats).forEach(([id, s]) => { ratings[id] = { pct: Math.round((s.up / s.total) * 100), total: s.total }; });
      setRestaurantRatings(ratings);
    } catch (err) { console.error('Ratings:', err); }
  };

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase.from('restaurants').select('*');
      if (error) throw error;
      const rests = data || [];
      setRestaurants(rests);
      if (rests.length) fetchRestaurantRatings(rests.map((r: any) => r.id));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchMenu = async (restaurantId: string) => {
    setMenuLoading(true);
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, description, image_url, menu_categories!inner(id, name, restaurant_id)')
        .eq('menu_categories.restaurant_id', restaurantId);
      if (error) throw error;
      const items = data || [];

      const statsPromise = items.length > 0
        ? supabase.from('reviews_public').select('menu_item_id, rating_thumbs').in('menu_item_id', items.map((it: any) => it.id)).not('rating_thumbs', 'is', null).limit(2000)
        : Promise.resolve({ data: [] });

      const { data: reviews } = await statsPromise;
      const stats: Record<string, { up: number; total: number }> = {};
      (reviews || []).forEach((r: any) => {
        if (!stats[r.menu_item_id]) stats[r.menu_item_id] = { up: 0, total: 0 };
        stats[r.menu_item_id].total++;
        if (r.rating_thumbs) stats[r.menu_item_id].up++;
      });

      setMenuItems(items);
      setReviewStats(stats);

      fadeAnims.current = items.map(() => new Animated.Value(0));
      slideAnims.current = items.map(() => new Animated.Value(12));
      items.forEach((_, i) => {
        Animated.parallel([
          Animated.timing(fadeAnims.current[i], { toValue: 1, duration: 200, delay: i * 30, useNativeDriver: true }),
          Animated.timing(slideAnims.current[i], { toValue: 0, duration: 200, delay: i * 30, useNativeDriver: true }),
        ]).start();
      });
    } catch (err) { console.error(err); }
    finally { setMenuLoading(false); }
  };

  const fetchDiary = async (userId?: string, page = 0, append = false) => {
    const uid = userId ?? session?.user?.id;
    if (!uid) return;
    if (append) setDiaryLoadingMore(true);
    try {
      const from = page * DIARY_PAGE_SIZE;
      const to = from + DIARY_PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from('reviews')
        .select(`
          id, created_at, rating_thumbs, private_note, public_note, photo_url, menu_item_id,
          menu_items (
            name, image_url,
            menu_categories (
              restaurants (name, logo_url)
            )
          )
        `, { count: 'exact' })
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw error;
      const entries = data || [];
      setDiaryEntries(prev => append ? [...prev, ...entries] : entries);
      setDiaryPage(page);
      setDiaryHasMore(from + entries.length < (count ?? 0));
    } catch (err) { console.error(err); }
    finally { if (append) setDiaryLoadingMore(false); }
  };

  const fetchFavourites = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('favourites').select('restaurant_id').eq('user_id', userId);
      if (error) {
        console.error('Error fetching favourites:', error);
        return;
      }
      setFavourites((data || []).map((f: any) => f.restaurant_id));
    } catch (err) {
      console.error('Unexpected error in fetchFavourites:', err);
    }
  };

  const fetchLikedItems = async (userId: string) => {
    try {
      const { data, error } = await supabase.from('liked_items').select('menu_item_id').eq('user_id', userId);
      if (error) {
        console.error('Error fetching liked items:', error);
        return;
      }
      const ids = (data || []).map((l: any) => l.menu_item_id);
      setLikedItems(ids);
      if (ids.length > 0) {
        const { data: items, error: itemsError } = await supabase
          .from('menu_items')
          .select('id, name, price, image_url, menu_categories!inner(id, name, restaurant_id, restaurants(id, name))')
          .in('id', ids);
        if (itemsError) {
          console.error('Error fetching liked item details:', itemsError);
          return;
        }
        setLikedItemDetails(items || []);
      } else {
        setLikedItemDetails([]);
      }
    } catch (err) {
      console.error('Unexpected error in fetchLikedItems:', err);
    }
  };

  const toggleLikedItem = async (itemId: string) => {
    if (!session?.user) return;
    const isLiked = likedItems.includes(itemId);
    if (isLiked) {
      await supabase.from('liked_items').delete().eq('user_id', session.user.id).eq('menu_item_id', itemId);
      setLikedItems(prev => prev.filter(id => id !== itemId));
      setLikedItemDetails(prev => prev.filter(it => it.id !== itemId));
    } else {
      await supabase.from('liked_items').insert({ user_id: session.user.id, menu_item_id: itemId });
      setLikedItems(prev => [...prev, itemId]);
      // fetch item detail to show on home screen
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url, menu_categories!inner(id, name, restaurant_id, restaurants(id, name))')
        .eq('id', itemId)
        .single();
      if (data) setLikedItemDetails(prev => [...prev, data]);
    }
  };

  const fetchTrending = async () => {
    try {
      const { data: revs } = await supabase.from('reviews_public').select('menu_item_id, rating_thumbs').not('rating_thumbs', 'is', null).order('created_at', { ascending: false }).limit(600);
      if (!revs?.length) return;
      const agg: Record<string, { up: number; total: number }> = {};
      revs.forEach((r: any) => {
        if (!agg[r.menu_item_id]) agg[r.menu_item_id] = { up: 0, total: 0 };
        agg[r.menu_item_id].total++;
        if (r.rating_thumbs) agg[r.menu_item_id].up++;
      });
      const topIds = Object.entries(agg)
        .filter(([_, s]) => s.total >= 1 && s.up / s.total >= 0.5)
        .sort((a, b) => (b[1].up / b[1].total) - (a[1].up / a[1].total))
        .slice(0, 6).map(([id]) => id);
      if (!topIds.length) return;
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, price, image_url, menu_categories!inner(id, name, restaurant_id, restaurants(id, name, logo_url))')
        .in('id', topIds);
      if (items?.length) setTrendingDishes(items);
    } catch (err) { console.error('Trending:', err); }
  };

  const toggleFavourite = async (restId: string) => {
    if (!session?.user) return;
    const isFav = favourites.includes(restId);
    try {
      if (isFav) {
        await supabase.from('favourites').delete().eq('user_id', session.user.id).eq('restaurant_id', restId);
        setFavourites(prev => prev.filter(id => id !== restId));
      } else {
        await supabase.from('favourites').insert({ user_id: session.user.id, restaurant_id: restId });
        setFavourites(prev => [...prev, restId]);
      }
    } catch (err) { console.error(err); }
  };

  const takePhotoWithCamera = async () => {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access to take a photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      setReviewImage(compressed);
    }
  };

  const pickFromGallery = async () => {
    setShowPhotoPicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to pick from gallery.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]) {
      const compressed = await compressImage(result.assets[0].uri);
      setReviewImage(compressed);
    }
  };

  const uploadReviewImage = async (localUri: string): Promise<string | null> => {
    try {
      const filename = `${session!.user.id}/${Date.now()}.jpg`;

      // Use ImageManipulator (already a working dependency) to extract base64.
      // fetch+blob/arrayBuffer are unreliable on React Native for local file URIs.
      const manipResult = await ImageManipulator.manipulateAsync(
        localUri,
        [],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      if (!manipResult.base64) throw new Error('Could not read image data');

      // Decode base64 → ArrayBuffer
      const binaryString = atob(manipResult.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error } = await supabase.storage
        .from('review-photos')
        .upload(filename, bytes.buffer, {
          contentType: 'image/jpeg',
          cacheControl: '3600',
          upsert: true,
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from('review-photos').getPublicUrl(filename);
      return urlData.publicUrl;
    } catch (err) {
      console.error('Upload failed:', err);
      return null;
    }
  };

  const handleRestaurantSelect = (rest: any) => {
    setSelectedRestaurant(rest);
    fetchMenu(rest.id);
  };

  const handleDishSearchSelect = async (dish: any) => {
    const restId = dish.menu_categories?.restaurant_id;
    if (!restId) return;
    let restObj = restaurants.find((r: any) => r.id === restId);
    if (!restObj) {
      const { data } = await supabase.from('restaurants').select('*').eq('id', restId).single();
      restObj = data;
    }
    if (!restObj) return;
    setSelectedRestaurant(restObj);
    fetchMenu(restObj.id);
    openDetailPage(dish);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setAuthError('Please enter your email to reset password.');
      return;
    }
    const isAllowed = await authRateLimiter.isAllowed();
    if (!isAllowed) {
      setAuthError('Too many attempts. Please try again in 5 minutes.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'cravesync://reset-password' });
      if (error) throw error;
      setResetEmailSent(true);
    } catch (err: any) {
      setAuthError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSetNewPassword = async () => {
    if (newPassword.length < 8) { setResetError('Password must be at least 8 characters.'); return; }
    if (newPassword !== newPasswordConfirm) { setResetError('Passwords do not match.'); return; }
    setResetLoading(true);
    setResetError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setResetPasswordMode(false);
      setNewPassword('');
      setNewPasswordConfirm('');
      Alert.alert('Password Updated', 'Your password has been changed. You can now log in.');
    } catch {
      setResetError('Failed to update password. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleAuth = async (signUp: boolean) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      if (signUp) {
        // --- SIGN UP: validate everything client-side first ---
        const emailValidation = validateEmail(email);
        if (!emailValidation.isValid) throw new Error(emailValidation.error);

        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) throw new Error(passwordValidation.errors[0] || 'Password does not meet requirements');

        const usernameErr = validateUsername(username);
        if (usernameErr) throw new Error(usernameErr);

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username.trim() } }
        });
        if (error) {
          if (error.message.includes('already registered')) {
            throw new Error('This email is already registered. Please sign in instead.');
          }
          throw new Error(error.message || 'Sign up failed. Please try again.');
        }
        setProfileUsername(username.trim());
        setShowWelcome(true);
        setTimeout(() => setShowWelcome(false), 3000);
      } else {
        // --- SIGN IN: rate limit + let Supabase handle all validation ---
        const isAllowed = await authRateLimiter.isAllowed();
        if (!isAllowed) throw new Error('Too many attempts. Please try again in 5 minutes.');

        if (!email.trim() || !password) throw new Error('Please enter your email and password.');

        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw new Error('Invalid email or password.');

        const { data: { user } } = await supabase.auth.getUser();
        if (user?.user_metadata?.username) setProfileUsername(user.user_metadata.username);
        if (user?.user_metadata?.username_last_changed) setUsernameLastChanged(new Date(user.user_metadata.username_last_changed));
        await authRateLimiter.reset();
      }
    } catch (error: any) {
      console.error('Auth error:', error.message);
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const saveUsername = async () => {
    if (savingUsername) return;
    const err = validateUsername(newUsername);
    if (err) { Alert.alert('Invalid Username', err); return; }
    if (!canEditUsername()) return;
    setSavingUsername(true);
    try {
      const now = new Date();
      const { error } = await supabase.auth.updateUser({ data: { username: newUsername.trim(), username_last_changed: now.toISOString() } });
      if (error) throw error;
      // Keep public.users in sync so reviews show the updated username
      await supabase.from('users').update({ username: newUsername.trim(), full_name: newUsername.trim() }).eq('id', session!.user.id);
      setProfileUsername(newUsername.trim());
      setUsernameLastChanged(now);
      setEditingUsername(false);
    } catch (err: any) { Alert.alert('Error', err.message); }
    finally { setSavingUsername(false); }
  };

  const deleteReview = async (reviewId: string) => {
    try {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
      // Remove from local diary state immediately
      setDiaryEntries(prev => prev.filter(e => e.id !== reviewId));
      setEditedReviewIds(prev => { const s = new Set(prev); s.delete(reviewId); return s; });
    } catch (err: any) {
      Alert.alert('Error', 'Could not delete review. Please try again.');
    }
  };

  const closeModal = () => {
    setSelectedItem(null); setRatingThumbs(null); setPrivateNote(''); setPublicNote('');
    setExistingReviewId(null); setExistingReviewCreatedAt(null); setReviewImage(null); setShowPhotoPicker(false);
  };

  const openReviewModal = (item: any) => {
    if (!session?.user) return;
    setSelectedItem(item);
    setRatingThumbs(null); setPrivateNote(''); setPublicNote('');
    setExistingReviewId(null); setExistingReviewCreatedAt(null); setReviewImage(null);
  };

  const openEditModal = (review: any) => {
    const minsElapsed = (Date.now() - new Date(review.created_at).getTime()) / 60000;
    if (minsElapsed > 5) {
      Alert.alert('Edit Window Closed', 'Reviews can only be edited within 5 minutes of submission.');
      return;
    }
    setSelectedItem(review.menu_items);
    setExistingReviewId(review.id);
    setExistingReviewCreatedAt(review.created_at);
    setRatingThumbs(review.rating_thumbs);
    setPrivateNote(review.private_note || '');
    setPublicNote(review.public_note || '');
    setReviewImage(review.photo_url || null);
  };

  const submitReview = async () => {
    if (!selectedItem || !session?.user) {
      Alert.alert('System Error', 'Session or Item not found. Please reload.');
      return;
    }
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (reviewImage) {
        if (reviewImage.startsWith('http')) {
          // Already uploaded (e.g. from existing review)
          photoUrl = reviewImage;
        } else {
          // Local URI, needs upload
          photoUrl = await uploadReviewImage(reviewImage);
          if (!photoUrl) {
            Alert.alert('Upload Failed', 'The photo could not be uploaded. Please check your connection and try again.');
            setSubmitting(false);
            return;
          }
        }
      }

      if (existingReviewId) {
        // Preserve the existing photo if the user didn't change it
        const finalPhotoUrl = photoUrl !== null ? photoUrl : (reviewImage?.startsWith('http') ? reviewImage : null);
        const updates: any = { rating_thumbs: ratingThumbs, private_note: privateNote, public_note: publicNote, photo_url: finalPhotoUrl };
        const { data: updatedRows, error } = await supabase
          .from('reviews')
          .update(updates)
          .eq('id', existingReviewId)
          .select('id, rating_thumbs, public_note, private_note, photo_url');
        if (error) {
          console.error('Review update error:', error);
          throw error;
        }
        // If 0 rows returned, RLS silently blocked the update
        if (!updatedRows || updatedRows.length === 0) {
          console.error('Review update blocked silently — 0 rows updated. Check RLS and auth session.');
          throw new Error('Could not save your edit. Please sign out and sign in again, then try again.');
        }
        console.log('Review updated successfully:', updatedRows[0]);
        // Sync update to BOTH diary and public item reviews instantly
        const updatedId = existingReviewId;
        setDiaryEntries(prev => prev.map(e =>
          e.id === updatedId
            ? { ...e, rating_thumbs: ratingThumbs, private_note: privateNote, public_note: publicNote, photo_url: finalPhotoUrl, _edited: true }
            : e
        ));
        setItemReviews(prev => prev.map(r =>
          r.id === updatedId
            ? { ...r, rating_thumbs: ratingThumbs, public_note: publicNote, photo_url: finalPhotoUrl }
            : r
        ));
        setEditedReviewIds(prev => new Set(prev).add(updatedId));
        // Also refresh from DB so the item detail page has confirmed data when user navigates to it
        const editedEntry = diaryEntries.find(e => e.id === updatedId);
        if (editedEntry?.menu_item_id) {
          fetchItemReviews(editedEntry.menu_item_id, 0, false);
        } else if (detailItem?.id) {
          fetchItemReviews(detailItem.id, 0, false);
        }
        setReviewImage(null);
        closeModal();
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
        return; // Skip the insert path and the fetchDiary call below
      } else {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        
        const [totalRes, itemRes] = await Promise.all([
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).gte('created_at', todayStart),
          supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id).eq('menu_item_id', selectedItem.id).gte('created_at', todayStart)
        ]);

        const totalToday = totalRes.count ?? 0;
        const itemToday = itemRes.count ?? 0;

        if (itemToday >= 2) {
          setSubmitting(false);
          setLimitMsg({ title: 'Already Reviewed Today', body: "You've reviewed this dish twice today.\nCome back tomorrow to review again!" });
          setShowLimit(true);
          setTimeout(() => setShowLimit(false), 4000);
          return;
        }
        if (totalToday >= 5) {
          setSubmitting(false);
          setLimitMsg({ title: 'Daily Limit Reached', body: "You've posted 5 reviews today.\nCome back tomorrow for more!" });
          setShowLimit(true);
          setTimeout(() => setShowLimit(false), 4000);
          return;
        }

        const insert: any = { 
          user_id: session.user.id, 
          menu_item_id: selectedItem.id, 
          rating_thumbs: ratingThumbs, 
          private_note: privateNote, 
          public_note: publicNote
        };
        if (photoUrl) insert.photo_url = photoUrl;
        const { error } = await supabase.from('reviews').insert(insert);
        if (error) throw error;
      }
      setReviewImage(null);
      closeModal();
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2500);
      fetchDiary();
      if (selectedRestaurant) fetchMenu(selectedRestaurant.id);
      if (detailItem) fetchItemReviews(detailItem.id, 0, false);
    } catch (err: any) {
      const hint = err?.message || '';
      if (hint.includes('DAILY_LIMIT_REACHED') || hint.includes('Daily review limit')) {
        setLimitMsg({ title: 'Daily Limit Reached', body: "You've posted 5 reviews today.\nCome back tomorrow for more!" });
        setShowLimit(true);
        setTimeout(() => setShowLimit(false), 4000);
      } else if (hint.includes('ITEM_LIMIT_REACHED') || hint.includes('Item review limit')) {
        setLimitMsg({ title: 'Already Reviewed Today', body: "You've reviewed this dish twice today.\nCome back tomorrow to review again!" });
        setShowLimit(true);
        setTimeout(() => setShowLimit(false), 4000);
      } else if (hint.includes('EDIT_WINDOW_EXPIRED') || hint.includes('edit window')) {
        Alert.alert('Edit Window Closed', 'Reviews can only be edited within 5 minutes of submission.');
      } else {
        Alert.alert('Submission Error', err?.message || err?.details || JSON.stringify(err) || 'An unexpected error occurred.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreBadge = (itemId: string) => {
    const stat = reviewStats[itemId];
    if (!stat || stat.total < 3) return null;
    const pct = Math.round((stat.up / stat.total) * 100);
    if (pct < 70) return null;
    return `🔥 ${pct}% loved this`;
  };

  const getScorePercent = (itemId: string) => {
    const stat = reviewStats[itemId];
    if (!stat || stat.total === 0) return null;
    return { pct: Math.round((stat.up / stat.total) * 100), total: stat.total };
  };

  const openDetailPage = async (item: any) => {
    if (currentTab === 'review') {
      openReviewModal(item);
    } else {
      setDetailItem(item);
      setItemReviews([]);
      setReviewOffset(0);
      setReviewTotal(0);
      fetchItemReviews(item.id, 0, false);
    }
  };

  const fetchItemReviews = async (itemId: string, offset: number, append: boolean) => {
    setLoadingMoreReviews(true);
    try {
      const [countResult, dataResult] = await Promise.all([
        supabase.from('reviews_public').select('id', { count: 'exact', head: true }).eq('menu_item_id', itemId).neq('public_note', ''),
        supabase.from('reviews_public').select('id, rating_thumbs, public_note, photo_url, created_at, user_id, owner_reply, users(full_name, username, avatar_url)').eq('menu_item_id', itemId).neq('public_note', '').order('created_at', { ascending: false }).range(offset, offset + 2),
      ]);
      setReviewTotal(countResult.count || 0);
      if (append) { setItemReviews(prev => [...prev, ...(dataResult.data || [])]); }
      else { setItemReviews(dataResult.data || []); }
      setReviewOffset(offset + 3);
    } catch (err) { console.error(err); }
    finally { setLoadingMoreReviews(false); }
  };

  const filteredRestaurants = useMemo(() =>
    restaurants.filter(r =>
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.cuisine_type || '').toLowerCase().includes(searchQuery.toLowerCase())
    ),
  [restaurants, searchQuery]);

  const priceRange = useMemo(() => getPriceRange(menuItems), [menuItems]);

  const searchDropOpen = searchDropdownVisible && (homeSearchText.length >= 2 || searchHistory.length > 0);

  // --- SPLASH / LOADING GUARD ---
  if (onboardingDone === null || (loading && !session)) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0b1220', justifyContent: 'center', alignItems: 'center' }}>
        <ExpoStatusBar style="light" backgroundColor="#0b1220" translucent={false} />
        <CraveSyncMark size={110} tileColor="#0b1220" accent="#00A86B" />
        <Text style={{ color: '#ffffff', fontSize: 34, fontWeight: '800', marginTop: 24, letterSpacing: -0.5 }}>
          Crave<Text style={{ color: '#00A86B' }}>Sync</Text>
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 8, fontWeight: '500', letterSpacing: 0.3 }}>
          Your personal food memory
        </Text>
      </View>
    );
  }

  // --- ONBOARDING SCREEN ---
  if (!onboardingDone) {
    const slide = ONBOARDING_SLIDES[onboardingSlide];
    const isLast = onboardingSlide === ONBOARDING_SLIDES.length - 1;
    const finishOnboarding = async () => {
      await AsyncStorage.setItem('cravesync_onboarding_v1', 'done');
      setOnboardingDone(true);
    };
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'space-between' }]}>
        <ExpoStatusBar style="dark" backgroundColor="#F8F9FA" translucent={false} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
          <Text style={{ fontSize: 88, marginBottom: 28 }}>{slide.emoji}</Text>
          <Text style={{ color: '#111', fontSize: 26, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 }}>{slide.title}</Text>
          <Text style={{ color: '#666', fontSize: 16, textAlign: 'center', lineHeight: 26 }}>{slide.desc}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 }}>
          {ONBOARDING_SLIDES.map((_, i) => (
            <View key={i} style={{ width: i === onboardingSlide ? 28 : 8, height: 8, borderRadius: 4, backgroundColor: i === onboardingSlide ? '#00A86B' : '#DDD' }} />
          ))}
        </View>
        <View style={{ paddingHorizontal: 24, paddingBottom: 40, gap: 12 }}>
          <TouchableOpacity style={styles.submitButton} onPress={() => isLast ? finishOnboarding() : setOnboardingSlide(s => s + 1)}>
            <Text style={styles.submitButtonText}>{isLast ? 'Get Started' : 'Next'}</Text>
          </TouchableOpacity>
          {!isLast && (
            <TouchableOpacity onPress={finishOnboarding} style={{ padding: 10, alignItems: 'center' }}>
              <Text style={{ color: '#888', fontSize: 14 }}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    if (currentTab === 'home') {
      if (selectedRestaurant) {
        await fetchMenu(selectedRestaurant.id);
        if (detailItem) await fetchItemReviews(detailItem.id, 0, false);
      } else {
        await fetchRestaurants();
      }
    } else {
      await fetchDiary();
    }
    setRefreshing(false);
  };

  // --- RESET PASSWORD SCREEN ---
  if (resetPasswordMode) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="dark" backgroundColor="#F8F9FA" translucent={false} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }} keyboardShouldPersistTaps="handled">
            <View style={{ alignSelf: 'center', marginBottom: 24 }}>
              <CraveSyncLogo size={32} textColor="#0b1220" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: '#111', marginBottom: 6 }}>Set New Password</Text>
            <Text style={{ fontSize: 14, color: '#666', marginBottom: 28 }}>Choose a strong password for your account.</Text>
            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={newPassword}
              onChangeText={t => { setNewPassword(t); setResetError(''); }}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, { marginTop: 12 }]}
              placeholder="Confirm new password"
              placeholderTextColor="#aaa"
              secureTextEntry
              value={newPasswordConfirm}
              onChangeText={t => { setNewPasswordConfirm(t); setResetError(''); }}
              autoCapitalize="none"
            />
            {resetError ? <Text style={{ color: '#EF4444', fontSize: 13, marginTop: 8 }}>{resetError}</Text> : null}
            <TouchableOpacity
              onPress={handleSetNewPassword}
              disabled={resetLoading}
              style={{ backgroundColor: '#00A86B', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20 }}>
              {resetLoading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Update Password</Text>}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // --- AUTH SCREEN ---
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <ExpoStatusBar style="dark" backgroundColor="#F8F9FA" translucent={false} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={{ alignSelf: 'center', marginBottom: 16 }}>
              <CraveSyncLogo size={32} textColor="#0b1220" />
            </View>
            <Text style={styles.authSubtitle}>Your personal food memory, every bite.</Text>
            {authError ? <Text style={{ color: '#ef4444', marginBottom: 8, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>{authError}</Text> : null}
            {isSignUp && (
              <TextInput style={[styles.textInput, { marginBottom: 12 }]} placeholder="Username (e.g. hamza_eats)" placeholderTextColor="#888"
                value={username} onChangeText={t => { setUsername(t); setAuthError(''); }} autoCapitalize="none" />
            )}
            <TextInput style={[styles.textInput, { marginBottom: 12 }]} placeholder="Email address" placeholderTextColor="#888"
              value={email} onChangeText={t => { setEmail(t); setAuthError(''); }} autoCapitalize="none" keyboardType="email-address" />
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 14, borderWidth: 1, borderColor: '#EAEAEA', paddingRight: 16 }}>
              <TextInput style={{ flex: 1, color: '#111', fontSize: 16, padding: 15 }} placeholder="Password" placeholderTextColor="#888"
                value={password} onChangeText={t => { setPassword(t); setAuthError(''); }} secureTextEntry={!showPassword} />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff color="#888" size={20} /> : <Eye color="#888" size={20} />}
              </TouchableOpacity>
            </View>
            {!isSignUp && (
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignSelf: 'flex-end', marginTop: 12 }} disabled={authLoading}>
                <Text style={{ color: authLoading ? '#888' : '#00A86B', fontSize: 14, fontWeight: '600' }}>Forgot password?</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.submitButton, { marginTop: 20 }]} onPress={() => handleAuth(isSignUp)} disabled={authLoading}>
              {authLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitButtonText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={{ marginTop: 24, padding: 10 }} onPress={() => { setIsSignUp(!isSignUp); setAuthError(''); setEmail(''); setPassword(''); setUsername(''); }} disabled={authLoading}>
              <Text style={{ color: '#666', textAlign: 'center', fontSize: 14 }}>
                {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={{ color: '#00A86B', fontWeight: '700' }}>{isSignUp ? 'Sign In' : 'Create an account'}</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal visible={resetEmailSent} transparent animationType="fade">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 36, alignItems: 'center', width: '80%', borderWidth: 1, borderColor: '#DCFCE7', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 16 }}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 36 }}>📧</Text>
              </View>
              <Text style={{ color: '#111', fontWeight: '800', fontSize: 20, marginBottom: 8, textAlign: 'center' }}>Check your inbox</Text>
              <Text style={{ color: '#555', fontSize: 14, textAlign: 'center', lineHeight: 21, marginBottom: 6 }}>
                A password reset link has been sent to your email.
              </Text>
              <Text style={{ color: '#00A86B', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 24 }}>
                Don't forget to check spam.
              </Text>
              <TouchableOpacity
                onPress={() => setResetEmailSent(false)}
                style={{ backgroundColor: '#00A86B', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32 }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    );
  }

  // --- MAIN APP ---
  return (
    <SafeAreaView style={styles.container}>
      <ExpoStatusBar style="dark" backgroundColor="#F8F9FA" translucent={false} />
      {/* HEADER */}
      <View style={[styles.header, (detailItem || selectedRestaurant) && { borderBottomWidth: 0 }]}>
        {(selectedRestaurant || (currentTab === 'home' && homeView === 'search')) ? (
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => {
          if (detailItem) { setDetailItem(null); setItemReviews([]); }
            else if (selectedRestaurant) { setSelectedRestaurant(null); setMenuSearchQuery(''); }
            else { setHomeView('landing'); setSearchQuery(''); setMenuSearchResults([]); }
          }}>
            <ArrowLeft color="#111" size={22} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, { color: '#111', fontSize: 18 }]}>{detailItem ? selectedRestaurant?.name : selectedRestaurant ? 'Restaurants' : 'Search'}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <TouchableOpacity onPress={openSidebar}><Menu color="#111" size={24} /></TouchableOpacity>
            </View>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <TouchableOpacity onPress={() => { setCurrentTab('home'); setSelectedRestaurant(null); setDetailItem(null); setHomeView('landing'); setSearchQuery(''); setMenuSearchResults([]); }}>
                <CraveSyncLogo size={18} textColor="#111" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <TouchableOpacity onPress={() => setCurrentTab('profile')} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#00A86B' }}>
                <Text style={{ fontSize: 18 }}>{AVATAR_EMOJIS[profileAvatar]}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        overScrollMode="never"
        bounces={true}
        onScrollBeginDrag={() => { setSearchDropdownVisible(false); Keyboard.dismiss(); }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00A86B" colors={['#00A86B']} progressBackgroundColor="#fff" />}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#00A86B" style={{ marginTop: 60 }} />

        ) : currentTab === 'home' && homeView === 'landing' && !selectedRestaurant ? (
          /* ---- HOME LANDING ---- */
          <>
            {/* HOME SEARCH BAR — connected dropdown */}
            <View style={{ zIndex: 100, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: searchDropOpen ? '#00A86B' : '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2, marginBottom: 20, marginHorizontal: -6, overflow: 'hidden' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 }}>
                <Search color={searchDropOpen ? '#00A86B' : '#888'} size={18} style={{ marginRight: 10 }} />
                <TextInput
                  ref={homeSearchInputRef}
                  style={styles.searchInput}
                  placeholder="Search restaurants & dishes..."
                  placeholderTextColor="#aaa"
                  value={homeSearchText}
                  onChangeText={setHomeSearchText}
                  onFocus={() => { loadSearchHistory(); setSearchDropdownVisible(true); }}
                  onBlur={() => setTimeout(() => setSearchDropdownVisible(false), 180)}
                />
                {homeSearchText.length > 0 && (
                  <TouchableOpacity
                    onPress={() => { setHomeSearchText(''); setHomeDropdownRestaurants([]); setHomeDropdownDishes([]); homeSearchInputRef.current?.focus(); }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    style={{ padding: 8 }}>
                    <X color="#555" size={18} />
                  </TouchableOpacity>
                )}
              </View>

              {searchDropOpen && (
                <View style={{ borderTopWidth: 1, borderTopColor: '#F0F0F0' }}>
                  {homeSearchText.length < 2 ? (
                    searchHistory.length > 0 ? (
                      <>
                        <Text style={{ fontSize: 11, color: '#aaa', fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, letterSpacing: 0.8 }}>RECENT SEARCHES</Text>
                        {searchHistory.map((term, i) => (
                          <TouchableOpacity key={i} onPress={() => setHomeSearchText(term)}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F5F5F5' }}>
                            <Clock color="#bbb" size={15} style={{ marginRight: 12 }} />
                            <Text style={{ color: '#333', fontSize: 14, flex: 1 }}>{term}</Text>
                            <ChevronRight color="#ddd" size={14} />
                          </TouchableOpacity>
                        ))}
                        <View style={{ height: 8 }} />
                      </>
                    ) : null
                  ) : (
                    <View>
                      {homeDropdownRestaurants.length > 0 && (
                        <>
                          <Text style={{ fontSize: 11, color: '#aaa', fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, letterSpacing: 0.8 }}>RESTAURANTS</Text>
                          {homeDropdownRestaurants.map((rest, i) => (
                            <TouchableOpacity key={rest.id}
                              onPress={() => { saveSearchToHistory(rest.name); setSearchDropdownVisible(false); setHomeSearchText(''); Keyboard.dismiss(); handleRestaurantSelect(rest); }}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F5F5F5' }}>
                              {rest.logo_url
                                ? <Image source={{ uri: rest.logo_url }} style={{ width: 38, height: 38, borderRadius: 10, marginRight: 12 }} />
                                : <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}><Text style={{ fontSize: 18 }}>🍽️</Text></View>}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#111', fontSize: 14, fontWeight: '700' }}>{rest.name}</Text>
                                <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>{rest.address || 'Karachi'}</Text>
                              </View>
                              <ChevronRight color="#ccc" size={16} />
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                      {homeDropdownDishes.length > 0 && (
                        <>
                          <Text style={{ fontSize: 11, color: '#aaa', fontWeight: '700', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 6, letterSpacing: 0.8, borderTopWidth: homeDropdownRestaurants.length > 0 ? 1 : 0, borderTopColor: '#EAEAEA' }}>DISHES</Text>
                          {homeDropdownDishes.map((dish, i) => (
                            <TouchableOpacity key={dish.id}
                              onPress={() => { saveSearchToHistory(dish.name); setSearchDropdownVisible(false); setHomeSearchText(''); Keyboard.dismiss(); handleDishSearchSelect(dish); }}
                              style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F5F5F5' }}>
                              {dish.image_url
                                ? <Image source={{ uri: dish.image_url }} style={{ width: 38, height: 38, borderRadius: 10, marginRight: 12 }} resizeMode="cover" />
                                : <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#FFF8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}><Text style={{ fontSize: 18 }}>🥘</Text></View>}
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: '#111', fontSize: 14, fontWeight: '700' }}>{dish.name}</Text>
                                <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>at {dish.menu_categories?.restaurants?.name || 'Restaurant'} · PKR {dish.price}</Text>
                              </View>
                              <ChevronRight color="#ccc" size={16} />
                            </TouchableOpacity>
                          ))}
                        </>
                      )}
                      {homeDropdownRestaurants.length === 0 && homeDropdownDishes.length === 0 && (
                        <Text style={{ color: '#bbb', textAlign: 'center', padding: 20, fontSize: 14 }}>No results for "{homeSearchText}"</Text>
                      )}
                      <View style={{ height: 8 }} />
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* FAVOURITE DISHES */}
            {likedItemDetails.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>❤️ Your Favourite Dishes</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 28 }}>
                  {likedItemDetails.map(dish => (
                    <TouchableOpacity key={'liked-' + dish.id} style={{ marginRight: 14, width: 150, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#DCFCE7', shadowColor: '#00A86B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 3 }}
                      onPress={() => handleDishSearchSelect(dish)}>
                      <View style={{ position: 'relative' }}>
                        <Image source={{ uri: getItemImage(dish) }} style={{ width: '100%', height: 100 }} resizeMode="cover" />
                        <TouchableOpacity
                          style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 14, padding: 5 }}
                          onPress={() => toggleLikedItem(dish.id)}
                        >
                          <Heart color="#EF4444" fill="#EF4444" size={14} />
                        </TouchableOpacity>
                      </View>
                      <View style={{ padding: 10 }}>
                        <Text style={{ color: '#111', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{dish.name}</Text>
                        <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }} numberOfLines={1}>at {dish.menu_categories?.restaurants?.name || 'Restaurant'}</Text>
                        <Text style={{ color: '#00A86B', fontSize: 12, fontWeight: '700', marginTop: 4 }}>PKR {dish.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}





            {/* TRENDING DISHES */}
            {trendingDishes.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>🔥 Trending Dishes</Text>
                <Text style={{ color: '#666', fontSize: 14, marginBottom: 16, marginTop: -10 }}>Top-rated bites everyone is ordering</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginHorizontal: -20, marginBottom: 28 }}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 8 }}
                >
                  {trendingDishes.map(dish => (
                    <TouchableOpacity key={'td-' + dish.id} style={{ marginRight: 14, width: 150, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 8, elevation: 4 }}
                      onPress={() => handleDishSearchSelect(dish)}>
                      <Image source={{ uri: getItemImage(dish) }} style={{ width: '100%', height: 100, borderTopLeftRadius: 16, borderTopRightRadius: 16 }} resizeMode="cover" />
                      <View style={{ padding: 10 }}>
                        <Text style={{ color: '#111', fontSize: 13, fontWeight: '700' }} numberOfLines={1}>{dish.name}</Text>
                        <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }} numberOfLines={1}>at {dish.menu_categories?.restaurants?.name || 'Restaurant'}</Text>
                        <Text style={{ color: '#00A86B', fontSize: 12, fontWeight: '700', marginTop: 4 }}>PKR {dish.price}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

            {/* TRENDING RESTAURANTS */}
            <Text style={styles.sectionTitle}>Trending Near You</Text>
            <Text style={{ color: '#666', fontSize: 14, marginBottom: 16, marginTop: -10 }}>Highly-rated spots everyone is talking about</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -20, paddingHorizontal: 20, marginBottom: 30 }}>
              {restaurants.map(rest => {
                const rating = restaurantRatings[rest.id];
                const openStatus = isOpenNow(rest.opening_hours);
                const tags = rest.cuisine_type ? (rest.cuisine_type as string).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                return (
                  <TouchableOpacity key={'trend-' + rest.id} style={[styles.restaurantCard, { width: 260, flexDirection: 'column', alignItems: 'flex-start', marginRight: 16, padding: 0, overflow: 'hidden' }]} onPress={() => handleRestaurantSelect(rest)}>
                    <View style={{ position: 'relative', width: '100%' }}>
                      <Image source={{ uri: getRestaurantImage(rest) }} style={{ width: '100%', height: 130, borderRadius: 0 }} resizeMode="cover" />
                      {openStatus !== null && (
                        <View style={{ position: 'absolute', top: 10, left: 10, backgroundColor: openStatus ? '#00A86B' : '#EF4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{openStatus ? '● Open' : '● Closed'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 14, width: '100%' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ color: '#111', fontSize: 15, fontWeight: '700', flex: 1 }} numberOfLines={1}>{rest.name}</Text>
                        {rating && rating.total >= 3 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Text style={{ color: '#00A86B', fontSize: 11 }}>★</Text>
                            <Text style={{ color: '#444', fontWeight: '700', fontSize: 11 }}>{rating.pct}%</Text>
                          </View>
                        ) : (
                          <Text style={{ color: '#BBB', fontSize: 11 }}>New</Text>
                        )}
                      </View>
                      <Text style={{ color: '#888', fontSize: 11, marginBottom: 10 }} numberOfLines={1}>📍 {rest.address || 'Karachi'}</Text>
                      {tags.length > 0 && (
                        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                          {tags.slice(0, 2).map(tag => (
                            <View key={tag} style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 }}>
                              <Text style={{ color: '#00A86B', fontSize: 10, fontWeight: '700' }}>{tag}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* TOP RECOMMENDED */}
            <Text style={styles.sectionTitle}>Top Recommended</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              {restaurants.slice().reverse().map((rest, idx) => {
                const rating = restaurantRatings[rest.id];
                const openStatus = isOpenNow(rest.opening_hours);
                const tags = rest.cuisine_type ? (rest.cuisine_type as string).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                return (
                  <TouchableOpacity key={'rec-' + rest.id} style={{ width: '47.5%', backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#EAEAEA', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 }}
                    onPress={() => handleRestaurantSelect(rest)}>
                    <View style={{ position: 'relative' }}>
                      <Image source={{ uri: getRestaurantImage(rest) }} style={{ width: '100%', height: 110 }} resizeMode="cover" />
                      {openStatus !== null && (
                        <View style={{ position: 'absolute', bottom: 6, left: 6, backgroundColor: openStatus ? '#00A86B' : '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{openStatus ? '● Open' : '● Closed'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ padding: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <Text style={{ color: '#111', fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={1}>{rest.name}</Text>
                        {idx === 0 && <View style={{ backgroundColor: '#00A86B', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 }}><Text style={{ color: '#fff', fontSize: 8, fontWeight: '700' }}>AD</Text></View>}
                      </View>
                      {tags.length > 0 && <Text style={{ color: '#888', fontSize: 10, marginBottom: 4 }} numberOfLines={1}>{tags.slice(0, 2).join(' · ')}</Text>}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ color: '#00A86B', fontSize: 11 }}>★</Text>
                        <Text style={{ color: '#444', fontSize: 11, fontWeight: '700' }}>
                          {rating && rating.total >= 3 ? `${rating.pct}%` : 'New'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>

        ) : (currentTab === 'home' || currentTab === 'review') ? (
          selectedRestaurant ? (
            /* ---- RESTAURANT VIEW ---- */
            detailItem ? (
              /* ITEM DETAIL PAGE */
              <>
                <Image source={{ uri: getItemImage(detailItem) }} style={{ width: SCREEN_WIDTH, marginLeft: -20, marginTop: -20, height: 190, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, marginBottom: 20 }} resizeMode="cover" />
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text style={[styles.sectionTitle, { flex: 1, marginBottom: 0 }]}>{detailItem.name}</Text>
                  <TouchableOpacity onPress={() => toggleLikedItem(detailItem.id)} style={{ padding: 6, marginTop: 2 }}>
                    <Heart
                      color={likedItems.includes(detailItem.id) ? '#EF4444' : '#D1D5DB'}
                      fill={likedItems.includes(detailItem.id) ? '#EF4444' : 'none'}
                      size={26}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={{ color: '#00A86B', fontWeight: '700', fontSize: 16, marginBottom: 16 }}>PKR {detailItem.price}</Text>
                {(() => {
                  const score = getScorePercent(detailItem.id);
                  const isPopular = score && score.total >= 5;
                  return (
                    <View style={{ marginBottom: 20 }}>
                      {isPopular && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', padding: 10, borderRadius: 12, marginBottom: 10, gap: 8 }}>
                          <Text style={{ fontSize: 16 }}>🔥</Text>
                          <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13 }}>Popular Item</Text>
                        </View>
                      )}
                      {score && score.pct >= 70 ? (
                        <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <Text style={{ fontSize: 32 }}>🔥</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#00A86B', fontWeight: '800', fontSize: 20 }}>{score.pct}%</Text>
                            <Text style={{ color: '#16a34a', fontWeight: '600', fontSize: 13 }}>would order this again</Text>
                            <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>Based on {score.total} votes</Text>
                          </View>
                        </View>
                      ) : !score ? (
                        <View style={{ backgroundColor: '#F0FDF4', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <Text style={{ fontSize: 28 }}>✨</Text>
                          <View>
                            <Text style={{ color: '#00A86B', fontWeight: '700', fontSize: 15 }}>Be the first to review!</Text>
                            <Text style={{ color: '#888', fontSize: 12, marginTop: 2 }}>Your vote shapes what others order</Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })()}
                <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', marginBottom: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 }}>
                  <View style={{ padding: 14, borderBottomWidth: itemReviews.length > 0 || loadingMoreReviews ? 1 : 0, borderBottomColor: '#EAEAEA' }}>
                    <Text style={{ color: '#00A86B', fontWeight: '700', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8 }}>💬 What Diners Are Saying</Text>
                    {reviewTotal > 0 && <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{reviewTotal} public review{reviewTotal > 1 ? 's' : ''}</Text>}
                  </View>
                  {itemReviews.length === 0 && !loadingMoreReviews ? (
                    <View style={{ padding: 20, alignItems: 'center' }}>
                      <Text style={{ fontSize: 28, marginBottom: 8 }}>🤫</Text>
                      <Text style={{ color: '#555', fontWeight: '700', fontSize: 14 }}>No public reviews yet</Text>
                      <Text style={{ color: '#888', fontSize: 12, marginTop: 4 }}>Tap below to share your experience</Text>
                    </View>
                  ) : (
                    <View>
                      {itemReviews.map((r: any, idx: number) => (
                        <View key={r.id} style={{ padding: 14, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#EAEAEA' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#DCFCE7' }}>
                              <Text style={{ fontSize: 17 }}>{AVATAR_EMOJIS[r.users?.avatar_url && !isNaN(parseInt(r.users.avatar_url)) ? parseInt(r.users.avatar_url) : getAvatarIndex(r.users?.username || r.users?.full_name)]}</Text>
                            </View>
                            <Text style={{ color: '#1A1A1A', fontWeight: '700', fontSize: 15 }}>{r.users?.username || r.users?.full_name || 'Deleted User'}</Text>
                            {r.rating_thumbs === true ? <ThumbsUp color="#10b981" size={14} /> : r.rating_thumbs === false ? <ThumbsDown color="#ef4444" size={14} /> : null}
                          </View>
                          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ color: '#374151', fontSize: 14, lineHeight: 20 }} numberOfLines={3} ellipsizeMode="tail">{r.public_note}</Text>
                              <Text style={{ color: '#6B7280', fontSize: 11, marginTop: 6, fontWeight: '600' }}>{getRelativeTime(r.created_at)}</Text>
                              {r.owner_reply ? (
                                <View style={{ marginTop: 10, borderLeftWidth: 3, borderLeftColor: '#10b981', paddingLeft: 10, backgroundColor: '#f0fdf4', borderRadius: 6, padding: 8 }}>
                                  <Text style={{ color: '#065f46', fontSize: 11, fontWeight: '700', marginBottom: 3 }}>Owner Response</Text>
                                  <Text style={{ color: '#374151', fontSize: 13, lineHeight: 18 }}>{r.owner_reply}</Text>
                                </View>
                              ) : null}
                            </View>
                            
                            {r.photo_url ? (
                              <TouchableOpacity 
                                style={{ alignSelf: 'center', width: 80, height: 80 }} 
                                onPress={() => setFullScreenImage(r.photo_url)}
                              >
                                <View style={{ width: 80, height: 80, borderRadius: 14, overflow: 'hidden', backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#EEE' }}>
                                  <Image 
                                    source={{ uri: r.photo_url }} 
                                    style={{ width: '100%', height: '100%' }} 
                                    resizeMode="cover"
                                    blurRadius={2}
                                  />
                                  <View style={{ position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: 3 }}>
                                    <Search color="#fff" size={10} />
                                  </View>
                                </View>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      ))}
                      {itemReviews.length < reviewTotal && (
                        <TouchableOpacity style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#EAEAEA', alignItems: 'center' }} onPress={() => fetchItemReviews(detailItem.id, reviewOffset, true)} disabled={loadingMoreReviews}>
                          {loadingMoreReviews ? <ActivityIndicator color="#00A86B" /> : <Text style={{ color: '#00A86B', fontWeight: '700' }}>Load More ({reviewTotal - itemReviews.length} remaining)</Text>}
                        </TouchableOpacity>
                      )}
                      {itemReviews.length > 3 && (
                        <TouchableOpacity style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#EAEAEA', alignItems: 'center' }} onPress={() => { setItemReviews(itemReviews.slice(0, 3)); setReviewOffset(3); }}>
                          <Text style={{ color: '#888', fontWeight: '600' }}>− See Less</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </>
            ) : (
              /* MENU LIST */
              <>
                {/* HERO IMAGE with overlaid tags */}
                <View style={{ marginHorizontal: -20, marginTop: -20, marginBottom: 0 }}>
                  <Image
                    source={{ uri: getRestaurantImage(selectedRestaurant) }}
                    style={{ width: SCREEN_WIDTH, height: 180 }}
                    resizeMode="cover"
                  />
                  {/* Bottom-left: price + cuisine tags */}
                  <View style={{ position: 'absolute', bottom: 10, left: 12, flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {priceRange && (
                      <View style={{ backgroundColor: 'rgba(0,0,0,0.52)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{priceRange}</Text>
                      </View>
                    )}
                    {selectedRestaurant.cuisine_type && (selectedRestaurant.cuisine_type as string).split(',').slice(0, 2).map((c: string) => c.trim()).filter(Boolean).map((c: string) => (
                      <View key={c} style={{ backgroundColor: 'rgba(0,0,0,0.52)', paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                  {/* Bottom-right: open/closed */}
                  {(() => {
                    const open = isOpenNow(selectedRestaurant.opening_hours);
                    if (open === null) return null;
                    return (
                      <View style={{ position: 'absolute', bottom: 10, right: 12, backgroundColor: open ? '#00A86B' : '#EF4444', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{open ? '● Open Now' : '● Closed'}</Text>
                      </View>
                    );
                  })()}
                </View>

                {/* RESTAURANT INFO — name + rating + address */}
                <View style={{ backgroundColor: '#fff', marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', marginBottom: 20 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: '#111' }}>{selectedRestaurant.name}</Text>
                    {restaurantRatings[selectedRestaurant.id] && (
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#00A86B' }}>★ {restaurantRatings[selectedRestaurant.id].pct}%</Text>
                    )}
                  </View>
                  {selectedRestaurant.address ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text style={{ color: '#888', fontSize: 12 }}>📍</Text>
                      <Text style={{ color: '#888', fontSize: 12 }}>{selectedRestaurant.address}</Text>
                    </View>
                  ) : null}
                </View>

                {/* MENU HEADER + SEARCH */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, marginTop: 4, gap: 8 }}>
                  <Search size={16} color="#9CA3AF" />
                  <TextInput
                    value={menuSearchQuery}
                    onChangeText={setMenuSearchQuery}
                    placeholder="Search menu..."
                    placeholderTextColor="#9CA3AF"
                    style={{ flex: 1, fontSize: 14, color: '#111', padding: 0 }}
                  />
                  {menuSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setMenuSearchQuery('')}>
                      <X size={14} color="#9CA3AF" />
                    </TouchableOpacity>
                  )}
                </View>

                {menuLoading ? (
                  <ActivityIndicator size="large" color="#00A86B" style={{ marginTop: 40 }} />
                ) : null}
                {!menuLoading && (() => {
                  // Group by category, filtered by search
                  const filtered = menuSearchQuery.trim()
                    ? menuItems.filter(item =>
                        item.name?.toLowerCase().includes(menuSearchQuery.toLowerCase()) ||
                        item.menu_categories?.name?.toLowerCase().includes(menuSearchQuery.toLowerCase())
                      )
                    : menuItems;
                  const grouped: Record<string, any[]> = {};
                  filtered.forEach(item => {
                    const cat = item.menu_categories?.name || 'Menu';
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(item);
                  });
                  return Object.entries(grouped).map(([catName, catItems]) => (
                    <View key={catName}>
                      <Text style={[styles.categoryHeader, { fontSize: 16, marginTop: 24, marginBottom: 16 }]}>{catName}</Text>
                      {catItems.map((item, i) => {
                        const globalIdx = filtered.indexOf(item);
                        const score = getScoreBadge(item.id);
                        const fadeAnim = fadeAnims.current[globalIdx] || new Animated.Value(1);
                        const slideAnim = slideAnims.current[globalIdx] || new Animated.Value(0);
                        return (
                          <Animated.View key={item.id} style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                            <TouchableOpacity style={styles.menuCard} onPress={() => openDetailPage(item)}>
                              <Image source={{ uri: getItemImage(item) }} style={styles.menuImage} resizeMode="cover" />
                              <View style={styles.menuInfo}>
                                <Text style={styles.menuName}>{item.name}</Text>
                                <Text style={styles.menuPrice}>PKR {item.price}</Text>
                                {score && <Text style={styles.scoreBadge}>{score}</Text>}
                                {reviewStats[item.id]?.total >= 5 && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                                    <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                                      <Text style={{ color: '#DC2626', fontSize: 10, fontWeight: '700' }}>🔥 Popular</Text>
                                    </View>
                                  </View>
                                )}
                              </View>
                              <View style={{ alignItems: 'center', justifyContent: 'space-between', paddingRight: 12, paddingVertical: 12, gap: 10 }}>
                                <TouchableOpacity onPress={() => toggleLikedItem(item.id)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                                  <Heart
                                    color={likedItems.includes(item.id) ? '#EF4444' : '#D1D5DB'}
                                    fill={likedItems.includes(item.id) ? '#EF4444' : 'none'}
                                    size={24}
                                  />
                                </TouchableOpacity>
                                <ChevronRight color="#888" size={24} />
                              </View>
                            </TouchableOpacity>
                          </Animated.View>
                        );
                      })}
                    </View>
                  ));
                })()}
              </>
            )
          ) : (
            /* ---- RESTAURANT LIST (search/review) ---- */
            <>
              <View style={styles.searchBar}>
                <Search color="#888" size={18} style={{ marginRight: 10 }} />
                <TextInput style={styles.searchInput} placeholder={currentTab === 'review' ? 'Where did you eat? Drop a review 🍽️' : 'Search restaurants...'} placeholderTextColor="#666"
                  value={searchQuery} onChangeText={setSearchQuery} />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}><X color="#888" size={16} /></TouchableOpacity>
                )}
              </View>

              {/* Restaurants */}
              <Text style={styles.sectionTitle}>{currentTab === 'review' ? 'Where are you eating to review?' : 'Where are you eating?'}</Text>
              {filteredRestaurants.length === 0 && menuSearchResults.length === 0 ? (
                <Text style={styles.emptyText}>No results for "{searchQuery}"</Text>
              ) : (
                filteredRestaurants.map(rest => {
                  const rating = restaurantRatings[rest.id];
                  const openStatus = isOpenNow(rest.opening_hours);
                  const tags = rest.cuisine_type ? (rest.cuisine_type as string).split(',').map((t: string) => t.trim()).filter(Boolean) : [];
                  return (
                    <TouchableOpacity key={rest.id} style={styles.menuCard} onPress={() => handleRestaurantSelect(rest)}>
                      <Image source={{ uri: getRestaurantImage(rest) }} style={styles.menuImage} resizeMode="cover" />
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuName}>{rest.name}</Text>
                        <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>📍 {rest.address || 'Karachi'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                          {tags.slice(0, 2).map(tag => (
                            <View key={tag} style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: '#00A86B', fontSize: 10, fontWeight: '600' }}>{tag}</Text>
                            </View>
                          ))}
                          {openStatus !== null && (
                            <Text style={{ color: openStatus ? '#00A86B' : '#EF4444', fontSize: 10, fontWeight: '700' }}>{openStatus ? '● Open' : '● Closed'}</Text>
                          )}
                          {rating && rating.total >= 3 && (
                            <Text style={{ color: '#888', fontSize: 10 }}>★ {rating.pct}%</Text>
                          )}
                        </View>
                      </View>
                      <ChevronRight color="#555" size={22} style={{ marginRight: 4 }} />
                    </TouchableOpacity>
                  );
                })
              )}

              {/* Dish search results */}
              {menuSearchResults.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { fontSize: 16, marginTop: 8 }]}>🍽️ Matching Dishes</Text>
                  {menuSearchResults.map(dish => (
                    <TouchableOpacity key={'ms-' + dish.id} style={styles.menuCard} onPress={() => handleDishSearchSelect(dish)}>
                      <Image source={{ uri: getItemImage(dish) }} style={styles.menuImage} resizeMode="cover" />
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuName}>{dish.name}</Text>
                        <Text style={{ color: '#888', fontSize: 11, marginTop: 2 }}>at {dish.menu_categories?.restaurants?.name || 'Restaurant'}</Text>
                        <Text style={styles.menuPrice}>PKR {dish.price}</Text>
                      </View>
                      <ChevronRight color="#555" size={22} style={{ marginRight: 12 }} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )

        ) : currentTab === 'profile' ? (
          /* ---- PROFILE & DIARY ---- */
          <Pressable onPress={() => { if (showAvatarPicker) setShowAvatarPicker(false); }} style={{ flex: 1 }}>
            <View style={{ alignItems: 'center', marginBottom: 24, marginTop: 10 }}>
              <TouchableOpacity onPress={() => setShowAvatarPicker(!showAvatarPicker)} style={{ position: 'relative' }}>
                <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#00A86B', marginBottom: 6 }}>
                  <Text style={{ fontSize: 44 }}>{AVATAR_EMOJIS[profileAvatar]}</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 8, right: 0, backgroundColor: '#00A86B', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>✏️</Text>
                </View>
              </TouchableOpacity>

              {showAvatarPicker && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 12, backgroundColor: '#fff', padding: 16, borderRadius: 18, borderWidth: 1, borderColor: '#EAEAEA', width: '100%' }}>
                  <Text style={{ width: '100%', textAlign: 'center', color: '#666', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Choose your avatar</Text>
                  {AVATAR_EMOJIS.map((emoji, idx) => (
                    <TouchableOpacity key={idx} onPress={async () => { setProfileAvatar(idx); setShowAvatarPicker(false); await supabase.auth.updateUser({ data: { avatar_index: idx } }); await supabase.from('users').update({ avatar_url: idx.toString() }).eq('id', session?.user?.id); }}
                      style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: profileAvatar === idx ? '#F0FDF4' : '#F8F9FA', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: profileAvatar === idx ? '#00A86B' : '#EAEAEA' }}>
                      <Text style={{ fontSize: 28 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!editingUsername ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                    <Text style={{ color: '#111', fontSize: 20, fontWeight: '800' }}>{profileUsername || 'Set a username'}</Text>
                    <TouchableOpacity onPress={() => {
                      if (!canEditUsername()) return;
                      setNewUsername(profileUsername); setEditingUsername(true);
                    }}>
                      <Text style={{ fontSize: 14 }}>{canEditUsername() ? '✏️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                  {!canEditUsername() && usernameLastChanged && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#FFF7ED', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA', gap: 6 }}>
                      <Clock color="#EA580C" size={13} />
                      <Text style={{ color: '#9A3412', fontWeight: '600', fontSize: 12 }}>
                        {Math.max(1, 30 - Math.floor((Date.now() - usernameLastChanged.getTime()) / 86400000))} days until next change
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, width: '80%' }}>
                  <TextInput style={[styles.textInput, { flex: 1, padding: 10, fontSize: 15 }]} value={newUsername} onChangeText={setNewUsername} autoFocus autoCapitalize="none" />
                  <TouchableOpacity onPress={saveUsername} style={{ backgroundColor: '#00A86B', padding: 10, borderRadius: 10 }} disabled={savingUsername}>
                    {savingUsername ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Save</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingUsername(false)}><X color="#888" size={20} /></TouchableOpacity>
                </View>
              )}

              <Text style={{ color: '#888', fontSize: 13, marginTop: 4 }}>{diaryEntries.length} bites tracked 🍽️</Text>

              {/* STREAK BADGE */}
              {reviewStreak > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#FFF7ED', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#FED7AA', gap: 6 }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                  <Text style={{ color: '#EA580C', fontWeight: '700', fontSize: 14 }}>{reviewStreak} day streak!</Text>
                </View>
              )}

            </View>

            <Text style={styles.sectionTitle}>My Private Diary 📔</Text>
            {diaryEntries.length > 0 && (
              <View style={styles.searchBar}>
                <Search color="#888" size={20} style={{ marginRight: 12 }} />
                <TextInput style={styles.searchInput} placeholder="Search your history..." placeholderTextColor="#666"
                  value={diarySearchQuery} onChangeText={setDiarySearchQuery} />
                {diarySearchQuery.length > 0 && <TouchableOpacity onPress={() => setDiarySearchQuery('')}><X color="#888" size={16} /></TouchableOpacity>}
              </View>
            )}

            {diaryEntries.length === 0 ? (
              <Text style={styles.emptyText}>Your diary is empty. Rate your first bite! 🍽️</Text>
            ) : (() => {
              const grouped = diaryEntries.reduce((groups: any, entry: any) => {
                const restName = entry.menu_items?.menu_categories?.restaurants?.name || 'Unknown Restaurant';
                if (!groups[restName]) groups[restName] = [];
                groups[restName].push(entry);
                return groups;
              }, {});
              const q = diarySearchQuery.toLowerCase();
              const filteredRestNames = Object.keys(grouped).filter(name =>
                name.toLowerCase().includes(q) ||
                grouped[name].some((e: any) =>
                  e.menu_items?.name?.toLowerCase().includes(q) ||
                  e.private_note?.toLowerCase().includes(q) ||
                  e.public_note?.toLowerCase().includes(q)
                )
              );
              if (filteredRestNames.length === 0) return <Text style={styles.emptyText}>No diary entries match "{diarySearchQuery}"</Text>;

              return filteredRestNames.map((restName: string) => {
                const entries = grouped[restName];
                const isExpanded = expandedDiaryRest === restName;
                const limit = isExpanded ? diaryReviewLimit : 0;
                const visibleEntries = isExpanded ? entries.slice(0, limit) : [];
                return (
                  <View key={restName} style={{ marginBottom: 14 }}>
                    <TouchableOpacity style={[styles.restaurantCard, { marginBottom: isExpanded ? 14 : 0 }]} onPress={() => {
                      if (expandedDiaryRest === restName) { setExpandedDiaryRest(null); }
                      else { setExpandedDiaryRest(restName); setDiaryReviewLimit(3); }
                    }}>
                      {(() => {
                        const logo = entries[0]?.menu_items?.menu_categories?.restaurants?.logo_url;
                        return logo
                          ? <Image source={{ uri: logo }} style={{ width: 48, height: 48, borderRadius: 14, marginRight: 14 }} resizeMode="cover" />
                          : <View style={styles.restaurantIcon}><Text style={{ fontSize: 22 }}>🍴</Text></View>;
                      })()}
                      <View style={styles.menuInfo}>
                        <Text style={styles.menuName}>{restName}</Text>
                        <Text style={styles.menuPrice}>{entries.length} review{entries.length !== 1 ? 's' : ''}</Text>
                      </View>
                      <ChevronRight color="#555" size={22} style={{ transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }} />
                    </TouchableOpacity>

                    {isExpanded && visibleEntries.map((entry: any) => (
                      <View key={entry.id} style={[styles.diaryCard, { marginLeft: 16, borderLeftColor: '#00A86B', borderLeftWidth: 2 }]}>
                        <View style={styles.diaryHeader}>
                          {entry.menu_items?.image_url ? (
                            <Image source={{ uri: entry.menu_items.image_url }} style={{ width: 44, height: 44, borderRadius: 10, marginRight: 10 }} resizeMode="cover" />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <Text style={styles.diaryItemName}>{entry.menu_items?.name || 'Unknown Item'}</Text>
                              {(entry._edited || editedReviewIds.has(entry.id)) && (
                                <Text style={{ fontSize: 11, color: '#00A86B', fontWeight: '700', backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' }}>edited</Text>
                              )}
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            {(() => {
                              const minsElapsed = (Date.now() - new Date(entry.created_at).getTime()) / 60000;
                              if (minsElapsed <= 5) {
                                return (
                                  <TouchableOpacity onPress={() => openEditModal(entry)} style={{ padding: 4 }}>
                                    <PenTool color="#00A86B" size={16} />
                                  </TouchableOpacity>
                                );
                              }
                              return null;
                            })()}
                            <TouchableOpacity onPress={() => setDeleteConfirmId(entry.id)} style={{ padding: 4 }}>
                              <Trash2 color="#ef4444" size={16} />
                            </TouchableOpacity>
                            {entry.rating_thumbs === true ? <ThumbsUp color="#10b981" size={18} /> :
                              entry.rating_thumbs === false ? <ThumbsDown color="#ef4444" size={18} /> : null}
                          </View>
                        </View>
                        <View style={styles.diaryDate}>
                          <Clock color="#666" size={13} style={{ marginRight: 4 }} />
                          <Text style={styles.diaryDateText}>{getRelativeTime(entry.created_at)}</Text>
                        </View>
                        {entry.private_note ? (
                          <View style={styles.privateNoteContainer}>
                            <Text style={styles.noteLabel}>🔒 Private Note</Text>
                            <Text style={styles.privateNoteText}>{entry.private_note}</Text>
                          </View>
                        ) : null}
                        {entry.public_note ? (
                          <View style={styles.publicNoteContainer}>
                            <Text style={styles.noteLabel}>💬 Chef Message</Text>
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.publicNoteText}>{entry.public_note}</Text>
                              </View>
                              {entry.photo_url ? (
                                <TouchableOpacity 
                                  style={{ 
                                    position: 'relative',
                                    width: 70, 
                                    height: 70,
                                  }} 
                                  onPress={() => setFullScreenImage(entry.photo_url)}
                                >
                                  {/* Tilted Layer */}
                                  <View style={{ 
                                    position: 'absolute', 
                                    top: -3, 
                                    right: -3, 
                                    width: 70, 
                                    height: 70, 
                                    borderRadius: 12, 
                                    backgroundColor: '#D1FAE5', 
                                    transform: [{ rotate: '5deg' }],
                                    borderWidth: 1,
                                    borderColor: '#A7F3D0'
                                  }} />
                                  <View style={{ width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#EAEAEA' }}>
                                    <Image source={{ uri: entry.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                                  </View>
                                </TouchableOpacity>
                              ) : null}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    ))}

                    {isExpanded && entries.length > 3 && (
                      <View style={{ marginLeft: 16, flexDirection: 'row', justifyContent: 'center', marginBottom: 24, gap: 12 }}>
                        {limit < entries.length && <TouchableOpacity style={{ padding: 10 }} onPress={() => setDiaryReviewLimit(limit + 3)}><Text style={{ color: '#00A86B', fontWeight: '600' }}>Load More</Text></TouchableOpacity>}
                        {limit > 3 && <TouchableOpacity style={{ padding: 10 }} onPress={() => setDiaryReviewLimit(3)}><Text style={{ color: '#666', fontWeight: '600' }}>See Less</Text></TouchableOpacity>}
                      </View>
                    )}
                  </View>
                );
              });
            })()}

            {diaryHasMore && (
              <TouchableOpacity
                onPress={() => fetchDiary(undefined, diaryPage + 1, true)}
                disabled={diaryLoadingMore}
                style={{ marginTop: 8, marginBottom: 24, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#DCFCE7', backgroundColor: '#F0FDF4', alignItems: 'center' }}
              >
                {diaryLoadingMore
                  ? <ActivityIndicator color="#00A86B" />
                  : <Text style={{ color: '#00A86B', fontWeight: '700', fontSize: 14 }}>Load More Entries</Text>}
              </TouchableOpacity>
            )}
          </Pressable>
        ) : null}
      </ScrollView>

      {/* STICKY RATE BUTTON */}
      {detailItem && !selectedItem && currentTab !== 'profile' && (
        <View style={{ position: 'absolute', bottom: 90, left: 20, right: 20, zIndex: 99 }}>
          <TouchableOpacity style={styles.submitButton} onPress={() => openReviewModal(detailItem)}>
            <Text style={styles.submitButtonText}>Would you order this again? 🍽️</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* BOTTOM NAV */}
      {!selectedItem && (
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => { setCurrentTab('home'); setSelectedRestaurant(null); setDetailItem(null); setHomeView('landing'); setSearchQuery(''); setMenuSearchResults([]); mainScrollRef.current?.scrollTo({ y: 0, animated: true }); }}>
            <Home color={currentTab === 'home' ? '#00A86B' : '#bbb'} size={20} />
            <Text style={[styles.navText, currentTab === 'home' && styles.navTextActive]}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => { setCurrentTab('review'); setSelectedRestaurant(null); setDetailItem(null); setSearchQuery(''); setMenuSearchResults([]); mainScrollRef.current?.scrollTo({ y: 0, animated: true }); }}>
            <PlusCircle color={currentTab === 'review' ? '#00A86B' : '#bbb'} size={20} />
            <Text style={[styles.navText, currentTab === 'review' && styles.navTextActive]}>Review</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => { setCurrentTab('profile'); mainScrollRef.current?.scrollTo({ y: 0, animated: true }); }}>
            <User color={currentTab === 'profile' ? '#00A86B' : '#bbb'} size={20} />
            <Text style={[styles.navText, currentTab === 'profile' && styles.navTextActive]}>Profile</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* REVIEW MODAL */}
      {selectedItem && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeModal} />
          <View style={styles.modalContent}>

            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#DDD' }} />
            </View>

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }}>
              <Text style={{ fontSize: 11, color: '#00A86B', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 }}>
                {existingReviewId ? 'Editing Recent Review' : 'New Review'}
              </Text>
              <TouchableOpacity onPress={closeModal} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' }}>
                <X color="#555" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: Platform.OS === 'android' ? 80 : 40 }}>

              {/* Edit window banner */}
              {existingReviewId && (() => {
                const minsLeft = Math.max(0, 5 - (Date.now() - new Date(existingReviewCreatedAt!).getTime()) / 60000);
                const canEdit = minsLeft > 0;
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: canEdit ? '#F0FDF4' : '#FEF2F2', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: canEdit ? '#DCFCE7' : '#FECACA' }}>
                    <Text style={{ fontSize: 18 }}>{canEdit ? '✏️' : '🔒'}</Text>
                    <View>
                      <Text style={{ color: canEdit ? '#00A86B' : '#DC2626', fontWeight: '700', fontSize: 13 }}>
                        {canEdit ? `${Math.ceil(minsLeft)} min left to edit` : 'Edit window closed'}
                      </Text>
                      {canEdit && <Text style={{ color: '#888', fontSize: 11, marginTop: 1 }}>Changes save instantly</Text>}
                    </View>
                  </View>
                );
              })()}

              {/* Item name — heading for the image */}
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#111', marginBottom: 10 }} numberOfLines={2}>{selectedItem.name}</Text>

              {/* Dish image — no add photo button here anymore */}
              <View style={{ marginBottom: 20 }}>
                {reviewImage ? (
                  <View style={{ position: 'relative' }}>
                    <Image source={{ uri: reviewImage }} style={{ width: '100%', height: 180, borderRadius: 16 }} resizeMode="cover" />
                    <TouchableOpacity onPress={() => setReviewImage(null)}
                      style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 16, padding: 6 }}>
                      <X color="#fff" size={15} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Image source={{ uri: getItemImage(selectedItem) }} style={{ width: '100%', height: 160, borderRadius: 16 }} resizeMode="cover" />
                )}
              </View>

              {/* Would you order again */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Would you order this again?</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                <TouchableOpacity
                  onPress={() => setRatingThumbs(true)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: ratingThumbs === true ? '#00A86B' : '#EAEAEA', backgroundColor: ratingThumbs === true ? '#F0FDF4' : '#FAFAFA' }}>
                  <ThumbsUp color={ratingThumbs === true ? '#00A86B' : '#AAA'} size={22} />
                  <Text style={{ fontWeight: '700', fontSize: 15, color: ratingThumbs === true ? '#00A86B' : '#888' }}>Yes!</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRatingThumbs(false)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 16, borderWidth: 2, borderColor: ratingThumbs === false ? '#EF4444' : '#EAEAEA', backgroundColor: ratingThumbs === false ? '#FEF2F2' : '#FAFAFA' }}>
                  <ThumbsDown color={ratingThumbs === false ? '#EF4444' : '#AAA'} size={22} />
                  <Text style={{ fontWeight: '700', fontSize: 15, color: ratingThumbs === false ? '#EF4444' : '#888' }}>Nope</Text>
                </TouchableOpacity>
              </View>

              {/* Chef message */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Message to Chef</Text>
                <TextInput
                  style={{ backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 14, color: '#111', padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top', outlineColor: '#00A86B' }}
                  placeholder="e.g. The chef nailed the spices today!"
                  placeholderTextColor="#BBB"
                  value={publicNote}
                  onChangeText={setPublicNote}
                  multiline
                  maxLength={500}
                />
              </View>

              {/* Private note */}
              <View style={{ marginBottom: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#555', textTransform: 'uppercase', letterSpacing: 0.8 }}>Private Diary Note</Text>
                  <Text style={{ fontSize: 13 }}>🔒</Text>
                </View>
                <TextInput
                  style={{ backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 14, color: '#111', padding: 14, fontSize: 15, minHeight: 80, textAlignVertical: 'top', outlineColor: '#00A86B' }}
                  placeholder="A note to your future self..."
                  placeholderTextColor="#BBB"
                  value={privateNote}
                  onChangeText={setPrivateNote}
                  multiline
                  maxLength={1000}
                />
              </View>

              {/* Add Photo button */}
              <View style={{ marginBottom: 12 }}>
                {reviewImage ? (
                  /* Photo selected — show change/remove row */
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                      onPress={() => setShowPhotoPicker(true)}
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, borderRadius: 18, borderWidth: 2, borderColor: '#00A86B', backgroundColor: '#F0FDF4' }}>
                      <Camera color="#00A86B" size={20} />
                      <Text style={{ color: '#00A86B', fontSize: 15, fontWeight: '700' }}>Change Photo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setReviewImage(null)}
                      style={{ width: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, borderWidth: 2, borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
                      <X color="#EF4444" size={20} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  /* No photo yet — big dashed add button */
                  <TouchableOpacity
                    onPress={() => setShowPhotoPicker(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18, borderRadius: 18, borderWidth: 2, borderColor: '#D1D5DB', borderStyle: 'dashed', backgroundColor: '#FAFAFA' }}>
                    <Camera color="#888" size={22} />
                    <View>
                      <Text style={{ color: '#444', fontSize: 15, fontWeight: '700' }}>Add a Photo</Text>
                      <Text style={{ color: '#AAA', fontSize: 12, marginTop: 1 }}>Camera or gallery</Text>
                    </View>
                  </TouchableOpacity>
                )}

                {/* Inline picker */}
                {showPhotoPicker && (
                  <View style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 }}>
                    <TouchableOpacity onPress={takePhotoWithCamera} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center' }}>
                        <Camera color="#00A86B" size={20} />
                      </View>
                      <View>
                        <Text style={{ color: '#111', fontSize: 15, fontWeight: '700' }}>Take Photo</Text>
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>Use your camera right now</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
                    <TouchableOpacity onPress={pickFromGallery} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 16 }}>
                      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20 }}>🖼️</Text>
                      </View>
                      <View>
                        <Text style={{ color: '#111', fontSize: 15, fontWeight: '700' }}>Choose from Gallery</Text>
                        <Text style={{ color: '#888', fontSize: 12, marginTop: 1 }}>Pick an existing photo</Text>
                      </View>
                    </TouchableOpacity>
                    <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />
                    <TouchableOpacity onPress={() => setShowPhotoPicker(false)} style={{ paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ color: '#888', fontSize: 14, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Submit */}
              <TouchableOpacity
                style={{ backgroundColor: '#00A86B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, borderRadius: 18, gap: 10, shadowColor: '#00A86B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 }}
                onPress={submitReview}
                disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : (
                  <>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 }}>
                      {existingReviewId ? 'Update Review' : publicNote ? 'Send to Chef & Save' : 'Save to Diary'}
                    </Text>
                    <Send color="#fff" size={18} />
                  </>
                )}
              </TouchableOpacity>

            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* WELCOME TOAST */}
      {showWelcome && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 999, backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA', width: '75%', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
            <Text style={{ fontSize: 56, marginBottom: 14 }}>🥳</Text>
            <Text style={{ color: '#111', fontWeight: '800', fontSize: 22, marginBottom: 6 }}>Welcome!</Text>
            <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Your account is created.{'\n'}Let's start reviewing.</Text>
          </View>
        </View>
      )}

      {/* SIDEBAR DRAWER */}
      {sidebarOpen && (
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 200, elevation: 100, opacity: sidebarOverlayAnim, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={closeSidebar} />
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 290, backgroundColor: '#FAFAFA', zIndex: 201, transform: [{ translateX: sidebarAnim }], shadowColor: '#000', shadowOffset: { width: 10, height: 0 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 25, borderTopRightRadius: 30, borderBottomRightRadius: 30 }}>
          {/* PROFILE HEADER — top left, no logo here */}
            <View style={{ backgroundColor: '#00A86B', paddingTop: Platform.OS === 'web' ? 28 : 52, paddingBottom: 24, paddingHorizontal: 24, borderBottomLeftRadius: 30 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', marginRight: 14 }}>
                  <Text style={{ fontSize: 28 }}>{AVATAR_EMOJIS[profileAvatar]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.2 }}>{profileUsername || 'Foodie'}</Text>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 3, fontWeight: '500' }}>{diaryEntries.length} bites tracked 🍽️</Text>
                  {reviewStreak > 0 && <Text style={{ color: '#FCD34D', fontSize: 12, marginTop: 4, fontWeight: '700' }}>🔥 {reviewStreak} day streak</Text>}
                </View>
              </View>
            </View>

            {/* NAV LINKS */}
            <View style={{ padding: 20, flex: 1, backgroundColor: '#fff' }}>
              {[
                { label: 'Home', icon: Home, tab: 'home' as const },
                { label: 'Review', icon: PenTool, tab: 'review' as const },
                { label: 'My Profile', icon: User, tab: 'profile' as const },
              ].map(({ label, icon: Icon, tab }) => (
                <TouchableOpacity key={tab} onPress={() => navigateFromSidebar(tab)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, backgroundColor: currentTab === tab ? '#F0FDF4' : 'transparent', marginBottom: 8, borderWidth: currentTab === tab ? 1 : 0, borderColor: '#DCFCE7' }}>
                  <Icon color={currentTab === tab ? '#00A86B' : '#666'} size={24} />
                  <Text style={{ fontSize: 17, fontWeight: currentTab === tab ? '800' : '600', color: currentTab === tab ? '#00A86B' : '#444' }}>{label}</Text>
                </TouchableOpacity>
              ))}

              <View style={{ height: 1, backgroundColor: '#F0F0F0', marginVertical: 20, marginHorizontal: 10 }} />

              <TouchableOpacity onPress={closeSidebar} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, marginBottom: 4 }}>
                <Info color="#888" size={24} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#444' }}>About Us</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Built to capture every bite</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={closeSidebar} style={{ flexDirection: 'row', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16 }}>
                <MessageCircle color="#888" size={24} />
                <View>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: '#444' }}>Contact Support</Text>
                  <Text style={{ fontSize: 12, color: '#888', marginTop: 2 }}>support@cravesync.app</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* SIGN OUT + BRANDING FOOTER */}
            <View style={{ backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 24, paddingTop: 4 }}>
              <TouchableOpacity
                onPress={() => { closeSidebar(); setTimeout(() => { supabase.auth.signOut(); setEmail(''); setPassword(''); setAuthError(''); setProfileUsername(''); setFavourites([]); setLikedItems([]); setLikedItemDetails([]); setTrendingDishes([]); setDiaryEntries([]); }, 300); }}
                style={{ paddingVertical: 11, paddingHorizontal: 20, backgroundColor: '#FEF2F2', borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 16 }}>
                <LogOut color="#DC2626" size={17} />
                <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 14 }}>Sign Out</Text>
              </TouchableOpacity>

              {/* Standalone branding — full visibility */}
              <View style={{ alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 14 }}>
                <CraveSyncLogo size={18} textColor="#00A86B" />
              </View>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      {/* DELETE REVIEW CONFIRM MODAL */}
      {deleteConfirmId && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 999, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 28, marginHorizontal: 28, width: '85%', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 24, elevation: 20 }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 16 }}>
              <Trash2 color="#DC2626" size={26} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#111', textAlign: 'center', marginBottom: 8 }}>Delete Review?</Text>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>This will permanently remove your review and all its data. This cannot be undone.</Text>
            <TouchableOpacity
              onPress={() => { deleteReview(deleteConfirmId); setDeleteConfirmId(null); }}
              style={{ backgroundColor: '#DC2626', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>Yes, Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setDeleteConfirmId(null)}
              style={{ backgroundColor: '#F8F9FA', borderRadius: 16, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA' }}>
              <Text style={{ color: '#444', fontWeight: '700', fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* SUCCESS TOAST */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 36, alignItems: 'center', borderWidth: 1, borderColor: '#EAEAEA', width: '75%', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
            <Text style={{ fontSize: 56, marginBottom: 14 }}>🎉</Text>
            <Text style={{ color: '#111', fontWeight: '800', fontSize: 22, marginBottom: 6 }}>Saved!</Text>
            <Text style={{ color: '#666', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>Your bite is in the diary.{'\n'}Chef has been notified.</Text>
          </View>
        </View>
      </Modal>

      {/* FULL SCREEN IMAGE LIGHTBOX (Refined for 'Mid-Screen Window' feel) */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade">
        <TouchableOpacity 
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 }} 
          activeOpacity={1} 
          onPress={() => setFullScreenImage(null)}
        >
          <View style={{ width: Platform.OS === 'web' ? '60%' : '90%', height: '70%', backgroundColor: '#000', borderRadius: 24, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 10 }}>
            <TouchableOpacity 
              style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 8 }} 
              onPress={() => setFullScreenImage(null)}
            >
              <X color="#fff" size={24} />
            </TouchableOpacity>
            {fullScreenImage && (
              <Image 
                source={{ uri: fullScreenImage }} 
                style={{ width: '100%', height: '100%' }} 
                resizeMode="contain" 
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* LIMIT REACHED TOAST */}
      <Modal visible={showLimit} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 28, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: '#EF4444', width: '75%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 15, elevation: 10 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF2F2', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 32 }}>🛑</Text>
            </View>
            <Text style={{ color: '#111', fontWeight: '800', fontSize: 20, marginBottom: 4 }}>{limitMsg.title}</Text>
            <Text style={{ color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>{limitMsg.body}</Text>
            <TouchableOpacity onPress={() => setShowLimit(false)} style={{ marginTop: 20, backgroundColor: '#EF4444', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0 },
  loadingContainer: { flex: 1, backgroundColor: '#F8F9FA', justifyContent: 'center', alignItems: 'center' },

  authContainer: { flex: 1, justifyContent: 'center', padding: 28 },
  authTitle: { color: '#1A1A1A', fontSize: 38, fontWeight: '700', textAlign: 'center', marginBottom: 8, letterSpacing: -0.5 },
  authSubtitle: { color: '#4B5563', fontSize: 16, textAlign: 'center', marginBottom: 40 },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  headerTitle: { color: '#00A86B', fontSize: 21, fontWeight: '700' },

  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 20, marginHorizontal: -6, borderWidth: 1, borderColor: '#EAEAEA' },
  searchInput: { flex: 1, color: '#1A1A1A', fontSize: 15 },

  scrollContent: { padding: 20, paddingBottom: 180 },
  sectionTitle: { color: '#1A1A1A', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  emptyText: { color: '#6B7280', fontSize: 15, textAlign: 'center', marginTop: 60 },
  categoryHeader: { color: '#00A86B', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 18, marginBottom: 10, paddingLeft: 2 },

  restaurantCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
  restaurantIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', marginRight: 16 },

  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 20, marginBottom: 18, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  menuImage: { width: 100, height: 100 },
  menuInfo: { flex: 1, paddingHorizontal: 16, paddingVertical: 14 },
  menuName: { color: '#1A1A1A', fontSize: 17, fontWeight: '700', marginBottom: 4 },
  menuPrice: { color: '#00A86B', fontWeight: '700', fontSize: 15 },
  scoreBadge: { color: '#00A86B', fontSize: 12, fontWeight: '700', marginTop: 6 },

  diaryCard: { backgroundColor: '#fff', padding: 16, borderRadius: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F3F4F6' },
  diaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  diaryItemName: { color: '#1A1A1A', fontSize: 16, fontWeight: '700' },
  diaryDate: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  diaryDateText: { color: '#6B7280', fontSize: 12, fontWeight: '600' },
  privateNoteContainer: { backgroundColor: '#F0FDF4', padding: 12, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: '#DCFCE7' },
  publicNoteContainer: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F3F4F6' },
  noteLabel: { color: '#4B5563', fontSize: 11, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  privateNoteText: { color: '#00A86B', fontSize: 14, lineHeight: 20 },
  publicNoteText: { color: '#374151', fontSize: 14, lineHeight: 22 },

  bottomNav: { flexDirection: 'row', position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingVertical: 8, paddingBottom: 18, shadowColor: '#000', shadowOffset: { width: 0, height: -1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 8 },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  navText: { color: '#999', fontSize: 10, marginTop: 3, fontWeight: '500', letterSpacing: 0.2 },
  navTextActive: { color: '#00A86B', fontWeight: '700' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '92%', shadowColor: '#000', shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 24 },
  thumbsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 28 },
  thumbButton: { alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#EAEAEA', width: '45%', backgroundColor: '#F8F9FA' },
  thumbActive: { borderColor: '#00A86B', backgroundColor: '#F0FDF4' },
  thumbLabel: { color: '#555', marginTop: 8, fontWeight: '600', fontSize: 13 },

  inputGroup: { marginBottom: 18 },
  inputLabel: { color: '#666', marginBottom: 8, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  textInput: { backgroundColor: '#F8F9FA', borderWidth: 1, borderColor: '#EAEAEA', borderRadius: 14, color: '#111', padding: 15, fontSize: 15 },
  submitButton: { backgroundColor: '#00A86B', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, marginTop: 8, gap: 10, shadowColor: '#00A86B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
