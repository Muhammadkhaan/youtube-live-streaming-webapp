import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Configure Google Auth Provider with YouTube Scopes
const provider = new GoogleAuthProvider();
export const SCOPES = [
  'https://www.googleapis.com/auth/youtube',
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/youtube.force-ssl',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

SCOPES.forEach(scope => provider.addScope(scope));

// In-memory token storage (never persist access token in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export interface YouTubeChannelInfo {
  id: string;
  title: string;
  description: string;
  customUrl?: string;
  thumbnailUrl?: string;
  subscriberCount?: string;
  videoCount?: string;
  viewCount?: string;
  liveStreamingEnabled?: boolean;
}

export interface YouTubeBroadcastItem {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  scheduledStartTime?: string;
  actualStartTime?: string;
  actualEndTime?: string;
  lifeCycleStatus: 'created' | 'ready' | 'testing' | 'live' | 'complete' | 'revoked';
  privacyStatus: 'public' | 'unlisted' | 'private';
  boundStreamId?: string;
  streamKey?: string;
  rtmpUrl?: string;
  concurrentViewers?: string;
}

// Auth state listener
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

// Sign in with Google Popup
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to obtain YouTube access token from Google sign-in.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google YouTube Sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const logout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Fetch YouTube Channel Info for authenticated user
export const fetchMyYouTubeChannel = async (token: string): Promise<YouTubeChannelInfo | null> => {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics,status&mine=true',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `YouTube API error: ${res.status}`);
    }
    const data = await res.json();
    if (!data.items || data.items.length === 0) {
      return null;
    }
    const item = data.items[0];
    return {
      id: item.id,
      title: item.snippet?.title || 'YouTube Channel',
      description: item.snippet?.description || '',
      customUrl: item.snippet?.customUrl,
      thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url,
      subscriberCount: item.statistics?.subscriberCount,
      videoCount: item.statistics?.videoCount,
      viewCount: item.statistics?.viewCount,
      liveStreamingEnabled: item.status?.isLinked !== false,
    };
  } catch (err) {
    console.error('Error fetching YouTube channel:', err);
    throw err;
  }
};

// List user's Live Broadcasts
export const fetchYouTubeBroadcasts = async (token: string): Promise<YouTubeBroadcastItem[]> => {
  try {
    const res = await fetch(
      'https://www.googleapis.com/youtube/v3/liveBroadcasts?part=snippet,status,contentDetails&broadcastType=all&mine=true&maxResults=25',
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to fetch broadcasts: ${res.status}`);
    }
    const data = await res.json();
    const broadcasts: YouTubeBroadcastItem[] = (data.items || []).map((b: any) => ({
      id: b.id,
      title: b.snippet?.title || 'Untitled Broadcast',
      description: b.snippet?.description || '',
      publishedAt: b.snippet?.publishedAt,
      scheduledStartTime: b.snippet?.scheduledStartTime,
      actualStartTime: b.snippet?.actualStartTime,
      actualEndTime: b.snippet?.actualEndTime,
      lifeCycleStatus: b.status?.lifeCycleStatus || 'created',
      privacyStatus: b.status?.privacyStatus || 'unlisted',
      boundStreamId: b.contentDetails?.boundStreamId,
    }));

    const streamIds = broadcasts.map(b => b.boundStreamId).filter(Boolean);
    if (streamIds.length > 0) {
      try {
        const streamRes = await fetch(
          `https://www.googleapis.com/youtube/v3/liveStreams?part=snippet,cdn,status&id=${streamIds.join(',')}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/json',
            },
          }
        );
        if (streamRes.ok) {
          const streamData = await streamRes.json();
          const streamMap = new Map<string, { key: string; rtmpUrl: string }>();
          (streamData.items || []).forEach((s: any) => {
            const ingestion = s.cdn?.ingestionInfo;
            if (ingestion) {
              streamMap.set(s.id, {
                key: ingestion.streamName,
                rtmpUrl: ingestion.ingestionAddress,
              });
            }
          });
          broadcasts.forEach(b => {
            if (b.boundStreamId && streamMap.has(b.boundStreamId)) {
              const info = streamMap.get(b.boundStreamId)!;
              b.streamKey = info.key;
              b.rtmpUrl = info.rtmpUrl;
            }
          });
        }
      } catch (streamErr) {
        console.warn('Could not fetch bound streams:', streamErr);
      }
    }
    return broadcasts;
  } catch (err) {
    console.error('Error fetching broadcasts:', err);
    throw err;
  }
};
