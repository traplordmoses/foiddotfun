"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

export type BoardEvent = {
  id: string;
  created_at: string;
  event_type: "proposal_created" | "vote_cast" | "proposal_finalized";
  proposal_id: number | null;
  data: Record<string, unknown>;
};

export type BoardEventInsert = {
  event_type: BoardEvent["event_type"];
  proposal_id?: number | null;
  data?: Record<string, unknown>;
};

// ============================================================================
// SUPABASE CLIENT (gracefully disabled when credentials are placeholders)
// ============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const isConfigured =
  supabaseUrl.length > 0 &&
  supabaseKey.length > 0 &&
  !supabaseUrl.includes("placeholder") &&
  !supabaseKey.includes("placeholder");

export const supabase: SupabaseClient | null = isConfigured
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    })
  : null;

export const SUPABASE_ENABLED = isConfigured;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Insert a new board message
 */
export async function insertBoardMessage(
  data: BoardMessageInsert
): Promise<BoardMessage | null> {
  if (!supabase) return null;
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
  if (!supabase) return [];
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
  if (!supabase) return () => {};

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

// ============================================================================
// BOARD EVENTS (real-time proposal/vote/finalization updates)
// ============================================================================

/**
 * Insert a board event (proposal created, vote cast, proposal finalized).
 * Non-blocking — failures are logged but don't throw.
 */
export async function insertBoardEvent(
  data: BoardEventInsert
): Promise<void> {
  try {
    const { error } = await supabase
      .from("board_events")
      .insert(data);

    if (error) {
      console.warn("[supabase] insertBoardEvent error:", error.message);
    }
  } catch (err) {
    console.warn("[supabase] insertBoardEvent failed:", err);
  }
}

/**
 * Subscribe to board events in real-time.
 * Returns unsubscribe function.
 */
export function subscribeToBoardEvents(
  callback: (event: BoardEvent) => void
): () => void {
  const channel = supabase
    .channel("board_events_changes")
    .on<BoardEvent>(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "board_events",
      },
      (payload) => {
        if (payload.new) {
          callback(payload.new);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
