"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ProfileRow } from "@/lib/types";
import { supabase } from "@/lib/supabaseClient";
import {
  Headphones,
  Mic,
  MicOff,
  Plus,
  Search,
  Settings,
  UserPlus,
  X,
} from "lucide-react";

type SidebarProps = {
  friends: ProfileRow[];
  availableFriends: ProfileRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddFriend: (id: string) => void | Promise<void>;
  currentUser: ProfileRow | null;
  isMuted: boolean;
  isDeafened: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onOpenSettings: () => void;
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

const statusClass = (status: ProfileRow["status"]) => {
  switch (status) {
    case "online":
      return "bg-[var(--accent-green)]";
    case "away":
      return "bg-[var(--accent-yellow)]";
    case "busy":
      return "bg-[var(--accent-red)]";
    default:
      return "bg-[#80848e]";
  }
};

export function Sidebar({
  friends,
  availableFriends,
  selectedId,
  onSelect,
  onAddFriend,
  currentUser,
  isMuted,
  isDeafened,
  onToggleMute,
  onToggleDeafen,
  onOpenSettings,
}: SidebarProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProfileRow[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const displayName = currentUser?.display_name ?? "User";
  const realName = currentUser?.real_name ?? "";

  const doSearch = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .neq("id", currentUser?.id ?? "")
      .or(`display_name.ilike.%${trimmed}%,real_name.ilike.%${trimmed}%`)
      .order("display_name")
      .limit(20);
    setSearchResults(data ?? []);
    setIsSearching(false);
  }, [currentUser?.id]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void doSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, doSearch]);

  return (
    <aside className="relative flex h-full min-h-[360px] flex-col bg-[var(--bg-sidebar)] text-[var(--text-primary)]">
      <div className="flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
        <span>Friends</span>
        <button
          type="button"
          onClick={() => {
            setIsAdding((prev) => !prev);
            setSearchQuery("");
            setSearchResults([]);
            setAddedIds(new Set());
          }}
          className="flex h-6 w-6 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
          aria-label="Add friend"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {isAdding && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]">
            <Search className="h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by username..."
              className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-2 max-h-60 space-y-1 overflow-y-auto">
            {isSearching && (
              <div className="rounded bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]">
                Searching...
              </div>
            )}
            {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
              <div className="rounded bg-[var(--bg-card)] px-3 py-2 text-xs text-[var(--text-muted)]">
                No users found.
              </div>
            )}
            {!isSearching && searchResults.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded bg-[var(--bg-card)] px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.display_name}
                      className="h-7 w-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-[10px] font-semibold">
                      {user.display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--text-primary)]">
                      {user.display_name}
                    </div>
                    {user.real_name && (
                      <div className="truncate text-xs text-[var(--text-muted)]">
                        {user.real_name}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void onAddFriend(user.id);
                    setAddedIds((prev) => new Set(prev).add(user.id));
                  }}
                  disabled={addedIds.has(user.id)}
                  className="shrink-0 rounded bg-[var(--accent)] px-2 py-1 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:opacity-50"
                >
                  {addedIds.has(user.id) ? "Added" : "Add"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-24">
        {friends.length === 0 && !isAdding && (
          <div className="rounded bg-[var(--bg-card)] p-4 text-sm text-[var(--text-muted)]">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-[var(--text-primary)]">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--text-primary)]">
                  No friends yet
                </div>
                <div className="text-xs text-[var(--text-muted)]">
                  Add someone to start chatting.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="rounded bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--accent-strong)]"
              >
                Add Friend
              </button>
            </div>
          </div>
        )}
        {friends.map((friend) => {
          const isActive = friend.id === selectedId;
          return (
            <button
              key={friend.id}
              onClick={() => onSelect(friend.id)}
              className={`flex w-full items-center gap-3 rounded px-2 py-2 text-left transition ${
                isActive
                  ? "bg-[var(--bg-hover-secondary)]"
                  : "hover:bg-[var(--bg-hover)]"
              }`}
            >
              <div className="relative shrink-0">
                {friend.avatar_url ? (
                  <img
                    src={friend.avatar_url}
                    alt={friend.display_name}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-xs font-semibold">
                    {getInitials(friend.display_name)}
                  </div>
                )}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-[10px] w-[10px] rounded-full border-2 border-[var(--bg-sidebar)] ${statusClass(
                    friend.status,
                  )}`}
                />
              </div>
              <div className="min-w-0 text-left">
                <div className="truncate text-sm font-medium leading-tight text-[var(--text-primary)]">
                  {friend.display_name}
                </div>
                {friend.status_message && (
                  <div className="truncate text-xs text-[var(--text-muted)]">
                    {friend.status_message}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div className="absolute bottom-0 left-0 right-0 bg-[var(--bg-userbar)] px-2 py-2">
        <div className="flex items-center justify-between rounded px-2 py-1 transition hover:bg-[var(--bg-hover)]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="relative shrink-0">
              {currentUser?.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={displayName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-xs font-semibold">
                  {getInitials(displayName)}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 h-[10px] w-[10px] rounded-full border-2 border-[var(--bg-userbar)] ${statusClass(
                  currentUser?.status ?? null,
                )}`}
              />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium leading-tight">{displayName}</div>
              {realName && (
                <div className="truncate text-[11px] text-[var(--text-muted)] leading-tight">
                  {realName}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleMute}
              className={`flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)] ${
                isMuted ? "bg-[var(--bg-hover-secondary)] text-[var(--accent-red)]" : ""
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
            </button>
            <button
              type="button"
              onClick={onToggleDeafen}
              className={`flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)] ${
                isDeafened ? "bg-[var(--bg-hover-secondary)] text-[var(--accent-red)]" : ""
              }`}
              aria-label={isDeafened ? "Undeafen" : "Deafen"}
            >
              <Headphones className="h-[18px] w-[18px]" />
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex h-8 w-8 items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Settings"
              title="Settings"
            >
              <Settings className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
