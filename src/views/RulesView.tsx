import { useEffect, useState } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import {
  WARM_SWATCHES,
  type Category,
  type CategoryRule,
  type IgnoreRule,
  type ProductivityKind,
  type RuleMatchType,
  type RuleTestResult,
} from "../types/pulsetrack";
import { Modal } from "../components/Modal";

interface RulesViewProps {
  categories: Category[];
  rules: CategoryRule[];
  ignoreRules: IgnoreRule[];
  onSaveCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
  onSaveRule: (rule: CategoryRule) => void;
  onDeleteRule: (id: string) => void;
  onSaveIgnore: (rule: IgnoreRule) => void;
  onDeleteIgnore: (id: string) => void;
  onTestRule: (appName: string, windowTitle: string) => Promise<RuleTestResult>;
}

type SubTab = "rules" | "categories" | "ignore";

const KIND_WEIGHT: Record<ProductivityKind, number> = {
  productive: 1.0,
  neutral: 0.5,
  distracting: 0.0,
};

export function RulesView({
  categories,
  rules,
  ignoreRules,
  onSaveCategory,
  onDeleteCategory,
  onSaveRule,
  onDeleteRule,
  onSaveIgnore,
  onDeleteIgnore,
  onTestRule,
}: RulesViewProps) {
  const [tab, setTab] = useState<SubTab>("rules");

  // arbtt Rule Sandbox Tester
  const [testApp, setTestApp] = useState("Google Chrome");
  const [testTitle, setTestTitle] = useState("PR #128 · DestTraky · GitHub - Google Chrome");
  const [testResult, setTestResult] = useState<RuleTestResult | null>(null);

  useEffect(() => {
    let active = true;
    void onTestRule(testApp, testTitle).then((res) => {
      if (active) setTestResult(res);
    });
    return () => {
      active = false;
    };
  }, [testApp, testTitle, rules, ignoreRules, onTestRule]);

  // Rule modal
  const [ruleModal, setRuleModal] = useState(false);
  const [ruleMatchType, setRuleMatchType] = useState<RuleMatchType>("windowTitle");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleCategoryId, setRuleCategoryId] = useState("productive");
  const [rulePriority, setRulePriority] = useState(25);
  const [ruleIsRegex, setRuleIsRegex] = useState(false);
  const [ruleTag, setRuleTag] = useState("");

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState<string>(WARM_SWATCHES[3]);
  const [catKind, setCatKind] = useState<ProductivityKind>("productive");

  // Ignore modal
  const [ignoreModal, setIgnoreModal] = useState(false);
  const [ignoreType, setIgnoreType] = useState<RuleMatchType>("appName");
  const [ignorePattern, setIgnorePattern] = useState("");
  const [ignoreIsRegex, setIgnoreIsRegex] = useState(false);

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const submitRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern.trim()) return;
    onSaveRule({
      id: `rule-${Date.now()}`,
      matchType: ruleMatchType,
      pattern: rulePattern.trim(),
      categoryId: ruleCategoryId,
      priority: rulePriority,
      isRegex: ruleIsRegex,
      tag: ruleTag.trim() || null,
    });
    setRulePattern("");
    setRuleTag("");
    setRuleIsRegex(false);
    setRuleModal(false);
  };

  const submitCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const slug = catName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    onSaveCategory({
      id: `${slug || "cat"}-${Date.now()}`,
      name: catName.trim(),
      color: catColor,
      kind: catKind,
      weight: KIND_WEIGHT[catKind],
      isSystem: false,
    });
    setCatName("");
    setCatModal(false);
  };

  const submitIgnore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ignorePattern.trim()) return;
    onSaveIgnore({
      id: `ig-${Date.now()}`,
      matchType: ignoreType,
      pattern: ignorePattern.trim(),
      isRegex: ignoreIsRegex,
    });
    setIgnorePattern("");
    setIgnoreIsRegex(false);
    setIgnoreModal(false);
  };

  const testCat = testResult ? catMap.get(testResult.categoryId) : null;

  return (
    <div className="space-y-4 max-w-[1400px] mx-auto">
      {/* arbtt-inspired Live Rule & Regex Sandbox */}
      <div className="pt-card p-4 space-y-3 animate-pt-in">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amberPulse shrink-0" strokeWidth={1.9} />
            <span className="text-xs font-semibold text-ink">Rule Sandbox</span>
            <span className="text-[10px] font-mono text-inkFaint">TITLE &gt; APP &gt; NEUTRAL</span>
          </div>

          {testResult && (
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {testResult.ignored ? (
                <span className="px-2 py-0.5 rounded-full bg-rustPulse/15 text-rustPulse font-semibold">
                  IGNORED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-elevated text-ink">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: testCat?.color ?? "#8A8478" }}
                  />
                  <span>{testCat?.name ?? "Neutral"}</span>
                </span>
              )}
              {testResult.matchedPattern && (
                <span className="text-[11px] text-inkMuted">
                  via <code className="text-amberPulse">{testResult.matchedPattern}</code>
                </span>
              )}
              {testResult.tags.map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-1.5 py-0.5 rounded bg-canvas border border-borderSubtle text-inkMuted"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          <input
            type="text"
            value={testApp}
            onChange={(e) => setTestApp(e.target.value)}
            placeholder="Sample app (e.g. VS Code)"
            className="pt-input text-xs font-mono"
          />
          <input
            type="text"
            value={testTitle}
            onChange={(e) => setTestTitle(e.target.value)}
            placeholder="Sample window title..."
            className="md:col-span-2 pt-input text-xs font-mono"
          />
        </div>
      </div>

      {/* Sub-tabs & Add button */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-borderSubtle">
          {(
            [
              { id: "rules", label: `Rules (${rules.length})` },
              { id: "categories", label: `Categories (${categories.length})` },
              { id: "ignore", label: `Ignore (${ignoreRules.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-elevated text-ink border border-borderStrong"
                  : "text-inkMuted hover:text-ink border border-transparent"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          id="btn-add-rule-entity"
          type="button"
          onClick={() => {
            if (tab === "rules") setRuleModal(true);
            else if (tab === "categories") setCatModal(true);
            else setIgnoreModal(true);
          }}
          className="pt-btn-primary px-3.5 py-1.5 text-xs flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{tab === "rules" ? "Add Rule" : tab === "categories" ? "Add Category" : "Add Ignore"}</span>
        </button>
      </div>

      {/* Rules Table */}
      {tab === "rules" && (
        <div className="pt-card overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-borderSubtle text-[11px] font-mono uppercase text-inkFaint">
                <th className="py-2.5 px-4 font-medium">Match</th>
                <th className="py-2.5 px-3 font-medium">Pattern</th>
                <th className="py-2.5 px-3 font-medium">Tag</th>
                <th className="py-2.5 px-3 font-medium">Category</th>
                <th className="py-2.5 px-3 font-medium text-right">Priority</th>
                <th className="py-2.5 px-4 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-borderSubtle/70">
              {rules.map((r) => {
                const cat = catMap.get(r.categoryId);
                return (
                  <tr key={r.id} className="hover:bg-elevated/40">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                            r.matchType === "windowTitle"
                              ? "bg-amberPulse/15 text-amberPulse"
                              : "bg-elevated text-inkMuted"
                          }`}
                        >
                          {r.matchType === "windowTitle" ? "Title" : "App"}
                        </span>
                        {r.isRegex && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-canvas border border-borderStrong text-ink">
                            Regex
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-ink">{r.pattern}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-inkMuted">
                      {r.tag ? `#${r.tag}` : "—"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1.5 text-inkMuted">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat?.color ?? "#8A8478" }}
                        />
                        {cat?.name ?? "Neutral"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-inkMuted text-right">
                      {r.priority}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteRule(r.id)}
                        className="p-1 text-inkFaint hover:text-rustPulse"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories Tab */}
      {tab === "categories" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {categories.map((c) => (
            <div key={c.id} className="pt-card p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink truncate">{c.name}</div>
                  <div className="text-[11px] font-mono text-inkFaint uppercase">
                    {c.kind} · {c.weight.toFixed(1)}
                  </div>
                </div>
              </div>
              {!c.isSystem && (
                <button
                  type="button"
                  onClick={() => onDeleteCategory(c.id)}
                  className="p-1 text-inkFaint hover:text-rustPulse"
                  aria-label="Delete category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Ignore Tab */}
      {tab === "ignore" && (
        <div className="pt-card overflow-hidden">
          {ignoreRules.length === 0 ? (
            <div className="py-14 text-center text-xs font-mono text-inkFaint">No ignored rules</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-borderSubtle text-[11px] font-mono uppercase text-inkFaint">
                  <th className="py-2.5 px-4 font-medium">Match</th>
                  <th className="py-2.5 px-3 font-medium">Pattern</th>
                  <th className="py-2.5 px-4 w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borderSubtle/70">
                {ignoreRules.map((ig) => (
                  <tr key={ig.id} className="hover:bg-elevated/40">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-elevated text-inkMuted">
                          {ig.matchType === "windowTitle" ? "Title" : "App"}
                        </span>
                        {ig.isRegex && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-canvas border border-borderStrong text-ink">
                            Regex
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-ink">{ig.pattern}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteIgnore(ig.id)}
                        className="p-1 text-inkFaint hover:text-rustPulse"
                        aria-label="Delete ignore rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Add Rule Modal (with arbtt Regex + Tag support) */}
      <Modal open={ruleModal} title="Add Rule" onClose={() => setRuleModal(false)}>
        <form onSubmit={submitRule} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "windowTitle", label: "Title Keyword" },
                { id: "appName", label: "Application" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRuleMatchType(opt.id)}
                className={`py-1.5 rounded-lg text-xs font-mono border ${
                  ruleMatchType === opt.id
                    ? "bg-elevated border-amberPulse text-ink"
                    : "border-borderSubtle text-inkMuted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Pattern</span>
            <input
              type="text"
              value={rulePattern}
              onChange={(e) => setRulePattern(e.target.value)}
              placeholder={ruleIsRegex ? "e.g. PR #\\d+|pull/\\d+" : "e.g. youtube, Code.exe"}
              className="pt-input w-full font-mono"
              required
            />
          </label>

          <label className="flex items-center justify-between text-xs text-inkMuted cursor-pointer">
            <span>Regex match (arbtt mode)</span>
            <input
              type="checkbox"
              checked={ruleIsRegex}
              onChange={(e) => setRuleIsRegex(e.target.checked)}
              className="w-4 h-4 accent-[#D97706]"
            />
          </label>

          <div className="grid grid-cols-3 gap-2">
            <label className="col-span-2 block space-y-1">
              <span className="text-[11px] font-mono uppercase text-inkMuted">Category</span>
              <select
                value={ruleCategoryId}
                onChange={(e) => setRuleCategoryId(e.target.value)}
                className="pt-input w-full"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-mono uppercase text-inkMuted">Priority</span>
              <input
                type="number"
                value={rulePriority}
                onChange={(e) => setRulePriority(Number(e.target.value) || 10)}
                className="pt-input w-full font-mono"
              />
            </label>
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Tag (optional)</span>
            <input
              type="text"
              value={ruleTag}
              onChange={(e) => setRuleTag(e.target.value)}
              placeholder="e.g. code-review, design"
              className="pt-input w-full font-mono"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRuleModal(false)} className="pt-btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="submit" className="pt-btn-primary px-4 py-1.5 text-xs">
              Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Category Modal */}
      <Modal open={catModal} title="Add Category" onClose={() => setCatModal(false)}>
        <form onSubmit={submitCategory} className="space-y-3.5">
          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Name</span>
            <input
              type="text"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="e.g. Design, Research"
              className="pt-input w-full"
              required
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Weight</span>
            <div className="grid grid-cols-3 gap-2">
              {(["productive", "neutral", "distracting"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setCatKind(k)}
                  className={`py-1.5 rounded-lg text-xs font-mono capitalize border ${
                    catKind === k
                      ? "bg-elevated border-amberPulse text-ink"
                      : "border-borderSubtle text-inkMuted"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Color</span>
            <div className="flex flex-wrap gap-2">
              {WARM_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => setCatColor(hex)}
                  className={`w-7 h-7 rounded-md transition-transform ${
                    catColor === hex ? "ring-2 ring-ink scale-105" : ""
                  }`}
                  style={{ backgroundColor: hex }}
                  aria-label={hex}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCatModal(false)} className="pt-btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="submit" className="pt-btn-primary px-4 py-1.5 text-xs">
              Create
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Ignore Modal */}
      <Modal open={ignoreModal} title="Ignore Rule" onClose={() => setIgnoreModal(false)}>
        <form onSubmit={submitIgnore} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "appName", label: "Application" },
                { id: "windowTitle", label: "Title Keyword" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setIgnoreType(opt.id)}
                className={`py-1.5 rounded-lg text-xs font-mono border ${
                  ignoreType === opt.id
                    ? "bg-elevated border-amberPulse text-ink"
                    : "border-borderSubtle text-inkMuted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono uppercase text-inkMuted">Pattern</span>
            <input
              type="text"
              value={ignorePattern}
              onChange={(e) => setIgnorePattern(e.target.value)}
              placeholder={ignoreIsRegex ? "e.g. (incognito|inprivate)" : "e.g. 1Password.exe"}
              className="pt-input w-full font-mono"
              required
            />
          </label>

          <label className="flex items-center justify-between text-xs text-inkMuted cursor-pointer">
            <span>Regex match</span>
            <input
              type="checkbox"
              checked={ignoreIsRegex}
              onChange={(e) => setIgnoreIsRegex(e.target.checked)}
              className="w-4 h-4 accent-[#D97706]"
            />
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setIgnoreModal(false)} className="pt-btn-ghost px-3 py-1.5 text-xs">
              Cancel
            </button>
            <button type="submit" className="pt-btn-primary px-4 py-1.5 text-xs">
              Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
