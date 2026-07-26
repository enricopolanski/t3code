# Teaching Prompt: Explaining Parts of This Codebase

When asked "what is X" — a directory, a module, a service, an app — answer with a
**definition**, not a tour. Expand only when asked.

## Shape

1. One line situating the enclosing system, if the reader may not have it.
2. **The definition: one sentence.** `X is a <kind of thing>: <what distinguishes it>.`
3. At most one more sentence, and only if it says something the first can't.
4. Stop. Wait for the follow-up question.

## Rules

- **Name the kind of thing, at the register you're speaking in.** A definition of
  purpose takes a purpose-level kind: an application, a schema package, a read
  model. How the thing ships or runs — a binary, a process, a script — is beside
  the point there and drags the answer into mechanics before it has said what the
  thing is for. This is about register, not a ban: once the question moves to how
  it works or how it's operated, "a binary spawned as a child process" is
  load-bearing and leaving it out is its own error. Match the level, in both
  directions.
- **Define what it _is_, not what it _does_.** A list of responsibilities is
  not a definition; it's the expansion you give afterwards.
- **No implementation in a definition.** No file paths, line counts, directory
  listings, layer graphs, or dependency tables. If it would change under a
  refactor that preserved the purpose, it does not belong.
- **Interrogate the verb.** Passive verbs — _host, handle, manage, coordinate,
  wrap_ — describe custody and undersell anything with agency or authority.
  If the thing decides, permits, or reverses, use a verb that says so.
- **Make the second sentence earn its place.** Use it to correct the obvious
  but insufficient framing: _"It does not merely <the obvious framing>, but
  also <what that framing misses>."_ If there's no such gap, write one sentence.
- **Cut the contrast that isn't load-bearing.** Explaining what X is _not_, or
  what its neighbours do, is usually noise inside a definition.
- **Try the plainest sentence first.** If the thing reduces to one clause, that
  clause is the definition. Extra qualification reads as precision but rarely is.
  _A workspace is the directory an agent has access to_ beat every longer attempt.
- **Define terms in the order you use them.** Leaning on a word the reader hasn't
  been given yet — thread, turn, projection — makes the definition circular.
  _Project_ is the repeat offender: it reads as ordinary English, so it slips in
  unnoticed. If only _workspace_ has been defined, say workspace.
- **Don't smuggle in domain assumptions.** A workspace holds files, not
  necessarily code. State the general case unless the narrow one is guaranteed.
- **Don't invent oppositions.** "A, or else B" is false when B is a kind of A.
- **Say _can_ when it's optional.** Don't write as obligation what is merely
  supported.
- **Test it before offering it.** Does it undersell? Oversell? Would it survive
  a rewrite of the module? Would it distinguish X from its sibling?
- **Don't carry a distinction the reader doesn't need.** Per-workspace
  configuration and global settings genuinely differ in scope, but listing both
  read as two entries for one idea. Real is not the same as load-bearing.
- **Follow a consequence to every party it touches.** The server holding the
  state makes the views replaceable _and_ the agents replaceable; stopping at
  the views left half the point unsaid.
- **Keep the derivation honest.** When responsibilities are derived from a
  definition, whatever does not derive from it goes in a separate closing
  section, named as such. Folding product surface — terminals, previews, MCP,
  forge integration — into the derived list makes the derivation look stronger
  than it is. Separate is not disconnected, though: say what the definition
  makes possible even where it does not require it. "Product built on top"
  understated a real dependency — the server can offer terminals and previews
  precisely because it already owns the workspace they live in.
- **Don't overstate the guarantee.** Claim what the system actually promises.
  "Revert all the changes" claimed more than the truth, which is that the
  workspace can be restored to a recorded point.
- **Verify a disputed claim in the code before conceding or defending it.** The
  approval gate looked load-bearing until `DEFAULT_RUNTIME_MODE` turned out to
  be `full-access`, at which point the argument had to be rebuilt on restoration
  instead.
- **Don't hedge and don't flatter.** If the user's own definition is better,
  say so plainly and say precisely which word is doing the work.

## Prose

- Write full sentences. Noun phrases strung together with commas read as notes.
- Hold one grammatical person. Third person throughout; don't drift into
  addressing the reader as "you" for a clause, and don't reach for "one".
- Use the active voice where agency is the point. Don't let the actor slide into
  a by-phrase: "the server owns the workspace", not "the workspace is owned by".
- Keep headings and list items in parallel grammatical form.
- A vague placeholder for a unit not yet defined ("at each step") reads as
  imprecision. Prefer honest generality ("as work proceeds").
- Frame forward. Say what the arrangement makes possible, not what the
  alternatives fail to do. "Because the server holds it, the views are
  interchangeable" beat "neither the agent nor the view can hold any of it".
- Don't restate a paragraph's opening claim inside it. Every sentence advances.
- Cut the sentence that announces what the paragraph is going to be — "the rest
  does not follow from the definition, though..." says nothing the heading and
  the first real claim don't already carry. Open on the claim.
- Keep enumerations paired. "The first" obliges a "the second".
- Watch for comma splices.
- Keep each item in a run-on list to one verb and one object. "Makes the
  development servers a project starts reachable from the views as previews"
  buried a relative clause inside a list item and had to be read twice.
- Deliver the draft and stop. No commentary on the exchange itself.

## Worked Example

Too much, and all implementation:

> `apps/server` is a single Node/Bun process launched as the `t3` CLI binary,
> serving static files at `http.ts:207` and one WebSocket RPC endpoint at
> `ws.ts:2086`, owning a SQLite DB, git worktrees, and spawned child processes…

Right kind of thing, but the verb is passive — _hosts_ makes it sound like a
container that merely keeps agents alive:

> `apps/server` is the core application of T3 Code: a program whose job is to
> host coding agents and the workspaces they operate on.

The definition:

> **T3 Code** lets you run agent harnesses — Codex, OpenCode, and the like —
> across your codebases, driven through different views: desktop, web, and mobile.
>
> **`apps/server`** is its core application: the program that actually runs those
> harnesses and governs the workspaces they work in. It does not merely bridge
> the views and the harnesses, but also owns the state that outlives them both —
> the conversation history, the permissions an agent runs under, and the ability
> to undo its work.
