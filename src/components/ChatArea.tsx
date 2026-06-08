"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MessageRow, ProfileRow } from "@/lib/types";
import { MessageSquare, Paperclip, SendHorizontal } from "lucide-react";

type ChatAreaProps = {
  messages: MessageRow[];
  currentUserId: string | null;
  profileMap: Map<string, ProfileRow>;
  selectedFriend: ProfileRow | null;
  onSend: (body: string, file: File | null) => Promise<void>;
  isSending: boolean;
  error: string | null;
  showCallView: boolean;
  callView: React.ReactNode;
  compactMode: boolean;
};

const formatTime = (timestamp: string) =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

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

export function ChatArea({
  messages,
  currentUserId,
  profileMap,
  selectedFriend,
  onSend,
  isSending,
  error,
  showCallView,
  callView,
  compactMode,
}: ChatAreaProps) {
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const messageItems = useMemo(
    () =>
      messages.map((message) => {
        const sender = profileMap.get(message.sender_id);
        return { message, sender };
      }),
    [messages, profileMap],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim() && !file) return;
    await onSend(body.trim(), file);
    setBody("");
    setFile(null);
  };

  return (
    <section className="flex h-full flex-1 flex-col">
      <div
        className={`flex-1 px-4 py-4 ${
          showCallView ? "overflow-hidden" : "overflow-y-auto"
        }`}
      >
        {showCallView ? (
          <div className="h-full">{callView}</div>
        ) : (
          <>
            {messageItems.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)]">
                  <MessageSquare className="h-7 w-7 text-[var(--text-muted)]" />
                </div>
                <div>
                  <div className="text-base font-semibold text-[var(--text-primary)]">
                    {selectedFriend
                      ? selectedFriend.display_name
                      : "Select a friend"}
                  </div>
                  <div className="text-sm text-[var(--text-muted)]">
                    {selectedFriend
                      ? `This is the beginning of your direct message history with ${selectedFriend.display_name}.`
                      : "Select a friend to start chatting."}
                  </div>
                </div>
              </div>
            )}
            {messageItems.map(({ message, sender }, index) => {
              const isMe = message.sender_id === currentUserId;
              const senderName = sender?.display_name ?? "Unknown";
              const prev = index > 0 ? messages[index - 1] : null;
              const isSameSender = prev?.sender_id === message.sender_id;
              const showHeader = !isSameSender;
              return (
                <div
                  key={message.id}
                  className={`group flex items-start gap-3 px-2 py-[2px] rounded transition hover:bg-[var(--bg-hover)] ${
                    compactMode ? "py-[1px]" : ""
                  }`}
                >
                  {showHeader ? (
                    <div className="relative mt-0.5 shrink-0">
                      {sender?.avatar_url ? (
                        <img
                          src={sender.avatar_url}
                          alt={senderName}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-hover-secondary)] text-sm font-semibold">
                          {getInitials(senderName)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-10 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    {showHeader && (
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-[var(--text-primary)] hover:underline cursor-pointer">
                          {isMe ? "You" : senderName}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                    )}
                    {message.body && (
                      <p className={`whitespace-pre-line text-sm text-[var(--text-primary)] leading-[1.375rem] ${
                        showHeader ? "mt-[2px]" : ""
                      }`}>
                        {message.body}
                      </p>
                    )}
                    {message.file_url && (
                      /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i.test(
                        message.file_url,
                      ) ? (
                        <a
                          href={message.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-block ${showHeader || message.body ? "mt-1" : ""}`}
                        >
                          <img
                            src={message.file_url}
                            alt="Attachment"
                            className="max-h-60 max-w-xs rounded-lg object-cover"
                          />
                        </a>
                      ) : (
                        <a
                          href={message.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center gap-2 rounded bg-[var(--bg-hover-secondary)] px-3 py-1 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-input)] ${
                            showHeader || message.body ? "mt-1" : ""
                          }`}
                        >
                          <Paperclip className="h-4 w-4" />
                          Attachment
                        </a>
                      )
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </>
        )}
      </div>
      <form
        onSubmit={handleSubmit}
        className="px-4 pb-4 pt-2"
      >
        <div className="flex flex-col rounded-lg bg-[var(--bg-input)] px-4 py-[10px]">
          {error && (
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent-red)]">
              {error}
            </div>
          )}
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={1}
            className="w-full resize-none bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder-[var(--text-muted)]"
            placeholder={`Message ${selectedFriend?.display_name ?? "..."}`}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                handleSubmit(event);
              }
            }}
          />
          <div className="mt-[2px] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded text-[var(--text-muted)] transition hover:bg-[var(--bg-hover-secondary)] hover:text-[var(--text-primary)]"
                aria-label="Attach file"
                title="Attach file"
              >
                <Paperclip className="h-[18px] w-[18px]" />
                <span className="sr-only">Attach file</span>
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) =>
                    setFile(event.target.files ? event.target.files[0] : null)
                  }
                />
              </label>
              {file && (
                <span className="max-w-[180px] truncate text-xs text-[var(--text-muted)]">
                  {file.name}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSending || (!body.trim() && !file)}
              className="inline-flex items-center justify-center rounded bg-[var(--accent)] p-2 text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendHorizontal className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}
