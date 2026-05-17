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
  entrySeconds,
  sortedSearchSeconds,
  unsortedCheckSeconds,
  sortSecondsPerItemLog
}) {
  const [approach, setApproach] = useState("unsorted");
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const journeys = useMemo(() => buildKDJourney(selectedKd, {
    entrySeconds: Number(entrySeconds),
    sortedSearchSeconds: Number(sortedSearchSeconds),
    unsortedCheckSeconds: Number(unsortedCheckSeconds),
    sortSecondsPerItemLog: Number(sortSecondsPerItemLog)
  }), [selectedKd, entrySeconds, sortedSearchSeconds, unsortedCheckSeconds, sortSecondsPerItemLog]);

  const currentJourney = journeys[approach] || journeys.unsorted;
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
          title="Outside / waiting"
          subtitle={currentStep.sourceSubtitle || "Before entering the KD"}
          items={currentStep.sourceItems}
          emptyText="Nothing outside"
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
          title="Search area"
          subtitle={currentStep.searchSubtitle}
          items={currentStep.searchItems}
          emptyText="No active search"
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
          title="Device"
          subtitle={currentStep.deviceSubtitle || "Production output"}
          items={currentStep.deviceItems || []}
          emptyText="No item in device yet"
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
          <p>One KD, 17 items, and three approaches: unsorted, collect then sort, and collect while sorting.</p>
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
          <b>Phase 1</b>
          <span>The hover scan selects the next outside item, then it moves into the KD box.</span>
        </div>
        <div>
          <b>Phase 2</b>
          <span>The KD is emptied first, then every search is shown: checked items, found item, then return to KD.</span>
        </div>
        <div>
          <b>Phase 3</b>
          <span>Each item is searched inside the KD first, selected, then sent from KD to the device.</span>
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
  if (phase.includes("Sort after collecting")) return ["kd"];
  if (phase.includes("Phase 1")) return ["source", "kd"];
  if (phase.includes("Phase 2")) return ["search", "kd"];
  if (phase.includes("Phase 3")) return ["kd", "device"];
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

function buildKDJourney(kd, settings) {
  const items = kd?.items || [];
  const sortedItems = [...items].sort((a, b) => a.code.localeCompare(b.code));
  const itemCount = items.length;
  const creationTotal = itemCount * settings.entrySeconds;
  const unsortedPhase2Total = calculateUnsortedSearchWithRemovalSeconds(itemCount, settings.unsortedCheckSeconds);
  const unsortedPhase3Total = calculateUnsortedSearchWithRemovalSeconds(itemCount, settings.unsortedCheckSeconds);
  const sortedSearchTotal = calculateSortedSearchSeconds(itemCount, settings.sortedSearchSeconds);
  const sortAfterSeconds = calculateSortingSeconds(itemCount, settings.sortSecondsPerItemLog);
  const sortWhileSeconds = itemCount * settings.sortSecondsPerItemLog;

  const totals = {
    unsorted: creationTotal + unsortedPhase2Total + unsortedPhase3Total,
    sortedAfter: creationTotal + sortAfterSeconds + sortedSearchTotal + sortedSearchTotal,
    sortedWhile: creationTotal + sortWhileSeconds + sortedSearchTotal + sortedSearchTotal
  };

  const bestTotal = Math.min(totals.unsorted, totals.sortedAfter, totals.sortedWhile);

  return {
    unsorted: {
      key: "unsorted",
      title: "Unsorted",
      short: "Collect normally, then search item by item",
      totalSeconds: totals.unsorted,
      totalLabel: totals.unsorted === bestTotal ? "Best time" : "Slowest search",
      steps: buildJourneySteps({
        approach: "unsorted",
        items,
        sortedItems,
        creationSeconds: settings.entrySeconds,
        sortedSearchSeconds: settings.sortedSearchSeconds,
        unsortedCheckSeconds: settings.unsortedCheckSeconds,
        sortAfterSeconds: 0,
        sortWhileSecondsPerItem: 0
      })
    },
    sortedAfter: {
      key: "sortedAfter",
      title: "Sorted: collect then sort",
      short: "Collect first, then sort the KD once",
      totalSeconds: totals.sortedAfter,
      totalLabel: totals.sortedAfter === bestTotal ? "Best time" : "Pays sorting once",
      steps: buildJourneySteps({
        approach: "sortedAfter",
        items,
        sortedItems,
        creationSeconds: settings.entrySeconds,
        sortedSearchSeconds: settings.sortedSearchSeconds,
        unsortedCheckSeconds: settings.unsortedCheckSeconds,
        sortAfterSeconds,
        sortWhileSecondsPerItem: 0
      })
    },
    sortedWhile: {
      key: "sortedWhile",
      title: "Sorted: collect while sorting",
      short: "Place each item directly in order while collecting",
      totalSeconds: totals.sortedWhile,
      totalLabel: totals.sortedWhile === bestTotal ? "Best time" : "Sorted during creation",
      steps: buildJourneySteps({
        approach: "sortedWhile",
        items,
        sortedItems,
        creationSeconds: settings.entrySeconds,
        sortedSearchSeconds: settings.sortedSearchSeconds,
        unsortedCheckSeconds: settings.unsortedCheckSeconds,
        sortAfterSeconds: 0,
        sortWhileSecondsPerItem: settings.sortSecondsPerItemLog
      })
    }
  };
}

function buildJourneySteps({
  approach,
  items,
  sortedItems,
  creationSeconds,
  sortedSearchSeconds,
  unsortedCheckSeconds,
  sortAfterSeconds,
  sortWhileSecondsPerItem
}) {
  let cumulativeSeconds = 0;
  const steps = [];
  const isSortedApproach = approach !== "unsorted";
  const titleByApproach = {
    unsorted: "Unsorted journey",
    sortedAfter: "Sorted journey: collect then sort",
    sortedWhile: "Sorted journey: collect while sorting"
  };

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
      deviceSubtitle: "Production output",
      searchSubtitle: "No search yet",
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
    description: "The KD starts outside the process. Press Play or Next to follow the full journey.",
    sourceItems: items,
    moveLabel: "Ready",
    resultLabel: "KD empty"
  });

  let outsidePool = [...items];
  let collectedItems = [];

  for (let collectionStep = 0; collectionStep < items.length; collectionStep += 1) {
    const targetIndex = isSortedApproach ? 0 : getSlowUnsortedTargetIndex(outsidePool.length, collectionStep);
    const item = outsidePool[targetIndex];
    const phase1ScanPool = [...outsidePool];
    const scanChecks = targetIndex + 1;
    const collectedBeforeInsert = [...collectedItems];
    const kdItemsBeforeInsert = approach === "sortedWhile"
      ? [...collectedBeforeInsert].sort((a, b) => a.code.localeCompare(b.code))
      : collectedBeforeInsert;

    pushStep({
      phase: "Phase 1: KD Creation",
      title: `Search outside for ${item.code}`,
      description: `The hover scan checks ${scanChecks} outside chip${scanChecks === 1 ? "" : "s"}. ${item.code} is only highlighted as FOUND here; it is not inserted into the KD box yet.`,
      sourceItems: getSearchPreviewItems(item, phase1ScanPool, false),
      kdItems: kdItemsBeforeInsert,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "🔍",
      moveLabel: "Scanning outside",
      resultLabel: "Searching...",
      searchLabel: "Scanning...",
      searchingOnly: true,
      sourceSubtitle: `Outside scan: ${scanChecks} check${scanChecks === 1 ? "" : "s"}`,
      searchSubtitle: "Phase 1 collection scan",
      kdSubtitle: collectedBeforeInsert.length ? "KD content before insertion" : "KD is still empty",
      scanSource: true,
      holdMs: getJourneyScanHoldMs(scanChecks)
    });

    const timeAdded = creationSeconds + (approach === "sortedWhile" ? sortWhileSecondsPerItem : 0);
    cumulativeSeconds += timeAdded;

    collectedItems = [...collectedItems, item];
    outsidePool = removeItemAtIndex(outsidePool, targetIndex);

    const kdItems = approach === "sortedWhile"
      ? [...collectedItems].sort((a, b) => a.code.localeCompare(b.code))
      : collectedItems;

    pushStep({
      phase: "Phase 1: KD Creation",
      title: approach === "sortedWhile" ? `Insert ${item.code} in sorted position` : `Insert ${item.code} into the KD box`,
      description: approach === "sortedWhile"
        ? `${item.code} was found first, and now it enters the KD box in its sorted position. Time = ${creationSeconds}s creation + ${sortWhileSecondsPerItem}s sorted placement.`
        : `${item.code} was found first, and only now it moves from outside into the KD box.`,
      sourceItems: outsidePool,
      kdItems,
      activeItem: item,
      timeAdded,
      cumulativeSeconds,
      icon: "📥",
      moveLabel: "Found → KD",
      resultLabel: approach === "sortedWhile" ? "Inserted sorted" : "Inserted into KD",
      sourceSubtitle: "Outside items remaining",
      kdSubtitle: "KD content after insertion",
      searchSubtitle: "Insertion after search"
    });
  }

  if (approach === "sortedAfter") {
    cumulativeSeconds += sortAfterSeconds;
    pushStep({
      phase: "Phase 1: Sort after collecting",
      title: "Sort the collected KD once",
      description: `All items are already collected. Now the KD is sorted once before checking starts. Sorting time = ${formatDurationShort(sortAfterSeconds)}.`,
      kdItems: sortedItems,
      timeAdded: sortAfterSeconds,
      cumulativeSeconds,
      icon: "↕️",
      moveLabel: "Sort",
      resultLabel: "KD ordered",
      searchSubtitle: "No search yet"
    });
  }

  let phase2Pool = isSortedApproach ? [...sortedItems] : [...collectedItems];
  let phase2ReturnedItems = [];

  pushStep({
    phase: "Phase 2: KD Check",
    title: "Empty the KD before checking",
    description: "The KD box is emptied first. Items are searched one by one, and every found item is returned to the KD box.",
    searchItems: phase2Pool,
    kdItems: [],
    timeAdded: 0,
    cumulativeSeconds,
    icon: "📤",
    moveLabel: "Empty KD",
    resultLabel: "Ready to check",
    searchSubtitle: "Items waiting for checking"
  });

  const phase2Iterations = phase2Pool.length;
  for (let searchStep = 0; searchStep < phase2Iterations; searchStep += 1) {
    const targetIndex = isSortedApproach ? 0 : getSlowUnsortedTargetIndex(phase2Pool.length, searchStep);
    const item = phase2Pool[targetIndex];
    const remainingBeforeSearch = phase2Pool.length;
    const checksNeeded = targetIndex + 1;
    const timeAdded = isSortedApproach
      ? sortedSearchSeconds
      : checksNeeded * unsortedCheckSeconds;
    cumulativeSeconds += timeAdded;

    pushStep({
      phase: "Phase 2: KD Check",
      title: `Search for ${item.code}`,
      description: isSortedApproach
        ? `${item.code} is reached quickly because the temporary search list is sorted.`
        : `The operator does not get ${item.code} immediately. The hover scan checks ${checksNeeded} item${checksNeeded === 1 ? "" : "s"} from the unsorted list before the green FOUND chip appears.`,
      searchItems: getSearchPreviewItems(item, phase2Pool, isSortedApproach),
      kdItems: phase2ReturnedItems,
      activeItem: item,
      timeAdded,
      cumulativeSeconds,
      icon: "🔍",
      moveLabel: isSortedApproach ? "Fast search" : "Search item by item",
      resultLabel: "Searching...",
      searchLabel: isSortedApproach ? "Fast search" : "Checking...",
      searchingOnly: true,
      searchSubtitle: isSortedApproach ? "Sorted search path" : `Unsorted scan: ${checksNeeded}/${remainingBeforeSearch} checks`,
      kdSubtitle: "Found items already returned",
      holdMs: getJourneyScanHoldMs(checksNeeded)
    });

    phase2Pool = removeItemAtIndex(phase2Pool, targetIndex);
    phase2ReturnedItems = [...phase2ReturnedItems, item];

    pushStep({
      phase: "Phase 2: KD Check",
      title: `Return ${item.code} to the KD box`,
      description: `${item.code} is now found, so it is put back into the KD box. The next item will be searched from the remaining search area.`,
      searchItems: phase2Pool,
      kdItems: phase2ReturnedItems,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "📥",
      moveLabel: "Found",
      resultLabel: "Found → KD",
      searchSubtitle: "Items still waiting for checking",
      kdSubtitle: "Returned found items"
    });
  }

  let phase3Pool = isSortedApproach ? [...sortedItems] : [...phase2ReturnedItems];
  let deviceItems = [];
  const phase3Iterations = phase3Pool.length;

  for (let productionStep = 0; productionStep < phase3Iterations; productionStep += 1) {
    const targetIndex = isSortedApproach ? 0 : getSlowUnsortedTargetIndex(phase3Pool.length, productionStep);
    const item = phase3Pool[targetIndex];
    const remainingBeforeDevice = phase3Pool.length;
    const checksNeeded = targetIndex + 1;
    const timeAdded = isSortedApproach
      ? sortedSearchSeconds
      : checksNeeded * unsortedCheckSeconds;
    cumulativeSeconds += timeAdded;

    pushStep({
      phase: "Phase 3: Production",
      title: `Search inside KD for ${item.code}`,
      description: isSortedApproach
        ? `${item.code} is selected quickly inside the sorted KD before moving to the device.`
        : `The KD is still unordered, so the hover scan checks ${checksNeeded} item${checksNeeded === 1 ? "" : "s"} inside the KD before ${item.code} is found.`,
      kdItems: getSearchPreviewItems(item, phase3Pool, isSortedApproach),
      deviceItems,
      activeItem: item,
      timeAdded,
      cumulativeSeconds,
      icon: "🔎",
      moveLabel: "Search in KD",
      resultLabel: "Found in KD",
      searchLabel: isSortedApproach ? "Fast KD search" : "Searching KD...",
      searchingOnly: true,
      deviceIcon: "🔎",
      deviceLabel: "Searching...",
      deviceSubtitle: "Items already sent to device",
      kdSubtitle: isSortedApproach ? "Sorted KD search path" : `Unsorted KD scan: ${checksNeeded}/${remainingBeforeDevice} checks`,
      searchSubtitle: `Remaining KD items: ${remainingBeforeDevice}`,
      holdMs: getJourneyScanHoldMs(checksNeeded)
    });

    phase3Pool = removeItemAtIndex(phase3Pool, targetIndex);
    deviceItems = [...deviceItems, item];

    pushStep({
      phase: "Phase 3: Production",
      title: `Send ${item.code} from KD to the device`,
      description: `${item.code} leaves the KD box and becomes part of the device. The KD now contains only the remaining items.`,
      kdItems: phase3Pool,
      deviceItems,
      activeItem: item,
      timeAdded: 0,
      cumulativeSeconds,
      icon: "➡️",
      moveLabel: "Selected",
      resultLabel: "Remaining KD",
      deviceIcon: "➡️",
      deviceLabel: "KD → Device",
      deviceSubtitle: "Items already sent to device",
      kdSubtitle: "Remaining KD content",
      searchSubtitle: `Remaining KD items: ${phase3Pool.length}`
    });
  }

  pushStep({
    phase: "End",
    title: "Journey finished",
    description: `The full journey is complete. The selected items have moved from KD to device. Total time for this approach is ${formatDuration(cumulativeSeconds)}.`,
    kdItems: [],
    deviceItems,
    timeAdded: 0,
    cumulativeSeconds,
    icon: "✅",
    moveLabel: "Complete",
    resultLabel: "KD empty",
    deviceIcon: "✅",
    deviceLabel: "Completed",
    deviceSubtitle: "Device received the items",
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
  sortedCollectionMode,
  entrySeconds,
  sortedSearchSeconds,
  unsortedCheckSeconds,
  sortSecondsPerItemLog
}) {
  const steps = getIntegratedKDFlowSteps(scenario, sortedCollectionMode);
  const currentStep = steps[activeStep] || steps[0];
  const phaseDurations = selectedResult?.phases || [];
  const previewItems = selectedKd?.items?.slice(0, 6) || [];

  return (
    <section className="card integrated-flow-card">
      <div className="kd-section-head">
        <div>
          <h3>Visual process flow</h3>
          <p>Connect the process flow with the phase timing for the selected KD.</p>
        </div>

        <div className="integrated-flow-toggle">
          <button
            className={scenario === "unsorted" ? "active" : ""}
            onClick={() => { setScenario("unsorted"); setActiveStep(0); }}
          >
            Unsorted KD
          </button>
          <button
            className={scenario === "sorted" ? "active" : ""}
            onClick={() => { setScenario("sorted"); setActiveStep(0); }}
          >
            Sorted KD
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
                  ? "Phase 3: selected items leave the KD and go to the device."
                  : "Before Phase 3, checked items are still inside the KD or returned back to it."}
              </div>
            </div>

            <div className="flow-phase-times">
              <h4>Same numbers from the timing table</h4>
              {phaseDurations.map((phase) => (
                <div key={phase.phase} className="phase-time-line">
                  <b>{getKDPhaseName(phase.phase)}</b>
                  <span>Unsorted: {formatDurationShort(phase.unsortedSeconds)}</span>
                  <span>Sorted: {formatDurationShort(phase.sortedSeconds)}</span>
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
  const sortingTotal = settings.scenario === "sorted"
    ? settings.sortedCollectionMode === "after"
      ? calculateSortingSeconds(itemCount, settings.sortSecondsPerItemLog)
      : itemCount * settings.sortSecondsPerItemLog
    : 0;
  const sortingPerItem = itemCount > 0 ? sortingTotal / itemCount : 0;

  let cumulativeSeconds = 0;

  return kd.items.map((item, index) => {
    const remainingBeforeSearch = itemCount - index;
    const creationSeconds = settings.entrySeconds;
    const sortingSeconds = settings.scenario === "sorted" ? sortingPerItem : 0;

    const checkSeconds = settings.scenario === "unsorted"
      ? ((remainingBeforeSearch + 1) / 2) * settings.unsortedCheckSeconds
      : settings.sortedSearchSeconds;

    const productionSeconds = settings.scenario === "unsorted"
      ? ((itemCount + 1) / 2) * settings.unsortedCheckSeconds
      : settings.sortedSearchSeconds;

    const phase1Seconds = creationSeconds + sortingSeconds;
    const totalSeconds = phase1Seconds + checkSeconds + productionSeconds;

    cumulativeSeconds += totalSeconds;

    return {
      sequence: index + 1,
      item,
      remainingBeforeSearch,
      creationSeconds,
      sortingSeconds,
      phase1Seconds,
      checkSeconds,
      productionSeconds,
      totalSeconds,
      cumulativeSeconds
    };
  });
}

function getIntegratedStageNodes(activeStep, scenario) {
  const sortedTone = scenario === "sorted" ? "good" : "warn";

  if (activeStep === 0) {
    return [
      { icon: "📦", title: "KD box", subtitle: scenario === "sorted" ? "Ready to organize" : "Random order", tone: sortedTone }
    ];
  }

  if (activeStep === 1) {
    return [
      { icon: "📥", title: "Outside", subtitle: "Waiting items", tone: "warn" },
      { icon: "🏗️", title: "Phase 1", subtitle: "KD Creation" },
      { icon: "📦", title: "KD box", subtitle: scenario === "sorted" ? "Collected sorted" : "Collected" , tone: sortedTone }
    ];
  }

  if (activeStep === 2) {
    return [
      { icon: "🔍", title: "Search area", subtitle: scenario === "sorted" ? "Fast lookup" : "Item-by-item" , tone: "warn" },
      { icon: scenario === "sorted" ? "✅" : "🔎", title: "Phase 2", subtitle: "KD Check" },
      { icon: "📦", title: "KD box", subtitle: "Found items returned", tone: "good" }
    ];
  }

  if (activeStep === 3) {
    return [
      { icon: "📦", title: "KD box", subtitle: "Select item", tone: sortedTone },
      { icon: "🏭", title: "Phase 3", subtitle: "Production" },
      { icon: "🧩", title: "Device", subtitle: "Receives item", tone: "good" }
    ];
  }

  return [
    { icon: "⏱️", title: scenario === "sorted" ? "Time Saved" : "Time Used", subtitle: scenario === "sorted" ? "Less search" : "Repeated search", tone: sortedTone }
  ];
}

function getFlowMiniItemState(index, activeStep, scenario) {
  const sortedClass = scenario === "sorted" ? " sorted" : "";
  const foundIndex = scenario === "sorted" ? 1 : 3;

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
        label: "hover checked"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "FOUND → KD"
      };
    }

    return {
      className: `flow-mini-item waiting${sortedClass}`,
      label: "waiting to collect"
    };
  }

  if (activeStep === 2) {
    if (index < foundIndex) {
      return {
        className: `flow-mini-item checked scan-card${sortedClass}`,
        label: "hover checked"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "FOUND → KD"
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
        label: "already device"
      };
    }

    if (index < foundIndex) {
      return {
        className: `flow-mini-item checked scan-card${sortedClass}`,
        label: "hover checked"
      };
    }

    if (index === foundIndex) {
      return {
        className: `flow-mini-item found scan-card${sortedClass}`,
        label: "FOUND → device"
      };
    }

    return {
      className: `flow-mini-item waiting${sortedClass}`,
      label: "still inside KD"
    };
  }

  return {
    className: "flow-mini-item used",
    label: "used by device"
  };
}

function getIntegratedKDFlowSteps(scenario, sortedCollectionMode) {
  if (scenario === "unsorted") {
    return [
      {
        icon: "📦",
        title: "KD contains items",
        short: "Random order",
        badge: "Start",
        description: "The KD contains multiple item codes and names, but they are not organized.",
        explain: "Because the KD is random, the operator may check several items before finding the needed one."
      },
      {
        icon: "🏗️",
        title: "Phase 1: KD Creation",
        short: "Create the KD",
        badge: "Phase 1",
        description: "The hover scan selects each waiting item before it enters the KD.",
        explain: "KD Creation time is required in both sorted and unsorted scenarios. The visual now shows the selected item being found before it moves into the KD."
      },
      {
        icon: "🔍",
        title: "Phase 2: KD Check",
        short: "Search item by item",
        badge: "Phase 2",
        description: "The operator checks the KD until the required item is found.",
        explain: "After a found item is checked, it is returned to the KD box. The search is still slower because the checking order is unsorted."
      },
      {
        icon: "🏭",
        title: "Phase 3: Production",
        short: "KD → Device",
        badge: "Phase 3",
        description: "Production searches/selects the needed item inside the KD, then the item goes out from the KD to the device.",
        explain: "This phase is not only checking. The useful item leaves the KD and becomes part of the device, so unsorted searching still costs time before movement."
      },
      {
        icon: "⏱️",
        title: "Impact",
        short: "Higher total time",
        badge: "Result",
        description: "Unsorted KD consumes more time because the search effort is repeated.",
        explain: "The more items inside the KD, the more expensive unsorted checking becomes."
      }
    ];
  }

  const sortText = sortedCollectionMode === "after"
    ? "Sorting cost is added in Phase 1 after collection."
    : "Items are placed directly in order while collecting, so the sorted factor is paid during KD creation.";

  return [
    {
      icon: "📦",
      title: "KD contains items",
      short: "Codes and names",
      badge: "Start",
      description: "The KD contains multiple items that can be organized by code.",
      explain: "The goal is to make later item access direct instead of searching repeatedly."
    },
    {
      icon: "🏗️",
      title: "Phase 1: KD Creation",
      short: sortedCollectionMode === "after" ? "Create + sort" : "Create organized",
      badge: "Phase 1",
      description: sortText,
      explain: sortedCollectionMode === "after"
        ? "This mode pays sorting time once, then benefits in the next phases."
        : "This mode avoids a separate sorting step because organization happens during creation."
    },
    {
      icon: "✅",
      title: "Phase 2: KD Check",
      short: "Direct access",
      badge: "Phase 2",
      description: "The KD is emptied first, then each item is found quickly and returned to the KD box.",
      explain: "Because the list is organized, Phase 2 does not waste time checking item by item through an unsorted pile."
    },
    {
      icon: "🏭",
      title: "Phase 3: Production",
      short: "KD → Device",
      badge: "Phase 3",
      description: "Production quickly finds/selects the needed item inside the sorted KD, then the item goes out from the KD to the device.",
      explain: "This is where the sorted KD continues saving time because the device receives items after fast access instead of repeated unsorted checking."
    },
    {
      icon: "⏱️",
      title: "Impact",
      short: "Lower total time",
      badge: "Result",
      description: "The sorted KD reduces repeated searching during KD Check and Production.",
      explain: "The simulation converts this process improvement into total saved time."
    }
  ];
}


function KDSimulationPage() {
  const [kdCount, setKdCount] = useState(1);
  const [itemMin, setItemMin] = useState(17);
  const [itemMax, setItemMax] = useState(17);
  const [entrySeconds, setEntrySeconds] = useState(40);
  const [sortedSearchSeconds, setSortedSearchSeconds] = useState(5);
  const [unsortedCheckSeconds, setUnsortedCheckSeconds] = useState(15);
  const [sortSecondsPerItemLog, setSortSecondsPerItemLog] = useState(3);
  const [sortedCollectionMode, setSortedCollectionMode] = useState("after");
  const [selectedKdIndex, setSelectedKdIndex] = useState(0);
  const [flowScenario, setFlowScenario] = useState("unsorted");
  const [flowStep, setFlowStep] = useState(0);
  const [kds, setKds] = useState(() => generateKDs(1, 17, 17));
  const [sourceTags, setSourceTags] = useState({
    kdCount: "Given",
    entrySeconds: "Given",
    sortedSearchSeconds: "Given",
    unsortedCheckSeconds: "Given",
    sortSecondsPerItemLog: "Given"
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

  function updateSortedCollectionMode(mode) {
    setSortedCollectionMode(mode);
    setFlowScenario("sorted");
    setFlowStep(0);
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
            Compare unsorted KDs versus sorted KDs across 3 phases: KD Creation, KD Check, and Production.
          </p>
        </div>
        <div className="kd-hero-stats">
          <span><b>{kds.length}</b> KDs</span>
          <span><b>{FIXED_PHASE_COUNT}</b> phases</span>
          <span><b>{entrySeconds}</b>s creation/item</span>
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
            <label>KD creation time / item: <b>{entrySeconds}s</b></label>
            <SettingSourceSelect value={sourceTags.entrySeconds} onChange={(value) => updateSourceTag("entrySeconds", value)} />
          </div>
          <input type="range" min="10" max="300" step="10" value={entrySeconds} onChange={(e) => setEntrySeconds(Number(e.target.value))} />
          <small className="hint">Phase 1 is KD Creation. If mode is “Sort after collecting”, sorting is also counted in Phase 1.</small>

          <div className="kd-mode-box">
            <h4>Sorted KD mode</h4>
            <div className="mode-choice-grid">
              <button
                className={sortedCollectionMode === "after" ? "mode-choice active" : "mode-choice"}
                onClick={() => updateSortedCollectionMode("after")}
              >
                <b>Sort after collecting</b>
                <span>Collect all items first, then add sorting time in Phase 1.</span>
              </button>
              <button
                className={sortedCollectionMode === "while" ? "mode-choice active" : "mode-choice"}
                onClick={() => updateSortedCollectionMode("while")}
              >
                <b>Sort while collecting</b>
                <span>Put each item directly in its place while paying the sorted factor during creation.</span>
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
          <small className="hint">In Phase 2 the KD is emptied first, then each found item is put back into the KD box.</small>

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
              <span>{sortedCollectionMode === "after" ? "KD Creation + sorting in Phase 1" : "KD created directly organized"}</span>
            </div>

            <div className="card kd-summary unsorted">
              <small>Total unsorted KD time</small>
              <strong>{formatDuration(simulation.totalUnsortedSeconds)}</strong>
              <span>Repeated checking in KD Check and Production</span>
            </div>

            <div className={`card kd-summary ${simulation.totalSavedSeconds >= 0 ? "saving" : "loss"}`}>
              <small>{simulation.totalSavedSeconds >= 0 ? "Time saved by sorting" : "Extra time due to sorting"}</small>
              <strong>{formatDuration(Math.abs(simulation.totalSavedSeconds))}</strong>
              <span>{simulation.totalSavedSeconds >= 0 ? "Sorted process is faster overall" : "Sorting is not worth it with current settings"}</span>
            </div>
          </div>

          <KDJourneySimulation
            selectedKd={selectedKd}
            entrySeconds={entrySeconds}
            sortedSearchSeconds={sortedSearchSeconds}
            unsortedCheckSeconds={unsortedCheckSeconds}
            sortSecondsPerItemLog={sortSecondsPerItemLog}
          />

          <KDSimulationFlow
            selectedKd={selectedKd}
            selectedResult={selectedResult}
            scenario={flowScenario}
            setScenario={setFlowScenario}
            activeStep={flowStep}
            setActiveStep={setFlowStep}
            sortedCollectionMode={sortedCollectionMode}
            entrySeconds={entrySeconds}
            sortedSearchSeconds={sortedSearchSeconds}
            unsortedCheckSeconds={unsortedCheckSeconds}
            sortSecondsPerItemLog={sortSecondsPerItemLog}
          />

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
                <p>Select any KD to see its item codes, names, flow, and phase timing.</p>
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
                <h3>3-phase process timing for {selectedKd.id}</h3>
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
                          <td>{getKDPhaseName(phase.phase)}</td>
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
  if (phase === 1) return "Phase 1: KD Creation";
  if (phase === 2) return "Phase 2: KD Check";
  if (phase === 3) return "Phase 3: Production";
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
  const unsortedPhase2Search = calculateUnsortedSearchWithRemovalSeconds(itemCount, settings.unsortedCheckSeconds);
  const unsortedPhase3Search = calculateUnsortedSearchWithRemovalSeconds(itemCount, settings.unsortedCheckSeconds);
  const sortedSearchPerPhase = calculateSortedSearchSeconds(itemCount, settings.sortedSearchSeconds);
  const sortingSeconds = settings.sortedCollectionMode === "while"
    ? itemCount * settings.sortSecondsPerItemLog
    : calculateSortingSeconds(itemCount, settings.sortSecondsPerItemLog);

  let sortedSeconds = 0;
  let unsortedSeconds = 0;

  for (let phase = 1; phase <= phaseCount; phase++) {
    let unsortedPhaseSeconds = 0;
    let sortedPhaseSeconds = 0;
    let note = "";

    if (phase === 1) {
      // Phase 1 is the KD Creation phase.
      // Unsorted KD only pays KD creation time.
      // Sorted KD pays KD creation time + sorting time only if the selected mode is "Sort after collecting".
      unsortedPhaseSeconds = entryOnce;
      sortedPhaseSeconds = entryOnce + sortingSeconds;

      note = settings.sortedCollectionMode === "after"
        ? "KD Creation; sorted KD also pays sorting cost after collection"
        : "KD Creation; each item is placed directly in sorted position while collecting";
    } else if (phase === 2) {
      // Phase 2 starts by emptying the KD. Every found item is put back into the KD box.
      unsortedPhaseSeconds = unsortedPhase2Search;
      sortedPhaseSeconds = sortedSearchPerPhase;
      note = "Empty KD first, search item by item, then put each found item back into the KD";
    } else {
      // Phase 3 searches/selects inside the KD, then the item goes out to the device.
      // The KD content shrinks as items are sent to the device.
      unsortedPhaseSeconds = unsortedPhase3Search;
      sortedPhaseSeconds = sortedSearchPerPhase;
      note = "Search/select inside KD, then send each item from KD to the device";
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

function calculateUnsortedSearchWithRemovalSeconds(itemCount, checkSeconds) {
  // Phase 2 / Phase 3: unsorted search does not always find the first item.
  // The same slow-search pattern used in the visual is used here so the timing and journey match.
  let totalChecks = 0;
  let iterationIndex = 0;

  for (let remainingItems = itemCount; remainingItems >= 1; remainingItems -= 1) {
    totalChecks += getSlowUnsortedTargetIndex(remainingItems, iterationIndex) + 1;
    iterationIndex += 1;
  }

  return totalChecks * checkSeconds;
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
