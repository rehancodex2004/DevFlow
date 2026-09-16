import { useEffect, useRef, useState } from "react";
import Button from "./ui/Button";
import ConfirmDialog from "./ui/ConfirmDialog";
import { api } from "../services/api";

function AgentMessage({ role, content }) {
  return (
    <div className={`task-agent-message task-agent-message--${role}`}>
      <span className="task-agent-message__label">
        {role === "user" ? "You" : "Agent"}
      </span>

      <div className="task-agent-message__bubble">
        {content.split("\n").map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </div>
    </div>
  );
}

/**
 * Task-scoped AI Agent.
 *
 * The user communicates only through natural-language prompts.
 * The backend Agent decides which authorized tool to use.
 */
export default function TaskAgentPanel({ taskId, onTaskDeleted }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pendingConfirmation, setPendingConfirmation] = useState(null);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, pendingConfirmation]);

  async function askAgent(message, confirmationToken = null) {
    const trimmed = message.trim();

    if (!trimmed || loading) {
      return;
    }

    setError("");

    // Add the user's normal message to the conversation.
    if (!confirmationToken) {
      setMessages((current) => [
        ...current,
        {
          role: "user",
          content: trimmed,
        },
      ]);

      setInput("");
    }

    setLoading(true);

    try {
      const response = await api.taskAgent(
        taskId,
        trimmed,
        confirmationToken,
      );

      const data = response.data || {};

      const answer =
        data.answer ||
        "The agent could not complete that request.";

      setMessages((current) => [
        ...current,
        {
          role: "agent",
          content: answer,
        },
      ]);

      /*
       * Delete requires backend confirmation.
       */
      if (
        data.requiresConfirmation &&
        data.confirmationToken
      ) {
        setPendingConfirmation({
          message: trimmed,
          token: data.confirmationToken,
          action: data.confirmationAction,
        });
      } else {
        setPendingConfirmation(null);
      }

      /*
       * Only navigate when backend confirms the task
       * was actually deleted.
       */
      if (data.deleted) {
        onTaskDeleted?.();
      }
    } catch (requestError) {
      setError(
        requestError.message ||
          "The task agent is unavailable right now.",
      );
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!input.trim()) {
      return;
    }

    askAgent(input);
  }

  /*
   * Optional convenience:
   * Enter = send
   * Shift + Enter = new line
   */
  function handleKeyDown(event) {
    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      if (
        input.trim() &&
        !loading &&
        !pendingConfirmation
      ) {
        askAgent(input);
      }
    }
  }

  return (
    <section
      className="task-agent-panel section-card"
      aria-labelledby="task-agent-title"
    >
      <header className="task-agent-panel__header">
        <div>
          <p className="eyebrow">Task agent</p>

          <h2 id="task-agent-title">
            Work with this task
          </h2>

          <p>
            Tell the agent what you want to do.
            It can inspect, create, update, or
            manage tasks using your authorized
            project context.
          </p>
        </div>

        <span
          className="task-agent-panel__mark"
          aria-hidden="true"
        >
          ✦
        </span>
      </header>

      <div
        className="task-agent-panel__messages"
        ref={scrollRef}
        aria-live="polite"
      >
        {messages.length === 0 ? (
          <div className="task-agent-panel__empty">
            <strong>What can I do?</strong>

            <p>
              Just describe what you want in normal
              language.
            </p>

            <p>
              For example:
            </p>

            <ul>
              <li>
                Create a new task called Fix Login API
                with high priority.
              </li>

              <li>
                Change this task status to done.
              </li>

              <li>
                Update the description of this task.
              </li>

              <li>
                Show me the other tasks in this project.
              </li>

              <li>
                What is the current project about?
              </li>

              <li>
                Delete this task.
              </li>
            </ul>

            <p>
              Destructive actions require confirmation.
            </p>
          </div>
        ) : (
          messages.map((message, index) => (
            <AgentMessage
              key={`${message.role}-${index}`}
              {...message}
            />
          ))
        )}

        {loading && (
          <div className="task-agent-activity">
            <span aria-hidden="true">◌</span>
            Agent is working…
          </div>
        )}
      </div>

      {error && (
        <div
          className="task-agent-panel__error"
          role="alert"
        >
          {error}
        </div>
      )}

      {pendingConfirmation && (
        <ConfirmDialog
          isOpen={Boolean(pendingConfirmation)}
          onClose={() => !loading && setPendingConfirmation(null)}
          onConfirm={() =>
            askAgent(
              pendingConfirmation.message,
              pendingConfirmation.token,
            )
          }
          title="Delete task"
          description="The agent will delete this task after you confirm. This action can't be undone."
          confirmLabel="Delete task"
          busy={loading}
        />
      )}

      <form
        className="task-agent-panel__input"
        onSubmit={handleSubmit}
      >
        <label
          className="sr-only"
          htmlFor={`task-agent-input-${taskId}`}
        >
          Ask the task agent
        </label>

        <textarea
          id={`task-agent-input-${taskId}`}
          value={input}
          onChange={(event) =>
            setInput(event.target.value)
          }
          onKeyDown={handleKeyDown}
          placeholder="Tell the agent what you want to do…"
          rows="3"
          disabled={
            loading ||
            Boolean(pendingConfirmation)
          }
        />

        <Button
          type="submit"
          disabled={
            !input.trim() ||
            Boolean(pendingConfirmation)
          }
          loading={loading}
        >
          Send
        </Button>
      </form>
    </section>
  );
}