# Tabs Overhaul: How BlueKit Saved the Day

I knew I wanted to overhaul the entire UX with tabs. My first design was one global tab state across projects and the library. Clicking a tab updated the sidebar context too, so I could bounce between projects without losing state. It felt seamless.

That only worked because of a heavy context engine an agent had built for me. It was about 1000 lines of caching logic that kept tab state alive across contexts.

Then I realized the cost: tab clutter across projects is impossible to manage. It was hard to tell which tab belonged to which project, and cross-project tabs were not a real daily workflow. So I changed the architecture. Each project should have its own isolated context, loaded from its own `.bluekit/workspace/tabs.json`.

The agent implemented the new direction, but it kept the old engine. That was the problem. It did not ask, "Does this caching model still make sense?" And I did not immediately question it either. The code still had logic like:

- A `restoreContext` flag passed around everywhere
- Branching in `openInNewTab` that tried to decide whether to restore or create
- A `contextExists` check and a double read (read to decide, then read again in `switchContext`)

That logic was correct for the original global-cache idea, but it was wrong for the new disk-first model. The file was supposed to be the authority. Instead, we were still trying to make decisions in memory, which is exactly the complexity I wanted to kill.

The result was subtle but nasty: race conditions and weird navigation glitches. Opening a project could overwrite the first tab because the system was fighting itself, trying to reconcile stale context with disk state. It was the kind of bug you only get when old architecture is hiding inside a new one.

Then BlueKit saved the day. I had it generate a walkthrough and I actually read it. Walkthroughs slow you down and force you to understand. That doc made the old model obvious:

- "Check if context exists -> decide restore or create"
- Instead of: "Switch context -> disk tells me what tabs exist"

Once I saw it, I could interrogate the agent with clarity. The fix was no longer mysterious. We removed the `restoreContext` flag, simplified `openInNewTab`, and let `switchContext` do one job: read from disk and load the tabs. The complexity was not needed anymore, and BlueKit gave me the leverage to prove it.

The lesson was not just about tabs. It was about how understanding unblocks the agent in complex scenarios. The agent assumed the old engine was there for a reason. BlueKit helped me see that it was only there because we had not looked closely enough.
