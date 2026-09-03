// ./src/components/ui/Avatar.tsx
import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { User } from 'lucide-react-native';
import { Text } from './Text';
import { apiClient } from '../../lib/apiClient';

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}

// Global memory cache to prevent repeated signed URL requests across renders
const avatarCache = new Map<string, { url: string; expiresAt: number }>();
// Global tracker for in-flight requests to deduplicate concurrent renders of the same avatar
const pendingRequests = new Map<string, Promise<string | null>>();

function getImmediateAvatarUrl(src?: string | null): string | null {
  if (!src) return null;

  const isLocal = src.startsWith('file://') || src.startsWith('content://') || src.startsWith('data:');
  const isAbsoluteWeb = src.startsWith('http://') || src.startsWith('https://');
  if (isLocal || isAbsoluteWeb) return src;

  const cached = avatarCache.get(src);
  return cached && cached.expiresAt > Date.now() + 5 * 60 * 1000
    ? cached.url
    : null;
}

async function resolveAvatarUrl(src: string): Promise<string | null> {
  const now = Date.now();
  const cached = avatarCache.get(src);

  // Return cached URL if it exists and has more than 5 minutes until expiration
  if (cached && cached.expiresAt > now + 5 * 60 * 1000) {
    console.log(`[DEBUG] [resolveAvatarUrl] Cache HIT for src: "${src}" -> URL: "${cached.url.substring(0, 80)}..."`);
    return cached.url;
  }

  // If a request for this exact avatar is already in flight, wait for it instead of starting a new one
  if (pendingRequests.has(src)) {
    console.log(`[DEBUG] [resolveAvatarUrl] Request already in flight for src: "${src}". Deduplicating.`);
    return pendingRequests.get(src)!;
  }

  // Storage keys are always bucket-qualified (for example,
  // `avatars/<userId>-<fileId>.jpg`). Keep the key intact so it matches the
  // value persisted by the API and can be authorized exactly.
  console.log(`[DEBUG] [resolveAvatarUrl] Resolving signed URL for storage key: "${src}"`);

  const promise = apiClient.request<{ url?: string }>('vlog/getSignedReadUrl', ['avatars', src])
    .then((res) => {
      if (res.success && res.url) {
        console.log(`[DEBUG] [resolveAvatarUrl] Successfully resolved signed URL for "${src}": "${res.url.substring(0, 80)}..."`);
        avatarCache.set(src, {
          url: res.url,
          expiresAt: Date.now() + 3600 * 1000, // Matches the 1 hour expiry from the backend
        });
        return res.url;
      }
      console.warn(`[DEBUG] [resolveAvatarUrl] Server failed to return signed URL for "${src}". Error: ${res?.error || 'unknown'}`);
      return null;
    })
    .catch((err) => {
      console.error(`[DEBUG] [resolveAvatarUrl] Network error resolving signed URL for "${src}":`, err);
      return null;
    })
    .finally(() => {
      // Clean up the pending request tracker once complete
      pendingRequests.delete(src);
    });

  pendingRequests.set(src, promise);
  return promise;
}

export function Avatar({ src, name, size = 44, ring = false }: AvatarProps) {
  const [error, setError] = useState(false);
  // Absolute/local sources and warm relative sources are available during the
  // first render. This prevents the initials fallback from flashing when a tab
  // remounts while its avatar is already cached.
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => getImmediateAvatarUrl(src));

  useEffect(() => {
    setError(false);
    let isMounted = true;

    async function loadSource() {
      if (!src) {
        console.log(`[DEBUG] [Avatar] No src provided for "${name || 'unknown'}". Falling back to initials.`);
        if (isMounted) setResolvedSrc(null);
        return;
      }

      const immediateUrl = getImmediateAvatarUrl(src);
      if (immediateUrl) {
        if (isMounted) setResolvedSrc(immediateUrl);
        return;
      }

      console.log(`[DEBUG] [Avatar] Detected relative path for "${name || 'unknown'}": "${src}"`);
      const url = await resolveAvatarUrl(src);
      if (isMounted) {
        if (url) {
          console.log(`[DEBUG] [Avatar] Successfully mapped resolvedSrc for "${name || 'unknown'}"`);
          setResolvedSrc(url);
        } else {
          console.warn(`[DEBUG] [Avatar] Failed to resolve URL for "${name || 'unknown'}": "${src}"`);
          setResolvedSrc(null);
        }
      }
    }

    loadSource();

    return () => {
      isMounted = false;
    };
  }, [src]);

  const getInitials = () => {
    if (!name) return null;
    return name
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const initials = getInitials();
  const hasImage = resolvedSrc && !error;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring ? 2.5 : 0,
        },
      ]}
    >
      {hasImage ? (
        <Image
          source={{ uri: resolvedSrc }}
          style={StyleSheet.absoluteFill}
          onError={(e) => {
            console.error(`[DEBUG] [Avatar] Image load error on native component for "${name || 'unknown'}". URI: "${resolvedSrc?.substring(0, 80)}...". Error detail:`, e.nativeEvent);
            setError(true);
          }}
        />
      ) : initials ? (
        <Text weight="bold" style={{ fontSize: size * 0.35 }}>
          {initials}
        </Text>
      ) : (
        <User size={size * 0.5} color="rgba(255,255,255,0.6)" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#e07c30',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
