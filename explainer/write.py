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
MINUTES = float(os.environ.get("EXPLAINER_MINUTES", "5"))
UA = "PulseSA-explainer/0.1 (https://github.com/217193684/pulse-sa)"
TYPES = {"hook", "title", "timeline", "stats", "suspects", "bars", "calendar", "compare", "court", "bankcheck", "verdict", "checklist", "outro"}
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


def claude(messages, system, max_tokens=16000, tools=None):
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


def run(messages, system, tools=None):
    """Calls Claude until it finishes (server-side web search can pause a long turn)."""
    usage = {"input_tokens": 0, "output_tokens": 0, "searches": 0}
    for _ in range(6):
        r = claude(messages, system, tools=tools)
        u = r.get("usage", {})
        usage["input_tokens"] += u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0)
        usage["output_tokens"] += u.get("output_tokens", 0)
        usage["searches"] += (u.get("server_tool_use") or {}).get("web_search_requests", 0)
        if r.get("stop_reason") == "pause_turn":
            messages = messages + [{"role": "assistant", "content": r["content"]}]
            continue
        text = "".join(b.get("text", "") for b in r["content"] if b.get("type") == "text")
        return text, usage
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

Pick ONE story for a {MINUTES:.0f}-minute animated explainer for ordinary South Africans: the kind of thing people argue about
without understanding WHY it happens, where we can also say what they can do about it. Prefer money, prices, jobs, transport,
electricity, water, grants, housing, health services, laws and government decisions that affect daily life.
Avoid: sport results, celebrity news, single crimes or deaths, anything that would mean showing or naming victims,
and stories with too little information to explain.

Reply with JSON only: {{"index": <number>, "question": "<the question the video answers, max 70 chars>", "why": "<one sentence>"}}"""
    text, usage = run([{"role": "user", "content": prompt}], "You are the editor of Pulse SA News, a South African news channel.")
    m = re.search(r"\{.*\}", text, re.S)
    choice = json.loads(m.group(0))
    return choice, usage


def write(question, story, today):
    """Step 2: research and write the script."""
    arts = []
    for a in story["articles"][:5]:
        arts.append(f"### {a['outlet']} — {a['title']}\nURL: {a['url']}\nPublished: {a.get('publishedAt')}\n{article_text(a['url'])}")
    example = (HERE / "episodes" / "srd-r370" / "script.json").read_text()
    words = int(MINUTES * 150)
    system = (HERE / "SCENES.md").read_text()
    prompt = f"""Today is {today:%A %d %B %Y}. Write a Pulse SA News explainer that answers: "{question}"

News articles about it:

{chr(10).join(arts)}

Research first with web search: the background (how it started, key numbers, who decided what), the main causes, what
experts, government and critics say, and practical, official things an ordinary person can do (official websites, numbers,
rights, deadlines). Prefer South African news outlets, government sites and research bodies.

Then write the script as JSON following the format in your instructions. Rules:
- About {words} words of narration in total ({MINUTES:.0f} minutes), 11-14 scenes, in the case-file shape.
- Simple, warm, clear South African English, short sentences, like explaining to a friend. No jargon without explaining it.
- Write numbers the way a narrator says them ("three hundred and seventy rand", "eight and a half million", "forty billion rand").
  Years stay as digits ("2024"). On-screen fields (values, labels, show, notes) use digits ("R370", "8.5M").
- Every fact, number and quote must come from the articles above or your search results, and be listed in "sources"
  (name: "Outlet, date: headline", url). If you are not sure of something, leave it out. Never invent quotes.
- Be fair: give government's reason and the critics' view. Say "about" for rounded numbers.
- An illustrative example (like a sample bank statement) must be said to be an example in the narration.
- The checklist must be practical and safe; only mention official websites you found.
- caseNo "PSA-{today:%Y-%m%d}", date "{today:%Y.%m.%d}", voice "af_heart".

Here is a finished script in the right format (a different topic) to show the style and level of detail:

{example}

Reply with the new script JSON only, inside <script></script> tags."""
    tools = [{"type": "web_search_20250305", "name": "web_search", "max_uses": 8, "user_location": {"type": "approximate", "country": "ZA", "timezone": "Africa/Johannesburg"}}]
    try:
        text, usage = run([{"role": "user", "content": prompt}], system, tools=tools)
    except RuntimeError as e:
        if "web_search" not in str(e) and "tool" not in str(e): raise
        print("web search not available, writing from the articles only:", e)
        text, usage = run([{"role": "user", "content": prompt}], system)
    m = re.search(r"<script>\s*(\{.*\})\s*</script>", text, re.S) or re.search(r"(\{.*\})", text, re.S)
    return json.loads(m.group(1)), usage


def check(s):
    """Problems that would break the animation or the story; empty list = fine."""
    errs = []
    for k in ("id", "title", "caseNo", "date", "scenes", "sources", "thumb"):
        if k not in s: errs.append(f"missing {k}")
    sc = s.get("scenes", [])
    if not 9 <= len(sc) <= 16: errs.append(f"{len(sc)} scenes")
    for i, x in enumerate(sc):
        if x.get("type") not in TYPES: errs.append(f"scene {i}: unknown type {x.get('type')}")
        if not x.get("lines") or not all(isinstance(l, str) and l.strip() for l in x["lines"]): errs.append(f"scene {i}: no lines")
        if x.get("type") not in ("hook", "outro") and not x.get("tag"): x["tag"] = ["PULSE SA", "EXPLAINED"]
    if sc and sc[0].get("type") != "hook": errs.append("first scene must be hook")
    if not any(x.get("type") == "checklist" for x in sc): errs.append("no checklist (what you can do)")
    n = sum(len(l.split()) for x in sc for l in x.get("lines", []))
    if n < MINUTES * 150 * 0.7: errs.append(f"only {n} words")
    if len(s.get("sources", [])) < 2: errs.append("fewer than 2 sources")
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
    for attempt in range(2):
        s, u = write(question, story, today)
        for k in total: total[k] += u[k]
        errs = check(s)
        if not errs: break
        print("script problems, trying again:", errs)
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
