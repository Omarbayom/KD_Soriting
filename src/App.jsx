import React, { useEffect, useMemo, useRef, useState } from "react";

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
  const [mergeView, setMergeView] = useState(null);
  const [target, setTarget] = useState(50);
  const [message, setMessage] = useState("Choose what you want to demonstrate, then press Start.");
  const [stats, setStats] = useState({ checks: 0, changes: 0, steps: 0, time: 0 });
  const [comparisonResults, setComparisonResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const runningRef = useRef(false);
  const delayRef = useRef(220);
  const finishRequestedRef = useRef(false);
  const finishWaitResolverRef = useRef(null);

  const maxValue = useMemo(() => Math.max(...array, 1), [array]);

  function generate(count = barCount) {
    if (runningRef.current) return;
    const next = makeArray(count);
    setArray(next);
    setActive([]);
    setFound(null);
    setMergeView(null);
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
    finishRequestedRef.current = false;
    setIsRunning(true);
    setActive([]);
    setFound(null);
    setMergeView(null);
    setStats({ checks: 0, changes: 0, steps: 0, time: 0 });

    const startTime = performance.now();
    let result;

    try {
      if (mode === "sort") {
        if (sortAlgo === "bubble") result = bubbleSortSteps([...array]);
        if (sortAlgo === "insertion") result = insertionSortSteps([...array]);
        if (sortAlgo === "merge") result = mergeSortSteps([...array]);

        await playSteps(result.steps, true);
        setArray(result.finalArray);
        setActive(result.finalArray.map((_, position) => position));
        setMergeView(
          sortAlgo === "merge"
            ? { type: "complete", merged: result.finalArray.map((_, position) => position) }
            : null
        );
        setMessage(
          finishRequestedRef.current
            ? `${getLabel(sortAlgo)} finished instantly. Final ordered result is now shown.`
            : `${getLabel(sortAlgo)} finished. The bars are now ordered from shortest to tallest.`
        );
      } else {
        setMergeView(null);
        let workArray = [...array];

        if (searchAlgo === "binary") {
          workArray = [...array].sort((a, b) => a - b);
          setArray(workArray);
          setMessage("Fast Search needs the bars ordered first, so the app ordered them automatically.");
          await waitForAnimationStep(Math.max(250, delayRef.current));
        }

        if (searchAlgo === "linear") result = linearSearchSteps(workArray, Number(target));
        if (searchAlgo === "binary") result = binarySearchSteps(workArray, Number(target));

        await playSteps(result.steps, false);
        setFound(result.foundPosition);
        setActive([]);
        setMessage(
          result.foundPosition === -1
            ? `${target} was not found.`
            : `${target} was found at position ${result.foundPosition + 1}.`
        );
      }

      const endTime = performance.now();

      setStats({
        checks: result.checks,
        changes: result.changes || 0,
        steps: result.steps.length,
        time: endTime - startTime
      });
    } finally {
      runningRef.current = false;
      finishRequestedRef.current = false;
      finishWaitResolverRef.current = null;
      setIsRunning(false);
    }
  }

  async function playSteps(steps, isSort) {
    for (const step of steps) {
      if (finishRequestedRef.current) break;
      if (isSort && step.array) setArray(step.array);
      setActive(step.active || []);
      setMergeView(step.mergeView || null);
      if (typeof step.foundPosition === "number") setFound(step.foundPosition);
      setMessage(step.text || "Running...");
      await waitForAnimationStep(delayRef.current);
      if (finishRequestedRef.current) break;
    }
  }

  function waitForAnimationStep(ms) {
    if (finishRequestedRef.current) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (finishWaitResolverRef.current === finish) {
          finishWaitResolverRef.current = null;
        }
        resolve();
      };

      const timer = setTimeout(finish, ms);
      finishWaitResolverRef.current = finish;
    });
  }

  function finishCurrentDemo() {
    if (!runningRef.current) {
      setMessage("No demo is currently running. Press Start Demo first.");
      return;
    }

    finishRequestedRef.current = true;
    setMessage("Finishing the current demo and showing the final result...");

    if (finishWaitResolverRef.current) {
      finishWaitResolverRef.current();
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
      setMergeView(null);
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
    setMergeView(null);
    setFound(results[1].foundPosition);
  }

  function sortInstantly() {
    if (runningRef.current) return;
    const sorted = [...array].sort((a, b) => a - b);
    setArray(sorted);
    setActive(sorted.map((_, position) => position));
    setMergeView(null);
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
              <button className="primary" onClick={start} disabled={isRunning}>{isRunning ? "Running..." : "Start Demo"}</button>
              <button onClick={() => generate()} disabled={isRunning}>New Bars</button>
              <button className="warning full" onClick={finishCurrentDemo}>Finish Current Demo</button>
              <button className="success full" onClick={sortInstantly} disabled={isRunning}>Order Bars Instantly</button>
              <button className="compare-button full" onClick={runComparison} disabled={isRunning}>{mode === "sort" ? "Compare All Sorts" : "Compare Search Methods"}</button>
            </div>
          </aside>

          <section className="main-panel">
            <div className="card">
              <div className="visual-header">
                <div>
                  <h2>Live Visualization</h2>
                  <p>Blue = normal bar, yellow = being checked, green = found or finished. In Merge Sort, L and R show the two pointers and “Put” shows the selected value being written.</p>
                </div>
                <span className="pill">{mode === "sort" ? getLabel(sortAlgo) : getLabel(searchAlgo)}</span>
              </div>

              {mode === "sort" && sortAlgo === "merge" && mergeView && (
                <div className="merge-status-panel">
                  {typeof mergeView.leftPointerValue === "number" && (
                    <span><b>L pointer</b> {mergeView.leftPointerValue}</span>
                  )}
                  {typeof mergeView.rightPointerValue === "number" && (
                    <span><b>R pointer</b> {mergeView.rightPointerValue}</span>
                  )}
                  {typeof mergeView.selectedValue === "number" && (
                    <span className="selected"><b>Selected to put</b> {mergeView.selectedValue}</span>
                  )}
                  {typeof mergeView.writeIndex === "number" && (
                    <span><b>Write position</b> {mergeView.writeIndex + 1}</span>
                  )}
                  {typeof mergeView.displacedValue === "number" && mergeView.displacedValue !== mergeView.selectedValue && (
                    <span className="displaced"><b>Old value at that place</b> {mergeView.displacedValue}</span>
                  )}
                </div>
              )}

              {mode === "sort" && sortAlgo === "merge" && array.length <= 45 && (
                <div className="merge-temp-visual">
                  <div className="merge-temp-group left-temp">
                    <strong>Copied Left group</strong>
                    <div className="merge-temp-values">
                      {(mergeView?.leftTemp || []).map((value, tempIndex) => {
                        const isPointer = mergeView?.leftTempIndex === tempIndex;
                        const isSelected = mergeView?.selectedSide === "left" && mergeView?.selectedTempIndex === tempIndex;
                        const isDisplaced = mergeView?.displacedTempSide === "left" && mergeView?.displacedTempIndex === tempIndex;

                        return (
                          <span key={`left-temp-${tempIndex}`} className={[
                            "merge-temp-chip",
                            isPointer ? "pointer" : "",
                            isSelected ? "selected" : "",
                            isDisplaced ? "displaced" : ""
                          ].filter(Boolean).join(" ")}>
                            {isPointer && <em>L</em>}
                            {value}
                            {isDisplaced && !isSelected && <small>still here</small>}
                          </span>
                        );
                      })}
                      {(mergeView?.leftTemp || []).length === 0 && (
                        <span className="merge-temp-empty">Empty for now</span>
                      )}
                    </div>
                  </div>

                  <div className="merge-temp-group right-temp">
                    <strong>Copied Right group</strong>
                    <div className="merge-temp-values">
                      {(mergeView?.rightTemp || []).map((value, tempIndex) => {
                        const isPointer = mergeView?.rightTempIndex === tempIndex;
                        const isSelected = mergeView?.selectedSide === "right" && mergeView?.selectedTempIndex === tempIndex;
                        const isDisplaced = mergeView?.displacedTempSide === "right" && mergeView?.displacedTempIndex === tempIndex;

                        return (
                          <span key={`right-temp-${tempIndex}`} className={[
                            "merge-temp-chip",
                            isPointer ? "pointer" : "",
                            isSelected ? "selected" : "",
                            isDisplaced ? "displaced" : ""
                          ].filter(Boolean).join(" ")}>
                            {isPointer && <em>R</em>}
                            {value}
                            {isDisplaced && !isSelected && <small>still here</small>}
                          </span>
                        );
                      })}
                      {(mergeView?.rightTemp || []).length === 0 && (
                        <span className="merge-temp-empty">Empty for now</span>
                      )}
                    </div>
                  </div>

                  <p className={typeof mergeView?.displacedValue === "number" && mergeView.displacedValue !== mergeView.selectedValue ? "" : "merge-temp-note"}>
                    {typeof mergeView?.displacedValue === "number" && mergeView.displacedValue !== mergeView.selectedValue ? (
                      <>Before putting <b>{mergeView.selectedValue}</b>, this bar position contained <b>{mergeView.displacedValue}</b>. It is not lost; it is still waiting in the copied {mergeView.displacedTempSide === "left" ? "left" : "right"} group above.</>
                    ) : (
                      <>The copied left/right groups stay visible here. When a merge step starts, the values will appear here even before they are written back to the bars.</>
                    )}
                  </p>
                </div>
              )}

              {mode === "sort" && sortAlgo === "merge" && mergeView && array.length <= 45 && typeof mergeView?.selectedValue === "number" && (
                <div className="merge-action-row">
                  <span className="merge-action-chip pick-action">
                    Pick <b>{mergeView.selectedValue}</b> from {mergeView.selectedSide === "left" ? "left copy" : "right copy"}
                  </span>
                  <span className="merge-action-arrow">→</span>
                  <span className="merge-action-chip put-action">
                    Put into position <b>{typeof mergeView.writeIndex === "number" ? mergeView.writeIndex + 1 : "-"}</b>
                  </span>
                  {typeof mergeView.displacedValue === "number" && mergeView.displacedValue !== mergeView.selectedValue && (
                    <span className="merge-action-chip safe-action">
                      Old <b>{mergeView.displacedValue}</b> is safe in the copied {mergeView.displacedTempSide === "left" ? "left" : "right"} group
                    </span>
                  )}
                </div>
              )}

              <div className={`bars ${mode === "sort" && sortAlgo === "merge" && array.length <= 45 ? "merge-bars" : ""}`}>
                {array.map((value, position) => {
                  const isActive = active.includes(position);
                  const isFound = found === position;
                  const isMergeLeft = mergeView?.leftGroup?.includes(position);
                  const isMergeRight = mergeView?.rightGroup?.includes(position);
                  const isMergeRange = mergeView?.range?.includes(position);
                  const isMergeWrite = mergeView?.writeIndex === position;
                  const isMergeLeftPointer = mergeView?.leftPointer === position;
                  const isMergeRightPointer = mergeView?.rightPointer === position;
                  const isMergeSelected = mergeView?.selectedIndex === position;
                  const isMerged = mergeView?.merged?.includes(position);
                  const shouldShowMergeBadges = sortAlgo === "merge" && mode === "sort" && mergeView && array.length <= 45;
                  const shouldShowValueLabels = array.length <= 25;
                  const maxBarHeight = shouldShowMergeBadges ? 270 : 300;
                  const height = Math.max(20, (value / maxValue) * maxBarHeight);

                  const barClass = [
                    "bar",
                    isFound ? "found" : "",
                    isActive ? "active" : "",
                    isMergeRange ? "merge-range" : "",
                    isMergeLeft ? "merge-left" : "",
                    isMergeRight ? "merge-right" : "",
                    isMergeLeftPointer ? "merge-left-pointer" : "",
                    isMergeRightPointer ? "merge-right-pointer" : "",
                    isMergeSelected ? "merge-selected" : "",
                    isMergeWrite ? "merge-write" : "",
                    isMerged ? "merge-done" : ""
                  ].filter(Boolean).join(" ");

                  const columnClass = [
                    "bar-column",
                    isMergeSelected ? "merge-selected-column" : "",
                    isMergeWrite ? "merge-write-column" : ""
                  ].filter(Boolean).join(" ");

                  const numberClass = "bar-number";

                  return (
                    <div className={columnClass} key={position} style={{ "--bar-height": `${height}px` }}>
                      {shouldShowMergeBadges && (isMergeLeftPointer || isMergeRightPointer) && (
                        <div className="merge-pointer-badges">
                          {isMergeLeftPointer && <span className="merge-pointer-label left-pointer">L</span>}
                          {isMergeRightPointer && <span className="merge-pointer-label right-pointer">R</span>}
                        </div>
                      )}
                      <div
                        className={barClass}
                        style={{ height }}
                        title={`Position ${position + 1}: ${value}`}
                      />
                      {shouldShowValueLabels && <span className={numberClass}>{value}</span>}
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







function KDJourneySimulation({
  selectedKd,
  inventorySecondsPerItem,
  sortedInventoryTotalSeconds,
  sortedPhase1TotalSeconds,
  sortedOperationSeconds,
  unsortedCheckSeconds
}) {
  const [approach, setApproach] = useState("sortedInventory");
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const journeys = useMemo(() => buildKDJourney(selectedKd, {
    inventorySecondsPerItem: Number(inventorySecondsPerItem),
    sortedInventoryTotalSeconds: Number(sortedInventoryTotalSeconds),
    sortedPhase1TotalSeconds: Number(sortedPhase1TotalSeconds),
    sortedOperationSeconds: Number(sortedOperationSeconds),
    unsortedCheckSeconds: Number(unsortedCheckSeconds)
  }), [
    selectedKd,
    inventorySecondsPerItem,
    sortedInventoryTotalSeconds,
    sortedPhase1TotalSeconds,
    sortedOperationSeconds,
    unsortedCheckSeconds
  ]);

  const currentJourney = journeys[approach] || journeys.sortedInventory;
  const currentStep = currentJourney.steps[stepIndex] || currentJourney.steps[0];
  const progress = currentJourney.steps.length <= 1
    ? 100
    : (stepIndex / (currentJourney.steps.length - 1)) * 100;

  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [approach, selectedKd?.id]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    const stepDelay = currentStep?.holdMs || 850;

    const timer = setTimeout(() => {
      setStepIndex((previous) => {
        if (previous >= currentJourney.steps.length - 1) {
          setIsPlaying(false);
          return previous;
        }
        return previous + 1;
      });
    }, stepDelay);

    return () => clearTimeout(timer);
  }, [isPlaying, stepIndex, currentJourney.steps.length, currentStep?.holdMs]);

  function changeApproach(nextApproach) {
    setApproach(nextApproach);
  }

  function previousStep() {
    setIsPlaying(false);
    setStepIndex((previous) => Math.max(0, previous - 1));
  }

  function nextStep() {
    setIsPlaying(false);
    setStepIndex((previous) => Math.min(currentJourney.steps.length - 1, previous + 1));
  }

  function restartJourney() {
    setStepIndex(0);
    setIsPlaying(false);
  }

  const visibleAreas = getJourneyVisibleAreas(currentStep);
  const journeyAreas = [
    {
      key: "source",
      node: (
        <JourneyBox
          title="Inventory / waiting"
          subtitle={currentStep.sourceSubtitle || "Items before KD"}
          items={currentStep.sourceItems}
          emptyText="Nothing waiting"
          activeKey={currentStep.activeItem?.uid || currentStep.activeItem?.code}
          tone="source"
          scanActive={currentStep.scanSource}
        />
      )
    },
    {
      key: "search",
      node: (
        <JourneyBox
          title="Inspection area"
          subtitle={currentStep.searchSubtitle}
          items={currentStep.searchItems}
          emptyText="No active inspection"
          activeKey={currentStep.activeItem?.uid || currentStep.activeItem?.code}
          tone="search"
          scanActive={currentStep.scanSearch || currentStep.searchingOnly}
        />
      )
    },
    {
      key: "kd",
      node: (
        <JourneyBox
          title="KD box"
          subtitle={currentStep.kdSubtitle || "Current KD content"}
          items={currentStep.kdItems}
          emptyText="KD box is empty"
          activeKey={currentStep.activeItem?.uid || currentStep.activeItem?.code}
          tone="kd"
          scanActive={currentStep.scanKd || currentStep.searchingOnly}
        />
      )
    },
    {
      key: "device",
      node: (
        <JourneyBox
          title="Assembly output"
          subtitle={currentStep.deviceSubtitle || "Assembled device content"}
          items={currentStep.deviceItems || []}
          emptyText="No item assembled yet"
          activeKey={currentStep.activeItem?.uid || currentStep.activeItem?.code}
          tone="device"
        />
      )
    }
  ].filter((area) => visibleAreas.includes(area.key));

  return (
    <section className="card kd-journey-card">
      <div className="kd-section-head">
        <div>
          <h3>KD journey from start to end</h3>
          <p>One 17-item KD and three approaches: sorted in Inventory/Prep, sorted in Phase 1, and unsorted from start to end.</p>
        </div>
        <span className="pill">{currentJourney.totalLabel}</span>
      </div>

      <div className="journey-approach-grid">
        {Object.values(journeys).map((journey) => (
          <button
            key={journey.key}
            className={approach === journey.key ? "journey-approach active" : "journey-approach"}
            onClick={() => changeApproach(journey.key)}
          >
            <b>{journey.title}</b>
            <span>{journey.short}</span>
            <strong>{formatDuration(journey.totalSeconds)}</strong>
          </button>
        ))}
      </div>

      <div className="journey-controls-row">
        <button onClick={restartJourney}>Restart</button>
        <button onClick={previousStep}>Previous</button>
        <button className="primary" onClick={() => setIsPlaying((playing) => !playing)}>
          {isPlaying ? "Pause journey" : "Play journey"}
        </button>
        <button onClick={nextStep}>Next</button>
        <span>Step {stepIndex + 1} / {currentJourney.steps.length}</span>
      </div>

      <div className="journey-progress-bar">
        <span style={{ width: `${progress}%` }} />
      </div>

      <div className="journey-step-card">
        <div>
          <small>{currentStep.phase}</small>
          <h4>{currentStep.title}</h4>
          <p>{currentStep.description}</p>
        </div>
        <div className="journey-time-box">
          <span>Step time</span>
          <b>{formatDurationShort(currentStep.timeAdded)}</b>
          <span>Cumulative</span>
          <b>{formatDuration(currentStep.cumulativeSeconds)}</b>
        </div>
      </div>

      <div className="journey-stage compact-phase-stage">
        {journeyAreas.map((area, index) => (
          <React.Fragment key={area.key}>
            {area.node}
            {index < journeyAreas.length - 1 && (
              <JourneyArrow
                label={getJourneyArrowLabel(currentStep, area.key, journeyAreas[index + 1].key)}
                icon={getJourneyArrowIcon(currentStep, area.key, journeyAreas[index + 1].key)}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      <div className="journey-note-grid">
        <div>
          <b>Inventory</b>
          <span>Unsorted inventory uses {inventorySecondsPerItem}s per item. The two sorted approaches use the measured totals you gave.</span>
        </div>
        <div>
          <b>Inspection</b>
          <span>Sorted approaches use {sortedOperationSeconds}s per item. Unsorted uses {unsortedCheckSeconds}s per check with the remaining quantity decreasing by 1 after each found item.</span>
        </div>
        <div>
          <b>Assembly</b>
          <span>Sorted approaches use {sortedOperationSeconds}s per item. Unsorted repeats the same decreasing-check rule.</span>
        </div>
      </div>
    </section>
  );
}

function JourneyArrow({ icon, label }) {
  return (
    <div className="journey-arrow-column">
      <span>{icon}</span>
      <b>{label}</b>
    </div>
  );
}

function getJourneyVisibleAreas(step) {
  const phase = step?.phase || "";

  if (phase.includes("Start")) return ["source", "kd"];
  if (phase.includes("Inventory")) return ["source", "kd"];
  if (phase.includes("Inspection")) return ["search", "kd"];
  if (phase.includes("Assembly")) return ["kd", "device"];
  if (phase.includes("End")) return ["device"];

  return ["source", "kd"];
}

function getJourneyArrowLabel(step, from, to) {
  if (step.searchingOnly) return step.searchLabel || "Searching...";
  if (from === "source" && to === "kd") return step.moveLabel || "Out → KD";
  if (from === "search" && to === "kd") return step.resultLabel || "Found → KD";
  if (from === "kd" && to === "device") return step.deviceLabel || "KD → Device";
  return step.resultLabel || step.moveLabel || "Move";
}

function getJourneyArrowIcon(step, from, to) {
  if (step.searchingOnly) return "🔍";
  if (from === "kd" && to === "device") return step.deviceIcon || "➡️";
  return step.icon || "→";
}

function JourneyBox({ title, subtitle, items, emptyText, activeKey, tone, scanActive = false }) {
  const hasSearchPath = scanActive && items.some((item) => ["checked", "found"].includes(item.journeyStatus));

  return (
    <div className={`journey-box ${tone}${hasSearchPath ? " scan-active" : ""}`}>
      <div className="journey-box-head">
        <b>{title}</b>
        <span>{subtitle}</span>
      </div>
      <div className="journey-item-grid">
        {items.length === 0 ? (
          <em>{emptyText}</em>
        ) : (
          items.map((item, index) => {
            const itemKey = item.uid || `${item.code}-${item.name || "item"}-${index}`;
            const statusClass = item.journeyStatus ? ` ${item.journeyStatus}` : "";
            const activeClass = activeKey === itemKey ? " active" : "";

            return (
              <span
                key={`${itemKey}-${item.journeyStatus || "normal"}-${index}`}
                className={`journey-item${statusClass}${activeClass}`}
                title={item.name || item.code}
                style={{ "--scan-order": index, "--scan-total": items.length }}
              >
                {item.code}
                {item.journeyTag && <small>{item.journeyTag}</small>}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
}

function tagJourneyItem(item, journeyStatus, journeyTag) {
  return {
    ...item,
    journeyStatus,
    journeyTag
  };
}

function getSlowUnsortedTargetIndex(remainingItems, iterationIndex = 0) {
  if (remainingItems <= 1) return 0;

  // This fixed pattern makes the unsorted demo visibly search through several items.
  // It avoids the wrong visual where the target is always the first chip.
  const slowSearchPattern = [5, 4, 6, 3, 7, 2, 8, 1, 9, 0];
  const preferredIndex = slowSearchPattern[iterationIndex % slowSearchPattern.length];

  return Math.min(remainingItems - 1, preferredIndex);
}

function removeItemAtIndex(items, removeIndex) {
  return items.filter((_, index) => index !== removeIndex);
}

function getSearchPreviewItems(targetItem, poolItems, isSortedApproach) {
  if (!targetItem) return poolItems;

  const targetKey = targetItem.uid || targetItem.code;
  const targetIndex = Math.max(0, poolItems.findIndex((item) => (item.uid || item.code) === targetKey));

  if (isSortedApproach) {
    const otherItems = poolItems.filter((item) => (item.uid || item.code) !== targetKey);
    const quickChecks = otherItems.slice(0, Math.min(2, otherItems.length));
    const waitingAfterFound = otherItems.slice(quickChecks.length, quickChecks.length + 4);

    return [
      ...quickChecks.map((item) => tagJourneyItem(item, "checked", "quick check")),
      tagJourneyItem(targetItem, "found", "FOUND"),
      ...waitingAfterFound.map((item) => tagJourneyItem(item, "waiting", "not needed"))
    ];
  }

  const missedBeforeFound = poolItems.slice(0, targetIndex);
  const waitingAfterFound = poolItems.slice(targetIndex + 1, targetIndex + 5);

  return [
    ...missedBeforeFound.map((item) => tagJourneyItem(item, "checked", "no match")),
    tagJourneyItem(targetItem, "found", "FOUND"),
    ...waitingAfterFound.map((item) => tagJourneyItem(item, "waiting", "waiting"))
  ];
}

function getJourneyScanHoldMs(checksNeeded = 1) {
  // The visual hover reaches one chip after another. Keep auto-play on the
  // search step long enough so the KD/device insertion cannot happen before
  // the FOUND highlight appears.
  const safeChecks = Math.max(1, Number(checksNeeded) || 1);
  return Math.min(6200, 1700 + safeChecks * 480);
}

function getUnsortedDecreasingChecks(itemCount) {
  return (itemCount * (itemCount + 1)) / 2;
}

function getScaledMeasuredSeconds(baseSeconds, itemCount, baseItemCount = 17) {
  if (itemCount === baseItemCount) return baseSeconds;
  return (baseSeconds * itemCount) / baseItemCount;
}

function getKDApproachTotals(itemCount, settings) {
  const inventoryPrepSeconds = itemCount * settings.inventorySecondsPerItem;

  // These measured values are INSPECTION times, not Inventory / Prep times.
  const sortedInventoryInspectionSeconds = getScaledMeasuredSeconds(
    settings.sortedInventoryTotalSeconds,
    itemCount
  );

  const sortedPhase1InspectionSeconds = getScaledMeasuredSeconds(
    settings.sortedPhase1TotalSeconds,
    itemCount
  );

  const sortedAssemblySeconds = itemCount * settings.sortedOperationSeconds;

  const unsortedInventorySeconds = inventoryPrepSeconds;
  const unsortedCheckCount = getUnsortedDecreasingChecks(itemCount);
  const unsortedInspectionSeconds = unsortedCheckCount * settings.unsortedCheckSeconds;
  const unsortedAssemblySeconds = unsortedCheckCount * settings.unsortedCheckSeconds;

  return {
    inventoryPrepSeconds,

    // Keep these names because other parts of your app already use them.
    sortedInventoryPrepSeconds: inventoryPrepSeconds,
    sortedPhase1InventorySeconds: inventoryPrepSeconds,

    sortedInventoryInspectionSeconds,
    sortedPhase1InspectionSeconds,
    sortedAssemblySeconds,

    unsortedInventorySeconds,
    unsortedInspectionSeconds,
    unsortedAssemblySeconds,
    unsortedCheckCount,

    sortedInventoryTotal:
      inventoryPrepSeconds + sortedInventoryInspectionSeconds + sortedAssemblySeconds,

    sortedPhase1Total:
      inventoryPrepSeconds + sortedPhase1InspectionSeconds + sortedAssemblySeconds,

    unsortedTotal:
      unsortedInventorySeconds + unsortedInspectionSeconds + unsortedAssemblySeconds
  };
}

function buildKDJourney(kd, settings) {
  const items = kd?.items || [];
  const sortedItems = [...items].sort((a, b) => a.code.localeCompare(b.code));
  const itemCount = items.length;
  const totals = getKDApproachTotals(itemCount, settings);

  const approachTotals = {
    sortedInventory: totals.sortedInventoryTotal,
    sortedPhase1: totals.sortedPhase1Total,
    unsorted: totals.unsortedTotal
  };
  const bestTotal = Math.min(...Object.values(approachTotals));

  return {
    sortedInventory: {
      key: "sortedInventory",
      title: "Sorted in Inventory / Prep",
      short: `Inventory measured total ${formatDurationShort(totals.sortedInventoryPrepSeconds)}; then 3s/item in Inspection and Assembly`,
      totalSeconds: approachTotals.sortedInventory,
      totalLabel: approachTotals.sortedInventory === bestTotal ? "Best time" : "Sorted in inventory",
      steps: buildJourneySteps({
        approach: "sortedInventory",
        items,
        sortedItems,
        settings,
        totals
      })
    },
    sortedPhase1: {
      key: "sortedPhase1",
      title: "Sorted in Phase 1",
      short: `Phase 1 measured total ${formatDurationShort(totals.sortedPhase1InventorySeconds)}; then 3s/item in Inspection and Assembly`,
      totalSeconds: approachTotals.sortedPhase1,
      totalLabel: approachTotals.sortedPhase1 === bestTotal ? "Best time" : "Sorted in Phase 1",
      steps: buildJourneySteps({
        approach: "sortedPhase1",
        items,
        sortedItems,
        settings,
        totals
      })
    },
    unsorted: {
      key: "unsorted",
      title: "Unsorted start to end",
      short: "Inventory = 40s/item; Inspection and Assembly = 3s/check with remaining count decreasing",
      totalSeconds: approachTotals.unsorted,
      totalLabel: approachTotals.unsorted === bestTotal ? "Best time" : "Unsorted full path",
      steps: buildJourneySteps({
        approach: "unsorted",
        items,
        sortedItems,
        settings,
        totals
      })
    }
  };
}

function buildJourneySteps({
  approach,
  items,
  sortedItems,
  settings,
  totals
}) {
  let cumulativeSeconds = 0;
  const steps = [];
  const itemCount = items.length;
  const isUnsortedApproach = approach === "unsorted";
  const isSortedInventoryApproach = approach === "sortedInventory";
  const isSortedPhase1Approach = approach === "sortedPhase1";
  const sortedApproach = !isUnsortedApproach;

  const titleByApproach = {
    sortedInventory: "Sorted in Inventory / Prep journey",
    sortedPhase1: "Sorted in Phase 1 journey",
    unsorted: "Unsorted from start to end journey"
  };

  const inventoryTotalForApproach = isSortedInventoryApproach
    ? totals.sortedInventoryPrepSeconds
    : isSortedPhase1Approach
      ? totals.sortedPhase1InventorySeconds
      : totals.unsortedInventorySeconds;

  const inventorySecondsPerShownItem = itemCount > 0
    ? inventoryTotalForApproach / itemCount
    : 0;

  const pushStep = (step) => {
    steps.push({
      sourceItems: [],
      searchItems: [],
      kdItems: [],
      deviceItems: [],
      activeItem: null,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "→",
      moveLabel: "Move",
      resultLabel: "Result",
      deviceIcon: "→",
      deviceLabel: "Device",
      deviceSubtitle: "Assembly output",
      searchSubtitle: "No inspection yet",
      scanSource: false,
      scanSearch: false,
      scanKd: false,
      holdMs: 850,
      ...step
    });
  };

  pushStep({
    phase: "Start",
    title: titleByApproach[approach],
    description: "The KD starts before the process. Press Play or Next to follow Inventory, Inspection, and Assembly.",
    sourceItems: items,
    moveLabel: "Ready",
    resultLabel: "KD empty"
  });

  let outsidePool = [...items];
  let collectedItems = [];

  for (let collectionStep = 0; collectionStep < items.length; collectionStep += 1) {
    const targetIndex = sortedApproach ? 0 : getSlowUnsortedTargetIndex(outsidePool.length, collectionStep);
    const item = outsidePool[targetIndex];
    const scanChecks = targetIndex + 1;
    const collectedBeforeInsert = [...collectedItems];
    const kdItemsBeforeInsert = sortedApproach
      ? [...collectedBeforeInsert].sort((a, b) => a.code.localeCompare(b.code))
      : collectedBeforeInsert;

    pushStep({
      phase: "Inventory / Prep",
      title: `Pick ${item.code} from inventory`,
      description: sortedApproach
        ? `${item.code} is picked and prepared for an organized KD. This approach uses the measured Inventory/Phase 1 total spread over the ${itemCount} items.`
        : `${item.code} is picked without sorting. Inventory timing = ${settings.inventorySecondsPerItem}s per item.`,
      sourceItems: getSearchPreviewItems(item, outsidePool, false),
      kdItems: kdItemsBeforeInsert,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "🔍",
      moveLabel: "Pick item",
      resultLabel: "Searching...",
      searchLabel: "Inventory pick",
      searchingOnly: true,
      sourceSubtitle: `Inventory pick path: ${scanChecks} check${scanChecks === 1 ? "" : "s"}`,
      kdSubtitle: collectedBeforeInsert.length ? "KD content before insertion" : "KD is still empty",
      scanSource: true,
      holdMs: getJourneyScanHoldMs(scanChecks)
    });

    cumulativeSeconds += inventorySecondsPerShownItem;

    collectedItems = [...collectedItems, item];
    outsidePool = removeItemAtIndex(outsidePool, targetIndex);

    const kdItems = sortedApproach
      ? [...collectedItems].sort((a, b) => a.code.localeCompare(b.code))
      : collectedItems;

    pushStep({
      phase: "Inventory / Prep",
      title: sortedApproach ? `Place ${item.code} into sorted KD position` : `Place ${item.code} into KD without sorting`,
      description: sortedApproach
        ? `${item.code} enters the KD in an organized position. Cumulative Inventory timing is based on the measured total for this sorted approach.`
        : `${item.code} enters the KD as found. Inventory time added = ${settings.inventorySecondsPerItem}s.`,
      sourceItems: outsidePool,
      kdItems,
      activeItem: item,
      timeAdded: inventorySecondsPerShownItem,
      cumulativeSeconds,
      icon: "📥",
      moveLabel: "Inventory → KD",
      resultLabel: sortedApproach ? "Inserted sorted" : "Inserted unsorted",
      sourceSubtitle: "Inventory items remaining",
      kdSubtitle: "KD content after insertion",
      searchSubtitle: "Inventory insertion"
    });
  }

  let inspectionPool = sortedApproach ? [...sortedItems] : [...collectedItems];
  let inspectedItems = [];

  pushStep({
    phase: "Inspection",
    title: "Start inspection",
    description: sortedApproach
      ? `The KD is organized, so inspection takes ${settings.sortedOperationSeconds}s per item.`
      : `The KD is still unsorted. Inspection uses ${settings.unsortedCheckSeconds}s per check, and the remaining total decreases by 1 after each found item.`,
    searchItems: inspectionPool,
    kdItems: [],
    timeAdded: 0,
    cumulativeSeconds,
    icon: "📤",
    moveLabel: "Open KD",
    resultLabel: "Ready to inspect",
    searchSubtitle: "Items waiting for inspection"
  });

  const inspectionIterations = inspectionPool.length;
  for (let inspectionStep = 0; inspectionStep < inspectionIterations; inspectionStep += 1) {
    const targetIndex = sortedApproach ? 0 : inspectionPool.length - 1;
    const item = inspectionPool[targetIndex];
    const remainingBeforeSearch = inspectionPool.length;
    const checksNeeded = targetIndex + 1;
    const timeAdded = sortedApproach
      ? settings.sortedOperationSeconds
      : checksNeeded * settings.unsortedCheckSeconds;
    cumulativeSeconds += timeAdded;

    pushStep({
      phase: "Inspection",
      title: `Inspect ${item.code}`,
      description: sortedApproach
        ? `${item.code} is reached directly because the KD is sorted. Inspection time = ${settings.sortedOperationSeconds}s per item.`
        : `${item.code} is found after ${checksNeeded} check${checksNeeded === 1 ? "" : "s"}. Time added = ${checksNeeded} × ${settings.unsortedCheckSeconds}s = ${formatDurationShort(timeAdded)}. After this, remaining items decrease from ${remainingBeforeSearch} to ${remainingBeforeSearch - 1}.`,
      searchItems: getSearchPreviewItems(item, inspectionPool, sortedApproach),
      kdItems: inspectedItems,
      activeItem: item,
      timeAdded,
      cumulativeSeconds,
      icon: "🔍",
      moveLabel: sortedApproach ? "Fast inspect" : "Check one by one",
      resultLabel: "Inspecting...",
      searchLabel: sortedApproach ? "Fast inspection" : "Inspection scan",
      searchingOnly: true,
      searchSubtitle: sortedApproach ? "Sorted inspection path" : `Unsorted checks: ${checksNeeded}/${remainingBeforeSearch}`,
      kdSubtitle: "Inspected items already returned",
      holdMs: getJourneyScanHoldMs(checksNeeded)
    });

    inspectionPool = removeItemAtIndex(inspectionPool, targetIndex);
    inspectedItems = [...inspectedItems, item];

    pushStep({
      phase: "Inspection",
      title: `Return ${item.code} after inspection`,
      description: `${item.code} is checked, then returned to the KD box.`,
      searchItems: inspectionPool,
      kdItems: sortedApproach ? [...inspectedItems].sort((a, b) => a.code.localeCompare(b.code)) : inspectedItems,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "📥",
      moveLabel: "Checked",
      resultLabel: "Returned to KD",
      searchSubtitle: "Items still waiting for inspection",
      kdSubtitle: "Checked items returned"
    });
  }

  let assemblyPool = sortedApproach ? [...sortedItems] : [...inspectedItems];
  let deviceItems = [];
  const assemblyIterations = assemblyPool.length;

  for (let assemblyStep = 0; assemblyStep < assemblyIterations; assemblyStep += 1) {
    const targetIndex = sortedApproach ? 0 : assemblyPool.length - 1;
    const item = assemblyPool[targetIndex];
    const remainingBeforeDevice = assemblyPool.length;
    const checksNeeded = targetIndex + 1;
    const timeAdded = sortedApproach
      ? settings.sortedOperationSeconds
      : checksNeeded * settings.unsortedCheckSeconds;
    cumulativeSeconds += timeAdded;

    pushStep({
      phase: "Assembly",
      title: `Select ${item.code} for assembly`,
      description: sortedApproach
        ? `${item.code} is selected directly. Assembly time = ${settings.sortedOperationSeconds}s per item.`
        : `${item.code} is found after ${checksNeeded} check${checksNeeded === 1 ? "" : "s"}. Time added = ${checksNeeded} × ${settings.unsortedCheckSeconds}s = ${formatDurationShort(timeAdded)}. After this, remaining items decrease from ${remainingBeforeDevice} to ${remainingBeforeDevice - 1}.`,
      kdItems: getSearchPreviewItems(item, assemblyPool, sortedApproach),
      deviceItems,
      activeItem: item,
      timeAdded,
      cumulativeSeconds,
      icon: "🔎",
      moveLabel: sortedApproach ? "Direct select" : "Search in KD",
      resultLabel: "Found for assembly",
      searchLabel: sortedApproach ? "Fast assembly pick" : "Assembly scan",
      searchingOnly: true,
      deviceIcon: "🔎",
      deviceLabel: "Selecting...",
      deviceSubtitle: "Items already assembled",
      kdSubtitle: sortedApproach ? "Sorted KD pick path" : `Unsorted assembly checks: ${checksNeeded}/${remainingBeforeDevice}`,
      searchSubtitle: `Remaining KD items: ${remainingBeforeDevice}`,
      holdMs: getJourneyScanHoldMs(checksNeeded)
    });

    assemblyPool = removeItemAtIndex(assemblyPool, targetIndex);
    deviceItems = [...deviceItems, item];

    pushStep({
      phase: "Assembly",
      title: `Assemble ${item.code}`,
      description: `${item.code} leaves the KD box and becomes part of the assembly output.`,
      kdItems: assemblyPool,
      deviceItems,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "➡️",
      moveLabel: "Selected",
      resultLabel: "Remaining KD",
      deviceIcon: "➡️",
      deviceLabel: "KD → Assembly",
      deviceSubtitle: "Items already assembled",
      kdSubtitle: "Remaining KD content",
      searchSubtitle: `Remaining KD items: ${assemblyPool.length}`
    });
  }

  pushStep({
    phase: "End",
    title: "Journey finished",
    description: `The full journey is complete. Total time for this approach is ${formatDuration(cumulativeSeconds)}.` ,
    kdItems: [],
    deviceItems,
    timeAdded: 0,
    cumulativeSeconds,
    icon: "✅",
    moveLabel: "Complete",
    resultLabel: "KD empty",
    deviceIcon: "✅",
    deviceLabel: "Completed",
    deviceSubtitle: "Assembly received all items",
    searchSubtitle: "Finished"
  });

  return steps;
}

function KDSimulationFlow({
  selectedKd,
  selectedResult,
  scenario,
  setScenario,
  activeStep,
  setActiveStep,
  inventorySecondsPerItem,
  sortedOperationSeconds,
  unsortedCheckSeconds
}) {
  const steps = getIntegratedKDFlowSteps(scenario, {
    inventorySecondsPerItem,
    sortedOperationSeconds,
    unsortedCheckSeconds
  });
  const currentStep = steps[activeStep] || steps[0];
  const phaseDurations = selectedResult?.phases || [];
  const previewItems = selectedKd?.items?.slice(0, 6) || [];

  return (
    <section className="card integrated-flow-card">
      <div className="kd-section-head">
        <div>
          <h3>Visual process flow</h3>
          <p>Connect Inventory, Inspection, and Assembly with the timing table for the selected KD.</p>
        </div>

        <div className="integrated-flow-toggle">
          <button
            className={scenario === "sortedInventory" ? "active" : ""}
            onClick={() => { setScenario("sortedInventory"); setActiveStep(0); }}
          >
            Sorted in Inventory
          </button>
          <button
            className={scenario === "sortedPhase1" ? "active" : ""}
            onClick={() => { setScenario("sortedPhase1"); setActiveStep(0); }}
          >
            Sorted in Phase 1
          </button>
          <button
            className={scenario === "unsorted" ? "active" : ""}
            onClick={() => { setScenario("unsorted"); setActiveStep(0); }}
          >
            Unsorted
          </button>
        </div>
      </div>

      <div className="integrated-flow-layout">
        <aside className="integrated-flow-steps">
          {steps.map((step, index) => (
            <button
              key={step.title}
              className={activeStep === index ? "integrated-step active" : "integrated-step"}
              onClick={() => setActiveStep(index)}
            >
              <span>{step.icon}</span>
              <div>
                <b>{step.title}</b>
                <small>{step.short}</small>
              </div>
            </button>
          ))}
        </aside>

        <div className="integrated-flow-main">
          <div className="integrated-current-step">
            <div>
              <h4>{currentStep.title}</h4>
              <p>{currentStep.description}</p>
            </div>
            <span className="pill">{currentStep.badge}</span>
          </div>

          <div className={`integrated-flow-stage ${scenario} phase-only-stage`}>
            {getIntegratedStageNodes(activeStep, scenario).map((node, index, nodes) => (
              <React.Fragment key={`${node.title}-${index}`}>
                <div className={`integrated-node active ${node.tone || ""}`}>
                  <span>{node.icon}</span>
                  <b>{node.title}</b>
                  {node.subtitle && <small>{node.subtitle}</small>}
                </div>
                {index < nodes.length - 1 && <div className="integrated-arrow active">→</div>}
              </React.Fragment>
            ))}
          </div>

          <div className="integrated-flow-bottom">
            <div className="flow-mini-items">
              <h4>Item location in {selectedKd?.id || "KD"}</h4>
              <div className="flow-mini-item-grid">
                {previewItems.map((item, index) => {
                  const itemState = getFlowMiniItemState(index, activeStep, scenario);

                  return (
                    <div
                      key={item.uid || `${item.code}-${index}`}
                      className={itemState.className}
                      style={{ "--scan-order": index }}
                    >
                      <b>{item.code}</b>
                      <span>{itemState.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flow-mini-device-status">
                {activeStep >= 3
                  ? "Assembly: selected items leave the KD and go to the assembly output."
                  : "Before Assembly, checked items are still inside the KD or returned back to it."}
              </div>
            </div>

            <div className="flow-phase-times">
              <h4>Same numbers from the timing table</h4>
              {phaseDurations.map((phase) => (
                <div key={phase.phase} className="phase-time-line">
                  <b>{getKDPhaseName(phase.phase)}</b>
                  <span>Sorted in Inventory: {formatDurationShort(phase.sortedInventorySeconds)}</span>
                  <span>Sorted in Phase 1: {formatDurationShort(phase.sortedPhase1Seconds)}</span>
                  <span>Unsorted: {formatDurationShort(phase.unsortedSeconds)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="integrated-flow-message">
            <b>Explanation:</b> {currentStep.explain}
          </div>
        </div>
      </div>
    </section>
  );
}

function buildKDItemFlowRows(kd, settings) {
  if (!kd || !kd.items || kd.items.length === 0) return [];

  const itemCount = kd.items.length;
  let cumulativeSeconds = 0;

  return kd.items.map((item, index) => {
    const remainingBeforeSearch = itemCount - index;
    const inventorySeconds = settings.scenario === "unsorted"
      ? settings.inventorySecondsPerItem
      : settings.scenario === "sortedPhase1"
        ? settings.sortedPhase1TotalSeconds / itemCount
        : settings.sortedInventoryTotalSeconds / itemCount;

    const inspectionSeconds = settings.scenario === "unsorted"
      ? remainingBeforeSearch * settings.unsortedCheckSeconds
      : settings.sortedOperationSeconds;

    const assemblySeconds = settings.scenario === "unsorted"
      ? remainingBeforeSearch * settings.unsortedCheckSeconds
      : settings.sortedOperationSeconds;

    const totalSeconds = inventorySeconds + inspectionSeconds + assemblySeconds;
    cumulativeSeconds += totalSeconds;

    return {
      sequence: index + 1,
      item,
      remainingBeforeSearch,
      inventorySeconds,
      inspectionSeconds,
      assemblySeconds,
      totalSeconds,
      cumulativeSeconds
    };
  });
}

function getScenarioLabel(scenario) {
  if (scenario === "sortedInventory") return "Sorted in Inventory";
  if (scenario === "sortedPhase1") return "Sorted in Phase 1";
  return "Unsorted";
}

function getIntegratedStageNodes(activeStep, scenario) {
  const isSorted = scenario !== "unsorted";
  const sortedTone = isSorted ? "good" : "warn";

  if (activeStep === 0) {
    return [
      { icon: "📦", title: "KD box", subtitle: isSorted ? "Will be organized" : "Random order", tone: sortedTone }
    ];
  }

  if (activeStep === 1) {
    return [
      { icon: "📥", title: "Inventory", subtitle: scenario === "unsorted" ? "40s/item" : "Measured total", tone: "warn" },
      { icon: "🏗️", title: "Phase 1", subtitle: getScenarioLabel(scenario) },
      { icon: "📦", title: "KD box", subtitle: isSorted ? "Collected sorted" : "Collected unsorted", tone: sortedTone }
    ];
  }

  if (activeStep === 2) {
    return [
      { icon: isSorted ? "✅" : "🔎", title: "Inspection", subtitle: isSorted ? "3s/item" : "3s/check", tone: "warn" },
      { icon: "📦", title: "KD box", subtitle: "Checked items returned", tone: sortedTone }
    ];
  }

  if (activeStep === 3) {
    return [
      { icon: "📦", title: "KD box", subtitle: isSorted ? "Direct pick" : "Search needed", tone: sortedTone },
      { icon: "🏭", title: "Assembly", subtitle: isSorted ? "3s/item" : "3s/check" },
      { icon: "🧩", title: "Assembly output", subtitle: "Receives item", tone: "good" }
    ];
  }

  return [
    { icon: "⏱️", title: "Result", subtitle: getScenarioLabel(scenario), tone: sortedTone }
  ];
}

function getFlowMiniItemState(index, activeStep, scenario) {
  const sortedClass = scenario !== "unsorted" ? " sorted" : "";
  const foundIndex = scenario !== "unsorted" ? 1 : 3;

  if (activeStep === 0) {
    return {
      className: `flow-mini-item${sortedClass}`,
      label: "inside KD"
    };
  }

  if (activeStep === 1) {
    if (index < foundIndex) {
      return {
        className: `flow-mini-item checked scan-card${sortedClass}`,
        label: "inventory checked"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "picked → KD"
      };
    }

    return {
      className: `flow-mini-item waiting${sortedClass}`,
      label: "waiting to pick"
    };
  }

  if (activeStep === 2) {
    if (index < foundIndex) {
      return {
        className: `flow-mini-item checked scan-card${sortedClass}`,
        label: scenario === "unsorted" ? "check" : "quick check"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "inspected"
      };
    }

    return {
      className: `flow-mini-item waiting${sortedClass}`,
      label: "waiting"
    };
  }

  if (activeStep === 3) {
    if (index === 0) {
      return {
        className: "flow-mini-item used",
        label: "already assembled"
      };
    }

    if (index < foundIndex) {
      return {
        className: `flow-mini-item checked scan-card${sortedClass}`,
        label: scenario === "unsorted" ? "assembly check" : "direct pick"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "assembly found"
      };
    }

    return {
      className: `flow-mini-item waiting${sortedClass}`,
      label: "still inside KD"
    };
  }

  return {
    className: "flow-mini-item used",
    label: "completed"
  };
}

function getIntegratedKDFlowSteps(scenario, settings) {
  const isSorted = scenario !== "unsorted";
  const approachLabel = getScenarioLabel(scenario);

  if (!isSorted) {
    return [
      {
        icon: "📦",
        title: "KD contains items",
        short: "Random order",
        badge: "Start",
        description: "The KD contains the 17 items, but they are not organized.",
        explain: `Unsorted means the operator may need multiple checks. Inspection and Assembly use ${settings.unsortedCheckSeconds}s per check.`
      },
      {
        icon: "📥",
        title: "Inventory",
        short: `${settings.inventorySecondsPerItem}s per item`,
        badge: "Inventory",
        description: "Each item is picked from inventory without sorting.",
        explain: `Inventory unsorted = number of items × ${settings.inventorySecondsPerItem}s.`
      },
      {
        icon: "🔍",
        title: "Inspection",
        short: `${settings.unsortedCheckSeconds}s per check`,
        badge: "Inspection",
        description: "Inspection scans the unsorted KD. After each found item, the remaining total decreases by one.",
        explain: `For 17 items, checks = 17 + 16 + ... + 1 = 153 checks. Inspection time = 153 × ${settings.unsortedCheckSeconds}s.`
      },
      {
        icon: "🏭",
        title: "Assembly",
        short: `${settings.unsortedCheckSeconds}s per check`,
        badge: "Assembly",
        description: "Assembly repeats the same unsorted search rule before each item is used.",
        explain: `Assembly unsorted also uses 17 + 16 + ... + 1 checks, each check taking ${settings.unsortedCheckSeconds}s.`
      },
      {
        icon: "⏱️",
        title: "Impact",
        short: "Highest repeated search",
        badge: "Result",
        description: "The repeated checks in Inspection and Assembly make the unsorted path much slower.",
        explain: "The timing table converts this repeated-check behavior into total time."
      }
    ];
  }

  return [
    {
      icon: "📦",
      title: "KD contains items",
      short: approachLabel,
      badge: "Start",
      description: `The KD will be handled using the ${approachLabel} approach.`,
      explain: "Once the KD is organized, Inspection and Assembly can use a direct 3s/item timing."
    },
    {
      icon: "📥",
      title: "Inventory / Phase 1",
      short: scenario === "sortedInventory" ? "3m 12s total" : "4m 43s total",
      badge: "Inventory",
      description: scenario === "sortedInventory"
        ? "The KD is sorted during Inventory/Prep using the measured 3:12 total."
        : "The KD is sorted in Phase 1 using the measured 4:43 total.",
      explain: scenario === "sortedInventory"
        ? "Sorted in Inventory/Prep uses the measured 3:12 total for the 17-item KD."
        : "Sorted in Phase 1 uses the measured 4:43 total for the 17-item KD."
    },
    {
      icon: "✅",
      title: "Inspection",
      short: `${settings.sortedOperationSeconds}s per item`,
      badge: "Inspection",
      description: "Because the KD is sorted, each item is checked directly.",
      explain: `Inspection sorted = number of items × ${settings.sortedOperationSeconds}s.`
    },
    {
      icon: "🏭",
      title: "Assembly",
      short: `${settings.sortedOperationSeconds}s per item`,
      badge: "Assembly",
      description: "Assembly also uses direct selection from the sorted KD.",
      explain: `Assembly sorted = number of items × ${settings.sortedOperationSeconds}s.`
    },
    {
      icon: "⏱️",
      title: "Impact",
      short: "Low repeated search",
      badge: "Result",
      description: "The sorted approaches avoid the repeated decreasing-check search in both Inspection and Assembly.",
      explain: "The table compares this direct 3s/item timing against the unsorted 3s/check timing."
    }
  ];
}

function KDSimulationPage() {
  const [kdCount, setKdCount] = useState(1);
  const [itemMin, setItemMin] = useState(17);
  const [itemMax, setItemMax] = useState(17);
  const [inventorySecondsPerItem, setInventorySecondsPerItem] = useState(40);
  const [sortedInventoryTotalSeconds, setSortedInventoryTotalSeconds] = useState(192);
  const [sortedPhase1TotalSeconds, setSortedPhase1TotalSeconds] = useState(283);
  const [sortedOperationSeconds, setSortedOperationSeconds] = useState(3);
  const [unsortedCheckSeconds, setUnsortedCheckSeconds] = useState(3);
  const [selectedKdIndex, setSelectedKdIndex] = useState(0);
  const [flowScenario, setFlowScenario] = useState("sortedInventory");
  const [flowStep, setFlowStep] = useState(0);
  const [kds, setKds] = useState(() => generateKDs(1, 17, 17));
  const [sourceTags, setSourceTags] = useState({
    kdCount: "Given",
    inventorySecondsPerItem: "Estimated",
    sortedInventoryTotalSeconds: "Measured",
    sortedPhase1TotalSeconds: "Measured",
    sortedOperationSeconds: "Measured",
    unsortedCheckSeconds: "Measured"
  });

  const FIXED_PHASE_COUNT = 3;

  function regenerate() {
    const safeMin = Math.max(1, Math.min(Number(itemMin), Number(itemMax)));
    const safeMax = Math.max(safeMin, Number(itemMax));
    const safeCount = Math.max(1, Number(kdCount));
    setKds(generateKDs(safeCount, safeMin, safeMax));
    setSelectedKdIndex(0);
    setFlowStep(0);
  }

  function updateSourceTag(key, value) {
    setSourceTags((previous) => ({
      ...previous,
      [key]: value
    }));
  }

  const simulation = useMemo(() => {
    return calculateKDSimulation(kds, {
      inventorySecondsPerItem: Number(inventorySecondsPerItem),
      sortedInventoryTotalSeconds: Number(sortedInventoryTotalSeconds),
      sortedPhase1TotalSeconds: Number(sortedPhase1TotalSeconds),
      sortedOperationSeconds: Number(sortedOperationSeconds),
      unsortedCheckSeconds: Number(unsortedCheckSeconds),
      phaseCount: FIXED_PHASE_COUNT
    });
  }, [
    kds,
    inventorySecondsPerItem,
    sortedInventoryTotalSeconds,
    sortedPhase1TotalSeconds,
    sortedOperationSeconds,
    unsortedCheckSeconds
  ]);

  const selectedKd = kds[selectedKdIndex] || kds[0];
  const selectedResult = simulation.results[selectedKdIndex] || simulation.results[0];
  const selectedItemCount = selectedKd?.items?.length || 17;
  const unsortedChecks = getUnsortedDecreasingChecks(selectedItemCount);

  return (
    <main className="kd-page">
      <section className="card kd-hero">
        <div>
          <h2>KD Manufacturing Simulation</h2>
          <p>
            Compare a 17-item KD across Inventory, Inspection, and Assembly using the three approaches you described.
          </p>
        </div>
        <div className="kd-hero-stats">
          <span><b>{kds.length}</b> KDs</span>
          <span><b>{selectedItemCount}</b> items/KD</span>
          <span><b>{FIXED_PHASE_COUNT}</b> phases</span>
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
              <input type="number" min="1" max="60" value={itemMin} onChange={(e) => setItemMin(Number(e.target.value))} />
            </div>
            <div>
              <label>Max items</label>
              <input type="number" min="1" max="60" value={itemMax} onChange={(e) => setItemMax(Number(e.target.value))} />
            </div>
          </div>
          <small className="hint">Default setup is fixed to 17 items. Measured sorted totals are scaled if you intentionally test another item count.</small>

          <div className="setting-line">
            <label>Unsorted inventory time / item: <b>{inventorySecondsPerItem}s</b></label>
            <SettingSourceSelect value={sourceTags.inventorySecondsPerItem} onChange={(value) => updateSourceTag("inventorySecondsPerItem", value)} />
          </div>
          <input type="range" min="1" max="120" step="1" value={inventorySecondsPerItem} onChange={(e) => setInventorySecondsPerItem(Number(e.target.value))} />
          <small className="hint">
            Estimated value: Inventory unsorted = items × {inventorySecondsPerItem}s.
          </small>

          <div className="setting-line">
            <label>Sorted in Inventory / Prep total: <b>{formatDurationShort(sortedInventoryTotalSeconds)}</b></label>
            <SettingSourceSelect value={sourceTags.sortedInventoryTotalSeconds} onChange={(value) => updateSourceTag("sortedInventoryTotalSeconds", value)} />
          </div>
          <input type="range" min="30" max="600" step="1" value={sortedInventoryTotalSeconds} onChange={(e) => setSortedInventoryTotalSeconds(Number(e.target.value))} />
          <small className="hint">Default measured value: 3:12 = 192s for 17 items.</small>

          <div className="setting-line">
            <label>Sorted in Phase 1 total: <b>{formatDurationShort(sortedPhase1TotalSeconds)}</b></label>
            <SettingSourceSelect value={sourceTags.sortedPhase1TotalSeconds} onChange={(value) => updateSourceTag("sortedPhase1TotalSeconds", value)} />
          </div>
          <input type="range" min="30" max="700" step="1" value={sortedPhase1TotalSeconds} onChange={(e) => setSortedPhase1TotalSeconds(Number(e.target.value))} />
          <small className="hint">Default measured value: 4:43 = 283s for 17 items.</small>

          <div className="setting-line">
            <label>Sorted Inspection / Assembly time: <b>{sortedOperationSeconds}s/item</b></label>
            <SettingSourceSelect value={sourceTags.sortedOperationSeconds} onChange={(value) => updateSourceTag("sortedOperationSeconds", value)} />
          </div>
          <input type="range" min="1" max="20" step="0.5" value={sortedOperationSeconds} onChange={(e) => setSortedOperationSeconds(Number(e.target.value))} />
          <small className="hint">Used by the first two approaches in both Inspection and Assembly.</small>

          <div className="setting-line">
            <label>Unsorted check time: <b>{unsortedCheckSeconds}s/check</b></label>
            <SettingSourceSelect value={sourceTags.unsortedCheckSeconds} onChange={(value) => updateSourceTag("unsortedCheckSeconds", value)} />
          </div>
          <input type="range" min="1" max="20" step="0.5" value={unsortedCheckSeconds} onChange={(e) => setUnsortedCheckSeconds(Number(e.target.value))} />
          <small className="hint">Unsorted Inspection and Assembly use 3s per check; remaining count decreases by 1 after each found item.</small>

          <button className="primary kd-full-button" onClick={regenerate}>Generate New KD Data</button>
        </aside>

        <section className="kd-main">
          <div className="kd-summary-grid">
            <div className="card kd-summary sorted">
              <small>Sorted in Inventory / Prep</small>
              <strong>{formatDuration(simulation.totalSortedInventorySeconds)}</strong>
             <span>
              Inventory {inventorySecondsPerItem}s/item estimated + Inspection {formatDurationShort(sortedInventoryTotalSeconds)} measured + Assembly {sortedOperationSeconds}s/item measured
            </span>
            </div>

            <div className="card kd-summary saving">
              <small>Sorted in Phase 1</small>
              <strong>{formatDuration(simulation.totalSortedPhase1Seconds)}</strong>
              <span>
                Inventory {inventorySecondsPerItem}s/item estimated + Inspection {formatDurationShort(sortedPhase1TotalSeconds)} measured + Assembly {sortedOperationSeconds}s/item measured
              </span>
            </div>

            <div className="card kd-summary unsorted">
              <small>Unsorted start to end</small>
              <strong>{formatDuration(simulation.totalUnsortedSeconds)}</strong>
              <span>Inventory {inventorySecondsPerItem}s/item estimated + Inspection/Assembly {unsortedCheckSeconds}s/check with decreasing remaining count</span>
            </div>
          </div>

          <KDJourneySimulation
            selectedKd={selectedKd}
            inventorySecondsPerItem={inventorySecondsPerItem}
            sortedInventoryTotalSeconds={sortedInventoryTotalSeconds}
            sortedPhase1TotalSeconds={sortedPhase1TotalSeconds}
            sortedOperationSeconds={sortedOperationSeconds}
            unsortedCheckSeconds={unsortedCheckSeconds}
          />

          <KDSimulationFlow
            selectedKd={selectedKd}
            selectedResult={selectedResult}
            scenario={flowScenario}
            setScenario={setFlowScenario}
            activeStep={flowStep}
            setActiveStep={setFlowStep}
            inventorySecondsPerItem={inventorySecondsPerItem}
            sortedOperationSeconds={sortedOperationSeconds}
            unsortedCheckSeconds={unsortedCheckSeconds}
          />

          <p>
            For the unsorted path, Inspection checks <b>{selectedItemCount} + {selectedItemCount - 1} + ... + 1 = {unsortedChecks} checks</b>,
            so each unsorted check phase takes <b>{formatDurationShort(unsortedChecks * unsortedCheckSeconds)}</b>.
          </p>

          <p className="kd-check-note">
            <b>How checks work:</b> one check means looking at one item while searching.
            In the unsorted approach, the first search may check all {selectedItemCount} items.
            After the found item is removed, only {selectedItemCount - 1} remain, then {selectedItemCount - 2}, and so on until 1.
          </p>

          <section className="card kd-list-card">
            <div className="kd-section-head">
              <div>
                <h3>KD list</h3>
                <p>Select any KD to see its item codes, names, flow, and phase timing.</p>
              </div>
              <span className="pill">Default KD = 17 items</span>
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
                  <em>best saves {formatDurationShort(result.bestSavedVsUnsortedSeconds)}</em>
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
                        <th>Sorted in Inventory / Prep</th>
                        <th>Sorted in Phase 1</th>
                        <th>Unsorted</th>
                        <th>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedResult.phases.map((phase) => (
                        <tr key={phase.phase}>
                          <td>{getKDPhaseName(phase.phase)}</td>
                          <td>{formatDurationShort(phase.sortedInventorySeconds)}</td>
                          <td>{formatDurationShort(phase.sortedPhase1Seconds)}</td>
                          <td>{formatDurationShort(phase.unsortedSeconds)}</td>
                          <td>{phase.note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="kd-total-line">
                  <span>Sorted in Inventory / Prep total: <b>{formatDuration(selectedResult.sortedInventorySeconds)}</b></span>
                  <span>Sorted in Phase 1 total: <b>{formatDuration(selectedResult.sortedPhase1Seconds)}</b></span>
                  <span>Unsorted total: <b>{formatDuration(selectedResult.unsortedSeconds)}</b></span>
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
      <option value="Given">Given</option>
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



function getKDPhaseName(phase) {
  if (phase === 1) return "Inventory / Prep";
  if (phase === 2) return "Inspection";
  if (phase === 3) return "Assembly";
  return `Phase ${phase}`;
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
    const usedCodes = new Set();
    const items = Array.from({ length: count }, (_, itemIndex) => {
      let randomCodeNumber = randomBetween(100, 999);
      while (usedCodes.has(randomCodeNumber)) {
        randomCodeNumber = randomBetween(100, 999);
      }
      usedCodes.add(randomCodeNumber);

      const name = itemNames[(itemIndex + kdIndex * 3) % itemNames.length];
      const code = `ITM-${randomCodeNumber}`;

      return {
        uid: `kd-${kdIndex + 1}-item-${itemIndex + 1}-${randomCodeNumber}`,
        code,
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
  const totalSortedInventorySeconds = results.reduce((sum, result) => sum + result.sortedInventorySeconds, 0);
  const totalSortedPhase1Seconds = results.reduce((sum, result) => sum + result.sortedPhase1Seconds, 0);
  const totalUnsortedSeconds = results.reduce((sum, result) => sum + result.unsortedSeconds, 0);
  const totalBestSavedVsUnsortedSeconds = totalUnsortedSeconds - Math.min(totalSortedInventorySeconds, totalSortedPhase1Seconds, totalUnsortedSeconds);

  return {
    results,
    totalSortedInventorySeconds,
    totalSortedPhase1Seconds,
    totalUnsortedSeconds,
    totalBestSavedVsUnsortedSeconds
  };
}

function calculateSingleKD(kd, settings) {
  const itemCount = kd.items.length;
  const phases = [];
  const phaseCount = settings.phaseCount || 3;
  const totals = getKDApproachTotals(itemCount, settings);

  let sortedInventorySeconds = 0;
  let sortedPhase1Seconds = 0;
  let unsortedSeconds = 0;

  for (let phase = 1; phase <= phaseCount; phase++) {
    let sortedInventoryPhaseSeconds = 0;
    let sortedPhase1PhaseSeconds = 0;
    let unsortedPhaseSeconds = 0;
    let note = "";

  if (phase === 1) {
    sortedInventoryPhaseSeconds = totals.inventoryPrepSeconds;
    sortedPhase1PhaseSeconds = totals.inventoryPrepSeconds;
    unsortedPhaseSeconds = totals.unsortedInventorySeconds;
    note = `Inventory / Prep: all approaches = ${itemCount} × ${settings.inventorySecondsPerItem}s.`;
  } else if (phase === 2) {
    sortedInventoryPhaseSeconds = totals.sortedInventoryInspectionSeconds;
    sortedPhase1PhaseSeconds = totals.sortedPhase1InspectionSeconds;
    unsortedPhaseSeconds = totals.unsortedInspectionSeconds;
    note = `Inspection: sorted in Inventory/Prep = ${formatDurationShort(totals.sortedInventoryInspectionSeconds)} measured; sorted in Phase 1 = ${formatDurationShort(totals.sortedPhase1InspectionSeconds)} measured; unsorted = ${totals.unsortedCheckCount} checks × ${settings.unsortedCheckSeconds}s.`;
  } else  {
      sortedInventoryPhaseSeconds = totals.sortedAssemblySeconds;
      sortedPhase1PhaseSeconds = totals.sortedAssemblySeconds;
      unsortedPhaseSeconds = totals.unsortedAssemblySeconds;
      note = `Assembly: sorted approaches = ${itemCount} × ${settings.sortedOperationSeconds}s; unsorted = ${totals.unsortedCheckCount} checks × ${settings.unsortedCheckSeconds}s.`;
    }

    sortedInventorySeconds += sortedInventoryPhaseSeconds;
    sortedPhase1Seconds += sortedPhase1PhaseSeconds;
    unsortedSeconds += unsortedPhaseSeconds;

    phases.push({
      phase,
      sortedInventorySeconds: sortedInventoryPhaseSeconds,
      sortedPhase1Seconds: sortedPhase1PhaseSeconds,
      unsortedSeconds: unsortedPhaseSeconds,
      note
    });
  }

  const bestSeconds = Math.min(sortedInventorySeconds, sortedPhase1Seconds, unsortedSeconds);

  return {
    kd,
    itemCount,
    sortedInventorySeconds,
    sortedPhase1Seconds,
    unsortedSeconds,
    bestSeconds,
    bestSavedVsUnsortedSeconds: unsortedSeconds - bestSeconds,
    phases
  };
}

function calculateUnsortedSearchWithRemovalSeconds(itemCount, checkSeconds) {
  return getUnsortedDecreasingChecks(itemCount) * checkSeconds;
}

function calculateUnsortedFullBoxSearchSeconds(itemCount, checkSeconds) {
  // Kept for comparison only: this assumes the KD box stays full during every search.
  const averageChecksPerItem = (itemCount + 1) / 2;
  return itemCount * averageChecksPerItem * checkSeconds;
}

function calculateUnsortedSearchSeconds(itemCount, checkSeconds) {
  return calculateUnsortedSearchWithRemovalSeconds(itemCount, checkSeconds);
}

function calculateSortedSearchSeconds(itemCount, sortedSearchSeconds) {
  return itemCount * sortedSearchSeconds;
}

function calculateSortingSeconds(itemCount, secondsPerItemLog) {
  if (itemCount <= 1) return 0;
  return itemCount * Math.log2(itemCount) * secondsPerItemLog;
}

function findKDBreakEven() {
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
    let j = i;

    while (j > 0) {
      checks++;

      if (arr[j - 1] > arr[j]) {
        [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
        changes++;
        j--;
      } else {
        break;
      }
    }
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
    let j = i;

    steps.push({
      array: [...arr],
      active: [j],
      text: `Taking ${arr[j]} and moving it left by switching with bigger bars.`
    });

    while (j > 0) {
      checks++;
      steps.push({
        array: [...arr],
        active: [j - 1, j],
        text: `Checking neighboring bars ${arr[j - 1]} and ${arr[j]}.`
      });

      if (arr[j - 1] > arr[j]) {
        const leftValue = arr[j - 1];
        const rightValue = arr[j];
        [arr[j - 1], arr[j]] = [arr[j], arr[j - 1]];
        changes++;

        steps.push({
          array: [...arr],
          active: [j - 1, j],
          text: `${rightValue} is smaller than ${leftValue}, so the two bars switched places.`
        });

        j--;
      } else {
        steps.push({
          array: [...arr],
          active: [j - 1, j],
          text: `${arr[j]} is already after ${arr[j - 1]}, so no switch is needed.`
        });
        break;
      }
    }

    steps.push({
      array: [...arr],
      active: [j],
      text: `${arr[j]} is now in the correct position inside the sorted part.`
    });
  }

  steps.push({ array: [...arr], active: arr.map((_, i) => i), text: "Insertion Sort finished." });
  return { finalArray: arr, steps, checks, changes };
}

function mergeSortSteps(input) {
  const arr = [...input];
  const steps = [];
  let checks = 0;
  let changes = 0;

  function groupRange(left, right) {
    return range(left, right);
  }

  function tempMeta(leftPart, rightPart, i, j, selectedSide = null, selectedTempIndex = null, displacedInfo = {}) {
    return {
      leftTemp: [...leftPart],
      rightTemp: [...rightPart],
      leftTempIndex: i < leftPart.length ? i : null,
      rightTempIndex: j < rightPart.length ? j : null,
      selectedSide,
      selectedTempIndex,
      ...displacedInfo
    };
  }

  function getDisplacedInfo(left, middle, writeIndex, selectedValue) {
    const displacedValue = arr[writeIndex];

    if (displacedValue === selectedValue) {
      return {};
    }

    return {
      displacedValue,
      displacedTempSide: writeIndex <= middle ? "left" : "right",
      displacedTempIndex: writeIndex <= middle ? writeIndex - left : writeIndex - middle - 1
    };
  }

  function pushDivideStep(left, middle, right) {
    steps.push({
      array: [...arr],
      active: groupRange(left, right),
      mergeView: {
        type: "divide",
        range: groupRange(left, right),
        leftGroup: groupRange(left, middle),
        rightGroup: groupRange(middle + 1, right)
      },
      text: `Divide positions ${left + 1} to ${right + 1}: the purple bars are the left group and the cyan bars are the right group.`
    });
  }

  function pushMergeStartStep(left, middle, right, leftPart, rightPart) {
    steps.push({
      array: [...arr],
      active: groupRange(left, right),
      mergeView: {
        type: "merge-start",
        range: groupRange(left, right),
        leftGroup: groupRange(left, middle),
        rightGroup: groupRange(middle + 1, right),
        leftPointer: left,
        rightPointer: middle + 1,
        leftPointerValue: leftPart[0],
        rightPointerValue: rightPart[0],
        ...tempMeta(leftPart, rightPart, 0, 0)
      },
      text: `Start merging. The copied left and copied right groups are shown above the bars, so values do not disappear when a position is overwritten.`
    });
  }

  function pushCompareStep(left, middle, right, leftPart, rightPart, i, j, k) {
    const leftPointer = left + i;
    const rightPointer = middle + 1 + j;
    const leftValue = leftPart[i];
    const rightValue = rightPart[j];
    const takeLeft = leftValue <= rightValue;
    const selectedValue = takeLeft ? leftValue : rightValue;
    const selectedSide = takeLeft ? "left" : "right";
    const selectedIndex = takeLeft ? leftPointer : rightPointer;
    const selectedTempIndex = takeLeft ? i : j;
    const displacedInfo = getDisplacedInfo(left, middle, k, selectedValue);

    steps.push({
      array: [...arr],
      active: [leftPointer, rightPointer, k],
      mergeView: {
        type: "compare",
        range: groupRange(left, right),
        leftGroup: groupRange(left, middle),
        rightGroup: groupRange(middle + 1, right),
        leftPointer,
        rightPointer,
        leftPointerValue: leftValue,
        rightPointerValue: rightValue,
        selectedIndex,
        selectedValue,
        selectedSide,
        selectedTempIndex,
        writeIndex: k,
        merged: k > left ? groupRange(left, k - 1) : [],
        ...tempMeta(leftPart, rightPart, i, j, selectedSide, selectedTempIndex, displacedInfo)
      },
      text: `L pointer = ${leftValue}, R pointer = ${rightValue}. ${selectedValue} is smaller, so it is selected from the ${selectedSide} copy and will be put into position ${k + 1}.`
    });
  }

  function pushWriteStep(left, middle, right, writeIndex, value, sourceSide, pointerIndex, leftPart, rightPart, iBefore, jBefore, selectedTempIndex, displacedInfo = {}) {
    const mergedUntilNow = groupRange(left, writeIndex);
    const leftPointer = iBefore < leftPart.length ? left + iBefore : null;
    const rightPointer = jBefore < rightPart.length ? middle + 1 + jBefore : null;

    steps.push({
      array: [...arr],
      active: [writeIndex, pointerIndex].filter((position) => typeof position === "number"),
      mergeView: {
        type: "write",
        range: groupRange(left, right),
        leftGroup: groupRange(left, middle),
        rightGroup: groupRange(middle + 1, right),
        leftPointer,
        rightPointer,
        leftPointerValue: iBefore < leftPart.length ? leftPart[iBefore] : undefined,
        rightPointerValue: jBefore < rightPart.length ? rightPart[jBefore] : undefined,
        selectedIndex: pointerIndex,
        selectedValue: value,
        selectedSide: sourceSide.startsWith("left") ? "left" : "right",
        selectedTempIndex,
        writeIndex,
        merged: mergedUntilNow,
        ...tempMeta(
          leftPart,
          rightPart,
          iBefore,
          jBefore,
          sourceSide.startsWith("left") ? "left" : "right",
          selectedTempIndex,
          displacedInfo
        )
      },
      text: displacedInfo.displacedValue !== undefined
        ? `${value} is written into position ${writeIndex + 1}. The old value ${displacedInfo.displacedValue} is still visible in the copied ${displacedInfo.displacedTempSide} group above, so it can be placed later.`
        : `${value} is written into position ${writeIndex + 1}. The selected number rises, then appears in the merged output area.`
    });
  }

  function mergeSort(left, right) {
    if (left >= right) return;

    const middle = Math.floor((left + right) / 2);
    pushDivideStep(left, middle, right);

    mergeSort(left, middle);
    mergeSort(middle + 1, right);
    merge(left, middle, right);
  }

  function merge(left, middle, right) {
    const leftPart = arr.slice(left, middle + 1);
    const rightPart = arr.slice(middle + 1, right + 1);

    pushMergeStartStep(left, middle, right, leftPart, rightPart);

    let i = 0;
    let j = 0;
    let k = left;

    while (i < leftPart.length && j < rightPart.length) {
      checks++;
      const leftPointer = left + i;
      const rightPointer = middle + 1 + j;
      const takeLeft = leftPart[i] <= rightPart[j];
      const selectedValue = takeLeft ? leftPart[i] : rightPart[j];
      const sourceSide = takeLeft ? "left" : "right";
      const pointerIndex = takeLeft ? leftPointer : rightPointer;
      const selectedTempIndex = takeLeft ? i : j;
      const iBefore = i;
      const jBefore = j;

      pushCompareStep(left, middle, right, leftPart, rightPart, iBefore, jBefore, k);

      const displacedInfo = getDisplacedInfo(left, middle, k, selectedValue);
      arr[k] = selectedValue;
      if (takeLeft) i++;
      else j++;
      changes++;
      pushWriteStep(left, middle, right, k, selectedValue, sourceSide, pointerIndex, leftPart, rightPart, iBefore, jBefore, selectedTempIndex, displacedInfo);

      k++;
    }

    while (i < leftPart.length) {
      const selectedValue = leftPart[i];
      const pointerIndex = left + i;
      const iBefore = i;
      const jBefore = j;
      const displacedInfo = getDisplacedInfo(left, middle, k, selectedValue);

      steps.push({
        array: [...arr],
        active: [pointerIndex, k],
        mergeView: {
          type: "remaining-left",
          range: groupRange(left, right),
          leftGroup: groupRange(left, middle),
          rightGroup: groupRange(middle + 1, right),
          leftPointer: pointerIndex,
          leftPointerValue: selectedValue,
          selectedIndex: pointerIndex,
          selectedValue,
          selectedSide: "left",
          selectedTempIndex: iBefore,
          writeIndex: k,
          merged: k > left ? groupRange(left, k - 1) : [],
          ...tempMeta(leftPart, rightPart, iBefore, jBefore, "left", iBefore, displacedInfo)
        },
        text: `Right group is empty, so the remaining left value ${selectedValue} is selected and put into position ${k + 1}.`
      });
      arr[k] = selectedValue;
      i++;
      changes++;
      pushWriteStep(left, middle, right, k, selectedValue, "left", pointerIndex, leftPart, rightPart, iBefore, jBefore, iBefore, displacedInfo);
      k++;
    }

    while (j < rightPart.length) {
      const selectedValue = rightPart[j];
      const pointerIndex = middle + 1 + j;
      const iBefore = i;
      const jBefore = j;
      const displacedInfo = getDisplacedInfo(left, middle, k, selectedValue);

      steps.push({
        array: [...arr],
        active: [pointerIndex, k],
        mergeView: {
          type: "remaining-right",
          range: groupRange(left, right),
          leftGroup: groupRange(left, middle),
          rightGroup: groupRange(middle + 1, right),
          rightPointer: pointerIndex,
          rightPointerValue: selectedValue,
          selectedIndex: pointerIndex,
          selectedValue,
          selectedSide: "right",
          selectedTempIndex: jBefore,
          writeIndex: k,
          merged: k > left ? groupRange(left, k - 1) : [],
          ...tempMeta(leftPart, rightPart, iBefore, jBefore, "right", jBefore, displacedInfo)
        },
        text: `Left group is empty, so the remaining right value ${selectedValue} is selected and put into position ${k + 1}.`
      });
      arr[k] = selectedValue;
      j++;
      changes++;
      pushWriteStep(left, middle, right, k, selectedValue, "right", pointerIndex, leftPart, rightPart, iBefore, jBefore, jBefore, displacedInfo);
      k++;
    }

    steps.push({
      array: [...arr],
      active: groupRange(left, right),
      mergeView: {
        type: "merged",
        range: groupRange(left, right),
        merged: groupRange(left, right)
      },
      text: `Positions ${left + 1} to ${right + 1} are now merged and ordered.`
    });
  }

  mergeSort(0, arr.length - 1);
  steps.push({
    array: [...arr],
    active: arr.map((_, i) => i),
    mergeView: { type: "complete", merged: arr.map((_, i) => i) },
    text: "Merge Sort finished. All small sorted groups have been merged into one ordered list."
  });

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
