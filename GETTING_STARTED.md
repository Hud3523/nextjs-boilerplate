# 🛰️ Mission Control — Simple Start

A plain-English guide. No jargon. Follow it top to bottom.

---

## 1. Start it

On a computer, in the project folder:

```bash
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

It starts in **DRY-RUN** — that means the agents *pretend* to work so you can
learn the buttons safely. Nothing costs money and nothing is sent anywhere.

---

## 2. Get your first piece of work

1. On the main screen, click an agent on the left. Start with **Forge**.
2. A panel slides out. Find **📋 Assign Task**.
3. Type a title and what you want, for example:
   > *Draft a product listing for a bamboo cutting board, 30×20cm, oiled finish.*
4. Click **Queue task**.
5. Watch the bottom bar — the agent "writes" the draft live.
6. The draft shows up on the right under **⚡ Attention**.

---

## 3. Approve, edit, or kill it

On every draft in the **Attention** panel you have three buttons:

- **✓ Approve** — accept it.
- **Edit** — fix the wording yourself, then approve.
- **✕ Kill** — throw it away.

**This is the one rule of the whole system: agents draft, you decide.** Nothing
is ever sent to the outside world without you approving it.

---

## 4. Give it a big goal (optional)

1. Top bar → **+ DIRECTIVE**.
2. Type a goal like *"find me a digital product to sell."*
3. The system researches and puts a list of **opportunities** in the Attention
   panel.
4. **Approve** the one you like → it automatically builds a small team of agents
   to chase that goal. **Kill** the rest.

---

## 5. Turn on the real AI (when you're ready to spend)

By default it only pretends. To use the real Claude AI:

1. Get an API key from **console.anthropic.com**.
2. In the project folder, make a file called `.env` and add this line:
   ```
   ANTHROPIC_API_KEY=your-key-here
   ```
3. Stop the app (Ctrl-C) and run `npm run dev` again.
4. In the app: top bar → **CONTROL ROOM → ⚡ Arm LIVE mode**, then confirm 3
   times.

Now the agents write real drafts. You have a **spending cap** (set in the
Control Room) — if it's reached, everything stops automatically. There's also a
big red **🛑 E-STOP** button that freezes everything instantly, any time.

**Tip — save money:** in an agent's panel under **⚙️ Config** you can pick a
cheaper, faster AI model for simple jobs (Haiku) and save the best model
(Opus / Fable) for hard ones.

---

## 6. Make the agents better

The agents don't learn on their own — *you* make them better:

1. Open an agent → **🎓 Training Run**. It grades the agent (A–F).
2. If the grade is low, it suggests a better instruction — **approve it** to
   apply it, then run training again and watch the grade go up.
3. The more you approve good work, the more it remembers what you like.

**The honest test:** have Forge draft 3 real listings. If you'd publish them
with only small edits, it's saving you time — do more. If you rewrite
everything, train it first before adding more agents.

---

## 7. Use it on your phone

The phone view shows the same thing in one column with a bar of tabs at the
bottom (Deck · Fleet · Org · Inbox · Feed). The **Inbox** tab is where you
approve work on the go.

To open it on your phone, run the app on a computer on the same Wi-Fi and open
the **Network** address that `npm run dev` prints (looks like
`http://192.168.x.x:5173`).

---

## Letting agents use your computer (Pilot)

There's an agent called **Pilot** that can run things on your computer — safely:

1. Run the app **on your own computer** (not the cloud).
2. In `.env` set `ENABLE_SHELL=true`, then restart.
3. Assign Pilot a task ("list my downloads", "create a folder called drafts").
4. Pilot **proposes commands** — they show up in the Attention queue. **Nothing
   runs until you click "▶ Run on my computer"** on each one.

Safety: off by default; every command needs your approval; dry-run only shows
what *would* run; the 🛑 E-STOP blocks everything. **Never enable this on a
public server** — only on your own machine behind the login.

## What it can and can't do (be realistic)

- ✅ It does the **grunt work** — research, drafts, listings, copy, analysis.
- ✅ You stay in control and approve everything.
- ❌ It does **not** run your business by itself. Real selling/posting needs you
  to connect a real account (a developer step), and platforms block bots.

The real win is **time saved on drafting**, with you as the editor.
