"use client";

import { useEffect, useState } from "react";
import type { ProfileRow } from "@/lib/types";
import { LogOut, Upload, X } from "lucide-react";
import { AvatarCropperModal } from "@/components/AvatarCropperModal";

type SettingsModalProps = {
  isOpen: boolean;
  currentUser: ProfileRow | null;
  isSaving: boolean;
  error: string | null;
  compactMode: boolean;
  storageWarnings: string[];
  onToggleCompactMode: () => void;
  onRefreshStorageChecks: () => void;
  onClose: () => void;
  onSaveProfile: (input: {
    displayName: string;
    realName: string;
    avatarFile: File | null;
    status: ProfileRow["status"];
    statusMessage: string;
  }) => Promise<boolean>;
  onSignOut: () => Promise<void>;
  audioInputDeviceId: string;
  audioOutputDeviceId: string;
  onAudioInputDeviceChange: (deviceId: string) => void;
  onAudioOutputDeviceChange: (deviceId: string) => void;
};

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

export function SettingsModal({
  isOpen,
  currentUser,
  isSaving,
  error,
  compactMode,
  storageWarnings,
  onToggleCompactMode,
  onRefreshStorageChecks,
  onClose,
  onSaveProfile,
  onSignOut,
  audioInputDeviceId,
  audioOutputDeviceId,
  onAudioInputDeviceChange,
  onAudioOutputDeviceChange,
}: SettingsModalProps) {
  const [displayName, setDisplayName] = useState("");
  const [realName, setRealName] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [status, setStatus] = useState<ProfileRow["status"]>("online");
  const [devices, setDevices] = useState<{ kind: string; id: string; label: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(currentUser?.display_name ?? "");
    setRealName(currentUser?.real_name ?? "");
    setStatus(currentUser?.status ?? "online");
    setStatusMessage(currentUser?.status_message ?? "");
    setAvatarFile(null);
    setAvatarPreviewUrl(null);
  }, [currentUser?.id, isOpen]);

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(avatarFile);
    setAvatarPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [avatarFile]);

  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices.enumerateDevices().then((list) => {
      setDevices(
        list
          .filter((d) => d.kind === "audioinput" || d.kind === "audiooutput")
          .map((d) => ({ kind: d.kind, id: d.deviceId, label: d.label || d.kind })),
      );
    }).catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const avatarSrc = avatarPreviewUrl ?? currentUser?.avatar_url ?? null;

  const handleAvatarSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    setPendingAvatarFile(file);
    setIsCropperOpen(true);
    event.target.value = "";
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const success = await onSaveProfile({
      displayName,
      realName,
      avatarFile,
      status,
      statusMessage,
    });
    if (success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6">
      <div className="w-full max-w-lg rounded-lg bg-[var(--bg-card)] text-[var(--text-primary)] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-base font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
            aria-label="Close settings"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        <form onSubmit={handleSave} className="max-h-[70vh] overflow-y-auto px-4 py-4">
          <section className="space-y-4">
            <div className="flex items-center gap-4">
              {avatarSrc ? (
                <img
                  src={avatarSrc}
                  alt={displayName || "User"}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-lg font-semibold">
                  {getInitials(displayName || "User")}
                </div>
              )}
              <div className="space-y-2">
                <div className="text-xs text-[var(--text-muted)]">
                  Profile picture
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-input)]">
                  <Upload className="h-4 w-4" />
                  <span>{avatarFile ? "Image ready" : "Upload image"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarSelect}
                  />
                </label>
                {avatarFile && (
                  <div className="text-xs text-[var(--text-muted)]">
                    {avatarFile.name}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Username
                </label>
                <input
                  required
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                  placeholder="Username"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Real name
                </label>
                <input
                  required
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                  placeholder="Real name"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Status
                </label>
                <select
                  value={status ?? "online"}
                  onChange={(event) =>
                    setStatus(event.target.value as ProfileRow["status"])
                  }
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                >
                  <option value="online">Online</option>
                  <option value="away">Away</option>
                  <option value="busy">Do Not Disturb</option>
                  <option value="offline">Offline</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Status message
                </label>
                <input
                  value={statusMessage}
                  onChange={(event) => setStatusMessage(event.target.value)}
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                  placeholder="What's up?"
                />
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              Preferences
            </div>
            <div className="flex items-center justify-between rounded bg-[var(--bg-hover-secondary)] px-3 py-3">
              <div>
                <div className="text-sm font-medium">Compact mode</div>
                <div className="text-xs text-[var(--text-muted)]">
                  Reduce spacing in the message list.
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleCompactMode}
                className={`relative h-6 w-10 shrink-0 rounded-full transition ${
                  compactMode ? "bg-[var(--accent)]" : "bg-[#4e5058]"
                }`}
                aria-pressed={compactMode}
                aria-label="Toggle compact mode"
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                    compactMode ? "translate-x-[18px]" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </section>

          <section className="mt-6 space-y-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">
              Audio Devices
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Microphone
                </label>
                <select
                  value={audioInputDeviceId}
                  onChange={(event) => onAudioInputDeviceChange(event.target.value)}
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                >
                  {devices.filter((d) => d.kind === "audioinput").map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                  {devices.filter((d) => d.kind === "audioinput").length === 0 && (
                    <option value="">No microphones found</option>
                  )}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                  Speaker
                </label>
                <select
                  value={audioOutputDeviceId}
                  onChange={(event) => onAudioOutputDeviceChange(event.target.value)}
                  className="w-full rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:bg-[var(--bg-input)]"
                >
                  {devices.filter((d) => d.kind === "audiooutput").map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                  {devices.filter((d) => d.kind === "audiooutput").length === 0 && (
                    <option value="">No speakers found</option>
                  )}
                </select>
              </div>
            </div>
          </section>

          <section className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-[var(--text-primary)]">
                Storage
              </div>
              <button
                type="button"
                onClick={onRefreshStorageChecks}
                className="rounded bg-[var(--bg-hover-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
              >
                Recheck
              </button>
            </div>
            {storageWarnings.length === 0 ? (
              <div className="rounded bg-[var(--bg-hover-secondary)] px-3 py-3 text-xs text-[var(--text-muted)]">
                Storage buckets look good.
              </div>
            ) : (
              <div className="space-y-2">
                {storageWarnings.map((warning) => (
                  <div
                    key={warning}
                    className="rounded bg-[var(--accent-red)]/10 px-3 py-3 text-xs text-[var(--accent-red)]"
                  >
                    {warning}
                  </div>
                ))}
              </div>
            )}
          </section>

          {error && (
            <div className="mt-4 rounded bg-[var(--accent-red)]/10 px-3 py-2 text-sm text-[var(--accent-red)]">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-2 rounded bg-[var(--bg-hover-secondary)] px-3 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded bg-[var(--bg-hover-secondary)] px-4 py-2 text-xs font-semibold text-[var(--text-muted)] transition hover:bg-[var(--bg-input)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSaving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
      <AvatarCropperModal
        isOpen={isCropperOpen}
        file={pendingAvatarFile}
        onCancel={() => {
          setIsCropperOpen(false);
          setPendingAvatarFile(null);
        }}
        onCrop={(file) => {
          setAvatarFile(file);
          setIsCropperOpen(false);
          setPendingAvatarFile(null);
        }}
      />
    </div>
  );
}
