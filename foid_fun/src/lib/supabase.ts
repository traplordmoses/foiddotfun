"use client";

import { createClient } from "@supabase/supabase-js";

// ============================================================================
// TYPES
// ============================================================================

export type BoardMessage = {
  id: string;
  created_at: string;
  wallet_address: string | null;
  message: string;
  type: "chat" | "status";
};

export type BoardMessageInsert = {
  wallet_address?: string | null;
  message: string;
  type: "chat" | "status";
};

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Insert a new board message
 */
export async function insertBoardMessage(
  data: BoardMessageInsert
): Promise<BoardMessage | null> {
  try {
    const { data: message, error } = await supabase
      .from("board_messages")
      .insert(data)
      .select()
      .single();

    if (error) {
      console.error("Error inserting board message:", error);
      return null;
    }

    return message;
  } catch (err) {
    console.error("Failed to insert board message:", err);
    return null;
  }
}

/**
 * Fetch recent board messages (default: last 100)
 */
export async function fetchRecentMessages(
  limit = 100
): Promise<BoardMessage[]> {
  try {
    const { data, error } = await supabase
      .from("board_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching board messages:", error);
      return [];
    }

    return (data || []).reverse(); // Reverse to show oldest first
  } catch (err) {
    console.error("Failed to fetch board messages:", err);
    return [];
  }
}

/**
 * Subscribe to new board messages in real-time
 * Returns unsubscribe function
 */
export function subscribeToBoardMessages(
  callback: (message: BoardMessage) => void
): () => void {
  const channel = supabase
    .channel("board_messages_changes")
    .on<BoardMessage>(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "board_messages",
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new);
        }
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
