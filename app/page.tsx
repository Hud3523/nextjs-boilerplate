"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const EXERCISES = [
  "auto-detect",
  "squat",
  "deadlift",
  "bench press",
  "overhead press",
  "row",
  "pull-up",
  "lunge",
  "push-up",
  "plank",
  "running",
];

type Facing = "user" | "environment";

type Coaching = {
  exercise: string;
  status: "good" | "needs-work" | "unclear" | "";
  fix: string;
  why: string;
  raw: string;
};

const EMPTY_COACHING: Coaching = {
  exercise: "",
  status: "",
  fix: "",
  why: "",
  raw: "",
};

const FRAMES_PER_BATCH = 3;
const FRAME_INTERVAL_MS = 700;
const COOLDOWN_MS = 600;
const FRAME_MAX_WIDTH = 768;
const FRAME_QUALITY = 0.7;

function parseCoaching(raw: string): Coaching {
  const get = (key: string) => {
    const re = new RegExp(`^\\s*${key}\\s*:\\s*(.*)$`, "im");
    const m = raw.match(re);
    return m ? m[1].trim() : "";
  };
  const statusRaw = get("STATUS").toLowerCase();
  let status: Coaching["status"] = "";
  if (statusRaw.startsWith("good")) status = "good";
  else if (statusRaw.startsWith("needs")) status = "needs-work";
  else if (statusRaw.startsWith("unclear")) status = "unclear";
  return {
    exercise: get("EXERCISE"),
    status,
    fix: get("FIX"),
    why: get("WHY"),
    raw,
  };
}

export default function Page() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const [facing, setFacing] = useState<Facing>("environment");
  const [exercise, setExercise] = useState<string>("auto-detect");
  const [running, setRunning] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string>("");
  const [coaching, setCoaching] = useState<Coaching>(EMPTY_COACHING);
  const [streaming, setStreaming] = useState(false);
  const [analyses, setAnalyses] = useState(0);

  const startCamera = useCallback(async (which: Facing) => {
    setError("");
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: which },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setCameraReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "camera failed";
      setError(`Camera error: ${msg}`);
      setCameraReady(false);
    }
  }, []);

  useEffect(() => {
    startCamera(facing);
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [facing, startCamera]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    const scale = Math.min(1, FRAME_MAX_WIDTH / w);
    const cw = Math.round(w * scale);
    const ch = Math.round(h * scale);
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    if (facing === "user") {
      ctx.save();
      ctx.translate(cw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, cw, ch);
      ctx.restore();
    } else {
      ctx.drawImage(video, 0, 0, cw, ch);
    }
    const dataUrl = canvas.toDataURL("image/jpeg", FRAME_QUALITY);
    const comma = dataUrl.indexOf(",");
    return comma >= 0 ? dataUrl.slice(comma + 1) : null;
  }, [facing]);

  const runAnalysisOnce = useCallback(async () => {
    const frames: string[] = [];
    for (let i = 0; i < FRAMES_PER_BATCH; i++) {
      const f = captureFrame();
      if (f) frames.push(f);
      if (i < FRAMES_PER_BATCH - 1) {
        await new Promise((r) => setTimeout(r, FRAME_INTERVAL_MS));
      }
      if (!runningRef.current) return;
    }
    if (frames.length === 0) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setStreaming(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exercise, frames }),
      });
      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "");
        setError(`Analyze failed (${res.status}): ${text || "no body"}`);
        return;
      }
      setError("");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (runningRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setCoaching(parseCoaching(acc));
      }
      acc += decoder.decode();
      setCoaching(parseCoaching(acc));
      setAnalyses((n) => n + 1);
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError") {
        const msg = err instanceof Error ? err.message : "analyze error";
        setError(`Analyze error: ${msg}`);
      }
    } finally {
      setStreaming(false);
    }
  }, [captureFrame, exercise]);

  useEffect(() => {
    runningRef.current = running;
    if (!running) {
      abortRef.current?.abort();
      return;
    }
    let cancelled = false;
    (async () => {
      while (!cancelled && runningRef.current) {
        await runAnalysisOnce();
        if (!runningRef.current) break;
        await new Promise((r) => setTimeout(r, COOLDOWN_MS));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [running, runAnalysisOnce]);

  const flip = useCallback(() => {
    setFacing((f) => (f === "user" ? "environment" : "user"));
  }, []);

  const statusColor = useMemo(() => {
    switch (coaching.status) {
      case "good":
        return "bg-emerald-500";
      case "needs-work":
        return "bg-amber-500";
      case "unclear":
        return "bg-zinc-500";
      default:
        return "bg-zinc-700";
    }
  }, [coaching.status]);

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
      />
      <canvas ref={canvasRef} className="hidden" />

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
        <select
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          className="pointer-events-auto flex-1 rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-medium backdrop-blur"
        >
          {EXERCISES.map((x) => (
            <option key={x} value={x} className="bg-black">
              {x}
            </option>
          ))}
        </select>
        <button
          onClick={flip}
          className="pointer-events-auto rounded-full border border-white/20 bg-black/60 px-4 py-2 text-sm font-medium backdrop-blur active:scale-95"
          aria-label="Flip camera"
        >
          Flip · {facing === "user" ? "Front" : "Back"}
        </button>
      </div>

      <div className="absolute left-4 right-4 top-20 z-10 space-y-2">
        {error && (
          <div className="rounded-xl border border-red-400/40 bg-red-950/70 px-3 py-2 text-sm text-red-100 backdrop-blur">
            {error}
          </div>
        )}
        {!cameraReady && !error && (
          <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2 text-sm backdrop-blur">
            Allow camera access to start.
          </div>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-3 px-4 pt-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        {(coaching.fix || coaching.exercise || streaming) && (
          <div className="rounded-2xl border border-white/15 bg-black/70 p-4 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/70">
              <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
              <span>
                {coaching.exercise || (streaming ? "looking…" : "waiting")}
              </span>
              {streaming && (
                <span className="ml-auto text-white/50">live</span>
              )}
            </div>
            <div className="mt-2 text-lg font-semibold leading-snug">
              {coaching.fix ||
                (streaming ? "Analyzing your form…" : "Press start.")}
            </div>
            {coaching.why && (
              <div className="mt-1 text-sm text-white/70">{coaching.why}</div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((r) => !r)}
            disabled={!cameraReady}
            className={`flex-1 rounded-full px-6 py-4 text-base font-semibold transition active:scale-[0.98] disabled:opacity-50 ${
              running
                ? "bg-red-500 text-white"
                : "bg-white text-black"
            }`}
          >
            {running ? "Stop coaching" : "Start coaching"}
          </button>
          <div className="rounded-full border border-white/15 bg-black/60 px-3 py-2 text-xs text-white/70 backdrop-blur">
            {analyses} {analyses === 1 ? "rep-check" : "rep-checks"}
          </div>
        </div>
      </div>
    </div>
  );
}
