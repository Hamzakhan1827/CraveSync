import React from 'react';
import Svg, { Circle, Rect, Path, G } from 'react-native-svg';
import { View, Text } from 'react-native';

const ACCENT = '#10b981';
const INK = '#0b1220';

export function CraveSyncMark({
  size = 32,
  tileColor = INK,
  accent = ACCENT,
}: {
  size?: number;
  tileColor?: string;
  accent?: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Circle cx="48" cy="48" r="44" fill={accent} />
      {/* Fork */}
      <G fill="white">
        <Rect x="22" y="14" width="2.8" height="14" rx="1.2" />
        <Rect x="28.6" y="14" width="2.8" height="14" rx="1.2" />
        <Rect x="35.2" y="14" width="2.8" height="14" rx="1.2" />
        <Path d="M20 28h20v3c0 5-3 8-7 9v27a3 3 0 0 1-6 0V40c-4-1-7-4-7-9v-3z" />
      </G>
      {/* Knife */}
      <G fill="white">
        <Path d="M58 14c0 0 9 7 9 17H58V14z" />
        <Rect x="55.5" y="31" width="6" height="37" rx="3" />
      </G>
    </Svg>
  );
}

export function CraveSyncLogo({
  size = 24,
  accent = ACCENT,
  textColor = '#ffffff',
  tileColor = INK,
}: {
  size?: number;
  accent?: string;
  textColor?: string;
  tileColor?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <CraveSyncMark size={Math.round(size * 1.4)} tileColor={tileColor} accent={accent} />
      <Text style={{ fontWeight: '700', fontSize: size, letterSpacing: -0.5, color: textColor }}>
        Crave<Text style={{ color: accent }}>Sync</Text>
      </Text>
    </View>
  );
}

export default CraveSyncLogo;
