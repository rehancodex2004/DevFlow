import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import "../styles/recent-chats.css";

function formatDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getChatTitle(chat) {
  if (chat.title?.trim()) {
    return chat.title.trim();
  }

  if (chat.chat_type === "TASK") {
    return chat.task_title || `Task #${chat.task_id}`;
  }

  return "Global AI Chat";
}

export default function RecentChats({ onOpenGlobalChat }) {
  const navigate = useNavigate();

  const [chats, setChats] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function loadRecentChats(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    }

    try {
      setError("");

      const response = await api.recentChats();
      const data = response.data || {};

      const nextChats = Array.isArray(data.chats)
        ? data.chats
        : [];

      setChats(nextChats);
    } catch (err) {
      console.error("RECENT CHATS ERROR:", err);

      // Never remove the current list just because refresh failed.
      if (chats.length === 0) {
        setError("Unable to load chats.");
      }
    } finally {
      setInitialLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadRecentChats(false);
  }, []);

  function openChat(chat) {
    if (chat.chat_type === "TASK") {
      navigate(
        `/tasks/${chat.task_id}?aiSession=${chat.id}`
      );
      return;
    }

    if (typeof onOpenGlobalChat === "function") {
      onOpenGlobalChat(chat.id);
    }
  }

  return (
    <div className="recent-chats">
      <div className="recent-chats-header">
        <span>Recent Chats</span>

        <button
          type="button"
          className={refreshing ? "is-refreshing" : ""}
          onClick={() => loadRecentChats(true)}
          disabled={refreshing}
          title="Refresh recent chats"
          aria-label="Refresh recent chats"
        >
          ↻
        </button>
      </div>

      {initialLoading && chats.length === 0 && (
        <div className="recent-chats-message">
          Loading chats…
        </div>
      )}

      {!initialLoading && error && chats.length === 0 && (
        <div className="recent-chats-message recent-chats-error">
          {error}
        </div>
      )}

      {!initialLoading && !error && chats.length === 0 && (
        <div className="recent-chats-message">
          No recent chats yet.
        </div>
      )}

      {chats.length > 0 && (
        <div className="recent-chats-list">
          {chats.map((chat) => {
            const isTask = chat.chat_type === "TASK";
            const isEnded = chat.status === "ENDED";

            return (
              <button
                type="button"
                className="recent-chat-item"
                key={chat.id}
                title={`Open ${getChatTitle(chat)}`}
                onClick={() => openChat(chat)}
              >
                <span
                  className={`recent-chat-icon ${
                    isTask ? "task" : "global"
                  }`}
                >
                  {isTask ? "✓" : "✦"}
                </span>

                <span className="recent-chat-info">
                  <span className="recent-chat-title">
                    {getChatTitle(chat)}
                  </span>

                  <span className="recent-chat-meta">
                    <span>{isTask ? "Task AI" : "Global AI"}</span>
                    <span className="recent-chat-dot">•</span>
                    <span>
                      {formatDate(
                        chat.last_message_at ||
                          chat.created_at
                      )}
                    </span>
                  </span>
                </span>

                <span
                  className={`recent-chat-status ${
                    isEnded ? "ended" : "active"
                  }`}
                >
                  {isEnded ? "Ended" : "Active"}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {refreshing && chats.length > 0 && (
        <div className="recent-chats-refreshing">
          Updating…
        </div>
      )}
    </div>
  );
}
