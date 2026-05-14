import React, { useMemo, useRef, useState } from "react";

export default function App() {
  const [page, setPage] = useState("try");
  const [mode, setMode] = useState("sort");
  const [sortAlgo, setSortAlgo] = useState("bubble");
  const [searchAlgo, setSearchAlgo] = useState("linear");
  const [barCount, setBarCount] = useState(12);
  const [delay, setDelay] = useState(220);
  const [array, setArray] = useState(() => makeArray(12));
  const [active, setActive] = useState([]);
  const [found, setFound] = useState(null);
  const [target, setTarget] = useState(50);
  const [message, setMessage] = useState("Choose what you want to demonstrate, then press Start.");
  const [stats, setStats] = useState({ checks: 0, changes: 0, steps: 0, time: 0 });
  const [comparisonResults, setComparisonResults] = useState([]);
  const runningRef = useRef(false);
  const delayRef = useRef(220);

  const maxValue = useMemo(() => Math.max(...array, 1), [array]);

  function generate(count = barCount) {
    if (runningRef.current) return;
    const next = makeArray(count);
    setArray(next);
    setActive([]);
    setFound(null);
    setStats({ checks: 0, changes: 0, steps: 0, time: 0 });
    setComparisonResults([]);
    setMessage("New random bars generated.");
  }

  function updateCount(value) {
    const count = Number(value);
    setBarCount(count);
    generate(count);
  }

  function handleDelayChange(value) {
    const nextDelay = Number(value);
    setDelay(nextDelay);
    delayRef.current = nextDelay;
  }

  async function start() {
    if (runningRef.current) return;

    runningRef.current = true;
    setActive([]);
    setFound(null);
    setStats({ checks: 0, changes: 0, steps: 0, time: 0 });

    const startTime = performance.now();
    let result;

    if (mode === "sort") {
      if (sortAlgo === "bubble") result = bubbleSortSteps([...array]);
      if (sortAlgo === "insertion") result = insertionSortSteps([...array]);
      if (sortAlgo === "merge") result = mergeSortSteps([...array]);

      await playSteps(result.steps, true);
      setArray(result.finalArray);
      setActive(result.finalArray.map((_, position) => position));
      setMessage(`${getLabel(sortAlgo)} finished. The bars are now ordered from shortest to tallest.`);
    } else {
      let workArray = [...array];

      if (searchAlgo === "binary") {
        workArray = [...array].sort((a, b) => a - b);
        setArray(workArray);
        setMessage("Fast Search needs the bars ordered first, so the app ordered them automatically.");
        await wait(Math.max(250, delayRef.current));
      }

      if (searchAlgo === "linear") result = linearSearchSteps(workArray, Number(target));
      if (searchAlgo === "binary") result = binarySearchSteps(workArray, Number(target));

      await playSteps(result.steps, false);
      setFound(result.foundPosition);
      setActive([]);
      setMessage(result.foundPosition === -1 ? `${target} was not found.` : `${target} was found at position ${result.foundPosition + 1}.`);
    }

    const endTime = performance.now();

    setStats({
      checks: result.checks,
      changes: result.changes || 0,
      steps: result.steps.length,
      time: endTime - startTime
    });

    runningRef.current = false;
  }

  async function playSteps(steps, isSort) {
    for (const step of steps) {
      if (isSort && step.array) setArray(step.array);
      setActive(step.active || []);
      if (typeof step.foundPosition === "number") setFound(step.foundPosition);
      setMessage(step.text || "Running...");
      await wait(delayRef.current);
    }
  }

  function runComparison() {
    if (runningRef.current) return;

    const original = [...array];

    if (mode === "sort") {
      const repeatCount = getSortBenchmarkRepeats(original.length);

      const sortingMethods = [
        ["Bubble Sort", bubbleSortBenchmark],
        ["Insertion Sort", insertionSortBenchmark],
        ["Merge Sort", mergeSortBenchmark]
      ];

      const results = sortingMethods.map(([name, method]) => {
        let totalChecks = 0;
        let totalChanges = 0;

        const startTime = performance.now();

        for (let run = 0; run < repeatCount; run++) {
          const copy = [...original];
          const metrics = method(copy);
          totalChecks += metrics.checks;
          totalChanges += metrics.changes;
        }

        const totalTime = performance.now() - startTime;

        return {
          type: "Sort",
          name,
          runs: repeatCount,
          totalTime,
          time: totalTime / repeatCount,
          checks: Math.round(totalChecks / repeatCount),
          changes: Math.round(totalChanges / repeatCount),
          note: name === "Merge Sort" ? "Lowest growth for larger lists" : "More work as the list grows"
        };
      });

      setComparisonResults(results);
      setMessage(`Comparison completed using ${repeatCount} repeated runs per method. Average time is more reliable than one single run.`);
      setArray([...original].sort((a, b) => a - b));
      setActive([]);
      setFound(null);
      return;
    }

    const repeatCount = getSearchBenchmarkRepeats(original.length);
    const searchTarget = Number(target);
    const sortedArray = [...original].sort((a, b) => a - b);

    const searchMethods = [
      ["Simple Search", () => linearSearchBenchmark(original, searchTarget), "Works without ordering"],
      ["Fast Search", () => binarySearchBenchmark(sortedArray, searchTarget), "Uses an ordered copy"]
    ];

    const results = searchMethods.map(([name, method, note]) => {
      let totalChecks = 0;
      let lastFoundPosition = -1;

      const startTime = performance.now();

      for (let run = 0; run < repeatCount; run++) {
        const metrics = method();
        totalChecks += metrics.checks;
        lastFoundPosition = metrics.foundPosition;
      }

      const totalTime = performance.now() - startTime;

      return {
        type: "Search",
        name,
        runs: repeatCount,
        totalTime,
        time: totalTime / repeatCount,
        checks: Math.round(totalChecks / repeatCount),
        changes: 0,
        foundPosition: lastFoundPosition,
        note
      };
    });

    setComparisonResults(results);
    setMessage(`Search comparison completed using ${repeatCount.toLocaleString()} repeated runs per method. Average time is more reliable than one single run.`);
    setArray(sortedArray);
    setActive([]);
    setFound(results[1].foundPosition);
  }

  function sortInstantly() {
    if (runningRef.current) return;
    const sorted = [...array].sort((a, b) => a - b);
    setArray(sorted);
    setActive(sorted.map((_, position) => position));
    setFound(null);
    setMessage("Bars ordered instantly. This is useful before showing Fast Search.");
  }

  return (
    <div className="app">
      <header className="header card">
        <div>
          <h1>Sorting & Searching Business Demo</h1>
          <p>A simple visual tool to explain speed, effort, and scalability without programming details.</p>
        </div>

        <nav className="tabs">
          <button className={page === "try" ? "tab active" : "tab"} onClick={() => setPage("try")}>Try Demo</button>
          <button className={page === "sorts" ? "tab active" : "tab"} onClick={() => setPage("sorts")}>Sorting Ideas</button>
          <button className={page === "search" ? "tab active" : "tab"} onClick={() => setPage("search")}>Searching Ideas</button>
          <button className={page === "bigO" ? "tab active" : "tab"} onClick={() => setPage("bigO")}>Growth & Speed</button>
          <button className={page === "kd" ? "tab active" : "tab"} onClick={() => setPage("kd")}>KD Simulation</button>
        </nav>
      </header>

      {page === "try" && (
        <main className="layout">
          <aside className="card controls">
            <h2>Controls</h2>
            <p className="muted">Use a slower delay when explaining to viewers. Use more bars to show why better methods matter.</p>

            <section className="control-block">
              <h3>What do you want to show?</h3>
              <div className="two-buttons">
                <button className={mode === "sort" ? "choice selected" : "choice"} onClick={() => setMode("sort")}>Ordering bars</button>
                <button className={mode === "search" ? "choice selected" : "choice"} onClick={() => setMode("search")}>Finding a value</button>
              </div>
            </section>

            {mode === "sort" ? (
              <section className="control-block">
                <h3>Ordering method</h3>
                <select value={sortAlgo} onChange={(e) => setSortAlgo(e.target.value)}>
                  <option value="bubble">Bubble Sort — simple but slow</option>
                  <option value="insertion">Insertion Sort — good for small lists</option>
                  <option value="merge">Merge Sort — better for large lists</option>
                </select>
              </section>
            ) : (
              <section className="control-block">
                <h3>Finding method</h3>
                <select value={searchAlgo} onChange={(e) => setSearchAlgo(e.target.value)}>
                  <option value="linear">Simple Search — checks one by one</option>
                  <option value="binary">Fast Search — cuts the list in half</option>
                </select>

                <label>Value to find</label>
                <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
              </section>
            )}

            <section className="control-block">
              <h3>Demo settings</h3>

              <label>Number of bars: <b>{barCount}</b></label>
              <input type="range" min="5" max="150" value={barCount} onChange={(e) => updateCount(e.target.value)} />
              <small className="hint">For clear animation use 5–40 bars. For comparison, try 100–150 bars.</small>

              <label>Delay between steps: <b>{delay} ms</b></label>
              <input type="range" min="40" max="900" step="20" value={delay} onChange={(e) => handleDelayChange(e.target.value)} />
            </section>

            <div className="button-grid">
              <button className="primary" onClick={start}>Start Demo</button>
              <button onClick={() => generate()}>New Bars</button>
              <button className="success full" onClick={sortInstantly}>Order Bars Instantly</button>
              <button className="compare-button full" onClick={runComparison}>{mode === "sort" ? "Compare All Sorts" : "Compare Search Methods"}</button>
            </div>
          </aside>

          <section className="main-panel">
            <div className="card">
              <div className="visual-header">
                <div>
                  <h2>Live Visualization</h2>
                  <p>Blue = normal bar, yellow = being checked, green = found or finished.</p>
                </div>
                <span className="pill">{mode === "sort" ? getLabel(sortAlgo) : getLabel(searchAlgo)}</span>
              </div>

              <div className="bars">
                {array.map((value, position) => {
                  const isActive = active.includes(position);
                  const isFound = found === position;
                  const height = Math.max(20, (value / maxValue) * 300);

                  return (
                    <div className="bar-column" key={position}>
                      <div
                        className={isFound ? "bar found" : isActive ? "bar active" : "bar"}
                        style={{ height }}
                        title={`Position ${position + 1}: ${value}`}
                      />
                      {array.length <= 25 && <span>{value}</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="stats">
              <div className="card stat wide">
                <small>What is happening now?</small>
                <strong>{message}</strong>
              </div>
              <div className="card stat">
                <small>Number of checks</small>
                <strong>{stats.checks.toLocaleString()}</strong>
              </div>
              <div className="card stat">
                <small>Number of changes</small>
                <strong>{stats.changes.toLocaleString()}</strong>
              </div>
              <div className="card stat">
                <small>Shown steps</small>
                <strong>{stats.steps.toLocaleString()}</strong>
              </div>
              <div className="card stat">
                <small>Demo duration</small>
                <strong>{stats.time.toFixed(1)} ms</strong>
              </div>
            </div>

            {comparisonResults.length > 0 && (
              <ComparisonPanel results={comparisonResults} />
            )}
          </section>
        </main>
      )}

      {page === "sorts" && <SortingPage />}
      {page === "search" && <SearchingPage />}
      {page === "bigO" && <GrowthPage />}
      {page === "kd" && <KDSimulationPage />}
    </div>
  );
}

/* =========================
   Explanation pages
========================= */


function KDSimulationPage() {
  const [kdCount, setKdCount] = useState(14);
  const [itemMin, setItemMin] = useState(1);
  const [itemMax, setItemMax] = useState(30);
  const [entrySeconds, setEntrySeconds] = useState(120);
  const [sortedSearchSeconds, setSortedSearchSeconds] = useState(3);
  const [unsortedCheckSeconds, setUnsortedCheckSeconds] = useState(8);
  const [sortSecondsPerItemLog, setSortSecondsPerItemLog] = useState(6);
  const [sortedCollectionMode, setSortedCollectionMode] = useState("after");
  const [selectedKdIndex, setSelectedKdIndex] = useState(0);
  const [kds, setKds] = useState(() => generateKDs(14, 1, 30));
  const [sourceTags, setSourceTags] = useState({
    kdCount: "Estimated",
    entrySeconds: "Measured",
    sortedSearchSeconds: "Estimated",
    unsortedCheckSeconds: "Estimated",
    sortSecondsPerItemLog: "Calculated"
  });

  const FIXED_PHASE_COUNT = 3;

  function regenerate() {
    const safeMin = Math.max(1, Math.min(Number(itemMin), Number(itemMax)));
    const safeMax = Math.max(safeMin, Number(itemMax));
    const safeCount = Math.max(1, Number(kdCount));
    setKds(generateKDs(safeCount, safeMin, safeMax));
    setSelectedKdIndex(0);
  }

  function updateSourceTag(key, value) {
    setSourceTags((previous) => ({
      ...previous,
      [key]: value
    }));
  }

  const simulation = useMemo(() => {
    return calculateKDSimulation(kds, {
      entrySeconds: Number(entrySeconds),
      phaseCount: FIXED_PHASE_COUNT,
      sortedSearchSeconds: Number(sortedSearchSeconds),
      unsortedCheckSeconds: Number(unsortedCheckSeconds),
      sortSecondsPerItemLog: Number(sortSecondsPerItemLog),
      sortedCollectionMode
    });
  }, [kds, entrySeconds, sortedSearchSeconds, unsortedCheckSeconds, sortSecondsPerItemLog, sortedCollectionMode]);

  const selectedKd = kds[selectedKdIndex] || kds[0];
  const selectedResult = simulation.results[selectedKdIndex] || simulation.results[0];

  return (
    <main className="kd-page">
      <section className="card kd-hero">
        <div>
          <h2>KD Manufacturing Simulation</h2>
          <p>
            Compare unsorted KDs versus sorted KDs across 3 phases. Phase 1 includes manufacturing entry. In “Sort after collecting”, sorting time is also added in Phase 1. Search starts in Phase 2, and found items are removed from the collection during Phase 2 and Phase 3.
          </p>
        </div>
        <div className="kd-hero-stats">
          <span><b>{kds.length}</b> KDs</span>
          <span><b>{FIXED_PHASE_COUNT}</b> phases</span>
          <span><b>{entrySeconds}</b>s entry/item</span>
        </div>
      </section>

      <section className="kd-layout">
        <aside className="card kd-controls">
          <h3>Simulation settings</h3>

          <div className="setting-line">
            <label>Number of KDs: <b>{kdCount}</b></label>
            <SettingSourceSelect value={sourceTags.kdCount} onChange={(value) => updateSourceTag("kdCount", value)} />
          </div>
          <input type="range" min="1" max="30" value={kdCount} onChange={(e) => setKdCount(Number(e.target.value))} />

          <div className="kd-two-inputs">
            <div>
              <label>Min items</label>
              <input type="number" min="1" max="30" value={itemMin} onChange={(e) => setItemMin(Number(e.target.value))} />
            </div>
            <div>
              <label>Max items</label>
              <input type="number" min="1" max="60" value={itemMax} onChange={(e) => setItemMax(Number(e.target.value))} />
            </div>
          </div>

          <div className="setting-line">
            <label>Manufacturing entry time / item: <b>{entrySeconds}s</b></label>
            <SettingSourceSelect value={sourceTags.entrySeconds} onChange={(value) => updateSourceTag("entrySeconds", value)} />
          </div>
          <input type="range" min="10" max="300" step="10" value={entrySeconds} onChange={(e) => setEntrySeconds(Number(e.target.value))} />
          <small className="hint">Phase 1 includes manufacturing entry. If mode is “Sort after collecting”, sorting time is also counted in Phase 1.</small>

          <div className="kd-mode-box">
            <h4>Sorted KD mode</h4>
            <div className="mode-choice-grid">
              <button
                className={sortedCollectionMode === "after" ? "mode-choice active" : "mode-choice"}
                onClick={() => setSortedCollectionMode("after")}
              >
                <b>Sort after collecting</b>
                <span>Collect all items first, then add sorting time in phase 1.</span>
              </button>
              <button
                className={sortedCollectionMode === "while" ? "mode-choice active" : "mode-choice"}
                onClick={() => setSortedCollectionMode("while")}
              >
                <b>Sort while collecting</b>
                <span>Put each item directly in its place, so no extra sorting time.</span>
              </button>
            </div>
          </div>

          <div className="setting-line">
            <label>Sorted search time / item: <b>{sortedSearchSeconds}s</b></label>
            <SettingSourceSelect value={sourceTags.sortedSearchSeconds} onChange={(value) => updateSourceTag("sortedSearchSeconds", value)} />
          </div>
          <input type="range" min="1" max="20" value={sortedSearchSeconds} onChange={(e) => setSortedSearchSeconds(Number(e.target.value))} />
          <small className="hint">Sorted KD search is O(1), so it uses a small fixed time per item.</small>

          <div className="setting-line">
            <label>Unsorted check time / comparison: <b>{unsortedCheckSeconds}s</b></label>
            <SettingSourceSelect value={sourceTags.unsortedCheckSeconds} onChange={(value) => updateSourceTag("unsortedCheckSeconds", value)} />
          </div>
          <input type="range" min="1" max="30" value={unsortedCheckSeconds} onChange={(e) => setUnsortedCheckSeconds(Number(e.target.value))} />
          <small className="hint">After an item is found, it is removed from the collection, so the remaining search set becomes smaller.</small>

          <div className="setting-line">
            <label>Sorting effort factor: <b>{sortSecondsPerItemLog}s</b></label>
            <SettingSourceSelect value={sourceTags.sortSecondsPerItemLog} onChange={(value) => updateSourceTag("sortSecondsPerItemLog", value)} />
          </div>
          <input type="range" min="1" max="30" value={sortSecondsPerItemLog} onChange={(e) => setSortSecondsPerItemLog(Number(e.target.value))} />
          <small className="hint">
            Used only in “Sort after collecting”. Sorting is counted once in Phase 1.
          </small>

          <button className="primary kd-full-button" onClick={regenerate}>Generate New KD Data</button>
        </aside>

        <section className="kd-main">
          <div className="kd-summary-grid">
            <div className="card kd-summary sorted">
              <small>Total sorted KD time</small>
              <strong>{formatDuration(simulation.totalSortedSeconds)}</strong>
              <span>{sortedCollectionMode === "after" ? "Entry counted in Phase 1; sorting also counted here if selected" : "Sorts while collecting, no extra sorting time"}</span>
            </div>

            <div className="card kd-summary unsorted">
              <small>Total unsorted KD time</small>
              <strong>{formatDuration(simulation.totalUnsortedSeconds)}</strong>
              <span>Search is repeated in all 3 phases with removal after each found item</span>
            </div>

            <div className={`card kd-summary ${simulation.totalSavedSeconds >= 0 ? "saving" : "loss"}`}>
              <small>{simulation.totalSavedSeconds >= 0 ? "Time saved by sorting" : "Extra time due to sorting"}</small>
              <strong>{formatDuration(Math.abs(simulation.totalSavedSeconds))}</strong>
              <span>{simulation.totalSavedSeconds >= 0 ? "Sorted process is faster overall" : "Sorting is not worth it with current settings"}</span>
            </div>
          </div>

          <div className="card kd-break-even">
            <h3>Breaking point</h3>
            {simulation.breakEvenItems ? (
              <p>
                With the current settings, sorting becomes faster starting from around
                <b> {simulation.breakEvenItems} items per KD</b>.
              </p>
            ) : (
              <p>
                With the current settings, sorting does not become faster within the tested range.
              </p>
            )}
            <div className="break-even-bar">
              <span style={{ width: `${Math.min(100, ((simulation.breakEvenItems || 30) / 30) * 100)}%` }} />
            </div>
          </div>

          <section className="card kd-list-card">
            <div className="kd-section-head">
              <div>
                <h3>KD list</h3>
                <p>Select any KD to see its item codes, names, and phase timing.</p>
              </div>
              <span className="pill">Sorted search = O(1)</span>
            </div>

            <div className="kd-list">
              {simulation.results.map((result, index) => (
                <button
                  key={result.kd.id}
                  className={selectedKdIndex === index ? "kd-chip active" : "kd-chip"}
                  onClick={() => setSelectedKdIndex(index)}
                >
                  <b>{result.kd.id}</b>
                  <span>{result.kd.items.length} items</span>
                  <em>{result.savedSeconds >= 0 ? `saves ${formatDurationShort(result.savedSeconds)}` : `loses ${formatDurationShort(Math.abs(result.savedSeconds))}`}</em>
                </button>
              ))}
            </div>
          </section>

          {selectedKd && selectedResult && (
            <section className="kd-detail-grid">
              <div className="card kd-visual">
                <div className="kd-section-head">
                  <div>
                    <h3>{selectedKd.id} item visualization</h3>
                    <p>Each item has a code and name. Sorted KD is arranged by item code.</p>
                  </div>
                  <span className="pill">{selectedKd.items.length} items</span>
                </div>

                <div className="kd-compare-boxes">
                  <div>
                    <h4>Unsorted KD</h4>
                    <div className="kd-item-grid">
                      {selectedKd.items.map((item) => (
                        <div key={item.code} className="kd-item-card unsorted-item">
                          <b>{item.code}</b>
                          <span>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4>Sorted KD</h4>
                    <div className="kd-item-grid">
                      {[...selectedKd.items].sort((a, b) => a.code.localeCompare(b.code)).map((item) => (
                        <div key={item.code} className="kd-item-card sorted-item">
                          <b>{item.code}</b>
                          <span>{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card kd-phase-card">
                <h3>3-phase timing for {selectedKd.id}</h3>
                <div className="phase-table-wrap">
                  <table className="phase-table">
                    <thead>
                      <tr>
                        <th>Phase</th>
                        <th>Unsorted</th>
                        <th>Sorted</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.phases.map((phase) => (
                        <tr key={phase.phase}>
                          <td>Phase {phase.phase}</td>
                          <td>{formatDurationShort(phase.unsortedSeconds)}</td>
                          <td>{formatDurationShort(phase.sortedSeconds)}</td>
                          <td>{phase.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="kd-total-line">
                  <span>Unsorted total: <b>{formatDuration(selectedResult.unsortedSeconds)}</b></span>
                  <span>Sorted total: <b>{formatDuration(selectedResult.sortedSeconds)}</b></span>
                </div>
              </div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function SettingSourceSelect({ value, onChange }) {
  return (
    <select className="source-select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Estimated">Estimated</option>
      <option value="Calculated">Calculated</option>
      <option value="Measured">Measured</option>
      <option value="Assumed">Assumed</option>
      <option value="Other">Other</option>
    </select>
  );
}

function SortingPage() {
  const [selected, setSelected] = useState("bubble");

  const data = {
    bubble: {
      title: "Bubble Sort",
      badge: "Simple but slow",
      visual: <MovingBubbleSort />,
      summary: "Bubble Sort compares two neighboring items. If they are in the wrong order, it swaps them.",
      idea: "The biggest values slowly move to the end after repeated passes.",
      steps: ["Compare two neighbors", "Swap if needed", "Repeat until everything is ordered"],
      business: "Easy to explain, but not good when the number of items becomes large.",
      tone: "danger"
    },
    insertion: {
      title: "Insertion Sort",
      badge: "Good for small lists",
      visual: <MovingInsertionSort />,
      summary: "Insertion Sort works like sorting playing cards in your hand.",
      idea: "It takes one item and places it in the correct position inside the already ordered part.",
      steps: ["Take one item", "Find its correct place", "Insert it"],
      business: "Good for small lists or lists that are already almost ordered.",
      tone: "warn"
    },
    merge: {
      title: "Merge Sort",
      badge: "Scales better",
      visual: <MovingMergeSort />,
      summary: "Merge Sort divides a large list into smaller groups, orders them, then combines them.",
      idea: "This avoids comparing every item with every other item.",
      steps: ["Divide into smaller groups", "Order each group", "Merge everything back"],
      business: "Better choice when the amount of data grows.",
      tone: "good"
    }
  };

  const item = data[selected];

  return (
    <section className="explain-layout">
      <SelectorPanel
        title="Choose a sorting idea"
        selected={selected}
        setSelected={setSelected}
        options={[
          ["bubble", "Bubble Sort", "Simple but slow"],
          ["insertion", "Insertion Sort", "Small lists"],
          ["merge", "Merge Sort", "Scalable"]
        ]}
      />

      <ExplanationDetail item={item} />
    </section>
  );
}

function SearchingPage() {
  const [selected, setSelected] = useState("linear");

  const data = {
    linear: {
      title: "Simple Search",
      badge: "Checks one by one",
      visual: <MovingLinearSearch />,
      summary: "Simple Search starts from the first item and checks items one after another.",
      idea: "It works even if the list is not ordered.",
      steps: ["Check first item", "Move to the next item", "Stop when the value is found"],
      business: "Simple, but can waste time in large lists.",
      tone: "warn"
    },
    binary: {
      title: "Fast Search",
      badge: "Cuts work in half",
      visual: <MovingBinarySearch />,
      summary: "Fast Search starts from the middle and removes half of the possible answers each time.",
      idea: "It is very fast, but the list must be ordered first.",
      steps: ["Check the middle", "Ignore half of the list", "Repeat on the remaining half"],
      business: "Extremely fast for large ordered lists.",
      tone: "good"
    }
  };

  const item = data[selected];

  return (
    <section className="explain-layout">
      <SelectorPanel
        title="Choose a searching idea"
        selected={selected}
        setSelected={setSelected}
        options={[
          ["linear", "Simple Search", "One by one"],
          ["binary", "Fast Search", "Cuts in half"]
        ]}
      />

      <ExplanationDetail item={item} />
    </section>
  );
}

function GrowthPage() {
  const [selected, setSelected] = useState("overview");

  const data = {
    overview: {
      title: "Big O Overview",
      badge: "Growth of work",
      visual: <BigOGraph selected="overview" />,
      summary: "Big O explains how quickly the required work grows when the amount of data grows.",
      explanation: "Big O is a simple way to compare methods. It does not focus on seconds only, because seconds change from one device to another. Instead, it focuses on how the work grows.",
      realExampleTitle: "Real-life situation",
      realExample: "Imagine a supermarket gets more and more customers every day. Some tasks stay easy as the supermarket grows, while other tasks become very heavy. Big O helps us describe which tasks grow slowly and which tasks grow too fast.",
      steps: ["Small size can hide problems", "More items expose slow methods", "Better growth keeps work manageable"]
    },
    constant: {
      title: "O(1) — Direct Action",
      badge: "Best growth",
      visual: <BigOGraph selected="constant" />,
      summary: "The work stays almost the same no matter how much data exists.",
      explanation: "O(1) means you go directly to the needed thing. The amount of work does not depend on how many total things exist.",
      realExampleTitle: "Real-life example: assigned parking spot",
      realExample: "If you have a reserved parking spot number, you go directly to that spot. It does not matter if the garage has 20 cars or 2,000 cars. You already know exactly where to go.",
      steps: ["Know the exact place", "Go directly", "Same effort even if the total grows"]
    },
    linear: {
      title: "O(n) — One-by-one Growth",
      badge: "Steady growth",
      visual: <BigOGraph selected="linear" />,
      summary: "The work grows at the same rate as the number of items.",
      explanation: "O(n) means you may need to check items one by one. If the number of items doubles, the effort can also roughly double.",
      realExampleTitle: "Real-life example: finding a missing key",
      realExample: "If you lost your key at home and you check every room one by one, a bigger house means more places to check. A small apartment may be quick, but a large building takes much longer.",
      steps: ["Check one place", "Move to the next", "More places means more checking"]
    },
    logarithmic: {
      title: "O(log n) — Cutting in Half",
      badge: "Very scalable",
      visual: <BigOGraph selected="logarithmic" />,
      summary: "The work grows very slowly because each step removes a large part of the remaining options.",
      explanation: "O(log n) means every step cuts the remaining possibilities strongly, usually by half.",
      realExampleTitle: "Real-life example: guessing a number",
      realExample: "If someone thinks of a number between 1 and 1,000, you can ask: is it higher or lower than 500? Each answer removes half of the possible numbers. You do not need to try every number.",
      steps: ["Check the middle", "Remove half", "Repeat with a much smaller set"]
    },
    quadratic: {
      title: "O(n²) — Pair-by-pair Growth",
      badge: "Danger zone",
      visual: <BigOGraph selected="quadratic" />,
      summary: "The work grows much faster than the number of items because many items are paired with many others.",
      explanation: "O(n²) means the effort can grow extremely quickly. It may look fine with small numbers but become too heavy when the number grows.",
      realExampleTitle: "Real-life example: everyone shakes hands",
      realExample: "At a meeting, if every person shakes hands with every other person, adding more people increases the number of handshakes very quickly. 10 people is manageable, but 1,000 people becomes impossible.",
      steps: ["Each person connects with many others", "More people create many more pairs", "Effort grows very fast"]
    },
    nlogn: {
      title: "O(n log n) — Divide and Combine",
      badge: "Good for sorting",
      visual: <BigOGraph selected="nlogn" />,
      summary: "The work grows faster than one-by-one, but much slower than pair-by-pair.",
      explanation: "O(n log n) means the work is divided into smaller groups, handled in parts, then combined again.",
      realExampleTitle: "Real-life example: organizing exam papers",
      realExample: "Imagine teachers need to order thousands of exam papers by student number. Instead of one person comparing papers randomly, they split the papers into smaller piles, order each pile, then combine the ordered piles.",
      steps: ["Split into smaller piles", "Order each pile", "Combine the ordered piles"]
    }
  };

  const item = data[selected];

  return (
    <section className="explain-layout">
      <SelectorPanel
        title="Choose a Big O idea"
        selected={selected}
        setSelected={setSelected}
        options={[
          ["overview", "Overview", "What Big O means"],
          ["constant", "O(1)", "Direct action"],
          ["logarithmic", "O(log n)", "Cut in half"],
          ["linear", "O(n)", "One by one"],
          ["nlogn", "O(n log n)", "Divide + combine"],
          ["quadratic", "O(n²)", "Pair by pair"]
        ]}
      />

      <article className="card explanation-detail bigo-detail">
        <div className="explanation-head">
          <div>
            <h2>{item.title}</h2>
            <p>{item.summary}</p>
          </div>
          <span className="pill">{item.badge}</span>
        </div>

        {item.visual}

        {selected === "overview" ? (
          <div className="bigo-table-card">
            <h3>Simple scale example</h3>
            <BigOScaleTable />
          </div>
        ) : (
          <div className="real-example-card">
            <h3>{item.realExampleTitle}</h3>
            <p>{item.realExample}</p>
          </div>
        )}

        <div className="explanation-grid">
          <div className="explanation-box">
            <h3>Simple explanation</h3>
            <p>{item.explanation}</p>
          </div>

          <div className="explanation-box">
            <h3>How to say it simply</h3>
            <VisualLine items={item.steps} />
          </div>
        </div>
      </article>
    </section>
  );
}

function BigOGraph({ selected }) {
  const curves = [
    { key: "constant", label: "O(1)", points: "45,205 120,205 195,205 270,205 345,205 420,205 495,205" },
    { key: "logarithmic", label: "O(log n)", points: "45,198 120,174 195,160 270,150 345,143 420,138 495,134" },
    { key: "linear", label: "O(n)", points: "45,215 120,190 195,165 270,140 345,115 420,90 495,65" },
    { key: "nlogn", label: "O(n log n)", points: "45,215 120,196 195,170 270,137 345,98 420,55 495,25" },
    { key: "quadratic", label: "O(n²)", points: "45,215 120,210 195,194 270,165 345,122 420,65 495,12" }
  ];

  const activeKey = selected === "overview" ? null : selected;

  return (
    <div className="bigo-graph-card">
      <div className="bigo-graph-header">
        <div>
          <h3>Growth graph</h3>
          <p>As the number of items increases, the required work grows differently for each method.</p>
        </div>
        <span className="graph-note">Lower curve = easier to scale</span>
      </div>

      <div className="bigo-graph-wrap">
        <svg className="bigo-graph" viewBox="0 0 560 260" role="img" aria-label="Big O graph">
          <line x1="45" y1="220" x2="520" y2="220" className="axis" />
          <line x1="45" y1="220" x2="45" y2="20" className="axis" />

          <text x="250" y="250" className="axis-text">Number of items grows →</text>
          <text x="4" y="122" className="axis-text rotate">Work</text>

          {[90, 135, 180].map((y) => (
            <line key={y} x1="45" y1={y} x2="520" y2={y} className="grid-line" />
          ))}

          {curves.map((curve) => (
            <polyline
              key={curve.key}
              points={curve.points}
              className={`curve curve-${curve.key} ${activeKey && activeKey !== curve.key ? "dimmed-curve" : ""} ${activeKey === curve.key ? "active-curve" : ""}`}
            />
          ))}

          <circle cx="495" cy="205" r="5" className={`dot dot-constant ${activeKey === "constant" ? "active-dot" : ""}`} />
          <circle cx="495" cy="134" r="5" className={`dot dot-logarithmic ${activeKey === "logarithmic" ? "active-dot" : ""}`} />
          <circle cx="495" cy="65" r="5" className={`dot dot-linear ${activeKey === "linear" ? "active-dot" : ""}`} />
          <circle cx="495" cy="25" r="5" className={`dot dot-nlogn ${activeKey === "nlogn" ? "active-dot" : ""}`} />
          <circle cx="495" cy="12" r="5" className={`dot dot-quadratic ${activeKey === "quadratic" ? "active-dot" : ""}`} />
        </svg>

        <div className="bigo-legend">
          {curves.map((curve) => (
            <div key={curve.key} className={`legend-item ${activeKey === curve.key ? "active-legend" : ""}`}>
              <span className={`legend-color legend-${curve.key}`} />
              <b>{curve.label}</b>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function BigOScaleTable() {
  const rows = [
    ["O(1)", "Direct action", "1", "1", "1"],
    ["O(log n)", "Cutting in half", "~7", "~10", "~20"],
    ["O(n)", "One by one", "100", "1,000", "1,000,000"],
    ["O(n log n)", "Divide and combine", "~664", "~9,966", "~19,931,569"],
    ["O(n²)", "Pair by pair", "10,000", "1,000,000", "1,000,000,000,000"]
  ];

  return (
    <div className="bigo-scale-wrap">
      <table className="bigo-scale-table">
        <thead>
          <tr>
            <th>Growth type</th>
            <th>Simple idea</th>
            <th>100 items</th>
            <th>1,000 items</th>
            <th>1,000,000 items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell) => <td key={cell}>{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function SelectorPanel({ title, selected, setSelected, options }) {
  return (
    <aside className="card selector-panel">
      <h2>{title}</h2>
      <p className="muted">Choose one topic at a time. This keeps the presentation clean for non-technical viewers.</p>
      <div className="selector-list">
        {options.map(([key, label, description]) => (
          <button
            key={key}
            className={selected === key ? "selector-item active" : "selector-item"}
            onClick={() => setSelected(key)}
          >
            <strong>{label}</strong>
            <span>{description}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function ExplanationDetail({ item }) {
  return (
    <article className="card explanation-detail">
      <div className="explanation-head">
        <div>
          <h2>{item.title}</h2>
          <p>{item.summary}</p>
        </div>
        <span className="pill">{item.badge}</span>
      </div>

      {item.visual}

      <div className="explanation-grid">
        <div className="explanation-box">
          <h3>Main idea</h3>
          <p>{item.idea}</p>
        </div>

        <div className="explanation-box">
          <h3>Simple flow</h3>
          <VisualLine items={item.steps} />
        </div>


      </div>
    </article>
  );
}

function VisualLine({ items }) {
  return (
    <div className="visual-line">
      {items.map((item, index) => (
        <React.Fragment key={item}>
          <span>{item}</span>
          {index < items.length - 1 && <b>→</b>}
        </React.Fragment>
      ))}
    </div>
  );
}

function ComparisonPanel({ results }) {
  const leastChecks = results.reduce((best, item) => item.checks < best.checks ? item : best, results[0]);
  const fastestMeasured = results.reduce((best, item) => item.time < best.time ? item : best, results[0]);

  return (
    <section className="card comparison-panel">
      <div className="comparison-head">
        <div>
          <h2>Comparison Results</h2>
          <p>The app repeats each method many times and shows the average. Time can still vary by browser/device, so the number of checks is the most stable comparison.</p>
        </div>
        <div className="comparison-pills">
          <span className="pill">Least checks: {leastChecks.name}</span>
          <span className="pill subtle-pill">Measured fastest: {fastestMeasured.name}</span>
        </div>
      </div>

      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Method</th>
              <th>Average time / run</th>
              <th>Total benchmark time</th>
              <th>Repeated runs</th>
              <th>Checks / run</th>
              <th>Changes / run</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {results.map((item) => (
              <tr key={item.name} className={item.name === leastChecks.name ? "fastest-row" : ""}>
                <td>{item.name}</td>
                <td>{formatMs(item.time)}</td>
                <td>{formatMs(item.totalTime)}</td>
                <td>{item.runs.toLocaleString()}</td>
                <td>{item.checks.toLocaleString()}</td>
                <td>{item.changes.toLocaleString()}</td>
                <td>{item.note}{typeof item.foundPosition === "number" ? `, ${item.foundPosition === -1 ? "not found" : `found at position ${item.foundPosition + 1}`}` : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}


/* =========================
   Moving explanation visuals
========================= */

function MovingBubbleSort() {
  return (
    <div className="mini-visual">
      <div className="stage bubble-stage">
        <div className="bubble-item bubble-a"><span>80</span></div>
        <div className="bubble-item bubble-b"><span>30</span></div>
        <div className="bubble-item bubble-c"><span>60</span></div>
        <div className="bubble-item bubble-d"><span>95</span></div>
        <div className="stage-label left-label">Compare</div>
        <div className="stage-label right-label">Swap</div>
      </div>
      <p>Two neighboring bars are checked. If the taller one is before the shorter one, they swap.</p>
    </div>
  );
}

function MovingInsertionSort() {
  return (
    <div className="mini-visual">
      <div className="stage insertion-stage clear-insertion">
        <div className="insertion-title">Insertion Sort idea: take one new value and place it inside the ordered part</div>

        <div className="sorted-label">Already ordered part</div>
        <div className="new-label">New value</div>

        <div className="insert-row">
          <div className="insert-item ordered low">20</div>
          <div className="insert-item ordered shift-me">45</div>
          <div className="insert-gap">New place for 30</div>
          <div className="insert-item outside high">75</div>
        </div>

        <div className="picked-item">30</div>
        <div className="insert-arrow">30 moves left → 45 shifts right → 30 joins the ordered group</div>
      </div>
      <p>Insertion Sort takes the next value, shifts bigger ordered values to the right, then inserts the new value into the correct place.</p>
    </div>
  );
}

function MovingMergeSort() {
  return (
    <div className="mini-visual">
      <div className="stage merge-stage clean-merge">
        <div className="merge-title">Merge Sort idea: divide the list, order small groups, then merge them back</div>

        <div className="merge-clean-row original-row">
          <label>1. Mixed values</label>
          <div className="merge-clean-values">
            <span>70</span><span>20</span><span>90</span><span>40</span>
          </div>
        </div>

        <div className="merge-down-arrow arrow-one">↓</div>

        <div className="merge-clean-row groups-row">
          <label>2. Smaller ordered groups</label>
          <div className="merge-clean-groups">
            <div className="clean-group"><span>20</span><span>70</span></div>
            <div className="clean-group"><span>40</span><span>90</span></div>
          </div>
        </div>

        <div className="merge-down-arrow arrow-two">↓</div>

        <div className="merge-clean-row result-row">
          <label>3. Merge by choosing the smallest available value</label>
          <div className="merge-pick-order">
            <span>Pick 20</span>
            <span>Pick 40</span>
            <span>Pick 70</span>
            <span>Pick 90</span>
          </div>
          <div className="merge-clean-result">
            <span>20</span><span>40</span><span>70</span><span>90</span>
          </div>
        </div>
      </div>
      <p>Merge Sort splits the list into smaller ordered groups, then builds the final result from left to right by choosing the smallest available value.</p>
    </div>
  );
}

function MovingLinearSearch() {
  return (
    <div className="mini-visual">
      <div className="stage linear-search-stage">
        {[18, 42, 67, 25, 90, 51].map((value) => <span key={value}>{value}</span>)}
        <div className="search-window" />
      </div>
      <p>The search window moves one item at a time until it reaches the needed value.</p>
    </div>
  );
}

function MovingBinarySearch() {
  return (
    <div className="mini-visual">
      <div className="stage binary-clear-stage">
        <div className="binary-title">Fast Search idea: check the middle, then ignore half</div>

        <div className="binary-target">Target: 60</div>

        <div className="binary-values">
          <span className="bin-left b10">10</span>
          <span className="bin-left b20">20</span>
          <span className="bin-left b30">30</span>
          <span className="bin-mid-first b40">40</span>
          <span className="bin-right b50">50</span>
          <span className="bin-found b60">60</span>
          <span className="bin-right b70">70</span>
        </div>

        <div className="binary-check first-check">1. Check middle: 40</div>
        <div className="binary-remove">Target is bigger, ignore the left half</div>
        <div className="binary-check second-check">2. Check new middle: 60</div>
        <div className="binary-found-label">Found</div>
      </div>
      <p>Fast Search works only on ordered data. It checks the middle first, then removes half of the remaining values each step.</p>
    </div>
  );
}

function MovingGrowthComparison() {
  return (
    <div className="mini-visual growth-visual">
      <div className="growth-row"><label>One-by-one</label><span className="growth-fill linear-fill" /></div>
      <div className="growth-row"><label>Cut in half</label><span className="growth-fill log-fill" /></div>
      <div className="growth-row"><label>Pair-by-pair</label><span className="growth-fill square-fill" /></div>
      <div className="growth-row"><label>Divide + combine</label><span className="growth-fill merge-fill" /></div>
      <p>Effort grows at different speeds. The red bar becomes heavy very quickly.</p>
    </div>
  );
}

function MovingDirectAction() {
  return (
    <div className="mini-visual small-visual">
      <div className="direct-stage">
        <span className="start-dot">Start</span>
        <span className="target-dot">Target</span>
      </div>
      <p>Go directly to the needed item.</p>
    </div>
  );
}

function MovingLinearGrowth() {
  return (
    <div className="mini-visual small-visual">
      <div className="dot-stage">
        {[1,2,3,4,5,6,7].map((n) => <span key={n} />)}
      </div>
      <p>More items means more checks.</p>
    </div>
  );
}

function MovingQuadraticGrowth() {
  return (
    <div className="mini-visual small-visual">
      <div className="grid-stage">
        {Array.from({ length: 20 }, (_, i) => <span key={i} />)}
      </div>
      <p>Many pair checks make the work grow fast.</p>
    </div>
  );
}

function MovingHalvingGrowth() {
  return (
    <div className="mini-visual small-visual">
      <div className="half-stage">
        <span className="piece p1">All</span>
        <span className="piece p2">Half</span>
        <span className="piece p3">Less</span>
      </div>
      <p>Each decision removes half of the remaining work.</p>
    </div>
  );
}

function MovingDivideCombine() {
  return (
    <div className="mini-visual small-visual">
      <div className="divide-stage">
        <div className="divide-top"><span /><span /><span /><span /></div>
        <div className="divide-bottom"><span /><span /></div>
        <div className="divide-final"><span /></div>
      </div>
      <p>Divide work into groups, then combine the result.</p>
    </div>
  );
}

/* =========================
   Algorithm logic
========================= */

function getSortBenchmarkRepeats(size) {
  if (size <= 50) return 500;
  if (size <= 150) return 200;
  if (size <= 300) return 80;
  return 40;
}

function getSearchBenchmarkRepeats(size) {
  if (size <= 50) return 100000;
  if (size <= 150) return 60000;
  if (size <= 300) return 30000;
  return 15000;
}

function formatMs(value) {
  if (value < 0.001) return `${value.toFixed(6)} ms`;
  if (value < 1) return `${value.toFixed(4)} ms`;
  return `${value.toFixed(2)} ms`;
}


function generateKDs(kdCount, minItems, maxItems) {
  const itemNames = [
    "Valve", "Sensor", "Bracket", "Cable", "Cover", "Tube", "Screw", "Panel",
    "Motor", "Filter", "Board", "Connector", "Seal", "Holder", "Switch",
    "Pump", "Clamp", "Wheel", "Pin", "Adapter", "Plate", "Ring", "Cap",
    "Guide", "Handle", "Spring", "Bearing", "Block", "Frame", "Housing"
  ];

  return Array.from({ length: kdCount }, (_, kdIndex) => {
    const count = randomBetween(minItems, maxItems);
    const items = Array.from({ length: count }, (_, itemIndex) => {
      const randomCodeNumber = randomBetween(100, 999);
      const name = itemNames[(itemIndex + kdIndex * 3) % itemNames.length];

      return {
        code: `ITM-${randomCodeNumber}`,
        name: `${name} ${itemIndex + 1}`
      };
    });

    return {
      id: `KD-${String(kdIndex + 1).padStart(2, "0")}`,
      items
    };
  });
}

function calculateKDSimulation(kds, settings) {
  const results = kds.map((kd) => calculateSingleKD(kd, settings));
  const totalSortedSeconds = results.reduce((sum, result) => sum + result.sortedSeconds, 0);
  const totalUnsortedSeconds = results.reduce((sum, result) => sum + result.unsortedSeconds, 0);
  const totalSavedSeconds = totalUnsortedSeconds - totalSortedSeconds;
  const breakEvenItems = findKDBreakEven(settings);

  return {
    results,
    totalSortedSeconds,
    totalUnsortedSeconds,
    totalSavedSeconds,
    breakEvenItems
  };
}

function calculateSingleKD(kd, settings) {
  const itemCount = kd.items.length;
  const phases = [];
  const phaseCount = settings.phaseCount || 3;

  const entryOnce = itemCount * settings.entrySeconds;
  const unsortedSearchPerPhase = calculateUnsortedSearchSeconds(itemCount, settings.unsortedCheckSeconds);
  const sortedSearchPerPhase = calculateSortedSearchSeconds(itemCount, settings.sortedSearchSeconds);
  const sortingSeconds = settings.sortedCollectionMode === "while"
    ? 0
    : calculateSortingSeconds(itemCount, settings.sortSecondsPerItemLog);

  let sortedSeconds = 0;
  let unsortedSeconds = 0;

  for (let phase = 1; phase <= phaseCount; phase++) {
    let unsortedPhaseSeconds = 0;
    let sortedPhaseSeconds = 0;
    let note = "";

    if (phase === 1) {
      // Phase 1 is the collection/manufacturing entry phase.
      // Unsorted KD only pays entry time.
      // Sorted KD pays entry time + sorting time only if the selected mode is "Sort after collecting".
      unsortedPhaseSeconds = entryOnce;
      sortedPhaseSeconds = entryOnce + sortingSeconds;

      note = settings.sortedCollectionMode === "after"
        ? "Manufacturing entry; sorted KD also pays sorting cost after collection"
        : "Manufacturing entry only; items are placed directly in sorted position";
    } else {
      // Phase 2 and Phase 3 are search/extraction phases.
      // After each found item, it is removed from the collection.
      unsortedPhaseSeconds = unsortedSearchPerPhase;
      sortedPhaseSeconds = sortedSearchPerPhase;
      note = "Search only; each found item is removed from the collection";
    }

    unsortedSeconds += unsortedPhaseSeconds;
    sortedSeconds += sortedPhaseSeconds;

    phases.push({
      phase,
      unsortedSeconds: unsortedPhaseSeconds,
      sortedSeconds: sortedPhaseSeconds,
      note
    });
  }

  return {
    kd,
    itemCount,
    sortedSeconds,
    unsortedSeconds,
    savedSeconds: unsortedSeconds - sortedSeconds,
    phases
  };
}

function calculateUnsortedSearchSeconds(itemCount, checkSeconds) {
  // Items are searched one by one, and each found item is removed.
  // Remaining collection size goes from N down to 1.
  let totalAverageChecks = 0;

  for (let remainingItems = itemCount; remainingItems >= 1; remainingItems--) {
    totalAverageChecks += (remainingItems + 1) / 2;
  }

  return totalAverageChecks * checkSeconds;
}

function calculateSortedSearchSeconds(itemCount, sortedSearchSeconds) {
  // Sorted search is treated as O(1): fixed small time per item.
  // Each found item is also removed, but access remains constant-time.
  return itemCount * sortedSearchSeconds;
}

function calculateSortingSeconds(itemCount, secondsPerItemLog) {
  if (itemCount <= 1) return 0;
  return itemCount * Math.log2(itemCount) * secondsPerItemLog;
}

function findKDBreakEven(settings) {
  for (let itemCount = 1; itemCount <= 100; itemCount++) {
    const kd = {
      id: "TEST",
      items: Array.from({ length: itemCount }, (_, index) => ({
        code: `ITM-${index}`,
        name: `Item ${index}`
      }))
    };

    const result = calculateSingleKD(kd, settings);
    if (result.savedSeconds > 0) {
      return itemCount;
    }
  }
  return null;
}

function formatDuration(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${remainingSeconds}s`;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function formatDurationShort(totalSeconds) {
  const seconds = Math.round(totalSeconds);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) return `${minutes}m ${remainingSeconds}s`;
  return `${remainingSeconds}s`;
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}


function bubbleSortBenchmark(input) {
  const arr = [...input];
  let checks = 0;
  let changes = 0;

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      checks++;
      if (arr[j] > arr[j + 1]) {
        const temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
        changes++;
      }
    }
  }

  return { checks, changes };
}

function insertionSortBenchmark(input) {
  const arr = [...input];
  let checks = 0;
  let changes = 0;

  for (let i = 1; i < arr.length; i++) {
    const selectedValue = arr[i];
    let j = i - 1;

    while (j >= 0) {
      checks++;
      if (arr[j] > selectedValue) {
        arr[j + 1] = arr[j];
        changes++;
        j--;
      } else {
        break;
      }
    }

    arr[j + 1] = selectedValue;
    changes++;
  }

  return { checks, changes };
}

function mergeSortBenchmark(input) {
  const arr = [...input];
  const helper = new Array(arr.length);
  let checks = 0;
  let changes = 0;

  function mergeSort(left, right) {
    if (left >= right) return;

    const middle = Math.floor((left + right) / 2);
    mergeSort(left, middle);
    mergeSort(middle + 1, right);
    merge(left, middle, right);
  }

  function merge(left, middle, right) {
    let i = left;
    let j = middle + 1;
    let k = left;

    while (i <= middle && j <= right) {
      checks++;
      if (arr[i] <= arr[j]) {
        helper[k] = arr[i];
        i++;
      } else {
        helper[k] = arr[j];
        j++;
      }
      k++;
    }

    while (i <= middle) {
      helper[k] = arr[i];
      i++;
      k++;
    }

    while (j <= right) {
      helper[k] = arr[j];
      j++;
      k++;
    }

    for (let index = left; index <= right; index++) {
      arr[index] = helper[index];
      changes++;
    }
  }

  mergeSort(0, arr.length - 1);
  return { checks, changes };
}

function linearSearchBenchmark(arr, target) {
  let checks = 0;

  for (let i = 0; i < arr.length; i++) {
    checks++;
    if (arr[i] === target) {
      return { checks, foundPosition: i };
    }
  }

  return { checks, foundPosition: -1 };
}

function binarySearchBenchmark(arr, target) {
  let checks = 0;
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    checks++;

    if (arr[middle] === target) {
      return { checks, foundPosition: middle };
    }

    if (arr[middle] < target) {
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return { checks, foundPosition: -1 };
}

function makeArray(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 95) + 5);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLabel(value) {
  return {
    bubble: "Bubble Sort",
    insertion: "Insertion Sort",
    merge: "Merge Sort",
    linear: "Simple Search",
    binary: "Fast Search"
  }[value] || value;
}

function range(start, end) {
  if (end < start) return [];
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function bubbleSortSteps(input) {
  const arr = [...input];
  const steps = [];
  let checks = 0;
  let changes = 0;

  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      checks++;
      steps.push({ array: [...arr], active: [j, j + 1], text: `Checking two neighboring bars: ${arr[j]} and ${arr[j + 1]}.` });

      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
        changes++;
        steps.push({ array: [...arr], active: [j, j + 1], text: "They were in the wrong order, so they were swapped." });
      }
    }
  }

  steps.push({ array: [...arr], active: arr.map((_, i) => i), text: "Bubble Sort finished." });
  return { finalArray: arr, steps, checks, changes };
}

function insertionSortSteps(input) {
  const arr = [...input];
  const steps = [];
  let checks = 0;
  let changes = 0;

  for (let i = 1; i < arr.length; i++) {
    const selectedValue = arr[i];
    let j = i - 1;

    steps.push({ array: [...arr], active: [i], text: `Taking ${selectedValue} and placing it where it belongs.` });

    while (j >= 0) {
      checks++;
      steps.push({ array: [...arr], active: [j, j + 1], text: `Checking if ${selectedValue} should move before ${arr[j]}.` });

      if (arr[j] > selectedValue) {
        arr[j + 1] = arr[j];
        changes++;
        steps.push({ array: [...arr], active: [j, j + 1], text: "Moving a bigger value to the right to make space." });
        j--;
      } else {
        break;
      }
    }

    arr[j + 1] = selectedValue;
    changes++;
    steps.push({ array: [...arr], active: [j + 1], text: `${selectedValue} was placed in the correct position.` });
  }

  steps.push({ array: [...arr], active: arr.map((_, i) => i), text: "Insertion Sort finished." });
  return { finalArray: arr, steps, checks, changes };
}

function mergeSortSteps(input) {
  const arr = [...input];
  const steps = [];
  let checks = 0;
  let changes = 0;

  function mergeSort(left, right) {
    if (left >= right) return;
    const middle = Math.floor((left + right) / 2);

    steps.push({ array: [...arr], active: range(left, right), text: "Dividing the list into smaller groups." });

    mergeSort(left, middle);
    mergeSort(middle + 1, right);
    merge(left, middle, right);
  }

  function merge(left, middle, right) {
    const leftPart = arr.slice(left, middle + 1);
    const rightPart = arr.slice(middle + 1, right + 1);

    let i = 0;
    let j = 0;
    let k = left;

    while (i < leftPart.length && j < rightPart.length) {
      checks++;
      steps.push({ array: [...arr], active: [k], text: `Choosing the smaller value between ${leftPart[i]} and ${rightPart[j]}.` });

      if (leftPart[i] <= rightPart[j]) {
        arr[k] = leftPart[i];
        i++;
      } else {
        arr[k] = rightPart[j];
        j++;
      }

      changes++;
      steps.push({ array: [...arr], active: [k], text: "Putting the smaller value back into the main list." });
      k++;
    }

    while (i < leftPart.length) {
      arr[k] = leftPart[i];
      i++;
      changes++;
      steps.push({ array: [...arr], active: [k], text: "Adding a remaining value from the left group." });
      k++;
    }

    while (j < rightPart.length) {
      arr[k] = rightPart[j];
      j++;
      changes++;
      steps.push({ array: [...arr], active: [k], text: "Adding a remaining value from the right group." });
      k++;
    }
  }

  mergeSort(0, arr.length - 1);
  steps.push({ array: [...arr], active: arr.map((_, i) => i), text: "Merge Sort finished." });
  return { finalArray: arr, steps, checks, changes };
}

function linearSearchSteps(arr, target) {
  const steps = [];
  let checks = 0;
  let foundPosition = -1;

  for (let i = 0; i < arr.length; i++) {
    checks++;
    steps.push({ active: [i], text: `Checking position ${i + 1}: is ${arr[i]} equal to ${target}?` });

    if (arr[i] === target) {
      foundPosition = i;
      steps.push({ active: [i], foundPosition: i, text: `Found ${target} at position ${i + 1}.` });
      break;
    }
  }

  if (foundPosition === -1) {
    steps.push({ active: [], foundPosition: -1, text: `${target} was not found.` });
  }

  return { steps, checks, changes: 0, foundPosition };
}

function binarySearchSteps(arr, target) {
  const steps = [];
  let checks = 0;
  let foundPosition = -1;
  let left = 0;
  let right = arr.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    checks++;

    steps.push({ active: [left, middle, right], text: `Checking the middle value: ${arr[middle]}.` });

    if (arr[middle] === target) {
      foundPosition = middle;
      steps.push({ active: [middle], foundPosition: middle, text: `Found ${target} at position ${middle + 1}.` });
      break;
    }

    if (arr[middle] < target) {
      left = middle + 1;
      steps.push({ active: range(left, right), text: `${arr[middle]} is smaller than ${target}, so the lower half is ignored.` });
    } else {
      right = middle - 1;
      steps.push({ active: range(left, right), text: `${arr[middle]} is bigger than ${target}, so the upper half is ignored.` });
    }
  }

  if (foundPosition === -1) {
    steps.push({ active: [], foundPosition: -1, text: `${target} was not found.` });
  }

  return { steps, checks, changes: 0, foundPosition };
}
