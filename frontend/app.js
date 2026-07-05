const {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback
} = React;

// ── Phosphor Icons (CSS font via CDN, loaded in index.html) ──────────────────
// No JS dependency — icons are `<i>` elements styled by the ph-bold font.
// `_icon` maps Tailwind w-* size classes → font-size and strips layout classes
// that don't apply to inline elements, keeping only color / other utilities.
const _icon = phName => ({
  className = '',
  size,
  style,
  ...rest
}) => {
  const sz = size ?? (className.includes('w-6') ? 24 : className.includes('w-3') ? 14 : className.includes('w-4') ? 16 : 20);
  // drop layout-only classes that don't apply to <i> (w-*, h-*, flex-none, etc.)
  const colorCls = className.split(' ').filter(c => !c.startsWith('w-') && !c.startsWith('h-') && c !== 'flex-none').join(' ').trim();
  return React.createElement('i', {
    className: `ph-bold ph-${phName}${colorCls ? ' ' + colorCls : ''}`,
    style: {
      fontSize: sz,
      lineHeight: 1,
      display: 'inline-block',
      ...style
    },
    ...rest
  });
};
const Icons = {
  ArrowLeft: _icon('arrow-left'),
  Activity: _icon('activity'),
  Network: _icon('share-network'),
  Database: _icon('database'),
  FileText: _icon('file-text'),
  ListBullet: _icon('list-bullets'),
  Check: _icon('check'),
  AlertTriangle: _icon('warning'),
  Info: _icon('info'),
  Flask: _icon('flask'),
  Layers: _icon('stack'),
  Search: _icon('magnifying-glass'),
  Cpu: _icon('cpu'),
  UserCheck: _icon('user-check')
};

// ---------- provenance + confidence vocabulary (docs/kg-pareto-provenance-design.md §5) ----------
const PROV = {
  retrieved: {
    icon: "🗄️",
    label: "retrieved — public API"
  },
  computed: {
    icon: "🔧",
    label: "computed — ClawBio skill"
  },
  web: {
    icon: "🌐",
    label: "agent web / literature"
  },
  primekg: {
    icon: "🧬",
    label: "PrimeKG — curated relation"
  },
  gap: {
    icon: "⚪",
    label: "gap — not available"
  }
};
// map cso.py provenance icons (🧪 demo, 🔧 clawbio, 🌐 web, ⚪ absent) to a prov key
const ICON_TO_PROV = {
  "🧪": "computed",
  "🔧": "computed",
  "🗄️": "retrieved",
  "🌐": "web",
  "⚪": "gap"
};
const provOf = icon => ICON_TO_PROV[icon] || "computed";
const gradeStyle = g => ({
  strong: "text-emerald-700 border-emerald-300 bg-emerald-50",
  illustrative: "text-sky-700 border-sky-300 bg-sky-50",
  supported: "text-sky-700 border-sky-300 bg-sky-50",
  suggestive: "text-amber-700 border-amber-300 bg-amber-50",
  supporting: "text-amber-700 border-amber-300 bg-amber-50",
  absent: "text-slate-600 border-slate-300 bg-slate-50",
  insufficient: "text-slate-600 border-slate-300 bg-slate-50"
})[g] || "text-slate-600 border-slate-300 bg-slate-50";
const DECISION = {
  GO: {
    c: "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-100",
    ring: "ring-emerald-100/40",
    glow: "shadow-emerald-100/25",
    accent: "emerald"
  },
  CONDITIONAL_GO: {
    c: "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-100",
    ring: "ring-amber-100/40",
    glow: "shadow-amber-100/25",
    accent: "amber"
  },
  REVIEW: {
    c: "bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-md shadow-sky-100",
    ring: "ring-cyan-100/40",
    glow: "shadow-cyan-100/25",
    accent: "top"
  },
  NO_GO: {
    c: "bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-100",
    ring: "ring-rose-100/40",
    glow: "shadow-rose-100/25",
    accent: "rose"
  },
  PENDING: {
    c: "bg-slate-100 text-slate-700 border border-slate-200",
    ring: "ring-slate-200/40",
    glow: "shadow-sm",
    accent: "top"
  }
};
const EXAMPLES = ["Assess B7-H3 potential as a therapeutic target in lung cancer", "Evaluate MET as a target in lung adenocarcinoma", "Is CEACAM5 a viable ADC target in NSCLC?"];

// ======================================================================================
//  Live run state — reduced from the SSE event stream
// ======================================================================================
const emptyRun = () => ({
  status: "idle",
  // idle | running | done | error
  meta: null,
  // {query, backend, model, calls_llm, mode, run_id, entities}
  steps: [],
  // ordered loop steps (each: {id, role, kind, division, title, status, ...})
  evidence: {},
  // step id -> normalized evidence event
  gnodes: {},
  // canonical graph nodes streamed from the server, by id
  gedges: {},
  // canonical graph edges streamed from the server, by id
  briefing: null,
  review: null,
  synthesis: null,
  report_md: null,
  decision: "PENDING",
  decisionSource: null,
  // "prometheux" | "agent"
  decisionEngine: null,
  // {tier, score, max_score, axes, explanation, facts}
  agentDecision: null,
  // the synthesis agent's proposed tier (for divergence)
  diverges: false,
  // engine tier != agent tier
  engineGaps: [],
  // Prometheux structural gaps (the non-silenceable voice)
  engineForced: false,
  // a structural gap forced the re-route
  panel: null,
  // latest 4-lens reviewer-panel vote {lenses, reroute_votes, n_lenses}
  divisionFindings: {},
  // division name -> division_finding event
  confidence: "n/a",
  checkpoint: null,
  // HITL: {run_id, iteration, verdict, panel, gaps, proposed_reroute} while awaiting a human
  error: null
});
function reduceEvent(run, ev, data) {
  const r = {
    ...run,
    steps: [...run.steps],
    evidence: {
      ...run.evidence
    },
    gnodes: {
      ...run.gnodes
    },
    gedges: {
      ...run.gedges
    }
  };
  switch (ev) {
    case "start":
      return {
        ...emptyRun(),
        status: "running",
        meta: data
      };
    case "node":
      r.gnodes[data.id] = data;
      return r;
    case "edge":
      r.gedges[data.id] = data;
      return r;
    case "phase":
      {
        // mark any previously-running step complete, then append this one as running
        r.steps = r.steps.map(s => s.status === "running" ? {
          ...s,
          status: "done"
        } : s);
        r.steps.push({
          ...data
        });
        return r;
      }
    case "briefing":
      r.briefing = data.briefing;
      return r;
    case "evidence":
      {
        r.evidence[data.step] = data;
        r.steps = r.steps.map(s => s.id === data.step ? {
          ...s,
          status: "done",
          evidence: data
        } : s);
        return r;
      }
    case "engine_gaps":
      r.engineGaps = data.gaps || [];
      r.engineForced = !!data.forced;
      return r;
    case "panel":
      r.panel = data;
      return r;
    case "division_finding":
      r.divisionFindings = {
        ...(run.divisionFindings || {}),
        [data.division]: data
      };
      return r;
    case "review":
      r.review = data.review;
      r.steps = r.steps.map(s => s.id === "review" ? {
        ...s,
        status: "done",
        review: data.review
      } : s);
      return r;
    case "checkpoint_wait":
      // HITL: the review loop is paused awaiting a human decision on this pass.
      r.checkpoint = data;
      return r;
    case "checkpoint_resolved":
      // the decision was delivered (by this human or by timeout) — clear the pause.
      r.checkpoint = null;
      return r;
    case "synthesis":
      r.synthesis = data.synthesis;
      return r;
    case "decision":
      r.decision = data.decision || "REVIEW";
      r.decisionSource = data.decision_source || null;
      r.decisionEngine = data.engine || null;
      r.agentDecision = data.agent_decision || null;
      r.diverges = !!data.diverges;
      r.confidence = data.confidence || r.confidence;
      return r;
    case "done":
      r.steps = r.steps.map(s => s.status === "running" ? {
        ...s,
        status: "done"
      } : s);
      r.report_md = data.report_md;
      r.decision = data.decision || r.decision || "REVIEW";
      r.decisionSource = data.decision_source || r.decisionSource;
      r.confidence = data.confidence || "n/a";
      r.status = "done";
      return r;
    case "error":
      r.status = "error";
      r.error = data.message;
      return r;
    default:
      return r;
  }
}

// ======================================================================================
//  Incremental evidence graph — built from whatever evidence has arrived so far
// ======================================================================================
const norm = (v, max) => Math.max(0, Math.min(1, (Number(v) || 0) / max));

// size hint per node kind (the server sends canonical entities; we only size them for layout)
const KIND_VAL = {
  Target: 0.95,
  Disease: 0.8,
  Modality: 0.55,
  CellType: 0.55,
  Tissue: 0.5,
  Trial: 0.5
};
function nodeVal(n) {
  return KIND_VAL[n.kind] ?? 0.5;
}

// the graph is now the CANONICAL property graph streamed from the server (kg.py).
// Nodes are deduped entities (target:CD276, celltype:fibroblast, source:cellxgene…);
// `shared_runs` marks an entity that also appears in OTHER hypotheses (cross-run link).
function graphFromRun(run) {
  const nodes = Object.values(run.gnodes).map(n => ({
    ...n,
    val: nodeVal(n),
    shared: (n.shared_runs || []).length > 0,
    sub: n.sub || subForNode(n)
  }));
  // only keep edges whose endpoints exist yet (deltas may arrive slightly out of order)
  const ids = new Set(nodes.map(n => n.id));
  const edges = Object.values(run.gedges).filter(e => ids.has(e.s) && ids.has(e.t));
  return {
    nodes,
    edges
  };
}
function subForNode(n) {
  return n.kind;
}
const srcUrl = ref => {
  const m = (ref || "").match(/https?:\/\/[^\s)]+/);
  return m ? m[0] : null;
};

// biomedical entity kinds only — nodes are entities, edges are the evidence
const NODE_STYLE = {
  Target: {
    fill: "#8b5cf6",
    stroke: "#c4b5fd"
  },
  Disease: {
    fill: "#0ea5e9",
    stroke: "#7dd3fc"
  },
  Modality: {
    fill: "#64748b",
    stroke: "#94a3b8"
  },
  CellType: {
    fill: "#d97706",
    stroke: "#fcd34d"
  },
  Tissue: {
    fill: "#be123c",
    stroke: "#fda4af"
  },
  Trial: {
    fill: "#0d9488",
    stroke: "#5eead4"
  },
  Drug: {
    fill: "#7c3aed",
    stroke: "#c4b5fd"
  },
  Pathway: {
    fill: "#ca8a04",
    stroke: "#fde68a"
  }
};
const PROV_EDGE = {
  retrieved: "#0284c7",
  computed: "#059669",
  web: "#7c3aed",
  primekg: "#d97706",
  gap: "#64748b"
};

// radial layout centred on the Target (the biological hub); entities ring outward
const layout = (g, W, H) => {
  const cx = W / 2,
    cy = H / 2,
    pos = {};
  const hub = g.nodes.find(n => n.kind === "Target") || g.nodes.find(n => n.kind === "Disease");
  if (hub) pos[hub.id] = {
    x: cx,
    y: cy
  };
  const byKind = (...ks) => g.nodes.filter(n => ks.includes(n.kind) && n !== hub).map(n => n.id);
  const ring = (ids, r, a0) => ids.forEach((id, i) => {
    const a = a0 + i / Math.max(1, ids.length) * Math.PI * 2;
    pos[id] = {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a)
    };
  });
  ring(byKind("Disease", "Modality"), Math.min(W, H) * 0.16, -Math.PI / 2);
  ring(byKind("CellType", "Tissue"), Math.min(W, H) * 0.34, -Math.PI / 2 + 0.4);
  ring(byKind("Trial", "Drug", "Pathway"), Math.min(W, H) * 0.46, Math.PI / 2);
  // any stragglers without a position
  g.nodes.forEach((n, i) => {
    if (!pos[n.id]) pos[n.id] = {
      x: cx + 0.4 * W * Math.cos(i),
      y: cy + 0.4 * H * Math.sin(i)
    };
  });
  return pos;
};
function EvidenceGraphSVG({
  g,
  selNode,
  selEdge,
  onNode,
  onEdge,
  complete
}) {
  const W = 720,
    H = 520;
  const pos = useMemo(() => layout(g, W, H), [g]);
  const focus = selNode;
  const isDim = id => focus && id !== focus && !g.edges.some(e => e.s === focus && e.t === id || e.t === focus && e.s === id);
  return /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    className: "w-full h-auto select-none",
    style: {
      maxHeight: "560px"
    }
  }, g.edges.map((e, i) => {
    const a = pos[e.s],
      b = pos[e.t];
    if (!a || !b) return null;
    const sel = selEdge === i;
    const dim = focus && e.s !== focus && e.t !== focus;
    const col = PROV_EDGE[e.prov] || "#64748b";
    const op = (e.conf >= 0.8 ? 0.85 : e.conf >= 0.5 ? 0.55 : 0.3) * (dim ? 0.15 : 1);
    return /*#__PURE__*/React.createElement("g", {
      key: "e" + i,
      className: "cursor-pointer fade-up",
      onClick: x => {
        x.stopPropagation();
        onEdge(i);
      }
    }, /*#__PURE__*/React.createElement("line", {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: "transparent",
      strokeWidth: "14"
    }), /*#__PURE__*/React.createElement("line", {
      x1: a.x,
      y1: a.y,
      x2: b.x,
      y2: b.y,
      stroke: col,
      strokeWidth: sel ? 3.5 : 1.6,
      strokeOpacity: sel ? 1 : op,
      strokeDasharray: e.prov === "primekg" ? "2 3" : e.conf < 0.2 ? "4 3" : "none"
    }), sel && /*#__PURE__*/React.createElement("text", {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2 - 4,
      fill: "#0f172a",
      fontSize: "9",
      textAnchor: "middle",
      className: "mono"
    }, e.type));
  }), g.nodes.map(n => {
    const p = pos[n.id];
    if (!p) return null;
    const st = NODE_STYLE[n.kind] || NODE_STYLE.Target;
    const r = 9 + (n.val || 0.4) * 16;
    const sel = selNode === n.id,
      dim = isDim(n.id);
    return /*#__PURE__*/React.createElement("g", {
      key: n.id,
      className: "cursor-pointer fade-up",
      opacity: dim ? 0.28 : 1,
      onClick: x => {
        x.stopPropagation();
        onNode(n.id);
      }
    }, n.shared && /*#__PURE__*/React.createElement("circle", {
      cx: p.x,
      cy: p.y,
      r: r + 4,
      fill: "none",
      stroke: "#fbbf24",
      strokeWidth: 1.5,
      strokeDasharray: "3 2",
      opacity: 0.9
    }), /*#__PURE__*/React.createElement("circle", {
      cx: p.x,
      cy: p.y,
      r: r,
      fill: st.fill,
      stroke: sel ? "#0f172a" : st.stroke,
      strokeWidth: sel ? 3 : 1.5
    }), /*#__PURE__*/React.createElement("text", {
      x: p.x,
      y: p.y + r + 11,
      fill: sel ? "#0f172a" : "#475569",
      fontSize: "10",
      textAnchor: "middle",
      style: {
        pointerEvents: "none"
      }
    }, n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label));
  }));
}
function GraphInspector({
  g,
  selNode,
  selEdge,
  stepsById
}) {
  if (selEdge != null && g.edges[selEdge]) {
    const e = g.edges[selEdge],
      p = PROV[e.prov] || PROV.computed;
    const sn = g.nodes.find(n => n.id === e.s),
      tn = g.nodes.find(n => n.id === e.t);
    const conf = e.conf != null ? e.conf : null;
    return /*#__PURE__*/React.createElement("div", {
      className: "space-y-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] uppercase tracking-widest text-sky-800"
    }, "Evidence · the edge IS the claim"), /*#__PURE__*/React.createElement("div", {
      className: "mono text-xs text-slate-800"
    }, sn?.label, " ", /*#__PURE__*/React.createElement("span", {
      className: "text-sky-600"
    }, "—", e.type, "→"), " ", tn?.label), e.value && /*#__PURE__*/React.createElement("div", {
      className: "text-base font-semibold text-slate-900"
    }, e.value), /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2 flex-wrap"
    }, e.axis && /*#__PURE__*/React.createElement(Chip, {
      cls: "border-sky-200 text-sky-700 bg-sky-50"
    }, e.axis), e.grade && /*#__PURE__*/React.createElement(Chip, {
      cls: gradeStyle(e.grade)
    }, e.grade), /*#__PURE__*/React.createElement(Chip, {
      cls: "border-slate-200 text-slate-700 bg-slate-100"
    }, p.icon, " ", p.label.split(" — ")[0]), conf != null && /*#__PURE__*/React.createElement(Chip, {
      cls: gradeStyle(conf >= 0.8 ? "strong" : conf >= 0.5 ? "supported" : "suggestive")
    }, "confidence ", conf.toFixed(2))), /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-800 leading-relaxed"
    }, e.ref || "—"), /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500"
    }, "source: ", e.url ? /*#__PURE__*/React.createElement("a", {
      href: e.url,
      target: "_blank",
      rel: "noreferrer",
      className: "text-sky-600 hover:text-sky-800 underline mono"
    }, e.source || e.url, " ↗") : /*#__PURE__*/React.createElement("span", {
      className: "mono text-slate-700"
    }, e.source || "—")), e.step && stepsById[e.step] && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 border-t border-slate-200 pt-2"
    }, "↳ from loop step ", /*#__PURE__*/React.createElement("span", {
      className: "mono text-slate-700"
    }, stepsById[e.step].role), " — ", stepsById[e.step].title));
  }
  if (selNode) {
    const n = g.nodes.find(x => x.id === selNode);
    if (!n) return null;
    const st = NODE_STYLE[n.kind];
    const inc = g.edges.filter(e => e.s === n.id || e.t === n.id);
    const step = n.step && stepsById[n.step];
    return /*#__PURE__*/React.createElement("div", {
      className: "space-y-3"
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex items-center gap-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "w-3 h-3 rounded-full",
      style: {
        background: st.fill
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "text-[11px] uppercase tracking-widest text-slate-600"
    }, n.kind)), /*#__PURE__*/React.createElement("div", {
      className: "text-base font-semibold text-slate-900"
    }, n.label), n.sub && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500"
    }, n.sub), n.shared && /*#__PURE__*/React.createElement("div", {
      className: "rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
    }, "🔗 shared entity — also appears in ", n.shared_runs.length, " other hypothesis", n.shared_runs.length > 1 ? "es" : "", /*#__PURE__*/React.createElement("div", {
      className: "mono text-amber-700 mt-1"
    }, n.shared_runs.join(", "))), n.val != null && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
    }, "normalized value"), /*#__PURE__*/React.createElement("div", {
      className: "h-2 rounded-full bg-slate-200 overflow-hidden"
    }, /*#__PURE__*/React.createElement("div", {
      className: "h-full",
      style: {
        width: `${n.val * 100}%`,
        background: st.fill
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono text-xs text-slate-600 mt-1"
    }, n.val.toFixed(2))), n.url && /*#__PURE__*/React.createElement("a", {
      href: n.url,
      target: "_blank",
      rel: "noreferrer",
      className: "inline-block text-xs text-sky-600 hover:text-sky-800 underline mono"
    }, n.url, " ↗"), /*#__PURE__*/React.createElement("div", {
      className: "border-t border-slate-200 pt-2"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] uppercase tracking-wide text-slate-500 mb-1"
    }, inc.length, " connection", inc.length !== 1 ? "s" : ""), /*#__PURE__*/React.createElement("ul", {
      className: "space-y-1"
    }, inc.map((e, i) => {
      const o = e.s === n.id ? e.t : e.s;
      const on = g.nodes.find(x => x.id === o);
      return /*#__PURE__*/React.createElement("li", {
        key: i,
        className: "text-xs text-slate-700 mono"
      }, e.type, " · ", on?.label);
    }))), step && /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-500 border-t border-slate-200 pt-2"
    }, "↳ traces to ", /*#__PURE__*/React.createElement("span", {
      className: "mono text-slate-700"
    }, step.role), " — ", step.title));
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "Click a ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, "node"), " for its normalized properties, or an ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, "edge"), " to open its reference & source.");
}

// The accumulated-evidence ledger: an auditable trail of every evidence item
// the graph has ever ingested, joined to its source (with a working link) and
// confidence — read from /api/ledger, which spans ALL runs, not just this one.
function LedgerView({
  run
}) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    fetch("/api/ledger").then(r => r.json()).then(setData).catch(e => setErr(String(e)));
  }, []);
  // refetch on mount and whenever this run finishes (new evidence just landed)
  useEffect(() => {
    load();
  }, [load, run.status === "done"]);
  if (err) return /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-rose-700"
  }, "Could not load the ledger: ", err);
  if (!data) return /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "Loading accumulated evidence…");
  const rows = data.rows || [];
  const byHyp = {};
  rows.forEach(r => {
    (byHyp[r.subject] ||= []).push(r);
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement(Stat, {
    n: data.n_evidence,
    l: "evidence items"
  }), /*#__PURE__*/React.createElement(Stat, {
    n: data.n_runs,
    l: "runs"
  }), /*#__PURE__*/React.createElement(Stat, {
    n: (data.sources || []).length,
    l: "sources",
    small: true
  })), /*#__PURE__*/React.createElement("button", {
    onClick: load,
    className: "px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50"
  }, "↻ refresh")), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, "Accumulated across ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-700 font-semibold"
  }, "every"), " query, persisted in ", /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, "kg.json"), ". Each row traces to its source."), (data.sources || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "rounded-xl border border-slate-200 bg-slate-50 p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-wide text-slate-500 mb-2"
  }, "sources on record"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-2"
  }, data.sources.map((s, i) => s.url ? /*#__PURE__*/React.createElement("a", {
    key: i,
    href: s.url,
    target: "_blank",
    rel: "noreferrer",
    className: "text-xs text-sky-600 hover:text-sky-800 underline mono px-2 py-1 rounded border border-slate-200 bg-white"
  }, s.label, " ↗") : /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "text-xs text-slate-500 mono px-2 py-1 rounded border border-slate-200 bg-white"
  }, s.label)))), Object.entries(byHyp).map(([hyp, items]) => /*#__PURE__*/React.createElement("div", {
    key: hyp,
    className: "rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden"
  }, /*#__PURE__*/React.createElement("div", {
    className: "px-4 py-2 bg-slate-100 border-b border-slate-200 text-sm font-semibold text-slate-900 mono"
  }, hyp || "—"), /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-slate-500 text-left"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, "evidence (relation → entity)"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "value"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "axis"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "grade"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "conf"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "source"))), /*#__PURE__*/React.createElement("tbody", null, items.map((r, i) => {
    const p = PROV[r.prov] || PROV.computed;
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      className: "border-t border-slate-200 align-top"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2 text-slate-800"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sky-600 mono"
    }, r.relation), " → ", /*#__PURE__*/React.createElement("span", {
      className: "text-slate-900 font-medium"
    }, r.object), /*#__PURE__*/React.createElement("span", {
      className: "ml-1 text-[10px] text-slate-500"
    }, r.object_kind)), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2 text-slate-700"
    }, r.value || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2 text-slate-500"
    }, r.axis || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2"
    }, /*#__PURE__*/React.createElement(Chip, {
      cls: gradeStyle(r.grade)
    }, r.grade || "—")), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2 mono text-slate-700"
    }, r.conf != null ? Number(r.conf).toFixed(2) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mr-1"
    }, p.icon), r.url ? /*#__PURE__*/React.createElement("a", {
      href: r.url,
      target: "_blank",
      rel: "noreferrer",
      className: "text-sky-600 hover:text-sky-800 underline"
    }, r.source, " ↗") : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-700"
    }, r.source), r.observations > 1 && /*#__PURE__*/React.createElement("span", {
      className: "ml-1 text-slate-500"
    }, "×", r.observations)));
  }))))), rows.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "No evidence accumulated yet — run a query."));
}
function GraphView({
  run
}) {
  const g = useMemo(() => graphFromRun(run), [run]);
  const stepsById = useMemo(() => Object.fromEntries(run.steps.map(s => [s.id, s])), [run.steps]);
  const [selNode, setSelNode] = useState(null);
  const [selEdge, setSelEdge] = useState(null);
  const complete = run.status === "done";
  const kinds = [...new Set(g.nodes.map(n => n.kind))];
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 text-xs text-slate-600 flex-wrap"
  }, kinds.map(k => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-2.5 rounded-full",
    style: {
      background: (NODE_STYLE[k] || NODE_STYLE.Target).fill
    }
  }), k)), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-2.5 h-2.5 rounded-full border border-dashed border-amber-500"
  }), "shared across runs"), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-300"
  }, "·"), Object.entries(PROV_EDGE).map(([k, c]) => /*#__PURE__*/React.createElement("span", {
    key: k,
    className: "flex items-center gap-1"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-4 h-0.5",
    style: {
      background: c
    }
  }), k))), /*#__PURE__*/React.createElement(Chip, {
    cls: complete ? "border-emerald-200 text-emerald-700 bg-emerald-50" : "border-sky-200 text-sky-700 bg-sky-50"
  }, complete ? `graph complete · ${g.nodes.length} nodes` : `building… ${g.nodes.length} nodes`)), /*#__PURE__*/React.createElement("div", {
    className: "grid lg:grid-cols-[1fr_300px] gap-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-2",
    onClick: () => {
      setSelNode(null);
      setSelEdge(null);
    }
  }, /*#__PURE__*/React.createElement(EvidenceGraphSVG, {
    g: g,
    selNode: selNode,
    selEdge: selEdge,
    complete: complete,
    onNode: id => {
      setSelNode(id === selNode ? null : id);
      setSelEdge(null);
    },
    onEdge: i => {
      setSelEdge(i === selEdge ? null : i);
      setSelNode(null);
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4 self-start"
  }, /*#__PURE__*/React.createElement(GraphInspector, {
    g: g,
    selNode: selNode,
    selEdge: selEdge,
    stepsById: stepsById
  }))), !complete && /*#__PURE__*/React.createElement("p", {
    className: "text-xs text-slate-500"
  }, "The graph grows as each division returns evidence; it's complete when the report is constructed."));
}

// ======================================================================================
//  Loop trace (live)
// ======================================================================================
function Chip({
  children,
  cls = ""
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: `inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`
  }, children);
}
function LoopStep({
  step,
  idx,
  last,
  active,
  onClick,
  engineGaps,
  engineForced,
  panel
}) {
  const ev = step.evidence;
  const running = step.status === "running";
  const kindCls = step.kind === "agent" ? "border-violet-200 bg-violet-50/50" : "border-slate-200 bg-white shadow-sm";
  const res = ev?.result || {};
  const metrics = res.tau != null ? {
    "τ (tau)": res.tau,
    "bimodality": res.bimodality_coefficient
  } : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap-4 fade-up"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col items-center"
  }, /*#__PURE__*/React.createElement("div", {
    className: `w-9 h-9 rounded-full grid place-items-center text-sm font-bold border-2 transition
          ${running ? "border-sky-500 bg-sky-50 text-sky-700 pulse-ring" : step.terminal ? "border-emerald-500 bg-emerald-50 text-emerald-700" : step.reroute ? "border-amber-500 bg-amber-50 text-amber-700" : "border-slate-300 bg-slate-100 text-slate-600"}`
  }, running ? "•" : step.terminal ? "✓" : idx + 1), !last && /*#__PURE__*/React.createElement("div", {
    className: `w-0.5 flex-1 my-1 ${step.reroute ? "bg-amber-500/40" : "bg-slate-200"}`,
    style: {
      minHeight: "1rem"
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: `relative overflow-hidden flex-1 mb-3 rounded-xl border p-4 transition bio-panel ${kindCls} ${running ? "ring-1 ring-cyan-500/40" : ""} ${active ? "ring-1 ring-cyan-500/60" : ""} ${ev ? "cursor-pointer hover:border-cyan-400" : ""}`,
    onClick: ev ? onClick : undefined
  }, running && /*#__PURE__*/React.createElement("div", {
    className: "absolute inset-x-0 top-0 h-[3px] bio-shimmer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center justify-between gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Chip, {
    cls: step.kind === "agent" ? "border-violet-200 text-violet-700 bg-violet-50" : "border-slate-200 text-slate-700 bg-slate-100"
  }, step.kind === "agent" ? "AGENT" : "SKILL"), /*#__PURE__*/React.createElement("span", {
    className: "mono text-xs text-slate-500"
  }, step.role)), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2"
  }, running && /*#__PURE__*/React.createElement("span", {
    className: "text-xs text-sky-600"
  }, "running…"), ev && /*#__PURE__*/React.createElement(Chip, {
    cls: "border-slate-200 text-slate-700 bg-slate-50"
  }, ev.provenance), ev && /*#__PURE__*/React.createElement(Chip, {
    cls: gradeStyle(ev.grade)
  }, ev.grade), step.review && /*#__PURE__*/React.createElement(Chip, {
    cls: gradeStyle(step.review.verdict === "re-route" ? "suggestive" : "supported")
  }, step.review.verdict))), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-sm font-semibold text-slate-900"
  }, step.title), /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-500"
  }, step.division), metrics && /*#__PURE__*/React.createElement("div", {
    className: "flex gap-4 mt-2"
  }, Object.entries(metrics).map(([k, v]) => v != null && /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-200"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono text-lg font-bold text-emerald-700"
  }, v), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-wide text-slate-500"
  }, k)))), ev && /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-sm text-slate-800 leading-relaxed"
  }, res.summary || ev.digest), step.review && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-sm text-slate-700"
  }, /*#__PURE__*/React.createElement("div", null, "relevance ", step.review.scores?.relevance, "/5 · evidence ", step.review.scores?.evidence, "/5 · thoroughness ", step.review.scores?.thoroughness, "/5"), (step.review.gaps || []).map((gp, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "text-xs text-amber-700 mt-1"
  }, "↳ gap: ", gp.missing, " → re-route to ", gp.route_to))), step.id === "review" && engineGaps && engineGaps.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 rounded-lg border border-fuchsia-200 bg-fuchsia-50/50 p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded-md font-bold bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200"
  }, "◆ PROMETHEUX"), /*#__PURE__*/React.createElement("span", {
    className: "text-fuchsia-800"
  }, "deductive gap-detector · ", engineForced ? "forced re-route" : "advisory")), engineGaps.map((g, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "mt-2 text-xs text-fuchsia-900"
  }, g.forces_reroute ? "⛔" : "○", " ", g.explanation, " ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, "→ ", g.route_to))), /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-[10px] text-slate-500"
  }, "A proven missing axis is a fact, not a judgement — so the engine re-routes even if the LLM panel said synthesize.")), step.id === "review" && panel && panel.lenses && panel.lenses.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-3.5 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-[0.18em] text-slate-600 mb-2.5"
  }, "4-lens reviewer panel"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5"
  }, panel.lenses.map((l, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: `px-2.5 py-1 rounded-lg text-xs font-medium border shadow-sm ${l.verdict === "re-route" ? "text-rose-700 border-rose-200 bg-rose-50" : "text-emerald-700 border-emerald-200 bg-emerald-50"}`
  }, l.key, " ", l.verdict === "re-route" ? "✗ re-route" : "✓"))), panel.n_lenses != null && /*#__PURE__*/React.createElement("div", {
    className: "mt-2 text-xs text-slate-500"
  }, panel.reroute_votes, "/", panel.n_lenses, " lenses flag re-route")), active && ev && res.top_cell_types && /*#__PURE__*/React.createElement("table", {
    className: "mt-3 w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-slate-500 text-left"
  }, /*#__PURE__*/React.createElement("th", {
    className: "py-1"
  }, "cell type"), /*#__PURE__*/React.createElement("th", null, "mean expr"), /*#__PURE__*/React.createElement("th", null, "% expr"))), /*#__PURE__*/React.createElement("tbody", null, res.top_cell_types.map((r, i) => /*#__PURE__*/React.createElement("tr", {
    key: i,
    className: "border-t border-slate-100"
  }, /*#__PURE__*/React.createElement("td", {
    className: "py-1 text-slate-700"
  }, r.cell_type), /*#__PURE__*/React.createElement("td", {
    className: "mono text-slate-600"
  }, r.mean_expr), /*#__PURE__*/React.createElement("td", {
    className: "mono text-slate-600"
  }, (r.pct_expressing * 100).toFixed(0), "%"))))), active && ev && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 text-xs text-slate-500"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, "reference: "), ev.reference)));
}

// ======================================================================================
//  Loop graph (live) — the execution rendered as a horizontal process flow, in the
//  same visual language as the static system schematic (frontend/site/schematic.html),
//  but built dynamically from run.steps as they stream in. Nodes light up by status.
// ======================================================================================

// Status → node colour. Mirrors the timeline's node states so the two views agree.
const GSTATE = {
  running: {
    stroke: "#0284c7",
    glow: "#0284c7",
    fill: "#f0f9ff"
  },
  reroute: {
    stroke: "#d97706",
    glow: "#d97706",
    fill: "#fffbeb"
  },
  terminal: {
    stroke: "#059669",
    glow: "#059669",
    fill: "#ecfdf5"
  },
  done: {
    stroke: "#64748b",
    glow: "#e2e8f0",
    fill: "#ffffff"
  },
  pending: {
    stroke: "#cbd5e1",
    glow: "#e2e8f0",
    fill: "#f8fafc"
  }
};
function gstate(step) {
  if (!step) return GSTATE.pending;
  if (step.status === "running") return GSTATE.running;
  if (step.terminal) return GSTATE.terminal;
  if (step.reroute) return GSTATE.reroute;
  if (step.status === "done") return GSTATE.done;
  return GSTATE.pending;
}

// Classify each streamed step into a schematic column. Division steps fan out in the
// middle; the reviewer, synthesis and re-route steps get their own lanes.
// routing keys → short, human labels for the division pills
const DIV_LABEL = {
  target_id_and_prioritization: "Target ID",
  target_safety: "Target Safety",
  modality_and_tractability: "Modality & Tractability",
  clinical_officers: "Clinical",
  literature_and_landscape: "Literature"
};
const prettyDiv = (d = "") => DIV_LABEL[d.replace(" (re-route)", "")] || d.replace(/_/g, " ").replace(" (re-route)", "");
function stageOf(step) {
  const id = step.id || "";
  if (id === "brief" || id === "briefing" || step.role === "Chief of Staff") return "brief";
  if (id === "plan" || id === "planner") return "plan";
  if (id === "review") return "review";
  if (id === "synthesize" || id === "synthesis" || id === "report") return "synth";
  if (step.reroute) return "reroute";
  return "division";
}

// Build the flow model: ordered columns, each holding the steps that landed in it,
// plus whether the re-route loop ever fired (so we draw the feedback arc live).
function flowFromRun(run) {
  const cols = {
    brief: [],
    plan: [],
    division: [],
    reroute: [],
    review: [],
    synth: []
  };
  run.steps.forEach((s, i) => {
    (cols[stageOf(s)] || cols.division).push({
      ...s,
      _i: i
    });
  });
  const rerouted = cols.reroute.length > 0;
  return {
    cols,
    rerouted
  };
}
function FlowNode({
  x,
  y,
  w,
  h,
  step,
  label,
  sub,
  active,
  onClick
}) {
  const st = gstate(step);
  const clickable = step && step.evidence;
  return /*#__PURE__*/React.createElement("g", {
    onClick: clickable ? onClick : undefined,
    style: {
      cursor: clickable ? "pointer" : "default"
    }
  }, step && step.status === "running" && /*#__PURE__*/React.createElement("rect", {
    x: x - 3,
    y: y - 3,
    width: w + 6,
    height: h + 6,
    rx: 13,
    fill: "none",
    stroke: st.glow,
    strokeWidth: "1.2",
    opacity: "0.5",
    className: "pulse-ring"
  }), /*#__PURE__*/React.createElement("rect", {
    x: x,
    y: y,
    width: w,
    height: h,
    rx: 11,
    fill: st.fill,
    stroke: st.stroke,
    strokeWidth: active ? 2 : 1.3,
    opacity: step ? 1 : 0.45
  }), active && /*#__PURE__*/React.createElement("rect", {
    x: x,
    y: y,
    width: w,
    height: h,
    rx: 11,
    fill: "none",
    stroke: "#0284c7",
    strokeWidth: "1.5",
    opacity: "0.7"
  }), /*#__PURE__*/React.createElement("text", {
    x: x + w / 2,
    y: y + h / 2 - 2,
    textAnchor: "middle",
    fontSize: "11",
    fontFamily: "'Space Grotesk',sans-serif",
    fontWeight: "600",
    fill: step ? "#0f172a" : "#64748b"
  }, label), sub && /*#__PURE__*/React.createElement("text", {
    x: x + w / 2,
    y: y + h / 2 + 13,
    textAnchor: "middle",
    fontSize: "8",
    fontFamily: "'JetBrains Mono',monospace",
    fill: "#64748b"
  }, sub));
}
function LoopGraph({
  run,
  active,
  setActive
}) {
  const {
    cols,
    rerouted
  } = useMemo(() => flowFromRun(run), [run]);

  // Responsive SVG: scales to container width.
  // viewBox is wide enough that all nodes fit with generous margins.
  // Columns are spaced to fit within ~1080px (1280px viewport - 180px sidebar - 24px padding each side).
  // The viewBox W has 90px right padding so the out node + its text never clip.
  const W = 1180,
    H = 440;

  // Column x-anchors
  const X = {
    input: 20,
    cso: 168,
    div: 360,
    review: 710,
    synth: 870,
    out: 1006
  };
  const flow = (d, key, color = "#475569", dash) => /*#__PURE__*/React.createElement("path", {
    key: key,
    d: d,
    fill: "none",
    stroke: color,
    strokeWidth: "1.5",
    strokeDasharray: dash,
    markerEnd: `url(#${color === GSTATE.reroute.stroke ? "flowArrLoop" : "flowArr"})`
  });
  const divs = cols.division.concat(cols.reroute);
  const dN = Math.max(divs.length, 1);
  const dH = 44,
    dW = 220;
  const totalDivH = dN * dH + (dN - 1) * 10;
  const divBlockTop = Math.max(68, (H - totalDivH) / 2);
  const divY = i => divBlockTop + i * (dH + 10);
  const csoW = 92,
    csoH = 64;
  const csoY = H / 2 - csoH / 2;
  const briefW = 164,
    briefH = 36;
  const briefY = 16;
  const briefX = X.cso + csoW + Math.round((X.div - (X.cso + csoW)) * 0.38);
  const revW = 116,
    revH = 58;
  const synthW = 86,
    synthH = 50;
  const outW = 86,
    outH = 50;
  const revStep = cols.review[cols.review.length - 1];
  const synthStep = cols.synth[cols.synth.length - 1];
  const briefStep = cols.brief[0];
  const decLabel = (() => {
    const d = (run.decision || "PENDING").replace(/_/g, " ");
    if (d === "CONDITIONAL GO") return "COND. GO";
    return d.split(" ")[0] || "PENDING";
  })();
  return /*#__PURE__*/React.createElement("div", {
    className: "relative rounded-2xl border border-slate-200 shadow-sm",
    style: {
      background: "radial-gradient(120% 90% at 80% -10%, rgba(2,132,199,0.02), transparent 55%), #ffffff"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: `0 0 ${W} ${H}`,
    style: {
      display: "block",
      width: "100%",
      height: "auto",
      overflow: "visible"
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("marker", {
    id: "flowArr",
    viewBox: "0 0 10 10",
    refX: "8.5",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 1 L9 5 L0 9",
    fill: "none",
    stroke: "#94a3b8",
    strokeWidth: "1.6",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  })), /*#__PURE__*/React.createElement("marker", {
    id: "flowArrLoop",
    viewBox: "0 0 10 10",
    refX: "8.5",
    refY: "5",
    markerWidth: "8",
    markerHeight: "8",
    orient: "auto-start-reverse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 1 L9 5 L0 9",
    fill: "none",
    stroke: GSTATE.reroute.stroke,
    strokeWidth: "1.7",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }))), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.input,
    y: H / 2 - 28,
    w: 118,
    h: 56,
    step: run.meta ? {
      status: "done"
    } : null,
    label: "QUERY",
    sub: "target question"
  }), flow(`M${X.input + 118} ${H / 2} H${X.cso - 4}`, "in-cso"), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.cso,
    y: csoY,
    w: csoW,
    h: csoH,
    step: {
      status: run.status === "running" && run.steps.length < 2 ? "running" : "done"
    },
    label: "CSO",
    sub: "route"
  }), flow(`M${X.cso + csoW} ${H / 2 - 14} C${briefX - 20} ${H / 2 - 14} ${briefX - 20} ${briefY + briefH / 2} ${briefX - 4} ${briefY + briefH / 2}`, "cso-brief"), /*#__PURE__*/React.createElement(FlowNode, {
    x: briefX,
    y: briefY,
    w: briefW,
    h: briefH,
    step: briefStep,
    label: "Chief of Staff",
    sub: "brief · decompose",
    active: !!briefStep && active === briefStep.id,
    onClick: () => briefStep && setActive(active === briefStep.id ? null : briefStep.id)
  }), divs.map((s, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: "e" + i
  }, flow(`M${X.cso + csoW} ${H / 2} C${X.div - 70} ${H / 2} ${X.div - 70} ${divY(i) + dH / 2} ${X.div - 4} ${divY(i) + dH / 2}`, "cso-div" + i, s.reroute ? GSTATE.reroute.stroke : "#475569", s.reroute ? "5 4" : undefined), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.div,
    y: divY(i),
    w: dW,
    h: dH,
    step: s,
    label: prettyDiv(s.division) + (s.reroute ? " ↺" : ""),
    sub: s.role,
    active: active === s.id,
    onClick: () => setActive(active === s.id ? null : s.id)
  }))), divs.length === 0 && /*#__PURE__*/React.createElement(FlowNode, {
    x: X.div,
    y: divY(0),
    w: dW,
    h: dH,
    step: null,
    label: "divisions",
    sub: "awaiting routing…"
  }), flow(`M${X.div + dW} ${divY(Math.floor((dN - 1) / 2)) + dH / 2} C${X.review - 60} ${H / 2} ${X.review - 60} ${H / 2} ${X.review - 4} ${H / 2}`, "div-rev"), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.review,
    y: H / 2 - revH / 2,
    w: revW,
    h: revH,
    step: revStep,
    label: "Reviewer",
    sub: "gap-gate · panel",
    active: active === "review",
    onClick: () => revStep && setActive(active === "review" ? null : "review")
  }), flow(`M${X.review + revW} ${H / 2} H${X.synth - 4}`, "rev-synth"), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.synth,
    y: H / 2 - synthH / 2,
    w: synthW,
    h: synthH,
    step: synthStep || (run.synthesis ? {
      status: "done"
    } : null),
    label: "CSO",
    sub: "synthesis"
  }), flow(`M${X.synth + synthW} ${H / 2} H${X.out - 4}`, "synth-out"), /*#__PURE__*/React.createElement(FlowNode, {
    x: X.out,
    y: H / 2 - outH / 2,
    w: outW,
    h: outH,
    step: run.decision && run.decision !== "PENDING" ? {
      status: "done",
      terminal: run.decision === "GO"
    } : null,
    label: decLabel,
    sub: run.decision === "PENDING" ? "awaiting" : "verdict"
  }), rerouted && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: `M${X.review} ${H / 2 + revH / 2} C${X.review} ${H - 30} ${X.div} ${H - 30} ${X.cso + csoW / 2} ${H - 30} L${X.cso + csoW / 2} ${csoY + csoH + 3}`,
    fill: "none",
    stroke: GSTATE.reroute.stroke,
    strokeWidth: "1.7",
    strokeDasharray: "6 5",
    markerEnd: "url(#flowArrLoop)"
  }), /*#__PURE__*/React.createElement("rect", {
    x: X.div - 10,
    y: H - 44,
    width: 260,
    height: 26,
    rx: 13,
    fill: "#f8fafc",
    stroke: GSTATE.reroute.stroke,
    strokeOpacity: "0.35"
  }), /*#__PURE__*/React.createElement("text", {
    x: X.div + 120,
    y: H - 27,
    textAnchor: "middle",
    fontSize: "10",
    fontFamily: "'JetBrains Mono',monospace",
    fill: GSTATE.reroute.stroke
  }, "re-route to fill missing gaps · ", cols.reroute.length))), active && run.steps.find(s => s.id === active) && /*#__PURE__*/React.createElement("div", {
    className: "border-t border-slate-200 p-4"
  }, /*#__PURE__*/React.createElement(LoopStep, {
    step: run.steps.find(s => s.id === active),
    idx: run.steps.findIndex(s => s.id === active),
    last: true,
    active: true,
    onClick: () => setActive(null),
    engineGaps: run.engineGaps,
    engineForced: run.engineForced,
    panel: run.panel
  })));
}
function LoopTrace({
  run
}) {
  const [active, setActive] = useState(null);
  const [view, setView] = useState("graph"); // "graph" (process flow) | "timeline"
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 mb-5 text-xs text-slate-500 flex-wrap"
  }, Object.entries(PROV).map(([k, p]) => /*#__PURE__*/React.createElement("span", {
    key: k
  }, p.icon, " ", p.label)), /*#__PURE__*/React.createElement("div", {
    className: "ml-auto inline-flex rounded-lg border border-slate-200 overflow-hidden bg-white"
  }, [["graph", "⬡ Process flow"], ["timeline", "☰ Timeline"]].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setView(k),
    className: `px-3 py-1 text-xs transition ${view === k ? "bg-slate-200 text-slate-800 font-semibold" : "text-slate-600 hover:text-slate-800 hover:bg-slate-50"}`
  }, l)))), run.decisionEngine && /*#__PURE__*/React.createElement(PrometheuxDecision, {
    run: run,
    className: "mb-5"
  }), view === "graph" && /*#__PURE__*/React.createElement(LoopGraph, {
    run: run,
    active: active,
    setActive: setActive
  }), view === "timeline" && /*#__PURE__*/React.createElement("div", {
    className: "relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-5"
  }, run.steps.map((s, i) => /*#__PURE__*/React.createElement(LoopStep, {
    key: s.id + "_" + i,
    step: s,
    idx: i,
    last: i === run.steps.length - 1,
    active: active === s.id,
    onClick: () => setActive(active === s.id ? null : s.id),
    engineGaps: run.engineGaps,
    engineForced: run.engineForced,
    panel: run.panel
  })), run.status === "running" && run.steps.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-500"
  }, "starting the loop…"), Object.keys(run.divisionFindings || {}).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-wide text-slate-500 mb-2"
  }, "division findings"), /*#__PURE__*/React.createElement("div", {
    className: "space-y-1.5"
  }, Object.values(run.divisionFindings).map((df, i) => {
    const f = df.finding || {};
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "flex items-start gap-2 text-xs"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-slate-800 font-semibold whitespace-nowrap"
    }, df.division), f.evidence_grade && /*#__PURE__*/React.createElement(Chip, {
      cls: gradeStyle(f.evidence_grade)
    }, f.evidence_grade), f.interpretation && /*#__PURE__*/React.createElement("span", {
      className: "text-slate-600 truncate"
    }, f.interpretation));
  })))));
}

// Prometheux deductive decision: the GO/NO-GO tier derived from per-axis coverage,
// with the safety hard-gate and a replayable per-axis basis. Authoritative over the
// agent's free-text; a divergence is surfaced, never silently overridden.
function PrometheuxDecision({
  run,
  className
}) {
  const e = run.decisionEngine;
  if (!e) return null;
  const dec = DECISION[e.tier] || DECISION.REVIEW;
  const axes = e.axes || {};
  return /*#__PURE__*/React.createElement("div", {
    className: `relative overflow-hidden rounded-2xl border border-fuchsia-200 bg-fuchsia-50/60 shadow-sm p-5 ${className || ""}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 mb-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "px-2 py-0.5 rounded-md font-bold text-xs bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200"
  }, "◆ PROMETHEUX"), /*#__PURE__*/React.createElement("span", {
    className: "text-xs uppercase tracking-widest text-fuchsia-700"
  }, "deductive decision"), /*#__PURE__*/React.createElement("span", {
    className: `ml-auto px-3 py-1 rounded-lg font-extrabold text-sm uppercase ${dec.c}`
  }, (e.tier || "REVIEW").replace("_", " "))), /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-700"
  }, "coverage score ", /*#__PURE__*/React.createElement("span", {
    className: "mono font-bold text-fuchsia-700"
  }, e.score), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-500"
  }, " / ", e.max_score)), /*#__PURE__*/React.createElement("div", {
    className: "mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2"
  }, Object.entries(axes).map(([ax, a]) => {
    const absent = a.grade === "absent";
    return /*#__PURE__*/React.createElement("div", {
      key: ax,
      className: `rounded-lg border px-3 py-2 ${absent ? "border-rose-200 bg-rose-50 border-dashed" : "border-slate-200 bg-white"}`
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-[10px] uppercase tracking-wide text-slate-500"
    }, ax), /*#__PURE__*/React.createElement("div", {
      className: `text-sm font-semibold ${a.weight >= 1 ? "text-emerald-700" : a.weight >= 0.5 ? "text-sky-700" : a.weight > 0 ? "text-amber-700" : "text-rose-700"}`
    }, absent ? "no information" : a.grade), /*#__PURE__*/React.createElement("div", {
      className: "mono text-[10px] text-slate-500"
    }, "w ", a.weight));
  })), (e.absent_axes || []).length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"
  }, "⚪ ", /*#__PURE__*/React.createElement("b", null, "No information"), " on: ", e.absent_axes.join(", "), " — these axes were never assessed (or returned empty). The score reflects absence, not weak evidence."), e.explanation && /*#__PURE__*/React.createElement("p", {
    className: "mt-3 text-xs text-fuchsia-800 leading-relaxed border-t border-fuchsia-200 pt-3"
  }, e.explanation), run.diverges && /*#__PURE__*/React.createElement("div", {
    className: "mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement(Icons.AlertTriangle, {
    className: "w-4 h-4 text-amber-600 flex-none mt-0.5"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Divergence:"), " the synthesis agent proposed ", /*#__PURE__*/React.createElement("b", null, (run.agentDecision || "").replace("_", " ")), ", but the deductive layer derives ", /*#__PURE__*/React.createElement("b", null, (e.tier || "").replace("_", " ")), " from the evidence coverage. The derived tier is the decision of record.")));
}

// ======================================================================================
//  Report (from live synthesis)
// ======================================================================================
function Panel({
  title,
  accent,
  children
}) {
  const a = {
    rose: "text-rose-700",
    amber: "text-amber-700",
    sky: "text-sky-700"
  }[accent] || "text-slate-700";
  const bg = {
    rose: "bg-rose-50 border-rose-200",
    amber: "bg-amber-50 border-amber-200",
    sky: "bg-sky-50 border-sky-200"
  }[accent] || "bg-white border-slate-200";
  const IconComponent = {
    rose: Icons.AlertTriangle,
    amber: Icons.Info,
    sky: Icons.Flask
  }[accent];
  return /*#__PURE__*/React.createElement("div", {
    className: `rounded-2xl border ${bg} shadow-sm p-5`
  }, /*#__PURE__*/React.createElement("div", {
    className: `text-xs uppercase tracking-widest mb-3 flex items-center gap-1.5 font-bold ${a}`
  }, IconComponent && /*#__PURE__*/React.createElement(IconComponent, {
    className: "w-4 h-4"
  }), /*#__PURE__*/React.createElement("span", null, title)), children);
}

// Collect the per-run evidence edges, grouped by validity axis (druggability,
// modality, linkage, safety, clinical precedence…). The decision engine supplies
// the axis grade + weight; the streamed edges supply the supporting datasource rows.
function axisEvidenceFromRun(run) {
  const axesMeta = run.decisionEngine?.axes || {};
  const nodes = run.gnodes || {};
  const byAxis = {};
  // seed every axis the decision engine evaluated, so empty axes still surface
  Object.entries(axesMeta).forEach(([ax, a]) => {
    byAxis[ax] = {
      meta: a,
      rows: []
    };
  });
  Object.values(run.gedges || {}).forEach(e => {
    if (!e.axis) return;
    (byAxis[e.axis] ||= {
      meta: null,
      rows: []
    }).rows.push({
      ...e,
      subjectLabel: nodes[e.s]?.label || e.s,
      objectLabel: nodes[e.t]?.label || e.t
    });
  });
  return byAxis;
}
function AxisEvidence({
  ax,
  entry
}) {
  const a = entry.meta;
  const absent = a?.grade === "absent" || entry.rows.length === 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: `rounded-2xl border p-5 ${absent ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white shadow-sm"}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-2 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-xs uppercase tracking-widest text-slate-600"
  }, ax), a && /*#__PURE__*/React.createElement(Chip, {
    cls: gradeStyle(absent ? "absent" : a.grade)
  }, absent ? "no information" : a.grade), a && /*#__PURE__*/React.createElement(Chip, {
    cls: "border-slate-200 text-slate-700 bg-slate-100"
  }, "weight ", a.weight), /*#__PURE__*/React.createElement("span", {
    className: "ml-auto text-xs text-slate-500"
  }, entry.rows.length, " evidence item", entry.rows.length !== 1 ? "s" : "")), absent && /*#__PURE__*/React.createElement("p", {
    className: "mt-2 text-xs text-rose-700"
  }, "No information on this axis was gathered — the score reflects absence, not weak evidence.")), entry.rows.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden"
  }, /*#__PURE__*/React.createElement("table", {
    className: "w-full text-xs"
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
    className: "text-slate-500 text-left"
  }, /*#__PURE__*/React.createElement("th", {
    className: "px-4 py-2 font-medium"
  }, "evidence (relation → entity)"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "value"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "grade"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "conf"), /*#__PURE__*/React.createElement("th", {
    className: "px-2 py-2 font-medium"
  }, "source"))), /*#__PURE__*/React.createElement("tbody", null, entry.rows.map((r, i) => {
    const p = PROV[provOf(r.prov)] || PROV.computed;
    return /*#__PURE__*/React.createElement("tr", {
      key: i,
      className: "border-t border-slate-200 align-top"
    }, /*#__PURE__*/React.createElement("td", {
      className: "px-4 py-2 text-slate-800"
    }, /*#__PURE__*/React.createElement("span", {
      className: "text-sky-600 mono"
    }, r.type), " → ", /*#__PURE__*/React.createElement("span", {
      className: "text-slate-900 font-medium"
    }, r.objectLabel), r.ref && /*#__PURE__*/React.createElement("div", {
      className: "text-[11px] text-slate-500 mt-0.5 leading-snug"
    }, r.ref)), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2 text-slate-700"
    }, r.value || "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2"
    }, /*#__PURE__*/React.createElement(Chip, {
      cls: gradeStyle(r.grade)
    }, r.grade || "—")), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2 mono text-slate-700"
    }, r.conf != null ? Number(r.conf).toFixed(2) : "—"), /*#__PURE__*/React.createElement("td", {
      className: "px-2 py-2"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mr-1"
    }, p.icon), r.url ? /*#__PURE__*/React.createElement("a", {
      href: r.url,
      target: "_blank",
      rel: "noreferrer",
      className: "text-sky-600 hover:text-sky-800 underline"
    }, r.source, " ↗") : /*#__PURE__*/React.createElement("span", {
      className: "text-slate-700"
    }, r.source || "—")));
  })))));
}
function ReportOverview({
  run,
  s
}) {
  const decTier = run.decisionEngine?.tier || s.decision || "REVIEW";
  const dec = DECISION[decTier] || DECISION.REVIEW;
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: `relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-6 ring-1 ${dec.ring}`
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] uppercase tracking-[0.2em] text-slate-500 mb-3"
  }, "Executive summary · CSO verdict"), /*#__PURE__*/React.createElement("div", {
    className: "flex items-center gap-3 flex-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: `px-5 py-2 rounded-xl font-extrabold text-base tracking-tight uppercase ${dec.c}`
  }, decTier.replace("_", " ")), run.decisionSource === "prometheux" && /*#__PURE__*/React.createElement(Chip, {
    cls: "border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50"
  }, "◆ derived"), /*#__PURE__*/React.createElement(Chip, {
    cls: "border-slate-200 text-slate-700 bg-slate-100 mono"
  }, "confidence: ", s.confidence || run.confidence)), /*#__PURE__*/React.createElement("p", {
    className: "mt-4 text-sm text-slate-800 leading-relaxed"
  }, s.recommendation), s.target_overview && /*#__PURE__*/React.createElement("p", {
    className: "mt-3 text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-3"
  }, s.target_overview)), run.decisionEngine && /*#__PURE__*/React.createElement(PrometheuxDecision, {
    run: run
  }), /*#__PURE__*/React.createElement("div", {
    className: "grid md:grid-cols-2 gap-5"
  }, /*#__PURE__*/React.createElement(Panel, {
    title: "Liabilities & risks",
    accent: "rose"
  }, (s.liabilities || []).map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "mb-3 last:mb-0"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm text-slate-800"
  }, l.risk), l.mitigation && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-emerald-700 mt-0.5"
  }, "↳ mitigation: ", l.mitigation)))), /*#__PURE__*/React.createElement(Panel, {
    title: "Evidence gaps",
    accent: "amber"
  }, /*#__PURE__*/React.createElement("ul", {
    className: "space-y-2"
  }, (s.evidence_gaps || []).map((g, i) => /*#__PURE__*/React.createElement("li", {
    key: i,
    className: "text-sm text-slate-700 flex gap-2"
  }, "⚪ ", g))))), (s.proposed_experiments || []).length > 0 && /*#__PURE__*/React.createElement(Panel, {
    title: "Proposed experiments",
    accent: "sky"
  }, /*#__PURE__*/React.createElement("div", {
    className: "grid sm:grid-cols-2 gap-3"
  }, s.proposed_experiments.map((e, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "rounded-lg border border-slate-200 bg-slate-50 p-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-sm font-semibold text-slate-900"
  }, e.experiment), e.expected_readout && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-sky-700 mt-1"
  }, "readout: ", e.expected_readout), e.rationale && /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-slate-600 mt-1"
  }, e.rationale))))));
}
function Report({
  run
}) {
  const s = run.synthesis;
  const byAxis = useMemo(() => axisEvidenceFromRun(run), [run.gedges, run.decisionEngine]);
  const axisKeys = Object.keys(byAxis);
  const [sub, setSub] = useState("overview");
  if (run.status !== "done" || !s) {
    return /*#__PURE__*/React.createElement("div", {
      className: "rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "text-sm text-slate-600"
    }, "The report is constructed once the loop completes."), /*#__PURE__*/React.createElement("div", {
      className: "text-xs text-slate-400 mt-1"
    }, run.status === "running" ? "synthesis pending — evidence still being gathered…" : "submit a query to begin."));
  }
  const active = sub !== "overview" && byAxis[sub] ? sub : "overview";
  return /*#__PURE__*/React.createElement("div", {
    className: "space-y-5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSub("overview"),
    className: `px-3 py-1.5 rounded-lg text-xs font-medium transition ${active === "overview" ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`
  }, "Report"), axisKeys.map(ax => {
    const entry = byAxis[ax];
    const absent = entry.meta?.grade === "absent" || entry.rows.length === 0;
    return /*#__PURE__*/React.createElement("button", {
      key: ax,
      onClick: () => setSub(ax),
      className: `px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${active === ax ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900 hover:bg-white"}`
    }, /*#__PURE__*/React.createElement("span", {
      className: "capitalize"
    }, ax), /*#__PURE__*/React.createElement("span", {
      className: `text-[10px] ${active === ax ? "opacity-80" : absent ? "text-rose-600" : "text-slate-500"}`
    }, absent ? "⚪" : entry.rows.length));
  })), active === "overview" ? /*#__PURE__*/React.createElement(ReportOverview, {
    run: run,
    s: s
  }) : /*#__PURE__*/React.createElement(AxisEvidence, {
    ax: active,
    entry: byAxis[active]
  }));
}

// ======================================================================================
//  Query screen + run shell
// ======================================================================================
// Reasoning-budget presets for the review→reroute loop. Higher budget lets the loop
// chase more of the broader "desired" evidence axes (somatic / malignancy / landscape)
// before converging; lower keeps it on the core four. Token spend is the bound — the
// same meter Langfuse traces. Mirrors a "thinking effort" selector.
const BUDGETS = [{
  key: "focused",
  label: "Focused",
  tokens: 0,
  hint: "core axes only — fastest"
}, {
  key: "balanced",
  label: "Balanced",
  tokens: 30000,
  hint: "core + a couple broader axes"
}, {
  key: "thorough",
  label: "Thorough",
  tokens: 60000,
  hint: "chase all broader axes (default)"
}];
function QueryScreen({
  onRun
}) {
  const [q, setQ] = useState(EXAMPLES[0]);
  const [demo, setDemo] = useState(true);
  const [agents, setAgents] = useState(false);
  const [partial, setPartial] = useState(false);
  const [hitl, setHitl] = useState(false);
  const [budget, setBudget] = useState("thorough");
  return /*#__PURE__*/React.createElement("div", {
    className: "flex h-full"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hidden lg:flex flex-col justify-between w-2/5 min-w-[340px] max-w-[520px] bg-slate-900 px-12 py-14 text-white"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "inline-flex items-center gap-2 text-[11px] text-sky-300 mono mb-8 px-2.5 py-1 rounded-full border border-sky-500/30 bg-sky-500/10"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-sky-400 bio-breath"
  }), "phronesis-cso · multi-agent harness"), /*#__PURE__*/React.createElement("h1", {
    className: "text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight mb-5"
  }, "Ask the", /*#__PURE__*/React.createElement("br", null), "Virtual CSO."), /*#__PURE__*/React.createElement("p", {
    className: "text-slate-400 text-sm leading-relaxed"
  }, "Submit a target-assessment question. A Chief-of-Staff briefing, division scientists, a four-lens Scientific Reviewer panel with a bounded re-route loop, and a CSO synthesis run in real time."), /*#__PURE__*/React.createElement("div", {
    className: "mt-10 grid grid-cols-2 gap-3"
  }, [{
    icon: Icons.Network,
    color: "text-blue-400",
    title: "Evidence graph",
    desc: "D3 knowledge graph built live"
  }, {
    icon: Icons.Activity,
    color: "text-sky-400",
    title: "Loop trace",
    desc: "Every agent step, streaming"
  }, {
    icon: Icons.Cpu,
    color: "text-fuchsia-400",
    title: "Prometheux engine",
    desc: "Deductive GO/NO-GO decision"
  }, {
    icon: Icons.UserCheck,
    color: "text-emerald-400",
    title: "HITL mode",
    desc: "Join the reviewer panel"
  }].map(({
    icon: IconComponent,
    color,
    title,
    desc
  }) => /*#__PURE__*/React.createElement("div", {
    key: title,
    className: "rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 flex flex-col gap-2"
  }, /*#__PURE__*/React.createElement(IconComponent, {
    className: `w-5 h-5 ${color}`
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "text-xs font-semibold text-white"
  }, title), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400 mt-0.5 leading-snug"
  }, desc)))))), /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] text-slate-600 mono"
  }, "Live multi-agent loop via server.py → harness.py / cso.py")), /*#__PURE__*/React.createElement("div", {
    className: "flex-1 overflow-y-auto"
  }, /*#__PURE__*/React.createElement("div", {
    className: "max-w-xl mx-auto px-8 py-14 fade-up"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex lg:hidden items-center gap-2 text-[11px] text-sky-700 mono mb-6 px-2.5 py-1 rounded-full border border-sky-200 bg-sky-50 w-fit"
  }, /*#__PURE__*/React.createElement("span", {
    className: "w-1.5 h-1.5 rounded-full bg-sky-500 bio-breath"
  }), "phronesis-cso"), /*#__PURE__*/React.createElement("h2", {
    className: "text-2xl font-extrabold text-slate-900 mb-1"
  }, "New assessment"), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-500 mb-7"
  }, "Enter your target–indication question below."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      if (q.trim()) onRun(q.trim(), demo, partial, agents, BUDGETS.find(b => b.key === budget).tokens, hitl);
    }
  }, /*#__PURE__*/React.createElement("textarea", {
    value: q,
    onChange: e => setQ(e.target.value),
    rows: 4,
    className: "w-full rounded-xl bg-white border border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none p-4 text-slate-900 text-sm resize-none transition shadow-sm",
    placeholder: "e.g. Assess B7-H3 potential as a therapeutic target in lung cancer"
  }), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 space-y-3"
  }, /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-3 cursor-pointer group"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: demo,
    onChange: e => setDemo(e.target.checked),
    className: "accent-sky-500 mt-0.5"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 font-medium"
  }, "Demo mode"), " ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "— cached data for all skills, reliable for a demo stage"))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-3 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: agents,
    onChange: e => setAgents(e.target.checked),
    className: "accent-emerald-500 mt-0.5"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-emerald-700 font-medium"
  }, "Live agents"), " ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "— reasoning roles call a real LLM (~3-4 min). Off = instant stubs."))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-3 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: partial,
    onChange: e => setPartial(e.target.checked),
    className: "accent-fuchsia-500 mt-0.5"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-fuchsia-700 font-medium"
  }, "Skip safety step"), " ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "— demo the Prometheux gap-detector forcing a re-route"))), /*#__PURE__*/React.createElement("label", {
    className: "flex items-start gap-3 cursor-pointer"
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: hitl,
    onChange: e => setHitl(e.target.checked),
    className: "accent-amber-500 mt-0.5"
  }), /*#__PURE__*/React.createElement("span", {
    className: "text-sm"
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-amber-700 font-medium"
  }, "Human in the loop"), " ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-400"
  }, "— pause at each reviewer pass to approve, override, or add a gap")))), /*#__PURE__*/React.createElement("button", {
    type: "submit",
    className: "mt-7 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-sm shadow-md shadow-sky-100 transition"
  }, "Run assessment →")), /*#__PURE__*/React.createElement("div", {
    className: "mt-8 border-t border-slate-100 pt-6"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] uppercase tracking-wide text-slate-400 mb-3"
  }, "Try an example"), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col gap-2"
  }, EXAMPLES.map((ex, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setQ(ex),
    className: "text-left text-sm text-slate-700 rounded-lg border border-slate-200 hover:border-sky-400 hover:text-slate-900 bg-white hover:bg-sky-50 px-3 py-2.5 transition shadow-sm"
  }, ex)))))));
}

// HITL: the reviewer-panel checkpoint. The loop is paused; the human joins the panel
// — approve the autonomous verdict, override it, redirect the re-route, or add a gap.
function CheckpointModal({
  cp,
  onDecide
}) {
  const [skill, setSkill] = useState(cp.proposed_reroute?.skill || "");
  const [missing, setMissing] = useState("");
  const pr = cp.proposed_reroute;
  const verdict = cp.verdict;
  return /*#__PURE__*/React.createElement("div", {
    className: "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm fade-up"
  }, /*#__PURE__*/React.createElement("div", {
    className: "relative overflow-hidden max-w-lg w-full mx-4 rounded-2xl border border-amber-200 bg-white shadow-2xl p-6 ring-1 ring-amber-300/30"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-xs text-amber-700 mono mb-1"
  }, "🧑‍⚖️ human in the loop · reviewer pass ", (cp.iteration ?? 0) + 1), /*#__PURE__*/React.createElement("h3", {
    className: "text-lg font-bold text-slate-900"
  }, "The panel voted ", /*#__PURE__*/React.createElement("span", {
    className: verdict === "re-route" ? "text-amber-600" : "text-emerald-600"
  }, verdict), "."), /*#__PURE__*/React.createElement("p", {
    className: "text-sm text-slate-600 mt-1"
  }, cp.panel ? `${cp.panel.reroute_votes}/${cp.panel.n_lenses} lenses flagged a re-route. ` : "", pr ? /*#__PURE__*/React.createElement(React.Fragment, null, "Proposed next step: ", /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800 mono"
  }, pr.skill), pr.missing ? ` — to fill "${pr.missing}"` : "", ".  ") : "No follow-up proposed."), cp.gaps && cp.gaps.length > 0 && /*#__PURE__*/React.createElement("ul", {
    className: "mt-3 text-xs text-slate-500 list-disc pl-5 space-y-0.5"
  }, cp.gaps.slice(0, 4).map((g, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "text-slate-800"
  }, g.missing), g.route_to ? ` → ${g.route_to}` : ""))), /*#__PURE__*/React.createElement("div", {
    className: "mt-5 grid grid-cols-2 gap-2"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onDecide({
      action: "approve"
    }),
    className: "px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
  }, "✓ Approve verdict"), verdict === "re-route" ? /*#__PURE__*/React.createElement("button", {
    onClick: () => onDecide({
      action: "override_verdict",
      verdict: "synthesize"
    }),
    className: "px-3 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 text-sm font-semibold"
  }, "■ Stop & synthesize") : /*#__PURE__*/React.createElement("button", {
    onClick: () => onDecide({
      action: "override_verdict",
      verdict: "re-route",
      route_to: skill || undefined,
      missing: missing || "human-directed re-route"
    }),
    className: "px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold"
  }, "↻ Force a re-route")), /*#__PURE__*/React.createElement("div", {
    className: "mt-4 border-t border-slate-200 pt-4"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[11px] uppercase tracking-wide text-slate-500 mb-2"
  }, "…or steer the next step"), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2"
  }, /*#__PURE__*/React.createElement("input", {
    value: skill,
    onChange: e => setSkill(e.target.value),
    placeholder: "skill (e.g. struct-predictor)",
    className: "flex-1 rounded-lg bg-white border border-slate-300 focus:border-amber-500 outline-none px-2 py-1.5 text-xs text-slate-900 mono shadow-sm"
  }), /*#__PURE__*/React.createElement("input", {
    value: missing,
    onChange: e => setMissing(e.target.value),
    placeholder: "gap / question",
    className: "flex-1 rounded-lg bg-white border border-slate-300 focus:border-amber-500 outline-none px-2 py-1.5 text-xs text-slate-900 shadow-sm"
  })), /*#__PURE__*/React.createElement("div", {
    className: "flex gap-2 mt-2"
  }, /*#__PURE__*/React.createElement("button", {
    disabled: !skill,
    onClick: () => onDecide({
      action: "redirect",
      route_to: skill,
      missing: missing || undefined
    }),
    className: "flex-1 px-3 py-1.5 rounded-lg border border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-xs font-semibold"
  }, "→ Redirect re-route"), /*#__PURE__*/React.createElement("button", {
    disabled: !skill && !missing,
    onClick: () => onDecide({
      action: "add_gap",
      route_to: skill || undefined,
      missing: missing || undefined
    }),
    className: "flex-1 px-3 py-1.5 rounded-lg border border-sky-400 text-sky-700 bg-sky-50 hover:bg-sky-100 disabled:opacity-40 text-xs font-semibold"
  }, "+ Add gap to chase")))));
}
function App() {
  const [run, setRun] = useState(emptyRun);
  const [tab, setTab] = useState("loop");
  const esRef = useRef(null);
  const runRef = useRef(run);
  runRef.current = run;
  const start = useCallback((query, demo, partial, agents, budget, hitl) => {
    if (esRef.current) esRef.current.close();
    setRun({
      ...emptyRun(),
      status: "running",
      meta: {
        query,
        partial: !!partial,
        hitl: !!hitl
      }
    });
    setTab("loop");
    const url = `/api/run?query=${encodeURIComponent(query)}&demo=${demo ? 1 : 0}&agents=${agents ? 1 : 0}${partial ? "&partial=1" : ""}${hitl ? "&hitl=1" : ""}`;
    const es = new EventSource(url);
    esRef.current = es;
    const on = name => es.addEventListener(name, e => {
      const data = JSON.parse(e.data);
      setRun(prev => reduceEvent(prev, name, data));
      if (name === "done" || name === "error") es.close();
    });
    ["start", "phase", "briefing", "plan", "evidence", "node", "edge", "engine_gaps", "panel", "division_finding", "review", "checkpoint_wait", "checkpoint_resolved", "synthesis", "decision", "done", "error"].forEach(on);
    es.onerror = () => {
      setRun(prev => prev.status === "done" ? prev : reduceEvent(prev, "error", {
        message: "connection lost — is server.py running?"
      }));
      es.close();
    };
  }, []);
  const decide = useCallback(decision => {
    const cp = runRef.current?.checkpoint;
    if (!cp) return;
    setRun(prev => ({
      ...prev,
      checkpoint: null
    }));
    fetch(`/api/decision?run_id=${encodeURIComponent(cp.run_id)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(decision)
    }).catch(() => {});
  }, []);
  useEffect(() => () => {
    if (esRef.current) esRef.current.close();
  }, []);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const q = p.get("q");
    if (q) start(q, p.get("demo") !== "0", p.get("partial") === "1", p.get("agents") === "1", undefined, p.get("hitl") === "1");
    if (p.get("tab")) setTab(p.get("tab"));
  }, [start]);
  if (run.status === "idle") return /*#__PURE__*/React.createElement(QueryScreen, {
    onRun: start
  });
  const decTier = run.decision || "PENDING";
  const dec = DECISION[decTier] || DECISION.PENDING;
  const stepsDone = run.steps.filter(s => s.status === "done").length;
  const TAB_ITEMS = [{
    k: "loop",
    icon: Icons.Activity,
    label: "Loop trace"
  }, {
    k: "graph",
    icon: Icons.Network,
    label: "Evidence graph"
  }, {
    k: "ledger",
    icon: Icons.ListBullet,
    label: "Evidence ledger"
  }, {
    k: "report",
    icon: Icons.FileText,
    label: "Report",
    pending: run.status !== "done"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "flex flex-col h-full"
  }, run.checkpoint && /*#__PURE__*/React.createElement(CheckpointModal, {
    cp: run.checkpoint,
    onDecide: decide
  }), /*#__PURE__*/React.createElement("header", {
    className: "flex-none flex items-center gap-4 px-5 border-b border-slate-200 bg-white shadow-sm",
    style: {
      height: "56px"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (esRef.current) esRef.current.close();
      setRun(emptyRun());
    },
    className: "flex-none flex items-center gap-1.5 text-xs text-sky-600 hover:text-sky-800 font-semibold transition whitespace-nowrap"
  }, /*#__PURE__*/React.createElement(Icons.ArrowLeft, {
    className: "w-4 h-4"
  }), /*#__PURE__*/React.createElement("span", null, "New")), /*#__PURE__*/React.createElement("div", {
    className: "w-px h-5 bg-slate-200"
  }), /*#__PURE__*/React.createElement("h1", {
    className: "flex-1 text-sm font-semibold text-slate-900 truncate"
  }, run.meta?.query), /*#__PURE__*/React.createElement("div", {
    className: "flex-none flex items-center gap-2"
  }, /*#__PURE__*/React.createElement(Chip, {
    cls: run.status === "done" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : run.status === "error" ? "border-rose-200 text-rose-700 bg-rose-50" : "border-sky-200 text-sky-700 bg-sky-50"
  }, run.status === "running" ? "● running" : run.status === "done" ? "complete" : "error"), run.meta?.partial && /*#__PURE__*/React.createElement(Chip, {
    cls: "border-fuchsia-200 text-fuchsia-700 bg-fuchsia-50"
  }, "◆ partial")), /*#__PURE__*/React.createElement("div", {
    className: "w-px h-5 bg-slate-200"
  }), /*#__PURE__*/React.createElement("div", {
    className: "flex-none flex items-center gap-4 text-xs"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1 text-slate-600"
  }, /*#__PURE__*/React.createElement(Icons.Layers, {
    className: "w-3.5 h-3.5 text-slate-400"
  }), /*#__PURE__*/React.createElement("span", null, "steps: ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-slate-900 mono"
  }, stepsDone))), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-200"
  }, "|"), /*#__PURE__*/React.createElement("span", {
    className: "flex items-center gap-1 text-slate-600"
  }, /*#__PURE__*/React.createElement(Icons.Database, {
    className: "w-3.5 h-3.5 text-slate-400"
  }), /*#__PURE__*/React.createElement("span", null, "evidence: ", /*#__PURE__*/React.createElement("span", {
    className: "font-bold text-slate-900 mono"
  }, Object.keys(run.evidence).length))), /*#__PURE__*/React.createElement("span", {
    className: "text-slate-200"
  }, "|"), /*#__PURE__*/React.createElement("span", {
    className: `px-2.5 py-0.5 rounded-lg font-bold text-xs uppercase ${dec.c}`
  }, decTier.replace("_", " ")))), /*#__PURE__*/React.createElement("div", {
    className: "flex flex-1 min-h-0"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "flex-none flex flex-col border-r border-slate-200 bg-slate-50",
    style: {
      width: "180px"
    }
  }, /*#__PURE__*/React.createElement("nav", {
    className: "flex-1 py-3"
  }, TAB_ITEMS.map(({
    k,
    icon: IconComponent,
    label,
    pending
  }) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    className: `w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition text-left ${tab === k ? "bg-sky-50 text-sky-700 border-r-2 border-sky-600" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`
  }, /*#__PURE__*/React.createElement(IconComponent, {
    className: "w-4 h-4"
  }), /*#__PURE__*/React.createElement("span", {
    className: "flex-1"
  }, label), pending && /*#__PURE__*/React.createElement("span", {
    className: "text-[9px] text-slate-400"
  }, "soon")))), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-slate-200 px-3 py-3"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[9px] uppercase tracking-widest text-slate-400 mb-2"
  }, "Sources"), Object.entries(PROV).map(([k, p]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "flex items-center gap-1.5 text-[10px] text-slate-500 mb-1"
  }, /*#__PURE__*/React.createElement("span", null, p.icon), /*#__PURE__*/React.createElement("span", {
    className: "truncate"
  }, p.label.split(" —")[0])))), /*#__PURE__*/React.createElement("div", {
    className: "border-t border-slate-200 px-3 py-2.5"
  }, /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] text-slate-400 mono truncate"
  }, run.meta?.calls_llm ? `${run.meta.backend === "nim" ? "🟢 NIM" : run.meta.backend} · ${run.meta.model?.split("/").pop() || run.meta.model}` : "demo / stub"))), /*#__PURE__*/React.createElement("main", {
    className: "flex-1 min-w-0 overflow-auto"
  }, run.status === "error" && /*#__PURE__*/React.createElement("div", {
    className: "m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-start gap-2"
  }, /*#__PURE__*/React.createElement(Icons.AlertTriangle, {
    className: "w-5 h-5 text-rose-600 flex-none"
  }), /*#__PURE__*/React.createElement("span", null, run.error)), /*#__PURE__*/React.createElement("div", {
    className: "p-6"
  }, tab === "loop" && /*#__PURE__*/React.createElement(LoopTrace, {
    run: run
  }), tab === "graph" && /*#__PURE__*/React.createElement(GraphView, {
    run: run
  }), tab === "ledger" && /*#__PURE__*/React.createElement(LedgerView, {
    run: run
  }), tab === "report" && /*#__PURE__*/React.createElement(Report, {
    run: run
  })))));
}
function Stat({
  n,
  l,
  small
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "px-3 py-2 rounded-xl bg-white border border-slate-200 shadow-sm"
  }, /*#__PURE__*/React.createElement("div", {
    className: `font-bold text-slate-900 ${small ? "text-sm" : "text-xl"} ${small ? "" : "mono"}`
  }, n), /*#__PURE__*/React.createElement("div", {
    className: "text-[10px] uppercase tracking-wide text-slate-500"
  }, l));
}
ReactDOM.createRoot(document.getElementById("root")).render(/*#__PURE__*/React.createElement(App, null));