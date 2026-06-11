"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel, Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import type {
  FriendRequestRow,
  MessageRow,
  ProfileRow,
  ScreenShareQuality,
} from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { VideoCanvas } from "@/components/VideoCanvas";
import { CallControls } from "@/components/CallControls";
import { SettingsModal } from "@/components/SettingsModal";
import { AvatarCropperModal } from "@/components/AvatarCropperModal";
import { Phone, PhoneOff } from "lucide-react";

type AuthView = "landing" | "sign-in" | "sign-up";

type SignalOffer = {
  type: "offer";
  senderId: string;
  data: RTCSessionDescriptionInit;
};

type SignalAnswer = {
  type: "answer";
  senderId: string;
  data: RTCSessionDescriptionInit;
};

type SignalIce = {
  type: "ice";
  senderId: string;
  data: RTCIceCandidateInit;
};

type SignalHangup = {
  type: "hangup";
  senderId: string;
  data?: null;
};

type SignalPayload = SignalOffer | SignalAnswer | SignalIce | SignalHangup;

const screenShareConstraints: Record<ScreenShareQuality, MediaTrackConstraints> =
  {
    low: {
      width: { ideal: 854 },
      height: { ideal: 480 },
      frameRate: { ideal: 24 },
    },
    medium: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    high: {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60 },
    },
  };

const callChannelName = (userId: string, friendId: string) =>
  `call:${[userId, friendId].sort().join(":")}`;

const messageMatches = (
  message: MessageRow,
  userId: string,
  friendId: string,
) =>
  (message.sender_id === userId && message.recipient_id === friendId) ||
  (message.sender_id === friendId && message.recipient_id === userId);

const getInitials = (name: string) => {
  const safeName = name.trim();
  if (!safeName) return "U";
  const parts = safeName.split(" ");
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return initials.toUpperCase();
};

const formatSchemaError = (error?: { message?: string; code?: string } | null) => {
  if (!error?.message) return null;
  if (error.code === "23505") {
    if (error.message.includes("profiles_display_name_unique")) {
      return "Username already taken. Please choose another.";
    }
    if (error.message.includes("friend_requests_unique_pair")) {
      return "Friend request already sent.";
    }
    if (error.message.includes("friends_unique_pair")) {
      return "You are already friends.";
    }
  }
  if (error.message.includes("schema cache") || error.code === "42P01") {
    return "Profiles, friends, or friend_requests tables are missing. Run schema.sql in Supabase, then reload the schema cache.";
  }
  return error.message;
};

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authView, setAuthView] = useState<AuthView>("landing");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authRealName, setAuthRealName] = useState("");
  const [authAvatarFile, setAuthAvatarFile] = useState<File | null>(null);
  const [pendingAuthAvatarFile, setPendingAuthAvatarFile] = useState<File | null>(null);
  const [isAuthCropperOpen, setIsAuthCropperOpen] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authSuccess, setAuthSuccess] = useState<string | null>(null);
  const [isAddFriendOpen, setIsAddFriendOpen] = useState(false);

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [allProfiles, setAllProfiles] = useState<ProfileRow[]>([]);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestRow[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestRow[]>([]);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [storageWarnings, setStorageWarnings] = useState<string[]>([]);

  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(
    null,
  );
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isInCall, setIsInCall] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [quality, setQuality] = useState<ScreenShareQuality>("medium");
  const [callError, setCallError] = useState<string | null>(null);
  const [callState, setCallState] = useState<"idle" | "ringing" | "incoming" | "active">("idle");
  const [incomingCallerId, setIncomingCallerId] = useState<string | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RTCSessionDescriptionInit | null>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [audioInputDeviceId, setAudioInputDeviceId] = useState("");
  const [audioOutputDeviceId, setAudioOutputDeviceId] = useState("");

  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const signalQueueRef = useRef<SignalPayload[]>([]);
  const processingSignalRef = useRef(false);
  const localAudioRef = useRef<MediaStream | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const screenAudioSenderRef = useRef<RTCRtpSender | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const currentUserId = session?.user.id ?? null;

  const compactStorageKey = currentUserId
    ? `le-croissant:compact:${currentUserId}`
    : null;

  const profileMap = useMemo(() => {
    const map = new Map<string, ProfileRow>();
    allProfiles.forEach((item) => map.set(item.id, item));
    if (profile) map.set(profile.id, profile);
    return map;
  }, [profile, allProfiles]);

  const friends = useMemo(
    () => allProfiles.filter((item) => friendIds.includes(item.id)),
    [allProfiles, friendIds],
  );

  const incomingRequestIds = useMemo(
    () => incomingRequests.map((item) => item.sender_id),
    [incomingRequests],
  );

  const outgoingRequestIds = useMemo(
    () => outgoingRequests.map((item) => item.recipient_id),
    [outgoingRequests],
  );

  const availableFriends = useMemo(
    () =>
      allProfiles.filter(
        (item) =>
          !friendIds.includes(item.id) &&
          !incomingRequestIds.includes(item.id) &&
          !outgoingRequestIds.includes(item.id),
      ),
    [allProfiles, friendIds, incomingRequestIds, outgoingRequestIds],
  );

  const selectedFriend = useMemo(
    () => friends.find((item) => item.id === selectedFriendId) ?? null,
    [friends, selectedFriendId],
  );

  const refreshFriends = useCallback(async () => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("friends")
      .select("*")
      .or(`user_id.eq.${currentUserId},friend_id.eq.${currentUserId}`);

    if (error) {
      const message = formatSchemaError(error);
      if (message) setProfileError(message);
      return;
    }

    if (!data) return;
    const nextIds = data.map((row) =>
      row.user_id === currentUserId ? row.friend_id : row.user_id,
    );
    setFriendIds(nextIds);
  }, [currentUserId]);

  const refreshFriendRequests = useCallback(async () => {
    if (!currentUserId) return;
    const { data, error } = await supabase
      .from("friend_requests")
      .select("*")
      .eq("status", "pending")
      .or(`sender_id.eq.${currentUserId},recipient_id.eq.${currentUserId}`)
      .order("created_at", { ascending: true });

    if (error) {
      const message = formatSchemaError(error);
      if (message) setProfileError(message);
      return;
    }

    if (!data) return;
    setIncomingRequests(
      data.filter((item) => item.recipient_id === currentUserId),
    );
    setOutgoingRequests(data.filter((item) => item.sender_id === currentUserId));
  }, [currentUserId]);

  const checkStorageBuckets = useCallback(async () => {
    if (!currentUserId) return;
    const warnings: string[] = [];

    const { error: avatarsError } = await supabase
      .storage
      .from("avatars")
      .list("", { limit: 1 });

    if (avatarsError) {
      warnings.push(
        "Storage bucket 'avatars' is missing or lacks access. Create it and set it to public.",
      );
    }

    const { error: attachmentsError } = await supabase
      .storage
      .from("attachments")
      .list("", { limit: 1 });

    if (attachmentsError) {
      warnings.push(
        "Storage bucket 'attachments' is missing or lacks access. Create it and set it to public.",
      );
    }

    setStorageWarnings(warnings);
  }, [currentUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      console.log("[AUTH] supabase not configured");
      return;
    }
    console.log("[AUTH] checking initial session...");
    supabase.auth.getSession().then(({ data, error }) => {
      console.log("[AUTH] initial session:", !!data.session, "error:", error?.message);
      setSession(data.session);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        console.log("[AUTH] onAuthStateChange:", event, "session:", !!nextSession);
        setSession(nextSession);
      },
    );
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);


  useEffect(() => {
    if (!currentUserId || !compactStorageKey) {
      setCompactMode(false);
      return;
    }
    const stored = localStorage.getItem(compactStorageKey);
    if (stored !== null) {
      setCompactMode(stored === "true");
    }
  }, [compactStorageKey, currentUserId]);


  useEffect(() => {
    if (!currentUserId || !compactStorageKey) return;
    localStorage.setItem(compactStorageKey, String(compactMode));
  }, [compactMode, compactStorageKey, currentUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId) {
      setProfile(null);
      setAllProfiles([]);
      setFriendIds([]);
      setSelectedFriendId(null);
      setProfileError(null);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setStorageWarnings([]);
      return;
    }

    setProfileError(null);

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUserId)
        .maybeSingle();

      if (error) {
        const message = formatSchemaError(error);
        if (message) setProfileError(message);
        return;
      }

      if (!data) {
        const fallbackName = session?.user.email?.split("@")[0] ?? "User";
        const { error: insertError } = await supabase
          .from("profiles")
          .upsert({
            id: currentUserId,
            display_name: fallbackName,
            real_name: fallbackName,
            avatar_url: null,
            status: "online",
            status_message: null,
            updated_at: new Date().toISOString(),
          });
        if (insertError) {
          const message = formatSchemaError(insertError);
          if (message) setProfileError(message);
          return;
        }
        const { data: created } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentUserId)
          .maybeSingle();
        setProfile(created ?? null);
        return;
      }

      setProfile(data);
    };

    const fetchProfiles = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", currentUserId)
        .order("display_name", { ascending: true });

      if (error) {
        const message = formatSchemaError(error);
        if (message) setProfileError(message);
        return;
      }
      if (data) setAllProfiles(data);
    };

    void fetchProfile();
    void fetchProfiles();
  }, [currentUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId) {
      setFriendIds([]);
      return;
    }
    void refreshFriends();

    const channel = supabase
      .channel(`friends:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `user_id=eq.${currentUserId}`,
        },
        () => {
          void refreshFriends();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friends",
          filter: `friend_id=eq.${currentUserId}`,
        },
        () => {
          void refreshFriends();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, refreshFriends]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId) {
      setIncomingRequests([]);
      setOutgoingRequests([]);
      return;
    }

    void refreshFriendRequests();

    const channel = supabase
      .channel(`friend-requests:${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        () => {
          void refreshFriendRequests();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friend_requests",
          filter: `sender_id=eq.${currentUserId}`,
        },
        () => {
          void refreshFriendRequests();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [currentUserId, refreshFriendRequests]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId) return;
    void checkStorageBuckets();
  }, [checkStorageBuckets, currentUserId]);


  useEffect(() => {
    if (friends.length === 0) {
      setSelectedFriendId(null);
      return;
    }
    if (!selectedFriendId || !friends.some((item) => item.id === selectedFriendId)) {
      setSelectedFriendId(friends[0].id);
    }
  }, [friends, selectedFriendId]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId || !selectedFriendId) {
      setMessages([]);
      return;
    }

    let active = true;

    const loadMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${currentUserId},recipient_id.eq.${selectedFriendId}),and(sender_id.eq.${selectedFriendId},recipient_id.eq.${currentUserId})`,
        )
        .order("created_at", { ascending: true });

      if (!error && data && active) {
        setMessages(data);
      }
    };

    void loadMessages();

    const channel = supabase
      .channel(`messages:${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const nextMessage = payload.new as MessageRow;
          if (
            messageMatches(nextMessage, currentUserId, selectedFriendId) &&
            active
          ) {
            setMessages((prev) => [...prev, nextMessage]);
          }
        },
      )
      .subscribe();

    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [currentUserId, selectedFriendId]);

  const sendSignal = useCallback(async (payload: SignalPayload) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event: "signal", payload });
  }, []);

  const playRingtone = useCallback(() => {
    try {
      const ctx = new AudioContext();
      ringtoneRef.current = ctx;
      let on = false;
      const beep = () => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      };
      beep();
      ringIntervalRef.current = setInterval(beep, 1000);
    } catch {}
  }, []);

  const stopRingtone = useCallback(() => {
    if (ringIntervalRef.current) {
      clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;
    }
    if (ringtoneRef.current) {
      ringtoneRef.current.close().catch(() => {});
      ringtoneRef.current = null;
    }
  }, []);

  const endCall = useCallback(
    async (notifyPeer: boolean) => {
      stopRingtone();
      if (notifyPeer && currentUserId) {
        await sendSignal({ type: "hangup", senderId: currentUserId });
      }

      localAudioRef.current?.getTracks().forEach((track) => track.stop());
      localAudioRef.current = null;

      localScreenStream?.getTracks().forEach((track) => track.stop());
      setLocalScreenStream(null);
      screenSenderRef.current = null;
      screenAudioSenderRef.current = null;

      if (peerRef.current) {
        peerRef.current.ontrack = null;
        peerRef.current.onicecandidate = null;
        peerRef.current.close();
      }
      peerRef.current = null;
      remoteStreamRef.current = null;
      setRemoteStream(null);
      setIsInCall(false);
      setIsSharing(false);
      setIsMuted(false);
      setCallState("idle");
      setIncomingCallerId(null);
      setIncomingOffer(null);
    },
    [currentUserId, localScreenStream, sendSignal, stopRingtone],
  );

  const ensurePeerConnection = useCallback(() => {
    if (peerRef.current) return peerRef.current;

    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:openrelay.metered.ca:80" },
        { urls: "turn:openrelay.metered.ca:443" },
        { urls: "turn:openrelay.metered.ca:443?transport=tcp" },
      ],
    });

    peer.onicecandidate = (event) => {
      if (event.candidate && currentUserId) {
        void sendSignal({
          type: "ice",
          senderId: currentUserId,
          data: event.candidate.toJSON(),
        });
      }
    };

    peer.ontrack = (event) => {
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      const alreadyAdded = remoteStreamRef.current.getTracks().some(
        (t) => t.id === event.track.id,
      );
      if (!alreadyAdded) {
        remoteStreamRef.current.addTrack(event.track);
      }
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };

    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed" || peer.connectionState === "closed") {
        void endCall(false);
      }
    };

    peerRef.current = peer;
    return peer;
  }, [currentUserId, endCall, sendSignal]);

  const getAudioConstraints = useCallback((): MediaStreamConstraints => {
    if (audioInputDeviceId) {
      return {
        audio: {
          deviceId: { exact: audioInputDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      };
    }
    return { audio: true, video: false };
  }, [audioInputDeviceId]);

  const startCall = useCallback(async () => {
    if (!currentUserId || !selectedFriendId) return;
    setCallError(null);
    try {
      const peer = ensurePeerConnection();

      if (!localAudioRef.current) {
        let audioStream: MediaStream;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia(getAudioConstraints());
        } catch {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        localAudioRef.current = audioStream;
        audioStream.getAudioTracks().forEach((track) => {
          peer.addTrack(track, audioStream);
        });
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal({ type: "offer", senderId: currentUserId, data: offer });
      setCallState("ringing");
      setIsInCall(true);
      playRingtone();
    } catch (error) {
      setCallError("Unable to start the call. Check device permissions.");
    }
  }, [currentUserId, ensurePeerConnection, getAudioConstraints, playRingtone, selectedFriendId, sendSignal]);

  const endScreenShare = useCallback(async () => {
    const peer = peerRef.current;
    if (peer && screenSenderRef.current) {
      peer.removeTrack(screenSenderRef.current);
      screenSenderRef.current = null;
    }
    if (peer && screenAudioSenderRef.current) {
      peer.removeTrack(screenAudioSenderRef.current);
      screenAudioSenderRef.current = null;
    }

    localScreenStream?.getTracks().forEach((track) => track.stop());
    setLocalScreenStream(null);
    setIsSharing(false);

    if (peer && currentUserId && peer.signalingState === "stable") {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await sendSignal({ type: "offer", senderId: currentUserId, data: offer });
    }
  }, [currentUserId, localScreenStream, sendSignal]);

  const startScreenShare = useCallback(
    async (overrideQuality?: ScreenShareQuality) => {
      if (!currentUserId || !selectedFriendId) return;
      setCallError(null);
      const nextQuality = overrideQuality ?? quality;
      try {
        const peer = ensurePeerConnection();
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: screenShareConstraints[nextQuality],
          audio: true,
        });

        setLocalScreenStream(stream);
        const videoTrack = stream.getVideoTracks()[0];
        if (!videoTrack) return;

        videoTrack.onended = () => {
          void endScreenShare();
        };

        if (screenSenderRef.current) {
          peer.removeTrack(screenSenderRef.current);
        }
        screenSenderRef.current = peer.addTrack(videoTrack, stream);

        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          if (screenAudioSenderRef.current) {
            peer.removeTrack(screenAudioSenderRef.current);
          }
          screenAudioSenderRef.current = peer.addTrack(audioTrack, stream);
        }

        setIsSharing(true);

        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        await sendSignal({
          type: "offer",
          senderId: currentUserId,
          data: offer,
        });
        setIsInCall(true);
      } catch (error) {
        setCallError("Unable to share your screen. Check permissions.");
      }
    },
    [
      currentUserId,
      endScreenShare,
      ensurePeerConnection,
      quality,
      selectedFriendId,
      sendSignal,
    ],
  );

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted;
    const audioStream = localAudioRef.current;
    if (audioStream) {
      audioStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    const screenStream = localScreenStream;
    if (screenStream) {
      screenStream.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }
    setIsMuted(nextMuted);
  }, [isMuted, localScreenStream]);

  const toggleDeafen = useCallback(() => {
    setIsDeafened((prev) => !prev);
  }, []);

  const cancelCall = useCallback(async () => {
    stopRingtone();
    if (currentUserId) {
      await sendSignal({ type: "hangup", senderId: currentUserId });
    }
    if (peerRef.current) {
      peerRef.current.ontrack = null;
      peerRef.current.onicecandidate = null;
      peerRef.current.close();
      peerRef.current = null;
    }
    localAudioRef.current?.getTracks().forEach((track) => track.stop());
    localAudioRef.current = null;
    setRemoteStream(null);
    setIsInCall(false);
    setCallState("idle");
  }, [currentUserId, sendSignal, stopRingtone]);

  const acceptCall = useCallback(async () => {
    stopRingtone();
    if (!incomingOffer || !incomingCallerId) return;
    try {
      const peer = ensurePeerConnection();

      await peer.setRemoteDescription(incomingOffer);

      // flush buffered ICE candidates
      for (const c of pendingIceCandidatesRef.current) {
        try { await peer.addIceCandidate(c); } catch {}
      }
      pendingIceCandidatesRef.current = [];

      if (!localAudioRef.current) {
        let audioStream: MediaStream;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia(getAudioConstraints());
        } catch {
          audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        localAudioRef.current = audioStream;
        audioStream.getAudioTracks().forEach((track) => {
          peer.addTrack(track, audioStream);
        });
      }

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await sendSignal({
        type: "answer",
        senderId: currentUserId!,
        data: answer,
      });
      setIsInCall(true);
      setCallState("active");
      setIncomingCallerId(null);
      setIncomingOffer(null);
    } catch {
      setCallError("Failed to accept call. Check microphone permissions.");
    }
  }, [currentUserId, ensurePeerConnection, getAudioConstraints, incomingCallerId, incomingOffer, sendSignal, stopRingtone]);

  const declineCall = useCallback(async () => {
    stopRingtone();
    if (currentUserId && incomingCallerId) {
      await sendSignal({ type: "hangup", senderId: currentUserId });
    }
    setIncomingCallerId(null);
    setIncomingOffer(null);
    setCallState("idle");
  }, [currentUserId, incomingCallerId, sendSignal, stopRingtone]);

  const startVideoCall = useCallback(async () => {
    await startCall();
  }, [startCall]);

  const handleSignal = useCallback(
    async (payload: SignalPayload) => {
      if (!currentUserId || payload.senderId === currentUserId) return;

      if (payload.type === "hangup") {
        stopRingtone();
        await endCall(false);
        setCallState("idle");
        return;
      }

      if (payload.type === "offer") {
        setIncomingCallerId(payload.senderId);
        setIncomingOffer(payload.data);
        setCallState("incoming");
        playRingtone();
        return;
      }

      const peer = peerRef.current;
      if (!peer) return;

      if (payload.type === "answer") {
        stopRingtone();
        await peer.setRemoteDescription(payload.data);
        setCallState("active");
        setIsInCall(true);
        return;
      }

      if (payload.type === "ice") {
        const peer = peerRef.current;
        if (peer) {
          try { await peer.addIceCandidate(payload.data); } catch {}
        } else {
          pendingIceCandidatesRef.current.push(payload.data);
        }
      }
    },
    [currentUserId, endCall, playRingtone, sendSignal, stopRingtone],
  );

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (!currentUserId || !selectedFriendId) return;

    const enqueueAndProcess = async () => {
      if (processingSignalRef.current) return;
      processingSignalRef.current = true;
      while (signalQueueRef.current.length > 0) {
        const payload = signalQueueRef.current.shift()!;
        await handleSignal(payload);
      }
      processingSignalRef.current = false;
      if (signalQueueRef.current.length > 0) {
        void enqueueAndProcess();
      }
    };

    const channel = supabase
      .channel(callChannelName(currentUserId, selectedFriendId), {
        config: { broadcast: { ack: true } },
      })
      .on("broadcast", { event: "signal" }, ({ payload }) => {
        signalQueueRef.current.push(payload as SignalPayload);
        void enqueueAndProcess();
      });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [currentUserId, handleSignal, selectedFriendId]);

  const handleAuthSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(null);
    setAuthSuccess(null);
    setAuthBusy(true);

    try {
      if (authView === "sign-in") {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: authPassword,
        });
        if (error) {
          setAuthError(error.message);
        } else if (data.session) {
          setSession(data.session);
        } else {
          const { data: { session: newSession } } = await supabase.auth.getSession();
          if (newSession) setSession(newSession);
        }
        setAuthBusy(false);
        return;
      }

      if (!authDisplayName.trim() || !authRealName.trim()) {
        setAuthError("Display name and real name are required.");
        setAuthBusy(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
      });

      if (error) {
        setAuthError(error.message);
        setAuthBusy(false);
        return;
      }

      if (data.session) {
        setSession(data.session);
        const userId = data.user?.id;
        if (userId) {
          const { url: avatarUrl } = await uploadAvatar(userId, authAvatarFile);
          await supabase.from("profiles").upsert({
            id: userId,
            display_name: authDisplayName.trim(),
            real_name: authRealName.trim(),
            avatar_url: avatarUrl,
            status: "online",
            status_message: null,
            updated_at: new Date().toISOString(),
          });
        }
        setAuthBusy(false);
        return;
      }

      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setAuthError("An account with this email already exists. Try signing in instead.");
        setAuthBusy(false);
        return;
      }

      const userId = data.user?.id;
      if (userId) {
        const { url: avatarUrl } = await uploadAvatar(userId, authAvatarFile);
        await supabase.from("profiles").upsert({
          id: userId,
          display_name: authDisplayName.trim(),
          real_name: authRealName.trim(),
          avatar_url: avatarUrl,
          status: "online",
          status_message: null,
          updated_at: new Date().toISOString(),
        });
      }

      setAuthError(null);
      setAuthView("sign-in");
      setAuthSuccess("Account created! You can now sign in.");
      setAuthBusy(false);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setAuthBusy(false);
    }
  };

  const handleAuthAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setPendingAuthAvatarFile(file);
    setIsAuthCropperOpen(true);
    event.target.value = "";
  };

  const uploadAvatar = async (userId: string, file: File | null) => {
    if (!file) return { url: null, error: null };
    const extension = file.name.split(".").pop() ?? "png";
    const path = `${userId}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadError) return { url: null, error: uploadError.message };
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  };

  const uploadAttachment = async (userId: string, file: File | null) => {
    if (!file) return null;
    const extension = file.name.split(".").pop() ?? "dat";
    const path = `${userId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("attachments")
      .upload(path, file, { upsert: false });
    if (error) return null;
    const { data } = supabase.storage.from("attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAddFriend = async (friendId: string) => {
    if (!currentUserId || friendId === currentUserId) return;
    if (friendIds.includes(friendId)) {
      setSelectedFriendId(friendId);
      return;
    }

    const { error } = await supabase.from("friends").insert({
      user_id: currentUserId,
      friend_id: friendId,
    });

    if (error) {
      if (error.code === "23505") {
        setFriendIds((prev) => (prev.includes(friendId) ? prev : [...prev, friendId]));
        setSelectedFriendId(friendId);
        return;
      }
      const message = formatSchemaError(error);
      if (message) setProfileError(message);
      return;
    }

    setFriendIds((prev) => (prev.includes(friendId) ? prev : [...prev, friendId]));
    setSelectedFriendId(friendId);
  };

  const handleProfileUpdate = async (input: {
    displayName: string;
    realName: string;
    avatarFile: File | null;
    status: ProfileRow["status"];
    statusMessage: string;
  }) => {
    if (!currentUserId) return false;
    setIsSavingProfile(true);
    setProfileError(null);
    const { url: avatarUrl, error: avatarError } = await uploadAvatar(currentUserId, input.avatarFile);
    if (avatarError) {
      setProfileError(`Avatar upload failed: ${avatarError}`);
      setIsSavingProfile(false);
      return false;
    }
    const { error } = await supabase.from("profiles").upsert({
      id: currentUserId,
      display_name: input.displayName.trim(),
      real_name: input.realName.trim(),
      avatar_url: avatarUrl ?? profile?.avatar_url ?? null,
      status: input.status ?? "online",
      status_message: input.statusMessage.trim() || null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      const message = formatSchemaError(error);
      if (message) setProfileError(message);
      setIsSavingProfile(false);
      return false;
    }
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            display_name: input.displayName.trim(),
            real_name: input.realName.trim(),
            avatar_url: avatarUrl ?? prev.avatar_url ?? null,
            status: input.status ?? prev.status,
            status_message: input.statusMessage.trim() || null,
          }
        : null,
    );
    setIsSavingProfile(false);
    return true;
  };

  const handleSendMessage = async (body: string, file: File | null) => {
    if (!currentUserId || !selectedFriendId) return;
    setMessageError(null);
    setIsSending(true);

    const fileUrl = await uploadAttachment(currentUserId, file);

    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: currentUserId,
        recipient_id: selectedFriendId,
        body: body || null,
        file_url: fileUrl,
      })
      .select()
      .single();

    if (error) {
      setMessageError(error.message);
    } else if (data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
    }
    setIsSending(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfileError(null);
    setIsSettingsOpen(false);
    void endCall(false);
  };

  const handleForgotPassword = async () => {
    if (!authEmail) {
      setAuthError("Enter your email above first, then click Forgot password.");
      return;
    }
    setAuthError(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(authEmail, {
      redirectTo: window.location.origin,
    });
    setAuthBusy(false);
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthSuccess("Password reset email sent. Check your inbox.");
    }
  };

  const handleOpenSettings = () => {
    setProfileError(null);
    setIsSettingsOpen(true);
  };

  const handleToggleShare = async () => {
    if (isSharing) {
      await endScreenShare();
      return;
    }
    await startScreenShare();
  };

  const handleQualityChange = (nextQuality: ScreenShareQuality) => {
    setQuality(nextQuality);
    if (isSharing) {
      void endScreenShare().then(() => startScreenShare(nextQuality));
    }
  };

  const showCallView =
    isInCall || isSharing || Boolean(remoteStream || localScreenStream);

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 bg-[var(--bg-main)]">
        <div className="w-full max-w-md rounded-lg bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-subtle)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
            Setup required
          </p>
          <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
            Missing environment variables
          </h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Add the variables below to <code className="text-[var(--text-primary)]">.env.local</code>, then restart the dev server.
          </p>
          <div className="mt-4 rounded bg-[var(--bg-hover-secondary)] p-3 text-xs text-[var(--text-muted)] font-mono">
            <div>NEXT_PUBLIC_SUPABASE_URL=</div>
            <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=</div>
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    if (authView === "landing") {
      return (
        <div className="flex min-h-screen items-center justify-center px-6 bg-[var(--bg-main)]">
          <div className="w-full max-w-md rounded-lg bg-[var(--bg-card)] p-8 shadow-2xl border border-[var(--border-subtle)]">
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                le croissant
              </p>
              <h1 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">
                Welcome to Le Croissant
              </h1>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                A place to talk with friends.
              </p>
            </div>
            <div className="mt-8 flex flex-col gap-3">
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccess(null);
                  setAuthView("sign-in");
                }}
                className="w-full rounded bg-[var(--accent)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setAuthError(null);
                  setAuthSuccess(null);
                  setAuthView("sign-up");
                }}
                className="w-full rounded border border-[var(--border-light)] bg-[var(--bg-hover-secondary)] py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:border-[var(--text-muted)]"
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center px-6 bg-[var(--bg-main)]">
        <div className="w-full max-w-md rounded-lg bg-[var(--bg-card)] p-6 shadow-2xl border border-[var(--border-subtle)]">
          <button
            onClick={() => {
              setAuthError(null);
              setAuthSuccess(null);
              setAuthView("landing");
            }}
            className="mb-4 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
          >
            &larr; Back
          </button>

          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
              le croissant
            </p>
            <h1 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
              {authView === "sign-in" ? "Welcome back" : "Create your account"}
            </h1>
            {authSuccess && (
              <p className="mt-1 text-sm text-green-400">{authSuccess}</p>
            )}
          </div>

          <form onSubmit={handleAuthSubmit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                Email
              </label>
              <input
                type="email"
                required
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)] placeholder-[var(--text-muted)]"
                placeholder="Email"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                Password
              </label>
              <input
                type="password"
                required
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)] placeholder-[var(--text-muted)]"
                placeholder="Password"
              />
            </div>

            {authView === "sign-in" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  disabled={authBusy}
                  className="text-xs text-[var(--text-link)] hover:underline disabled:opacity-50"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {authView === "sign-up" && (
              <>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                    Username
                  </label>
                  <input
                    required
                    value={authDisplayName}
                    onChange={(event) => setAuthDisplayName(event.target.value)}
                    className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)] placeholder-[var(--text-muted)]"
                    placeholder="Username"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                    Real name
                  </label>
                  <input
                    required
                    value={authRealName}
                    onChange={(event) => setAuthRealName(event.target.value)}
                    className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)] placeholder-[var(--text-muted)]"
                    placeholder="Real name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                    Profile picture
                  </label>
                  <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-[var(--border-light)] bg-[var(--bg-hover-secondary)] px-3 py-3 text-xs text-[var(--text-muted)] transition hover:border-[var(--text-muted)]">
                    {authAvatarFile ? authAvatarFile.name : "Upload an image"}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAuthAvatarSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </>
            )}

            {authError && (
              <div className={`rounded px-3 py-2 text-sm ${authError.includes("created") ? "bg-green-500/10 text-green-400" : "bg-[var(--accent-red)]/10 text-[var(--accent-red)]"}`}>
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full rounded bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {authBusy
                ? "Working..."
                : authView === "sign-in"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
        <AvatarCropperModal
          isOpen={isAuthCropperOpen}
          file={pendingAuthAvatarFile}
          onCancel={() => {
            setIsAuthCropperOpen(false);
            setPendingAuthAvatarFile(null);
          }}
          onCrop={(file) => {
            setAuthAvatarFile(file);
            setIsAuthCropperOpen(false);
            setPendingAuthAvatarFile(null);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-main)]">
      <div className="flex flex-1">
        <div className="w-60 flex-shrink-0">
          <Sidebar
            friends={friends}
            availableFriends={availableFriends}
            selectedId={selectedFriendId}
            onSelect={setSelectedFriendId}
            onAddFriend={handleAddFriend}
            currentUser={profile}
            isMuted={isMuted}
            isDeafened={isDeafened}
            onToggleMute={toggleMute}
            onToggleDeafen={toggleDeafen}
            onOpenSettings={handleOpenSettings}
          />
        </div>
        <main className="flex min-w-0 flex-1 flex-col bg-[var(--bg-panel)]">
          <header className="flex items-center justify-between gap-4 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2">
              {selectedFriend?.avatar_url ? (
                <img
                  src={selectedFriend.avatar_url}
                  alt={selectedFriend.display_name}
                  className="h-6 w-6 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-[10px] font-semibold">
                  {getInitials(selectedFriend?.display_name ?? "U")}
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {selectedFriend?.display_name ?? "Select a friend"}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {callError && (
                <span className="text-xs text-[var(--accent-red)]">{callError}</span>
              )}
              <CallControls
                isInCall={isInCall}
                isSharing={isSharing}
                callState={callState}
                onStartCall={startCall}
                onStartVideoCall={startVideoCall}
                onEndCall={() => endCall(true)}
                onCancelCall={cancelCall}
                onAcceptCall={acceptCall}
                onDeclineCall={declineCall}
                onToggleShare={handleToggleShare}
              />
            </div>
          </header>
          {callState === "incoming" && incomingCallerId && (
            <div className="mx-4 mt-2 flex items-center justify-between rounded-lg bg-[var(--accent)]/20 border border-[var(--accent)]/30 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--accent)] animate-pulse">
                  <Phone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">
                    Incoming call
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {profileMap.get(incomingCallerId)?.display_name ?? "Unknown"} wants to call you
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={declineCall}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--danger)] text-white transition hover:bg-[#c93033]"
                >
                  <PhoneOff className="h-4 w-4" />
                </button>
                <button
                  onClick={acceptCall}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-green)] text-white transition hover:bg-[#1d9449]"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          {profileError && (
            <div className="mx-4 mt-2 rounded bg-[var(--accent-red)]/10 px-3 py-2 text-xs text-[var(--accent-red)]">
              {profileError}
            </div>
          )}
          <ChatArea
            messages={messages}
            currentUserId={currentUserId}
            profileMap={profileMap}
            selectedFriend={selectedFriend}
            onSend={handleSendMessage}
            isSending={isSending}
            error={messageError}
            showCallView={showCallView}
            callView={
              <VideoCanvas
                localStream={localScreenStream}
                remoteStream={remoteStream}
                isSharing={isSharing}
                isInCall={isInCall}
                selectedFriend={selectedFriend}
                quality={quality}
                onQualityChange={handleQualityChange}
                audioOutputDeviceId={audioOutputDeviceId}
              />
            }
            compactMode={compactMode}
          />
        </main>
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        currentUser={profile}
        isSaving={isSavingProfile}
        error={profileError}
        compactMode={compactMode}
        storageWarnings={storageWarnings}
        onToggleCompactMode={() => setCompactMode((prev) => !prev)}
        onRefreshStorageChecks={checkStorageBuckets}
        onClose={() => setIsSettingsOpen(false)}
        onSaveProfile={handleProfileUpdate}
        onSignOut={handleSignOut}
        audioInputDeviceId={audioInputDeviceId}
        audioOutputDeviceId={audioOutputDeviceId}
        onAudioInputDeviceChange={setAudioInputDeviceId}
        onAudioOutputDeviceChange={setAudioOutputDeviceId}
      />
    </div>
  );
}
