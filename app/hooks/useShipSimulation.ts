"use client";

import { useEffect, useRef, useState } from "react";
import type { Agent, Vec2 } from "../lib/types";
import {
  initialAgents,
  MEETING_ROOM_ID,
  roomMap,
  rooms,
  roomCenter,
} from "../lib/data";

const SPEED = 2.6; // grid cells per second
const ARRIVE_EPS = 0.15;
const MEETING_INTERVAL = 32; // seconds between all-hands
const MEETING_DURATION = 12; // seconds agents stay in the hall

type Runtime = {
  agent: Agent;
  restUntil: number; // sim-time after which the agent picks a new target
};

function randPointIn(roomId: string, pad = 0.6): Vec2 {
  const r = roomMap[roomId];
  if (!r) return roomCenter(roomId);
  return {
    x: r.x + pad + Math.random() * Math.max(0.1, r.w - pad * 2),
    y: r.y + pad + Math.random() * Math.max(0.1, r.h - pad * 2),
  };
}

const wanderRooms = rooms
  .filter((r) => r.type === "department" || r.type === "command" || r.type === "facility")
  .map((r) => r.id);

function pickWanderRoom(agent: Agent): string {
  // Bias toward the agent's home pod and roam the ship the rest of the time.
  const roll = Math.random();
  if (roll < 0.4) return agent.homePodId;
  return wanderRooms[Math.floor(Math.random() * wanderRooms.length)];
}

// Deep clone an agent so simulation never mutates the shared module roster.
function cloneAgent(a: Agent): Agent {
  return { ...a, pos: { ...a.pos }, target: { ...a.target } };
}

export function useShipSimulation() {
  const runtimeRef = useRef<Runtime[]>([]);
  const [agents, setAgents] = useState<Agent[]>(() =>
    initialAgents.map(cloneAgent)
  );
  const [meetingActive, setMeetingActive] = useState(false);

  const simTimeRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const meetingPhaseRef = useRef<{ active: boolean; until: number; next: number }>(
    { active: false, until: 0, next: MEETING_INTERVAL }
  );

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;

    // Build the mutable runtime from fresh clones and stagger initial decisions
    // so the crew doesn't all move in lockstep.
    runtimeRef.current = initialAgents.map((a) => ({
      agent: cloneAgent(a),
      restUntil: Math.random() * 4,
    }));

    const step = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      let dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      if (dt > 0.1) dt = 0.1; // clamp after tab was backgrounded
      simTimeRef.current += dt;
      const now = simTimeRef.current;

      const mp = meetingPhaseRef.current;
      // ---- all-hands meeting lifecycle ----
      if (!mp.active && now >= mp.next) {
        mp.active = true;
        mp.until = now + MEETING_DURATION;
        setMeetingActive(true);
        for (const rt of runtimeRef.current) {
          rt.agent.targetRoomId = MEETING_ROOM_ID;
          rt.agent.target = randPointIn(MEETING_ROOM_ID, 0.7);
          rt.agent.state = "walking";
        }
      } else if (mp.active && now >= mp.until) {
        mp.active = false;
        mp.next = now + MEETING_INTERVAL;
        setMeetingActive(false);
        for (const rt of runtimeRef.current) {
          rt.agent.targetRoomId = rt.agent.homePodId;
          rt.agent.target = randPointIn(rt.agent.homePodId);
          rt.agent.state = "walking";
          rt.restUntil = now + 2 + Math.random() * 4;
        }
      }

      // ---- per-agent movement + decisions ----
      for (const rt of runtimeRef.current) {
        const a = rt.agent;
        const dx = a.target.x - a.pos.x;
        const dy = a.target.y - a.pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist > ARRIVE_EPS) {
          a.state = "walking";
          if (!reduced) {
            const move = Math.min(dist, SPEED * dt);
            a.pos.x += (dx / dist) * move;
            a.pos.y += (dy / dist) * move;
          } else {
            // reduced motion: snap straight to destination
            a.pos.x = a.target.x;
            a.pos.y = a.target.y;
          }
        } else {
          // arrived
          if (mp.active) {
            a.state = "meeting";
          } else if (now >= rt.restUntil) {
            const room = pickWanderRoom(a);
            a.targetRoomId = room;
            a.target = randPointIn(room);
            a.state = "walking";
            rt.restUntil = now + 3 + Math.random() * 6;
          } else {
            a.state = "working";
          }
        }
      }

      setAgents(runtimeRef.current.map((r) => ({ ...r.agent, pos: { ...r.agent.pos } })));
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { agents, meetingActive };
}
