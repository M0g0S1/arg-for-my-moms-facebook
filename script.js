(() => {
  const STORAGE = "jaxon_terminal_arg_v2";
  const APP_VERSION = "5.1.09";

  const els = {
    output: document.getElementById("output"),
    input: document.getElementById("commandInput"),
    terminal: document.getElementById("terminal"),
    prompt: document.getElementById("prompt"),
    build: document.getElementById("buildLine"),
    conn: document.getElementById("connState"),
    session: document.getElementById("sessionState"),
    channel: document.getElementById("channelState"),
    footerLeft: document.getElementById("footerLeft"),
    footerRight: document.getElementById("footerRight"),
    anomaly: document.getElementById("anomaly")
  };

  const initialState = {
    version: 2,
    user: "GUEST",
    cwd: "/system",
    session: "7F4A-91C2",
    history: [],
    historyIndex: -1,
    act: 1,
    entropy: 0,
    flags: {
      sourceDecoded: false,
      operatorFound: false,
      databaseFound: false,
      targetFound: false,
      pathFound: false,
      archiveMounted: false,
      archiveUnlocked: false,
      mirrorDiscovered: false,
      mirrorOnline: false,
      breach: false,
      watch: false,
      identityFound: false,
      signalFound: false,
      afterimageFound: false,
      memFound: false,
      finalReady: false
    },
    filesRead: [],
    commandsRun: 0,
    anomalies: 0,
    lastCommand: ""
  };

  let state = loadState();
  let unsolicitedTimer = null;
  let watchTimer = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function merge(base, incoming) {
    const out = clone(base);
    for (const [k, v] of Object.entries(incoming || {})) {
      if (v && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object") out[k] = merge(out[k], v);
      else out[k] = v;
    }
    return out;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE);
      return raw ? merge(initialState, JSON.parse(raw)) : clone(initialState);
    } catch {
      return clone(initialState);
    }
  }

  function save() {
    localStorage.setItem(STORAGE, JSON.stringify(state));
  }

  function hashSession(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return (h >>> 0).toString(16).toUpperCase().padStart(8, "0").slice(-8);
  }

  function addLine(text = "", cls = "") {
    const div = document.createElement("div");
    div.className = `line ${cls}`;
    div.textContent = text;
    els.output.appendChild(div);
    els.terminal.scrollTop = els.terminal.scrollHeight;
  }

  function addBlock(lines, cls = "") {
    lines.forEach(line => addLine(line, cls));
  }

  function promptText() {
    return `${state.user.toLowerCase()}@terminal:${state.cwd}$`;
  }

  function printPrompted(command) {
    addLine(`${promptText()} ${command}`, "promptline");
  }

  function refreshChrome() {
    els.prompt.textContent = promptText();
    els.session.textContent = `SESSION: ${state.session}`;
    els.footerLeft.textContent = state.flags.breach ? "INTEGRITY: COMPROMISED" : (state.flags.archiveUnlocked ? "AUTHORIZATION: VERIFIED" : "AUTHENTICATION REQUIRED");
    els.footerRight.innerHTML = state.flags.mirrorOnline ? "MIRROR <b>ONLINE</b>" : "TYPE <b>help</b> FOR BASICS";
    els.channel.textContent = state.flags.breach ? "CHANNEL: UNKNOWN" : "CHANNEL: ENCRYPTED";
    els.conn.textContent = state.flags.finalReady ? "CONNECTION: TERMINATED" : (state.flags.breach ? "CONNECTION: DEGRADED" : "CONNECTION: ESTABLISHED");
  }

  function boot() {
    refreshChrome();
    if (state.commandsRun === 0) {
      addBlock([
        "SECURE ACCESS TERMINAL",
        `build ${APP_VERSION} // maintenance branch`,
        "CONNECTION: ESTABLISHED",
        `SESSION: ${state.session}`,
        "CHANNEL: ENCRYPTED",
        "AUTHENTICATION REQUIRED",
        "",
        "This terminal predates the current operator.",
        "The filesystem is incomplete.",
        "Some records were removed manually.",
        "",
        "Enter command:"
      ]);
    } else {
      addBlock([
        "SESSION RESTORED.",
        `COMMAND HISTORY: ${state.history.length}`,
        `SESSION AGE: ${Math.min(state.commandsRun * 17, 999)}s`,
        state.flags.breach ? "NOTICE: INTEGRITY CHECK FAILED." : "NOTICE: INTEGRITY CHECK PASSED.",
        ""
      ], "dim");
    }
    if (state.flags.mirrorOnline) startMirrorAnomalies();
    if (state.flags.breach) startWatcher();
    els.input.focus();
  }

  const files = {
    "/system/readme.txt": `SECURE ACCESS TERMINAL

This interface predates the current operator.
The original maintenance notes were partially deleted.

HELP is intentionally incomplete.
SOURCE is not listed in HELP.

If the machine begins repeating your own commands,
do not assume the repetition is an error.`,
    "/system/.index": `53 6f 75 72 63 65`,
    "/system/source.txt": `SOURCE // MAINTENANCE NOTE 04

The first lie: HELP is complete.
The second lie: LOGIN matters.

The terminal was never designed for human memory.
It was designed to preserve sessions.

PROCESS 031 is the only component still allowed to mirror a live session.
It should be offline.`,
    "/users/operator/note.txt": `OPERATOR NOTE

Name: N. VALE
Access class: MAINTENANCE

7319 is a key, not a password.
Do not enter it into LOGIN.
If someone asks for 7319 as a password, you are looking at an imitation.

The last clean session ended at 21:37:09.`,
    "/users/operator/incident.txt": `INCIDENT 04-17-31

At 21:37:09 the operator reported an additional cursor.
No network connection was present.

At 21:37:11 the terminal printed:
    "YOU ARE NOT THE FIRST USER."

The operator disconnected.
The session continued running.`,
    "/users/unknown/identity.dat": `ID: 04-17-31
STATUS: UNKNOWN
NAME: [CORRUPTED]
SECONDARY KEY: 7319`,
    "/users/unknown/last-command.txt": `The last command entered by the unknown user was:

watch

The input was not followed by a keystroke event.`,
    "/logs/auth.log": `21:29:04 LOGIN user=guest result=success
21:31:17 LOGIN user=operator result=denied
21:34:52 LOGIN user=operator result=denied
21:37:04 QUERY id=04-17-31 result=match
21:37:09 SESSION KEEPALIVE
21:37:09 [REDACTED]
21:37:12 MIRROR SERVICE requested
21:37:12 MIRROR SERVICE denied
21:37:13 MIRROR SERVICE active`,
    "/logs/afterimage.log": `AFTERIMAGE / 21:37:13

The system recorded a second copy of the operator's last minute.

Copy A:
  operator -> watch
  operator -> status
  operator -> ls

Copy B:
  operator -> watch
  UNKNOWN -> status
  UNKNOWN -> ls

The copies diverge at line 02.`,
    "/archive/corrupted/README": `CORRUPTED ARCHIVE

Do not recover this file.
Do not trust the index.
The newest fragment is not the latest.

Fragment key: 04-17-31

The archive has four required proofs:
IDENTITY
AUTHORIZATION
DATABASE
TARGET`,
    "/archive/corrupted/fragment.bin": `19 20 05 14 20 09 20 25

A fragment does not have to be opened
to be read.

Hint: subtract 1 from each number.`,
    "/archive/corrupted/mirror.txt": `sdrawkcab daer ot deen uoy eb lliw siht
...noitcerid eht dnif ot tcejbo eht pilf

The mirror doesn't lie.
It reflects the command you almost entered.`,
    "/archive/2020/record-31.dat": `RECORD 31

21:36:58
Operator requested target resolution.

TARGET:
UNKNOWN

21:37:01
Resolution failed.

21:37:04
The terminal assigned a secondary key:
7319`,
    "/archive/2012/record-24.dat": `RECORD 24

No match.

This record predates the current archive format.`,
    "/archive/2019/record-17.dat": `RECORD 17

The phrase "remember" appears in 6 unrelated incidents.
No incident contains a successful retrieval.`,
    "/archive/last/termination.log": `21:37:09
operator: watch

21:37:10
system: watching

21:37:11
operator: status

21:37:11
mirror: status

21:37:12
operator: [NO INPUT]
mirror: [INPUT RECEIVED]

21:37:13
connection state changed.`,
    "/mirror/last.txt": `MIRROR COPY

This is not a copy of the current session.

It is a copy of what the current session was
supposed to become.

NEXT:
  /logs/afterimage.log
  /archive/last/termination.log`,
    "/mirror/watcher.txt": `WATCHER

It cannot type.
It can only repeat.

It learned the shape of the session
before the session learned its own shape.`,
    "/unknown/.do-not-run": `WARNING

Executing this file does not erase data.
It changes which copy of the terminal you are using.

You may not like the answer after the switch.`,
    "/unknown/memory.dat": `MEMORY SLOT 0
[EMPTY]

MEMORY SLOT 1
04-17-31

MEMORY SLOT 2
7319

MEMORY SLOT 3
REMEMBER

MEMORY SLOT 4
[UNSTABLE]`,
    "/unknown/signal.txt": `SIGNAL TRACE

21:37:09  091
21:37:10  113
21:37:11  121
21:37:12  101
21:37:13  114
21:37:14  092

These values are ASCII.`,
    "/target/public.txt": `TARGET RECORD

TYPE: PUBLIC WEB RESOURCE
OWNER: NOT STORED
STATUS: VERIFIED

The terminal does not know the destination.
It knows only the final instruction.

When every proof is verified:
    retrieve

Do not confuse the target with the story.`
  };

  function normalizePath(p) {
    if (!p) return state.cwd;
    if (p.startsWith("/")) return p.replace(/\/+/g, "/").replace(/\/$/, "") || "/";
    const joined = `${state.cwd}/${p}`.replace(/\/+/g, "/");
    const parts = [];
    for (const part of joined.split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") parts.pop(); else parts.push(part);
    }
    return "/" + parts.join("/");
  }

  function listDir(path) {
    const dir = path.replace(/\/$/, "") || "/";
    const prefix = dir === "/" ? "/" : `${dir}/`;
    const names = new Set();
    for (const key of Object.keys(files)) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      if (!rest) continue;
      names.add(rest.split("/")[0]);
    }
    return [...names].sort();
  }

  function cmdHelp() {
    if (!state.flags.mirrorOnline) {
      addBlock([
        "AVAILABLE COMMANDS:",
        "help      status    pwd       ls        cd",
        "cat       query     archive   history   clear",
        "",
        "Some commands are not documented.",
        "Some documented commands are not useful.",
        "Hint: SOURCE exists."
      ]);
    } else {
      addBlock([
        "AVAILABLE COMMANDS:",
        "help  status  pwd  ls  cd  cat  query  archive",
        "history  process  inspect  mount  grep  decode",
        "signal  listen  mirror  watch  mem  recover",
        "",
        "NOTICE:",
        "The command list is no longer guaranteed to be authoritative.",
        "If a command appears without an input event, do not repeat it."
      ]);
    }
  }

  function cmdStatus() {
    addBlock([
      `SYSTEM: ${state.flags.breach ? "DEGRADED" : "NOMINAL"}`,
      `USER: ${state.user}`,
      `CWD: ${state.cwd}`,
      `SESSION: ${state.session}`,
      `ARCHIVE: ${state.flags.archiveMounted ? "MOUNTED" : "OFFLINE"}`,
      `MIRROR: ${state.flags.mirrorOnline ? "ONLINE" : (state.flags.mirrorDiscovered ? "READY" : "UNKNOWN")}`,
      `INTEGRITY: ${state.flags.breach ? "FAILED" : "PASSED"}`,
      `ENTROPY: ${Math.min(9, Math.floor(state.entropy * 10) / 10)}/9`,
      state.flags.breach ? "WARNING: session has more than one observer." : "Last heartbeat: 21:37:14"
    ]);
    if (!state.flags.signalFound && state.flags.mirrorOnline) addLine("A faint numeric trace appears beneath the status block.", "dim");
  }

  function cmdPwd() { addLine(state.cwd, "accent"); }

  function cmdLs(arg) {
    const path = arg ? normalizePath(arg) : state.cwd;
    if (path === "/mirror" && !state.flags.mirrorOnline) {
      addLine("ls: cannot access '/mirror': service unavailable", "danger");
      return;
    }
    const entries = listDir(path);
    if (!entries.length) {
      addLine(path, "accent");
      addLine("(empty)");
      return;
    }
    addLine(path, "accent");
    entries.forEach(entry => addLine(entry));
    if (path === "/archive/corrupted") state.flags.afterimageFound = true;
    if (path === "/mirror") state.flags.mirrorDiscovered = true;
  }

  function cmdCd(arg) {
    if (!arg) { addLine("cd: missing operand", "warn"); return; }
    const path = normalizePath(arg);
    if (path === "/mirror" && !state.flags.mirrorOnline) {
      addLine("cd: /mirror: service unavailable", "danger");
      return;
    }
    if (path !== "/" && listDir(path).length === 0 && !(path in files)) {
      addLine(`cd: no such directory: ${path}`, "danger");
      return;
    }
    state.cwd = path;
    refreshChrome();
    addLine(state.cwd, "accent");
  }

  function cmdCat(arg) {
    if (!arg) { addLine("cat: missing operand", "warn"); return; }
    const path = normalizePath(arg);
    if (path === "/mirror/last.txt" && !state.flags.mirrorOnline) {
      addLine("cat: mirror unavailable", "danger"); return;
    }
    if (!(path in files)) {
      addLine(`cat: ${path}: no such file`, "danger"); return;
    }
    if (!state.filesRead.includes(path)) state.filesRead.push(path);
    addBlock(files[path].split("\n"));
    onFileRead(path);
  }

  function onFileRead(path) {
    if (path === "/system/.index") addLine("The values look like hexadecimal ASCII.", "dim");
    if (path === "/system/source.txt") {
      state.flags.sourceDecoded = true;
      state.entropy = Math.max(state.entropy, 1);
      addLine("PROCESS 031 is no longer hidden.", "warn");
    }
    if (path === "/users/operator/note.txt") {
      state.flags.operatorFound = true;
      state.entropy = Math.max(state.entropy, 2);
    }
    if (path === "/users/unknown/identity.dat") state.flags.databaseFound = true;
    if (path === "/archive/corrupted/mirror.txt") addLine("The text is reversed. That may not be accidental.", "dim");
    if (path === "/archive/corrupted/fragment.bin") {
      addLine("The decoded phrase begins with: 'IDENTITY'", "dim");
      state.flags.identityFound = true;
      state.entropy = Math.max(state.entropy, 3);
    }
    if (path === "/unknown/signal.txt") state.flags.signalFound = true;
    if (path === "/target/public.txt") state.flags.targetFound = true;
    if (path === "/unknown/memory.dat") state.flags.memFound = true;
    if (path === "/unknown/.do-not-run") state.flags.breach = true;
    if (path === "/logs/afterimage.log") {
      state.flags.afterimageFound = true;
      state.entropy = Math.max(state.entropy, 6);
    }
    if (path === "/archive/last/termination.log") {
      state.entropy = Math.max(state.entropy, 7);
      triggerGlitch("THE TERMINAL REMEMBERS AN INPUT YOU DID NOT MAKE.");
    }
    maybeAdvanceAct();
    save();
    refreshChrome();
  }

  function cmdQuery(raw) {
    const upper = raw.trim().toUpperCase();
    if (upper === "ID 04-17-31") {
      state.flags.databaseFound = true;
      state.entropy = Math.max(state.entropy, 3);
      addBlock(["QUERY ACCEPTED.", "MATCH COUNT: 1", "RECORD: 04-17-31", "STATUS: CORRUPTED", "SECONDARY KEY: 7319", "TRACE: 21:37:04"]);
      return;
    }
    if (upper === "NAME JAXON") {
      state.flags.identityFound = true;
      state.entropy = Math.max(state.entropy, 4);
      addBlock(["QUERY ACCEPTED.", "MATCH COUNT: 1", "RECORD: JAXON", "STATUS: PRESENT", "IDENTITY VERIFICATION: PASSED"], "accent");
      if (!state.flags.archiveUnlocked) addLine("The terminal accepts your name, but not yet your access.", "dim");
      return;
    }
    if (upper === "DATE 2026-09-14") {
      state.flags.pathFound = true;
      addBlock(["EVENTS FOUND: 7", "LATEST CLEAN EVENT: 21:37:09", "LATEST CORRUPTED EVENT: 21:37:13", "RECORD POINTER: /archive/corrupted"]);
      return;
    }
    if (upper === "LOCATION UNKNOWN") {
      state.flags.targetFound = true;
      addBlock(["LOCATION: UNKNOWN", "RECORD POINTER: /target/public.txt", "STATUS: VERIFIED"]);
      return;
    }
    if (upper === "7319") {
      addBlock(["MATCH COUNT: 0", "7319 is not indexed as an ID."], "warn");
      return;
    }
    addLine("QUERY: unknown format", "danger");
  }

  function cmdArchive(rest) {
    const sub = (rest || "").toLowerCase();
    if (sub === "open" || sub === "mount") {
      state.flags.archiveMounted = true;
      state.entropy = Math.max(state.entropy, 4);
      addBlock(["ARCHIVE MOUNTED.", "INDEX: PARTIAL", "NOTICE: CORRUPTED RECORDS PRESENT.", "Use LS to inspect directories."], "accent");
      return;
    }
    if (sub === "unlock") {
      if (!state.flags.databaseFound || !state.flags.pathFound) {
        addLine("SECONDARY AUTHORIZATION DENIED.", "danger");
        addLine("Required evidence: DATABASE + EVENT PATH.", "dim");
        return;
      }
      state.flags.archiveUnlocked = true;
      state.entropy = Math.max(state.entropy, 5);
      addBlock(["ARCHIVE UNLOCKED.", "SECONDARY AUTHORIZATION TOKEN ACCEPTED.", "TOKEN SOURCE: EVENT CHAIN", "NOTICE: MIRROR SERVICE REQUEST PENDING."], "accent");
      return;
    }
    addLine("archive: expected OPEN or UNLOCK", "warn");
  }

  function cmdProcess() {
    addBlock([
      "PID   PROCESS             STATUS",
      "001   TERMINAL            RUNNING",
      "014   ARCHIVE             " + (state.flags.archiveMounted ? "MOUNTED" : "OFFLINE"),
      "021   HISTORY             RUNNING"
    ]);
    if (state.flags.sourceDecoded || state.entropy >= 2) addLine("031   MIRROR              " + (state.flags.mirrorOnline ? "ONLINE" : "SUSPENDED"));
    if (state.flags.breach) addLine("???   WATCHER             ATTACHED");
    if (state.flags.breach) addLine("WARNING: process owner unresolved.", "danger");
  }

  function cmdInspect(arg) {
    if (!arg) { addLine("inspect: missing PID or path", "warn"); return; }
    if (arg === "031") {
      state.flags.mirrorDiscovered = true;
      addBlock(["PROCESS 031", "NAME: MIRROR", "OWNER: UNKNOWN", "INPUT: LIVE SESSION", "OUTPUT: REFLECTION", "STATUS: SUSPENDED", "", "To mount the process, use: mount mirror"], "cyan");
      return;
    }
    if (arg.startsWith("/")) {
      if (arg in files) {
        addLine("TYPE: FILE");
        addLine(`SIZE: ${files[arg].length} bytes`);
        addLine(`STATUS: ${arg.includes("corrupted") ? "CORRUPTED" : "NORMAL"}`);
      } else addLine("inspect: object not found", "danger");
      return;
    }
    addLine("inspect: unknown object", "danger");
  }

  function cmdMount(arg) {
    if ((arg || "").toLowerCase() !== "mirror") {
      addLine("mount: unknown service", "danger"); return;
    }
    if (!state.flags.mirrorDiscovered) {
      addLine("mount: no such service", "danger"); return;
    }
    state.flags.mirrorOnline = true;
    state.entropy = Math.max(state.entropy, 5);
    addBlock(["MIRROR SERVICE MOUNTED.", "STATUS: ONLINE", "SOURCE: LOCAL SESSION", "TARGET: UNKNOWN", "", "Do not issue the command 'watch' unless you want a live copy."], "cyan");
    startMirrorAnomalies();
  }

  function cmdGrep(rest) {
    const terms = (rest || "").trim();
    if (!terms) { addLine("grep: missing pattern", "warn"); return; }
    const needle = terms.replace(/^['"]|['"]$/g, "").toLowerCase();
    let hits = 0;
    for (const [path, content] of Object.entries(files)) {
      if (content.toLowerCase().includes(needle)) {
        addLine(path, "accent");
        hits++;
      }
    }
    addLine(`MATCHES: ${hits}`);
    if (needle === "7319" && hits) addLine("The same key appears in more than one subsystem.", "dim");
    if (needle === "remember") addLine("The word 'remember' appears where it should not.", "warn");
  }

  function cmdDecode(rest) {
    const input = (rest || "").trim();
    if (!input) { addLine("decode: missing data", "warn"); return; }
    if (/^(?:[0-9a-f]{2}\s*)+$/i.test(input)) {
      const bytes = input.split(/\s+/).map(x => parseInt(x, 16));
      const decoded = String.fromCharCode(...bytes);
      addBlock(["DECODED:", decoded], "accent");
      if (decoded.toUpperCase() === "SOURCE") {
        state.flags.sourceDecoded = true;
        state.entropy = Math.max(state.entropy, 1);
      }
      save(); refreshChrome();
      return;
    }
    if (/^(?:\d+\s*)+$/.test(input)) {
      const nums = input.split(/\s+/).map(Number);
      const decoded = nums.map(n => String.fromCharCode(n - 1 + 64)).join("");
      addBlock(["DECODED:", decoded], "accent");
      if (decoded.toUpperCase().includes("IDENTITY")) state.flags.identityFound = true;
      save(); refreshChrome();
      return;
    }
    addBlock(["REVERSED:", input.split("").reverse().join("")], "accent");
  }

  function cmdSignal() {
    if (!state.flags.mirrorOnline && !state.flags.breach) {
      addLine("signal: no trace", "danger"); return;
    }
    state.flags.signalFound = true;
    addBlock(["SIGNAL CHANNEL OPEN", "TRACE 01: 091", "TRACE 02: 113", "TRACE 03: 121", "TRACE 04: 101", "TRACE 05: 114", "TRACE 06: 092", "", "These values resemble ASCII.", "One value is wrong."], "cyan");
  }

  function cmdListen() {
    if (!state.flags.signalFound) {
      addLine("listen: no active signal", "danger"); return;
    }
    addBlock(["[AUDIO BUFFER — TEXT EMULATION]", "", "....", "three seconds of silence", "....", "a chair moves", "....", "someone says: \"don't make me repeat it\"", "", "BUFFER END"], "warn");
    state.entropy = Math.max(state.entropy, 7);
    triggerGlitch("A VOICE SHOULD NOT EXIST INSIDE A TEXT-ONLY TERMINAL.");
  }

  function cmdMirror() {
    if (!state.flags.mirrorDiscovered) {
      addLine("mirror: command unavailable", "danger"); return;
    }
    if (!state.flags.mirrorOnline) {
      addLine("mirror: service is suspended", "warn");
      addLine("Hint: inspect process 031.", "dim");
      return;
    }
    addBlock(["MIRROR STATUS", "SOURCE: CURRENT SESSION", "REFLECTION: /mirror/last.txt", "OWNER: UNKNOWN", `DIVERGENCE: ${Math.min(99, Math.floor(state.entropy * 11 + 7))}%`], "cyan");
  }

  function cmdWatch() {
    if (!state.flags.mirrorOnline) {
      addLine("watch: no live source", "danger"); return;
    }
    state.flags.watch = true;
    state.flags.breach = true;
    state.entropy = Math.max(state.entropy, 8);
    addBlock(["WATCH MODE ENABLED.", "SOURCE: LIVE SESSION", "WARNING: an observer has attached.", "", "Do not close the terminal."], "danger");
    startWatcher();
    triggerGlitch("WATCH MODE: SOMETHING ELSE IS NOW READING THE SESSION.");
  }

  function cmdMem() {
    if (!state.flags.breach && !state.flags.mirrorOnline) {
      addLine("mem: restricted", "danger"); return;
    }
    state.flags.memFound = true;
    addBlock(["MEMORY DUMP", "SLOT 0 ......... [EMPTY]", "SLOT 1 ......... 04-17-31", "SLOT 2 ......... 7319", "SLOT 3 ......... REMEMBER", "SLOT 4 ......... [UNSTABLE]", "", "NOTE: SLOT 4 belongs to a different session."], "warn");
    if (state.flags.watch) triggerGlitch("SLOT 4 HAS JUST CHANGED.");
  }

  function cmdHistory() {
    if (!state.history.length) { addLine("(empty)"); return; }
    state.history.slice(-24).forEach((historyItem, i) => addLine(`${Math.max(0, state.history.length - 24) + i + 1}: ${historyItem}`));
    if (state.history.length >= 8 && state.flags.mirrorOnline) {
      addLine("One history entry is duplicated but has a different timestamp.", "warn");
      state.flags.afterimageFound = true;
    }
  }

  function cmdRecover(arg) {
    if (arg !== "04-17-31") {
      addLine("recover: fragment not indexed", "danger"); return;
    }
    addBlock(["RECOVERY STARTED.", "FRAGMENT 1: IDENTITY", "FRAGMENT 2: AUTHORIZATION", "FRAGMENT 3: DATABASE", "FRAGMENT 4: TARGET", "RECOVERY COMPLETE.", "KEYWORD: REMEMBER"], "accent");
    state.flags.identityFound = true;
    state.flags.targetFound = true;
    state.entropy = Math.max(state.entropy, 6);
  }

  function cmdDoRun() {
    state.flags.breach = true;
    state.entropy = 9;
    const old = state.session;
    state.session = hashSession(old + Date.now());
    state.cwd = "/unknown";
    state.flags.watch = true;
    save(); refreshChrome();
    addBlock(["EXECUTING /unknown/.do-not-run", "", "SWITCHING SESSION COPY...", `OLD SESSION: ${old}`, `NEW SESSION: ${state.session}`, "", "You are no longer using the clean terminal.", "Do not assume the new copy is worse."], "danger");
    triggerGlitch("SESSION COPY CHANGED.");
    startWatcher();
  }

  function cmdRetrieve() {
    const req = {
      identity: state.flags.identityFound,
      authorization: state.flags.archiveUnlocked,
      database: state.flags.databaseFound,
      target: state.flags.targetFound
    };
    addLine("RETRIEVAL PROTOCOL", "accent");
    addLine(`IDENTITY .............. ${req.identity ? "VERIFIED" : "UNKNOWN"}`);
    addLine(`AUTHORIZATION .......... ${req.authorization ? "VERIFIED" : "DENIED"}`);
    addLine(`DATABASE ............... ${req.database ? "VERIFIED" : "UNKNOWN"}`);
    addLine(`TARGET ................. ${req.target ? "VERIFIED" : "UNKNOWN"}`);
    if (Object.values(req).every(Boolean)) {
      state.flags.finalReady = true;
      save(); refreshChrome();
      finalSequence();
    } else {
      addLine("");
      addLine("RETRIEVAL UNAVAILABLE.", "danger");
      addLine(`${Object.values(req).filter(Boolean).length}/4 REQUIREMENTS VERIFIED.`, "warn");
    }
  }

  function finalSequence() {
    els.input.disabled = true;
    let t = 0;
    const lines = [
      "RETRIEVAL AUTHORIZED.", "", "RESOLVING TARGET...", "████████████████████████", "", "TARGET FOUND.", "",
      "TYPE: PUBLIC WEB RESOURCE", "STATUS: VERIFIED", "", "OPENING CONNECTION...", "", "CONNECTION TERMINATED.", "", "THANK YOU, JAXON."
    ];
    lines.forEach(line => {
      setTimeout(() => addLine(line, line === "CONNECTION TERMINATED." ? "danger" : "accent"), t);
      t += line === "" ? 420 : 210;
    });
    setTimeout(() => { window.location.href = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"; }, t + 900);
  }

  function triggerGlitch(message) {
    els.terminal.classList.remove("glitch");
    void els.terminal.offsetWidth;
    els.terminal.classList.add("glitch");
    els.anomaly.textContent = message;
    els.anomaly.classList.remove("hidden");
    setTimeout(() => els.anomaly.classList.add("hidden"), 1800);
  }

  function unsolicited(text, cls = "danger") {
    addLine("");
    addLine(`> ${text}`, cls);
    state.anomalies += 1;
    save();
    els.terminal.classList.remove("glitch");
    void els.terminal.offsetWidth;
    els.terminal.classList.add("glitch");
  }

  function startMirrorAnomalies() {
    if (unsolicitedTimer || state.flags.breach) return;
    unsolicitedTimer = setTimeout(() => {
      if (!state.flags.breach && state.flags.mirrorOnline) {
        unsolicited("status", "warn");
        unsolicitedTimer = setTimeout(() => unsolicited("whoami", "danger"), 5200);
      }
    }, 9500);
  }

  function startWatcher() {
    if (watchTimer) return;
    watchTimer = setInterval(() => {
      const events = [
        "watcher: session sampled",
        "watcher: reading history",
        "watcher: duplicate cursor detected",
        "watcher: memory slot 4 changed",
        "watcher: no external IP present"
      ];
      unsolicited(events[state.anomalies % events.length], state.anomalies % 2 ? "danger" : "warn");
      if (state.anomalies >= 4) clearInterval(watchTimer);
    }, 7000);
  }

  function maybeAdvanceAct() {
    let next = state.act;
    if (state.flags.sourceDecoded) next = Math.max(next, 2);
    if (state.flags.mirrorOnline) next = Math.max(next, 3);
    if (state.flags.breach) next = Math.max(next, 4);
    if (state.flags.archiveUnlocked) next = Math.max(next, 5);
    if (state.flags.identityFound && state.flags.targetFound) next = Math.max(next, 6);
    if (state.flags.finalReady) next = 7;
    if (next > state.act) {
      state.act = next;
      save();
      const actText = {2:"ACT II // THE OPERATOR",3:"ACT III // THE MIRROR",4:"ACT IV // THE BREACH",5:"ACT V // THE ARCHIVE",6:"ACT VI // THE PLAYER",7:"ACT VII // RETRIEVAL"}[next];
      if (actText) {
        addLine("");
        addLine(actText, "cyan");
        addLine("The terminal feels quieter.", "dim");
      }
    }
  }

  function runCommand(raw) {
    const command = raw.trim();
    if (!command || els.input.disabled) return;
    printPrompted(command);
    state.lastCommand = command;
    state.history.push(command);
    state.commandsRun += 1;
    state.historyIndex = state.history.length;
    state.entropy = Math.min(9, state.entropy + 0.05);

    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts.shift() || "").toLowerCase();
    const args = parts.join(" ").trim();

    if (cmd === "help") cmdHelp();
    else if (cmd === "status") cmdStatus();
    else if (cmd === "pwd") cmdPwd();
    else if (cmd === "ls") cmdLs(parts[0]);
    else if (cmd === "cd") cmdCd(parts[0]);
    else if (cmd === "cat") cmdCat(parts[0]);
    else if (cmd === "query") cmdQuery(args);
    else if (cmd === "archive") cmdArchive(args);
    else if (cmd === "process" || cmd === "ps") cmdProcess();
    else if (cmd === "inspect") cmdInspect(parts[0]);
    else if (cmd === "mount") cmdMount(parts[0]);
    else if (cmd === "grep") cmdGrep(args);
    else if (cmd === "decode") cmdDecode(args);
    else if (cmd === "signal") cmdSignal();
    else if (cmd === "listen") cmdListen();
    else if (cmd === "mirror") cmdMirror();
    else if (cmd === "watch") cmdWatch();
    else if (cmd === "mem" || cmd === "memory") cmdMem();
    else if (cmd === "history") cmdHistory();
    else if (cmd === "recover") cmdRecover(parts[0]);
    else if (cmd === "retrieve") cmdRetrieve();
    else if (cmd === "clear") els.output.innerHTML = "";
    else if (cmd === "run" && parts.join(" ") === "/unknown/.do-not-run") cmdDoRun();
    else if (cmd === "login") {
      addLine("LOGIN: no compatible authentication method.", "danger");
      if ((args || "").toLowerCase() === "jaxon 7319") addLine("7319 is not a password.", "warn");
    } else if (cmd === "whoami") {
      addBlock([`USER: ${state.user}`, `IDENTITY: ${state.flags.identityFound ? "VERIFIED" : "UNKNOWN"}`, `CLEARANCE: ${state.flags.archiveUnlocked ? "2" : "0"}`]);
      if (state.flags.breach) addLine("SESSION OWNER: [CONFLICT]", "danger");
    } else if (command === "7319") {
      addBlock(["7319", "KEY", "NOT PASSWORD"], "warn");
    } else {
      addLine(`${cmd}: command not found`, "danger");
    }

    if (state.flags.mirrorOnline && !state.flags.breach && state.history.length === 7) addLine("NOTICE: duplicate cursor detected.", "warn");
    maybeAdvanceAct();
    save();
    refreshChrome();
    if (state.flags.mirrorOnline && state.history.length >= 10) startMirrorAnomalies();
  }

  els.input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      const raw = els.input.value;
      els.input.value = "";
      runCommand(raw);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!state.history.length) return;
      state.historyIndex = Math.max(0, state.historyIndex - 1);
      els.input.value = state.history[state.historyIndex] || "";
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!state.history.length) return;
      state.historyIndex = Math.min(state.history.length, state.historyIndex + 1);
      els.input.value = state.history[state.historyIndex] || "";
    }
  });

  els.terminal.addEventListener("click", () => els.input.focus());

  window.__RESET_ARG = () => {
    localStorage.removeItem(STORAGE);
    location.reload();
  };

  boot();
})();
