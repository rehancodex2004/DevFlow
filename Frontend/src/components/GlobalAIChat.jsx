import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import ConfirmDialog from "./ui/ConfirmDialog";
import AIMemoryPanel from "./AIMemoryPanel";
import "../styles/ai-global.css";

const SUGGESTIONS = [
  "What are my active tasks?",
  "Summarize my projects",
  "What is currently blocking me?",
  "What should I work on next?",
];

function SourceChip({ source }) {
  const label =
    source.label ||
    `${source.type}${source.id ? ` #${source.id}` : ""}`;

  return (
    <span className="ai-source-chip">
      {label}
    </span>
  );
}

function Message({ message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={`ai-message ${
        isUser
          ? "ai-message-user"
          : "ai-message-assistant"
      }`}
    >
      <div className="ai-message-bubble">
        {message.content.split("\n").map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>

      {!isUser &&
        Array.isArray(message.sources) &&
        message.sources.length > 0 && (
          <div className="ai-sources">
            <span className="ai-sources-label">
              Sources
            </span>

            {message.sources.map((s, i) => (
              <SourceChip
                key={i}
                source={s}
              />
            ))}
          </div>
        )}
      {!isUser && message.memoriesUsed > 0 && (
        <div className="ai-sources ai-memory-used">
          Memory used · {message.memoriesUsed}
        </div>
      )}
    </div>
  );
}

export default function GlobalAIChat({
  open,
  onClose,
  onMinimize,
  sessionId = null,
  context = null,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] =
    useState(false);
  const [error, setError] = useState("");
  const [endingChat, setEndingChat] =
    useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);

  const scrollRef = useRef(null);


  // ======================================================
  // LOAD GLOBAL CHAT HISTORY
  // ======================================================

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    async function loadHistory() {
      try {
        let data;

        if (sessionId) {
          const response =
            await api.chatSessionHistory(sessionId);

          data = response.data || {};

          if (
            !data.session ||
            data.session.chatType !== "GLOBAL"
          ) {
            throw new Error("This chat is not a Global AI session.");
          }

          if (!cancelled) {
            setViewingHistory(data.session.status === "ENDED");
            setHistoryStatus(data.session.status || "ENDED");
          }
        } else {
          const response =
            await api.globalChatHistory();

          data = response.data || {};

          if (!cancelled) {
            setViewingHistory(false);
            setHistoryStatus(data.sessionStatus || null);
          }
        }

        const rows = data.messages || [];

        if (!cancelled) {
          setMessages(
            rows.map((row) => ({
              id: row.id,
              role: row.role,
              content: row.content,
              sources: row.sources || [],
            }))
          );
        }
      } catch (e) {
        console.error(
          "Failed to load Global AI chat history:",
          e
        );
      } finally {
        if (!cancelled) {
          setHistoryLoaded(true);
        }
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);


  // ======================================================
  // AUTO SCROLL
  // ======================================================

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop =
        scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);


  // ======================================================
  // SEND MESSAGE
  // ======================================================

  async function sendMessage(text) {
    const trimmed = text.trim();

    if (
      !trimmed ||
      loading ||
      endingChat
    ) {
      return;
    }

    setError("");
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: trimmed,
        sources: [],
      },
    ]);

    setLoading(true);

    try {
      const response =
        await api.globalChat(trimmed, context);

      const data = response.data || {};

      const answer = data.answer || "";
      const sources = data.sources || [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          sources,
          memoriesUsed: data.memoriesUsed || 0,
        },
      ]);
    } catch (e) {
      setError(
        e.message ||
          "The AI assistant is unavailable right now."
      );
    } finally {
      setLoading(false);
    }
  }


  // ======================================================
  // END GLOBAL CHAT SESSION
  // ======================================================

  async function handleEndChat() {
    if (viewingHistory) {
      setViewingHistory(false);
      setHistoryStatus(null);
      setMessages([]);
      setHistoryLoaded(false);
      return;
    }

    if (
      loading ||
      endingChat
    ) {
      return;
    }

    setConfirmEnd(true);
  }

  async function confirmEndChat() {
    setConfirmEnd(false);

    setError("");
    setEndingChat(true);

    try {
      const response = await api.globalChatEnd();
      const result = response.data || {};

      if (!result.ended) {
        setError(result.message || "No active Global AI session found.");
        return;
      }

      setMessages([]);
      setInput("");
      setViewingHistory(false);
      setHistoryStatus(null);
      setHistoryLoaded(false);
      onClose();
    } catch (e) {
      setError(
        e.message ||
          "Unable to end the chat session."
      );
    } finally {
      setEndingChat(false);
    }
  }


  // ======================================================
  // FORM SUBMIT
  // ======================================================

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }


  // ======================================================
  // DO NOT RENDER WHEN CLOSED
  // ======================================================

  if (!open) {
    return null;
  }


  // ======================================================
  // UI
  // ======================================================

  return (
    <div className="ai-global-overlay">

      <div className="ai-global-panel">

        {/* HEADER */}
        <div className="ai-global-header">

          <div>
            <p className="eyebrow">
              Global AI
            </p>

            <h3>
              Ask about your workspace
            </h3>
          </div>


          <div className="ai-global-header-actions">

            {/* END CHAT */}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setMemoryOpen(true)}
            >
              Memory
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleEndChat}
              disabled={
                loading ||
                endingChat
              }
            >
              {viewingHistory
                ? "Close History"
                : endingChat
                  ? "Ending..."
                  : "End Chat"}
            </button>

            <button
              type="button"
              className="ai-global-minimize"
              onClick={onMinimize || onClose}
              disabled={endingChat}
              aria-label="Minimize Global AI"
            >
              −
            </button>

            {/* CLOSE */}
            <button
              type="button"
              className="ai-global-close"
              onClick={onClose}
              disabled={endingChat}
              aria-label="Close Global AI"
            >
              ×
            </button>

          </div>

        </div>


        {viewingHistory && (
          <div className="ai-history-banner">
            Viewing saved chat history
            {historyStatus === "ENDED" ? " · Ended" : ""}
          </div>
        )}

        {/* CHAT BODY */}
        <div
          className="ai-global-body"
          ref={scrollRef}
        >

          {historyLoaded &&
            messages.length === 0 && (
              <div className="ai-empty-state">
                Ask anything about your
                projects, tasks, comments,
                or workspace.
              </div>
            )}


          {messages.map((m, i) => (
            <Message
              key={m.id || i}
              message={m}
            />
          ))}


          {/* THINKING */}
          {loading && (
            <div className="ai-message ai-message-assistant">
              <div className="ai-message-bubble ai-thinking">
                Thinking&hellip;
              </div>
            </div>
          )}

        </div>


        {/* ERROR */}
        {error && (
          <div className="ai-error">
            {error}
          </div>
        )}


        {/* SUGGESTIONS */}
        {messages.length === 0 && !viewingHistory && (
          <div className="ai-suggestions">

            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="ai-suggestion-chip"
                onClick={() =>
                  sendMessage(s)
                }
                disabled={
                  loading ||
                  endingChat
                }
              >
                {s}
              </button>
            ))}

          </div>
        )}


        {/* INPUT */}
        <form
          className="ai-input-row"
          onSubmit={handleSubmit}
        >

          <textarea
            value={input}
            onChange={(e) =>
              setInput(e.target.value)
            }
            onKeyDown={(e) => {

              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();
                sendMessage(input);
              }

            }}
            placeholder="Ask AI about your workspace…"
            rows={2}
            disabled={
              loading ||
              endingChat ||
              viewingHistory
            }
          />


          <button
            type="submit"
            className="btn btn-primary ai-send-btn"
            disabled={
              loading ||
              endingChat ||
              !input.trim()
            }
          >
            Send
          </button>

        </form>

      </div>

      <ConfirmDialog
        isOpen={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={confirmEndChat}
        busy={endingChat}
        title="End chat session"
        description="End this AI chat session? You can still review saved history, but this conversation can't be continued."
        confirmLabel="End session"
      />
      <AIMemoryPanel isOpen={memoryOpen} onClose={() => setMemoryOpen(false)} />

    </div>
  );
}
