"use client";

import { MonitorUp, Phone, PhoneOff, Video, X } from "lucide-react";

type CallControlsProps = {
  isInCall: boolean;
  isSharing: boolean;
  callState: "idle" | "ringing" | "incoming" | "active";
  onStartCall: () => Promise<void>;
  onEndCall: () => Promise<void>;
  onCancelCall: () => Promise<void>;
  onAcceptCall: () => Promise<void>;
  onDeclineCall: () => Promise<void>;
  onStartVideoCall: () => Promise<void>;
  onToggleShare: () => Promise<void>;
};

export function CallControls({
  isInCall,
  isSharing,
  callState,
  onStartCall,
  onEndCall,
  onCancelCall,
  onAcceptCall,
  onDeclineCall,
  onStartVideoCall,
  onToggleShare,
}: CallControlsProps) {
  if (callState === "ringing") {
    return (
      <div className="flex items-center gap-1">
        <span className="text-xs text-[var(--accent-yellow)] animate-pulse mr-1">Ringing...</span>
        <button
          onClick={onCancelCall}
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-[var(--danger)] text-white transition hover:bg-[#c93033]"
          aria-label="Cancel call"
        >
          <X className="h-[18px] w-[18px]" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={isInCall ? onEndCall : onStartCall}
        className={`inline-flex h-8 w-8 items-center justify-center rounded transition ${
          isInCall
            ? "bg-[var(--danger)] text-white hover:bg-[#c93033]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-label={isInCall ? "End call" : "Start call"}
      >
        {isInCall ? <PhoneOff className="h-[18px] w-[18px]" /> : <Phone className="h-[18px] w-[18px]" />}
      </button>
      <button
        onClick={onStartVideoCall}
        disabled={isInCall}
        className="inline-flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Start video call"
      >
        <Video className="h-[18px] w-[18px]" />
      </button>
      <button
        onClick={onToggleShare}
        className={`inline-flex h-8 w-8 items-center justify-center rounded transition ${
          isSharing
            ? "bg-[var(--accent)] text-white hover:bg-[var(--accent-strong)]"
            : "text-[var(--text-muted)] hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
        }`}
        aria-label={isSharing ? "Stop screen share" : "Start screen share"}
      >
        <MonitorUp className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
