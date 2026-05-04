"use client";

import { useEffect, useRef } from "react";

interface Props {
  running: boolean;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  onToggleSidebar: () => void;
}

export default function InputBar({
  running,
  value,
  onChange,
  onSend,
  onStop,
  onToggleSidebar,
}: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }, [value]);

  return (
    <div className="input-wrap">
      <div className="input-bar">
        <button
          type="button"
          className="input-icon-btn lg-hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (value.trim() && !running) onSend();
            }
          }}
          placeholder="Send the office a goal…"
          className="input-textarea"
          disabled={running}
        />
        {running ? (
          <button type="button" className="send-btn stop" onClick={onStop} aria-label="Stop">
            ◼
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={onSend}
            disabled={!value.trim()}
            aria-label="Send"
          >
            ➤
          </button>
        )}
      </div>
      <p className="input-hint">
        Enter to send · Shift+Enter for new line · running in mock mode
      </p>
    </div>
  );
}
