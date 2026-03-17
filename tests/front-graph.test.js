const FrontPlanner = require("../front-planner.js");

function assert(ok, msg) {
  if (!ok) throw new Error("FAIL: " + msg);
}

function makeState() {
  return {
    t: 0,
    players: new Map(),
    units: new Map(),
    squads: new Map(),
    engagementZones: new Map(),
    mines: new Map(),
    pirateBases: [],
    botPlayerIds: new Set(),
    nextSquadId: 1,
    nextEngagementZoneId: 1
  };
}

function addPlayer(state, id, x, y) {
  state.players.set(id, { id, x, y, eliminated: false });
}

function testFrontGraphUsesRingNeighbors() {
  const state = makeState();
  addPlayer(state, 1, 0, -100);
  addPlayer(state, 2, 100, 0);
  addPlayer(state, 3, 0, 100);
  addPlayer(state, 4, -100, 0);

  FrontPlanner.buildCenterObjectives(state);
  const graph = FrontPlanner.buildFrontGraph(state);

  assert(graph[1].leftTargetCoreId === 4, "core 1 left neighbor = 4");
  assert(graph[1].rightTargetCoreId === 2, "core 1 right neighbor = 2");
  assert(graph[2].leftTargetCoreId === 1, "core 2 left neighbor = 1");
  assert(graph[2].rightTargetCoreId === 3, "core 2 right neighbor = 3");
  assert(graph[3].leftTargetCoreId === 2, "core 3 left neighbor = 2");
  assert(graph[3].rightTargetCoreId === 4, "core 3 right neighbor = 4");
  assert(graph[4].leftTargetCoreId === 3, "core 4 left neighbor = 3");
  assert(graph[4].rightTargetCoreId === 1, "core 4 right neighbor = 1");
  console.log("  [OK] testFrontGraphUsesRingNeighbors");
}

function testFrontGraphSkipsEliminatedCore() {
  const state = makeState();
  addPlayer(state, 1, 0, -100);
  addPlayer(state, 2, 100, 0);
  addPlayer(state, 3, 0, 100);
  addPlayer(state, 4, -100, 0);
  state.players.get(2).eliminated = true;

  FrontPlanner.buildCenterObjectives(state);
  const graph = FrontPlanner.buildFrontGraph(state);

  assert(graph[1].leftTargetCoreId === 4, "with eliminated core, left still wraps correctly");
  assert(graph[1].rightTargetCoreId === 3, "with eliminated core, right still resolves to the next live core");
  assert(Array.isArray(graph[1].rightPath) && graph[1].rightPath.length === 2, "right lane keeps the dead core as an intermediate waypoint");
  assert(graph[1].rightPath[0].coreId === 2 && graph[1].rightPath[0].eliminated === true, "dead neighbor stays on the lane route");
  assert(graph[1].rightPath[1].coreId === 3, "lane continues from dead neighbor to next live core");
  assert(graph[3].leftTargetCoreId === 1, "bottom core left still resolves to the next live core");
  assert(graph[4].rightTargetCoreId === 1, "left core right wraps to top core");
  console.log("  [OK] testFrontGraphSkipsEliminatedCore");
}

function testSideLaneMinePlacementsFollowNeighborPairs() {
  const entries = [
    { id: 1, x: 0, y: -200 },
    { id: 2, x: 200, y: 0 },
    { id: 3, x: 0, y: 200 },
    { id: 4, x: -200, y: 0 }
  ];
  const mines = FrontPlanner.buildSideLaneMinePlacements(entries, { x: 0, y: 0 });

  assert(mines.length === 8, "4 adjacent pairs produce only midpoint mine pairs");
  const pairKeys = new Set(mines.map((mine) => mine.pairKey));
  assert(pairKeys.size === 4, "mine placements are grouped by 4 unique neighbor pairs");
  const midpointCluster = mines.filter((mine) => mine.pairKey === "1:2" && mine.laneRole === "mid");
  assert(midpointCluster.length === 2, "each pair gets 2 midpoint mines");
  assert(midpointCluster.some((mine) => mine.resourceType === "money"), "midpoint cluster keeps money mine");
  assert(midpointCluster.some((mine) => mine.resourceType === "xp"), "midpoint cluster keeps xp mine");
  console.log("  [OK] testSideLaneMinePlacementsFollowNeighborPairs");
}

function testDuelFrontGraphCreatesDistinctLeftAndRightLanes() {
  const state = makeState();
  addPlayer(state, 1, -220, 0);
  addPlayer(state, 2, 220, 0);

  FrontPlanner.buildCenterObjectives(state);
  const graph = FrontPlanner.buildFrontGraph(state);

  assert(graph[1].leftTargetCoreId === 2, "duel left lane still targets the enemy core");
  assert(graph[1].rightTargetCoreId === 2, "duel right lane still targets the enemy core");
  assert(Array.isArray(graph[1].leftPath) && graph[1].leftPath.length >= 2, "duel left lane has an intermediate flank waypoint");
  assert(Array.isArray(graph[1].rightPath) && graph[1].rightPath.length >= 2, "duel right lane has an intermediate flank waypoint");
  assert(Math.round(graph[1].leftPath[0].y) !== Math.round(graph[1].rightPath[0].y), "duel left/right lanes split to opposite flanks");
  console.log("  [OK] testDuelFrontGraphCreatesDistinctLeftAndRightLanes");
}

function testDuelSideLaneMinesCreateTwoFlanks() {
  const entries = [
    { id: 1, x: -220, y: 0 },
    { id: 2, x: 220, y: 0 }
  ];
  const mines = FrontPlanner.buildSideLaneMinePlacements(entries, { x: 0, y: 0 });

  assert(mines.length === 4, "duel map creates 2 side lanes with money/xp mine pairs");
  const pairKeys = new Set(mines.map((mine) => mine.pairKey));
  assert(pairKeys.size === 2, "duel side-lane mines are grouped into left/right flank pairs");
  const ys = mines.map((mine) => Math.round(mine.y));
  assert(ys.some((y) => y < 0) && ys.some((y) => y > 0), "duel mines appear on both flank lanes");
  console.log("  [OK] testDuelSideLaneMinesCreateTwoFlanks");
}

function runAll() {
  console.log("front-graph tests:");
  testFrontGraphUsesRingNeighbors();
  testFrontGraphSkipsEliminatedCore();
  testSideLaneMinePlacementsFollowNeighborPairs();
  testDuelFrontGraphCreatesDistinctLeftAndRightLanes();
  testDuelSideLaneMinesCreateTwoFlanks();
  console.log("All front-graph tests passed.");
}

runAll();
