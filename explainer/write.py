"""
Writes today's explainer script with Claude.

  python explainer/write.py            -> prints the new episode id; writes explainer/episodes/<id>/script.json
  TOPIC="..." python explainer/write.py  (explain this instead of picking from the news)

1. Gets the day's biggest stories from the Pulse SA server.
2. Claude picks the one people most need explained (skipping topics done in the last 30 days).
3. Reads the news articles about it, researches with web search, and writes a ~5 minute case-file script
   that follows explainer/SCENES.md. Every fact must come from a source it lists.
"""
import datetime as dt, html, json, os, re, sys, time, urllib.error, urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
API = os.environ.get("API_URL", "https://pulse-sa.vercel.app").rstrip("/")
MODEL = os.environ.get("EXPLAINER_MODEL", "claude-sonnet-5-5")
_m = os.environ.get("EXPLAINER_MINUTES", "auto").strip().lower()
# "auto": as long as the story needs (usually 6-10 minutes); a number fixes the length
MIN_MIN, MAX_MIN = (5.0, 12.0) if _m in ("", "auto") else (float(_m) * 0.85, float(_m) * 1.15)
MINUTES = (MIN_MIN + MAX_MIN) / 2
UA = "PulseSA-explainer/0.1 (https://github.com/217193684/pulse-sa)"
TYPES = {"hook", "title", "timeline", "stats", "suspects", "bars", "calendar", "compare", "court", "bankcheck", "verdict", "checklist", "outro",
         "scenario", "voices", "moneytrail", "howto"}
SAST = dt.timezone(dt.timedelta(hours=2))


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"user-agent": UA, "accept-language": "en-ZA,en"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def article_text(url, limit=9000):
    """The readable text of a news article (best effort)."""
    try:
        raw = get(url)
    except Exception as e:
        return f"(could not open: {e})"
    try:
        import trafilatura
        t = trafilatura.extract(raw, include_comments=False, include_tables=False) or ""
    except Exception:
        t = ""
    if not t:
        t = re.sub(r"(?is)<(script|style|nav|header|footer|aside)[^>]*>.*?</\1>", " ", raw)
        t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"\s+", " ", t).strip()[:limit]


def claude(messages, system, max_tokens=24000, tools=None):
    body = {"model": MODEL, "max_tokens": max_tokens, "system": system, "messages": messages}
    if tools: body["tools"] = tools
    for attempt in range(4):
        req = urllib.request.Request("https://api.anthropic.com/v1/messages", data=json.dumps(body).encode(), method="POST",
                                     headers={"x-api-key": os.environ["ANTHROPIC_API_KEY"], "anthropic-version": "2023-06-01", "content-type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=600) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")[:600]
            if e.code in (429, 500, 529) and attempt < 3:
                time.sleep(20 * (attempt + 1)); continue
            raise RuntimeError(f"Claude API {e.code}: {msg}")


def run(messages, system, tools=None, max_tokens=24000):
    """Calls Claude until it finishes (server-side web search can pause a long turn). Returns all its text."""
    usage = {"input_tokens": 0, "output_tokens": 0, "searches": 0}
    texts = []
    for _ in range(8):
        r = claude(messages, system, max_tokens=max_tokens, tools=tools)
        u = r.get("usage", {})
        usage["input_tokens"] += u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0)
        usage["output_tokens"] += u.get("output_tokens", 0)
        usage["searches"] += (u.get("server_tool_use") or {}).get("web_search_requests", 0)
        texts.append("".join(b.get("text", "") for b in r["content"] if b.get("type") == "text"))
        if r.get("stop_reason") == "pause_turn":
            messages = messages + [{"role": "assistant", "content": r["content"]}]
            continue
        if r.get("stop_reason") == "max_tokens":
            kinds = {}
            for b in r["content"]: kinds[b.get("type")] = kinds.get(b.get("type"), 0) + len(json.dumps(b))
            print(f"  (Claude ran out of room in this reply; output {u.get('output_tokens')} tokens; content sizes by type {kinds})")
        return "\n".join(texts), usage
    raise RuntimeError("Claude kept pausing")


def recent_topics(days=30):
    out = []
    for p in sorted((HERE / "episodes").glob("*/script.json")):
        try:
            s = json.loads(p.read_text())
            out.append(s.get("title", ""))
        except Exception:
            pass
    return out[-days:]


def pick(stories, done):
    """Step 1: choose the story (cheap call, headlines only)."""
    lines = []
    for i, s in enumerate(stories):
        heads = " | ".join(a["title"] for a in s["articles"][:3])
        lines.append(f"{i}. [{s['category']}, {len(s['publishers'])} outlets: {', '.join(s['publishers'][:5])}] {heads}")
    prompt = f"""These are today's biggest South African news stories (most-covered first):

{chr(10).join(lines)}

Explainers we already made recently (don't repeat these topics):
{chr(10).join('- ' + t for t in done) or '- none'}

Pick ONE story for an animated explainer for ordinary South Africans: the kind of thing people argue about
without understanding WHY it happens, where we can also say what they can do about it. Prefer money, prices, jobs, transport,
electricity, water, grants, housing, health services, laws and government decisions that affect daily life.
Avoid: sport results, celebrity news, single crimes or deaths, anything that would mean showing or naming victims,
and stories with too little information to explain.

Reply with JSON only: {{"index": <number>, "question": "<the question the video answers, max 70 chars>", "why": "<one sentence>"}}"""
    text, usage = run([{"role": "user", "content": prompt}], "You are the editor of Pulse SA News, a South African news channel.")
    m = re.search(r"\{.*\}", text, re.S)
    choice = json.loads(m.group(0))
    return choice, usage


def research(question, story, today):
    """Step 2a: read the articles and search the web; returns research notes (plain text with sources)."""
    arts = []
    for a in story["articles"][:5]:
        arts.append(f"### {a['outlet']} — {a['title']}\nURL: {a['url']}\nPublished: {a.get('publishedAt')}\n{article_text(a['url'])}")
    prompt = f"""Today is {today:%A %d %B %Y}. We are making a Pulse SA News explainer video that answers: "{question}"

News articles about it:

{chr(10).join(arts) or '(none: research it from scratch)'}

Research it with web search and write RESEARCH NOTES (not the script). Prefer South African news outlets, government sites,
the Auditor-General, SIU, Parliament (PMG) and research bodies. Cover:
1. The background in plain words: how it started, who decides what, key numbers and dates.
2. The main causes (2-4), with evidence for each.
3. Money: what was promised or budgeted, by whom and when, and what was actually spent or delivered. Note any gap or
   contradiction, and what official findings (Auditor-General, SIU, courts, Parliament) say about it, if any.
4. What people are saying: real quotes from residents, officials, experts and critics in the articles (who said it, where).
5. What an ordinary person can do: how to check the problem themselves, how and where to report it (official numbers and
   websites only), their rights, and what a street or community can do together.
6. Everyday comparisons that make the big numbers understandable.

Write each fact as a bullet with its source in brackets: (Outlet, date, URL). Mark anything uncertain as UNCERTAIN.
End with a SOURCES list: one line per source, "Outlet, date: headline | URL"."""
    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 10, "user_location": {"type": "approximate", "country": "ZA", "timezone": "Africa/Johannesburg"}}]
    try:
        notes, usage = run([{"role": "user", "content": prompt}], "You are a careful South African news researcher.", tools=tools, max_tokens=12000)
    except RuntimeError as e:
        if "web_search" not in str(e) and "tool" not in str(e): raise
        print("web search not available, using the articles only:", e)
        notes, usage = run([{"role": "user", "content": prompt}], "You are a careful South African news researcher.", max_tokens=12000)
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "research-notes.txt").write_text(notes)
    return notes, usage


def write(question, story, today):
    """Step 2: research, then write the script from the notes (no tools, so the reply is clean JSON)."""
    notes, usage = research(question, story, today)
    print(f"  research notes: {len(notes.split())} words, {usage['searches']} searches")
    example = json.dumps(json.loads((HERE / "episodes" / "srd-r370" / "script.json").read_text()), ensure_ascii=False, separators=(",", ":"))
    system = (HERE / "SCENES.md").read_text()
    prompt = f"""Today is {today:%A %d %B %Y}. Write a Pulse SA News explainer that answers: "{question}"

Use ONLY these research notes for facts, numbers, quotes and sources:

{notes}

WHO WE ARE TALKING TO: South Africans who may not have finished school. Someone who never studied economics or law must
understand every sentence the first time they hear it. If they can't, the video has failed.

Then write the script as JSON following the format in your instructions. Rules:
- Length: as long as the story needs to be explained simply, between {MIN_MIN:.0f} and {MAX_MIN:.0f} minutes
  (about {int(MIN_MIN * 140)}-{int(MAX_MIN * 140)} words of narration). Never squeeze: if a point needs a story or an example
  to be clear, take the time. 12-20 scenes, in the case-file shape.
- Very simple, warm South African English, like talking to a neighbour. Short sentences (mostly under 15 words). Everyday
  words. Explain every big number with a comparison people know ("that's enough to pay ... ", "that's like every taxi in
  Soweto ..."). No jargon; if a word like "municipality" or "budget" is needed, say what it means the first time.
- Use scenarios: invent everyday people (e.g. "Gogo Nomsa in Soweto", "Thabo, a taxi driver in Durban") to show how the
  problem hits real life and how a fix would help. Always say clearly they are examples.
- Be the viewer's voice: say out loud what people are thinking and asking ("Many people are asking: where did the money
  go?"). Include a voices scene with real quotes from the articles, or common questions labelled as such.
- Look for gaps and contradictions: money promised vs work done, targets vs results, what officials said vs what happened.
  If there is a gap, show it (moneytrail) and ask the question plainly ("So where did the other R150 million go?"). Then go
  through the possible explanations people raise (corruption, budget cut, costs went up, delays, bad planning) and say
  honestly what the evidence shows for each: proven / being investigated / not proven / not explained. NEVER say a person
  or body is corrupt unless a court, the Auditor-General, SIU or a similar official finding says so; say it is a question
  that needs an answer, and who must answer it. If a budget was cut, say whether it was announced.
- Give solutions people can act on: what an individual can do today, how to check things themselves (e.g. how to tell if
  a pipe leaks or is old), how to report it, and what a street or community can do together. Practical and safe; only
  official contact details you actually found.
- End by asking viewers a simple question to answer in the comments (in the outro), so people talk about it.
- Write numbers the way a narrator says them ("three hundred and seventy rand", "eight and a half million", "forty billion rand").
  Years stay as digits ("2024"). On-screen fields (values, labels, show, notes) use digits ("R370", "8.5M").
- Every fact, number and quote must come from the articles above or your search results, and be listed in "sources"
  (name: "Outlet, date: headline", url). If you are not sure of something, leave it out. Never invent quotes.
- Be fair: give government's reason and the critics' view. Say "about" for rounded numbers.
- "hashtags": 4-5 hashtags people really search for this topic (issue, place, body involved), CamelCase, no spaces.
- caseNo "PSA-{today:%Y-%m%d}", date "{today:%Y.%m.%d}", voice "af_heart".

Here is a finished script in the right format (a different topic) to show the style and level of detail:

{example}

Reply with the new script JSON only (compact, no indentation), inside <script></script> tags. Make sure it is complete: every scene has lines, and
it ends with "sources"."""
    text, u = run([{"role": "user", "content": prompt}], system, max_tokens=24000)
    for k in usage: usage[k] += u[k]
    return parse(text, usage), usage


def fix(s, errs, usage):
    """Asks Claude to repair specific problems in a script it wrote (cheap: no research)."""
    text, u = run([{"role": "user", "content": "Fix these problems in this explainer script and return the whole corrected JSON inside "
                   f"<script></script> tags. Problems: {errs}\n\n<script>{json.dumps(s, ensure_ascii=False)}</script>"}],
                  (HERE / "SCENES.md").read_text(), max_tokens=24000)
    for k in usage: usage[k] += u[k]
    return parse(text, usage)


def parse(text, usage):
    """The script JSON from Claude's reply; if it isn't valid JSON, Claude fixes it (no research needed)."""
    (HERE / "out").mkdir(exist_ok=True)
    (HERE / "out" / "last-reply.txt").write_text(text)
    m = re.search(r"<script>\s*(\{.*\})\s*</script>", text, re.S) or re.search(r"(\{.*\})", text, re.S)
    raw = m.group(1) if m else text
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"reply wasn't valid JSON ({e}); asking for a fixed copy")
        fixed, u = run([{"role": "user", "content": f"This JSON has an error ({e}). Return the same content as valid JSON only, "
                                                       f"inside <script></script> tags, changing nothing else:\n\n{raw}"}],
                       "You fix JSON syntax. Escape quotes inside strings with \\\" or use single quotes inside text.")
        for k in usage: usage[k] += u[k]
        m = re.search(r"<script>\s*(\{.*\})\s*</script>", fixed, re.S) or re.search(r"(\{.*\})", fixed, re.S)
        return json.loads(m.group(1))


def check(s):
    """Problems that would break the animation or the story; empty list = fine."""
    errs = []
    for k in ("id", "title", "caseNo", "date", "scenes", "sources", "thumb"):
        if k not in s: errs.append(f"missing {k}")
    sc = s.get("scenes", [])
    if not 10 <= len(sc) <= 22: errs.append(f"{len(sc)} scenes")
    for i, x in enumerate(sc):
        if x.get("type") not in TYPES: errs.append(f"scene {i}: unknown type {x.get('type')}")
        if not x.get("lines") or not all(isinstance(l, str) and l.strip() for l in x["lines"]): errs.append(f"scene {i}: no lines")
        if x.get("type") not in ("hook", "outro") and not x.get("tag"): x["tag"] = ["PULSE SA", "EXPLAINED"]
    if sc and sc[0].get("type") != "hook": errs.append("first scene must be hook")
    if not any(x.get("type") == "checklist" for x in sc): errs.append("no checklist (what you can do)")
    n = sum(len(l.split()) for x in sc for l in x.get("lines", []))
    if n < MIN_MIN * 140 * 0.8: errs.append(f"only {n} words")
    if n > MAX_MIN * 140 * 1.2: errs.append(f"{n} words is too long")
    if len(s.get("sources", [])) < 2: errs.append("fewer than 2 sources")
    if not isinstance(s.get("hashtags"), list): s["hashtags"] = []
    return errs


def main():
    today = dt.datetime.now(SAST)
    done = recent_topics()
    total = {"input_tokens": 0, "output_tokens": 0, "searches": 0}
    topic = os.environ.get("TOPIC", "").strip()
    if topic:
        question, story = topic, {"articles": []}
    else:
        stories = json.loads(get(f"{API}/api/explainer/candidates?hours=36"))["stories"]
        if not stories: sys.exit("no stories today")
        choice, u = pick(stories, done)
        for k in total: total[k] += u[k]
        story, question = stories[int(choice["index"])], choice["question"]
        print(f"picked: {question}  ({choice.get('why', '')})")
    errs = ["not written"]
    for attempt in range(2):
        try:
            s, u = write(question, story, today)
        except Exception as e:
            print("writing failed, trying again:", e); continue
        for k in total: total[k] += u[k]
        errs = check(s)
        for _ in range(2):
            if not errs: break
            print("script problems, asking for a fix:", errs)
            try:
                s = fix(s, errs, total)
                errs = check(s)
            except Exception as e:
                print("fix failed:", e)
        if not errs: break
    if errs: sys.exit(f"script still has problems: {errs}")
    slug = re.sub(r"[^a-z0-9]+", "-", s.get("id", "explainer").lower()).strip("-")[:40] or "explainer"
    ep_id = f"{today:%Y-%m-%d}-{slug}"
    s["id"] = ep_id
    s["usage"] = total
    ep = HERE / "episodes" / ep_id
    ep.mkdir(parents=True, exist_ok=True)
    (ep / "script.json").write_text(json.dumps(s, indent=2, ensure_ascii=False))
    words = sum(len(l.split()) for x in s["scenes"] for l in x["lines"])
    print(f"wrote {ep_id}: {len(s['scenes'])} scenes, {words} words, tokens in {total['input_tokens']} out {total['output_tokens']}, searches {total['searches']}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as f: f.write(f"id={ep_id}\n")


if __name__ == "__main__":
    main()
