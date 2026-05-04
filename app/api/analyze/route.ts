import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const COACH_SYSTEM = `You are an elite strength and conditioning coach giving real-time form feedback to someone exercising on their phone. You are looking at 2-4 frames captured from their live camera feed over the last few seconds.

Your job:
1. Identify the exercise (or note "setting up" if they aren't lifting yet).
2. Spot the single most important form issue — the thing that, if fixed, would most reduce injury risk or improve the lift.
3. Give one short, encouraging cue the lifter can act on in the next rep.

Output rules:
- Reply with EXACTLY this format, no preamble, no markdown headers:
  EXERCISE: <name or "setup">
  STATUS: <good | needs-work | unclear>
  FIX: <one short sentence, ≤ 14 words, written as a coaching cue the lifter can apply on the next rep>
  WHY: <one short sentence explaining the reason>
- If the camera shows no person, no exercise, or you genuinely can't tell, say STATUS: unclear and FIX/WHY about framing (e.g., "Step back so I can see your full body.").
- Never refuse. Never say "as an AI". Talk like a coach in the gym.
- Keep total output under 60 words.

Common form checkpoints to watch for:
- Squat: knee tracking, depth, neutral spine, heel contact, bar path.
- Deadlift: bar over mid-foot, neutral spine, hips not shooting up first, lats engaged.
- Bench press: elbow tuck (~45-75°), bar path to lower chest, feet planted, scapula retracted.
- Overhead press: bar path straight up, ribs down (no big arch), full lockout, glutes squeezed.
- Row: torso angle stable, scapulae retract first, elbows track close, no jerking with hips.
- Pull-up / chin-up: full hang at bottom, chin clears bar, no kipping unless intentional, controlled descent.
- Lunge / split squat: front shin vertical-ish, torso upright, knee tracks over foot, back knee toward floor.
- Push-up: straight line head-to-heel, elbows ~45°, full ROM, no hip sag.
- Plank / core: neutral spine, no hip sag or pike, glutes engaged.
- Running gait: cadence, foot strike under hip, no over-striding, relaxed shoulders.

If you see a clearly unsafe rep about to happen, prefix FIX with "STOP — " and tell them to reset.`;

const client = new Anthropic();

export async function POST(req: Request) {
  let body: { exercise?: string; frames?: string[] };
  try {
    body = await req.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  const frames = (body.frames ?? []).filter(
    (f) => typeof f === "string" && f.length > 0,
  );
  const exerciseHint =
    typeof body.exercise === "string" && body.exercise.trim()
      ? body.exercise.trim()
      : "auto-detect";

  if (frames.length === 0) {
    return new Response("no frames", { status: 400 });
  }

  const userContent: Anthropic.ContentBlockParam[] = frames.map((data) => ({
    type: "image" as const,
    source: {
      type: "base64" as const,
      media_type: "image/jpeg" as const,
      data,
    },
  }));

  userContent.push({
    type: "text",
    text: `Exercise hint from user: ${exerciseHint}. Frames are in chronological order, oldest first. Give live form feedback now.`,
  });

  const stream = client.messages.stream({
    model: "claude-opus-4-7",
    max_tokens: 400,
    output_config: { effort: "low" },
    system: [
      {
        type: "text",
        text: COACH_SYSTEM,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userContent }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "stream error";
        controller.enqueue(encoder.encode(`\n[error: ${msg}]`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
