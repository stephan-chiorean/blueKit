# Tabs Overhaul Story

I knew I wanted to overhaul my entire UX with tabs. At first, I built one global tab state across projects and the library. Clicking a tab would update the sidebar context too, so it was basically sustaining context in memory across projects. I could jump between projects just by switching tabs, and it felt seamless.

That sustained context came from a very complex context engine that an agent created for me. It was about 1000 lines long and worked like a caching layer for tabs and sidebar state.

Then I realized I did not want tab clutter across projects. It was impossible to manage. How often are people really jumping across multiple projects at once? It also made it hard to tell which tab belonged to which project.

So I changed direction. Each project should have its own context, reading from its own `workspace/tabs.json`.

The agent implemented the new architecture, but it kept the old context engine. It did not stop and ask whether the whole context engine still made sense. I did not immediately think about it either. I did not fully grasp what that engine was doing. So the new system kept a buried caching layer that was now pointless. It was still trying to decide whether tabs already existed in memory, and if so, load them from context instead of disk. That used to be the whole feature. Now it was just complexity.

That leftover complexity created race conditions and strange behavior. We would open a project and the first tab would get overwritten. The navigation could glitch. It was the kind of bug you only get from advanced logic that no longer matches the current architecture.

Then BlueKit saved the day. I had it generate documentation and a walkthrough that I actually sat down and read. Walkthroughs are for slowing down and understanding something. As I read it, I could see the caching behavior clearly, and I started interrogating the agent. That deep dive made me realize the context engine was entirely unnecessary. The agent never would have assumed that on its own, because it saw the engine and assumed it existed for a reason.

BlueKit gave me the lever to understand the system. That understanding unblocked the agent in a situation where the code was too complex for it to safely delete. The fix was not just code. The fix was clarity.
