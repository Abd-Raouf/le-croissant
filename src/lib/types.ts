export type ProfileRow = {
  id: string;
  display_name: string;
  real_name: string;
  avatar_url: string | null;
  status: "online" | "away" | "busy" | "offline" | null;
  status_message: string | null;
  updated_at: string | null;
};

export type MessageRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string | null;
  file_url: string | null;
  created_at: string;
};

export type FriendRow = {
  id: string;
  user_id: string;
  friend_id: string;
  created_at: string | null;
};

export type FriendRequestRow = {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string | null;
};

export type ScreenShareQuality = "low" | "medium" | "high";
