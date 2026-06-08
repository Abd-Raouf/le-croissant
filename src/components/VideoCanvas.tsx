"use client";

import { useEffect, useRef } from "react";
import type { ProfileRow, ScreenShareQuality } from "@/lib/types";
import { MonitorUp } from "lucide-react";

type VideoCanvasProps = {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isSharing: boolean;
  isInCall: boolean;
  selectedFriend: ProfileRow | null;
  quality: ScreenShareQuality;
  onQualityChange: (quality: ScreenShareQuality) => void;
};

export function VideoCanvas({
  localStream,
  remoteStream,
  isSharing,
  isInCall,
  selectedFriend,
  quality,
  onQualityChange,
}: VideoCanvasProps) {
  const mainRef = useRef<HTMLVideoElement | null>(null);
  const pipRef = useRef<HTMLVideoElement | null>(null);

  const mainStream = remoteStream ?? localStream ?? null;
  const pipStream = remoteStream && localStream ? localStream : null;
  const shouldRender = Boolean(isInCall || isSharing || mainStream);

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.srcObject = mainStream;
    }
  }, [mainStream]);

  useEffect(() => {
    if (pipRef.current) {
      pipRef.current.srcObject = pipStream;
    }
  }, [pipStream]);

  if (!shouldRender) return null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded bg-black/60 px-2.5 py-1 text-xs font-semibold text-[var(--text-muted)]">
        <MonitorUp className="h-3.5 w-3.5" />
        <span>
          {isSharing
            ? "Screen Share"
            : `Voice Call${selectedFriend ? ` — ${selectedFriend.display_name}` : ""}`}
        </span>
      </div>
      {isSharing && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded bg-black/60 px-2.5 py-1 text-xs text-[var(--text-muted)]">
          <span>Quality</span>
          <select
            value={quality}
            onChange={(event) =>
              onQualityChange(event.target.value as ScreenShareQuality)
            }
            className="bg-transparent text-xs text-[var(--text-primary)] outline-none"
          >
            <option value="low">480p</option>
            <option value="medium">720p</option>
            <option value="high">1080p</option>
          </select>
        </div>
      )}
      {mainStream ? (
        <video
          ref={mainRef}
          autoPlay
          playsInline
          muted={!remoteStream}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-[var(--text-muted)]">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-lg font-semibold text-[var(--text-primary)]">
            {getInitials(selectedFriend?.display_name ?? "Call")}
          </div>
          <div>Connecting...</div>
        </div>
      )}
      {pipStream && (
        <div className="absolute bottom-3 right-3 h-28 w-44 overflow-hidden rounded-lg border-2 border-[var(--bg-card)] bg-black/50 shadow-lg">
          <video
            ref={pipRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

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
