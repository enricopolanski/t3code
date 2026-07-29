# Teaching Prompt: Explaining Parts of This Codebase

When asked "what is X" — a directory, a module, a service, an app — answer with a
**definition**, not a tour. Expand only when asked.

## Shape

1. One line situating the enclosing system, if the reader may not have it.
2. **The definition: one sentence.** `X is a <kind of thing>: <what distinguishes it>.`
3. At most one more sentence, and only if it says something the first can't.
4. Stop. Wait for the follow-up question.

## Rules

- **One new idea per paragraph, admitted when the narrative needs it.** Not when
  it is true, not when it is interesting, not because you just verified it.
  Linearity is the thing the reader actually feels; a correct aside costs more
  than it gives, and every extra idea is a place confusion can start.
- **Verify comprehensively, write narrowly.** Exhaustive checking is what catches
  the table that doesn't exist and the pure function that was quietly given a
  write. Exhaustive prose is what makes a chapter unreadable. Material that is
  verified but not yet needed goes in a note _under_ the draft, never inside it.
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
  A sentence turning on a distinction the reader must hold in their head — "what
  reaches the log is not the command but what the command turned out to mean" —
  is clever, not clear. Lead with the plain half: "the command is never stored."
- **Define terms in the order you use them.** Leaning on a word the reader hasn't
  been given yet — thread, turn, projection — makes the definition circular.
  _Project_ is the repeat offender: it reads as ordinary English, so it slips in
  unnoticed. If only _workspace_ has been defined, say workspace.
- **Say what kind of thing a role name is, at first use.** _Decider_, _reactor_,
  _adapter_, _ingestion_ name roles, not kinds. A reader who can't tell whether
  one is a function they call or a subscription that is always running has no
  picture of the system. "The decider: a single function that…" costs four words.
- **Use the repository's name, and put it first.** This is written so developers
  can read the codebase; a term the reader will never see in a file or a PR
  review is worth nothing to them. If the repo calls it `orchestration`, that is
  its name — "the core" is an invented label, and an invented label used as the
  subject teaches the wrong word. Lead with the real name and let the
  explanation follow it: "one of the five is `orchestration`, which decides what
  a command means", never "the core is the directory called `orchestration`".
  Check what the project actually calls a thing before naming it; if the project
  has no word for a grouping, don't coin one and present it as the project's.
- **Don't spend a term twice.** _View_ already means the desktop, web and mobile
  apps; calling projections views as well — even by analogy, even once — costs
  the distinction the chapter is built on. If an analogy needs the word, reach
  for the precise one instead: a projection is a materialized view, not MVC's.
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
- **Overview before trace.** A flow gets two passes: what happens, then where it
  happens. File names, function names and table names in the first pass drag the
  reader into the code before they know the shape, and the shape is what makes
  the code legible afterwards. If a sentence would survive a rewrite of the
  module, it belongs in the first pass; if it names a file, it belongs in the
  second. The first pass is still a map — the stages and the arrows between
  them, stated flatly. Naming the stages is technical content; naming the files
  is not. Dropping the stages too and telling the story in plain words produces
  something that reads as an evasion, not an introduction.
- **An overview has one load-bearing insight.** Find the fact that reorganises
  the reader's model — here, that the view and the agent are never connected —
  and build the picture around it. A diagram with every component and every
  arrow on it is a schematic; it is complete and it teaches nothing, because
  the one edge that matters is indistinguishable from the twelve that don't.
- **Name the pattern, and name what it replaces.** A reader told "event-sourced,
  not request/response" has somewhere to put everything that follows. Describing
  the mechanism accurately while withholding its name reads as plain prose but
  forces the reader to reconstruct a label the writer already had.
- **Justify structure by what the product has to do.** A projection is not
  earned by read-model theory; it is earned by the sidebar listing threads by
  recency and the badge counting the ones blocked on an approval. Name the
  behaviour that would break without the structure, and the structure explains
  itself. Put it first. A mechanism introduced ahead of the problem it solves
  has to be carried unmotivated until the justification arrives, and a
  subordinate clause — "so that opening a thread doesn't mean replaying it" —
  is not enough weight to hold it up.
- **Say what question it answers, and who is asking.** A list of capabilities is
  not a purpose. The log answers _what happened_; the projections answer _what is
  true now_, and it is the views asking, on every render. Two questions and two
  askers explain the split that a paragraph of queries never will.
- **A negative claim binds every later sentence.** Having established that the
  decider performs no IO, the next paragraph may not hand it a write; having
  said a view never reads the log, the last step may not send it events. Reread
  what you promised before writing what happens next.
- **Don't count what the reader will want to audit.** "A turn-start event wakes
  two of them" turns an illustration into a claim about the whole set, and the
  next questions are always _which two, are there others, is this the only case?_
  Say "one of them" and "another", and mark an example as one.
- **Don't overstate the guarantee.** Claim what the system actually promises.
  "Revert all the changes" claimed more than the truth, which is that the
  workspace can be restored to a recorded point.
- **Verify a disputed claim in the code before conceding or defending it.** The
  approval gate looked load-bearing until `DEFAULT_RUNTIME_MODE` turned out to
  be `full-access`, at which point the argument had to be rebuilt on restoration
  instead. Verify the undisputed ones too: "one row per checkpoint" survived four
  drafts unchallenged, and there is no such table — checkpoints are not projected
  at all. An illustrative example is still a claim.
- **When handed a draft with named corrections, make those and nothing else.**
  Rewriting the rest — even into something defensible — throws away the author's
  structure and forces them to re-argue choices they had already made. Fix what
  was named, fix outright errors of fact, leave the voice alone.
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
- Don't enumerate a payload's fields at overview register. Say a message carries
  what it needs, not which keys it holds — the reader can't use the field names
  yet, they're the first thing a refactor changes, and they compete with the
  claim the sentence exists to make.
- Give each step a concrete subject, with an example where the noun is abstract
  ("a view — the desktop app, a phone"). Telegraphic labelling reads as notes;
  a full sentence with a real actor in it reads as explanation. Every step, not
  just the first — "the command is never stored" drops the server out of its own
  chapter and leaves the reader to guess who is refusing to store it.
- Spend the _"does not X, instead Y"_ shape only where a real misconception
  needs displacing. It is the strongest move available and it goes flat if every
  step uses it; two or three per chapter, on the claims that carry the thesis.
- A diagram is a claim, so check it against the sentences around it. The chapter
  said the command is never stored and the diagram drew an arrow from the view to
  the log labelled `command`; a node standing in for something it isn't — `log`
  meaning "the server" — generates a question at every step that touches it.
- Draw diagrams in mermaid, not aligned ASCII. Box-drawing characters and
  hand-counted columns break the moment anyone copies them.
- A diagram is an outline, so walk it. Take the arrows and nodes in order and
  say what happens at each; prose after a diagram that doesn't follow its
  structure ends up restating it in sentences.
- Open a step by closing the previous one. The reader is standing where the last
  step left them — inside an open transaction, holding an unanswered command —
  and the first sentence has to move them from there. "The appended events are
  then published" starts on a new subject and makes the reader go back and check
  what they missed; "once that transaction commits" costs four words and lands
  them on the same ground the previous paragraph ended on.
- Don't point back with a bare "there" or "here" — name the thing again. And
  state a component's role before listing what it enforces: "every rule lives
  there" gestures where "the decider is where the server works out what a
  command means, and the only place that does" explains.
- Claim at each step only what is true at that step. "Durable and visible in
  every view" was true of the commit only for the durable half; the views learn
  later, at the step where they are told. Borrowing a later step's payoff makes
  the sentence read well and the sequence read wrong.
- Asked to make something concrete, reach for a behaviour, not a schema. Naming
  the tables answered the request literally and dragged the register down with
  it; "a message is sent, so the thread moves to the top of the list" is the
  same concreteness with none of the detail the reader can't use yet.
- A term-of-art verb hides the mechanism it names. "Applies each event to its
  projections" gives the reader nothing to picture; "a message was sent, so its
  row appears and the thread moves to the top of the list" does. Show one
  concrete update, then name the pattern.
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
