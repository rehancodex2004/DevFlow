import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../services/api";
import ConfirmDialog from "./ui/ConfirmDialog";

const SUGGESTIONS = [
  "Summarize this task",
  "What is blocking this?",
  "Summarize the comments",
  "Suggest next steps",
];

function SourceChip({ source }) {
  const label =
    source.label ||
    `${source.type}${source.id ? ` #${source.id}` : ""}`;

  return <span className="ai-source-chip">{label}</span>;
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
            <span className="ai-sources-label">Sources</span>

            {message.sources.map((s, i) => (
              <SourceChip key={i} source={s} />
            ))}
          </div>
        )}
    </div>
  );
}

export default function TaskAIPanel({ taskId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [error, setError] = useState("");
  const [endingChat, setEndingChat] = useState(false);
  const [viewingHistory, setViewingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState(null);
  const [confirmEndChatOpen, setConfirmEndChatOpen] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const selectedSessionId = searchParams.get("aiSession");

  const scrollRef = useRef(null);


  // ======================================================
  // LOAD CHAT HISTORY
  // ======================================================

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      try {
        let data;

        if (selectedSessionId) {
          const response = await api.chatSessionHistory(
            selectedSessionId
          );
          data = response.data || {};

          if (
            !data.session ||
            data.session.chatType !== "TASK" ||
            Number(data.session.taskId) !== Number(taskId)
          ) {
            throw new Error("This chat does not belong to this task.");
          }

          if (!cancelled) {
            setViewingHistory(data.session.status === "ENDED");
            setHistoryStatus(data.session.status || "ENDED");
          }
        } else {
          const response = await api.taskChatHistory(taskId);
          data = response.data || {};

          if (!cancelled) {
            setViewingHistory(false);
            setHistoryStatus(data.sessionStatus || null);
          }
        }

        const rows = data.messages || [];

        if (!cancelled) {
          setMessages(
            Array.isArray(rows)
              ? rows.map((row) => ({
                  id: row.id,
                  role: row.role,
                  content: row.content,
                  sources: row.sources || [],
                }))
              : []
          );
        }
      } catch (e) {
        console.error(
          "Failed to load AI chat history:",
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
  }, [taskId, selectedSessionId]);


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
      endingChat ||
      viewingHistory
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
      const response = await api.taskChat(
        taskId,
        trimmed
      );

      const data = response.data || {};

      const answer = data.answer || "";
      const sources = data.sources || [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
          sources,
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
  // END CHAT SESSION
  // ======================================================

  function handleEndChat() {
    if (viewingHistory) {
      setSearchParams({});
      return;
    }

    if (loading || endingChat) {
      return;
    }

    setConfirmEndChatOpen(true);
  }

  async function confirmEndChat() {
    setError("");
    setEndingChat(true);

    try {
      await api.taskChatEnd(taskId);

      // Clear current chat from UI.
      setMessages([]);
      setInput("");

      // Start the next conversation from a clean active session.
      setSearchParams({});
      setHistoryLoaded(true);
    } catch (e) {
      setError(
        e.message ||
          "Unable to end the chat session."
      );
    } finally {
      setEndingChat(false);
      setConfirmEndChatOpen(false);
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
  // UI
  // ======================================================

  return (
    <div className="ai-panel section-card">

      {/* HEADER */}
      <div className="ai-panel-header">

        <div>
          <p className="eyebrow">Task AI</p>
          <h3>Ask about this task</h3>
        </div>

        {/* END CHAT BUTTON */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleEndChat}
          disabled={loading || endingChat}
        >
          {viewingHistory
            ? "New Chat"
            : endingChat
              ? "Ending..."
              : "End Chat"}
        </button>

      </div>


      {viewingHistory && (
        <div className="ai-history-banner">
          Viewing saved chat history
          {historyStatus === "ENDED" ? " · Ended" : ""}
        </div>
      )}

      {/* CHAT MESSAGES */}
      <div
        className="ai-panel-body"
        ref={scrollRef}
      >

        {historyLoaded &&
          messages.length === 0 && (
            <div className="ai-empty-state">
              Ask anything about this task
              &mdash; status, blockers, comments,
              or what to do next.
              The AI only uses this task&apos;s
              own data.
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
              onClick={() => sendMessage(s)}
              disabled={loading || endingChat}
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
          placeholder="Ask AI about this task…"
          rows={2}
          disabled={loading || endingChat}
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

      <ConfirmDialog
        isOpen={confirmEndChatOpen}
        onClose={() => setConfirmEndChatOpen(false)}
        onConfirm={confirmEndChat}
        title="End chat session"
        description="This will end the current AI chat session for this task. You can start a new conversation afterward. This action can't be undone."
        confirmLabel="End session"
        busy={endingChat}
      />

    </div>
  );
}