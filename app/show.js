export function newShow() {
  return {
    phase: 'lobby', teams: [], players: [], awards: [], results: {},
    current: null, pending: null, revealed: false, deadline: null, pausedMs: null,
    locks: {}, buzzedTeamId: null, buzzedPlayerId: null, choiceResponses: [], choiceResults: {}, finaleStart: null
  };
}

export function award(show, kind, id, points, { musicQuiz = false, announce = false } = {}) {
  if (!Number.isSafeInteger(points) || points < 0) return;
  show.awards.push({ kind, id, points, ...(musicQuiz ? { musicQuiz } : {}) });
  if (announce && points > 0) show.pointPopup = { kind, id, points, until: Date.now() + 3000 };
}

export function submitChoice(show, slot, choice, now = Date.now()) {
  if (show.phase !== 'task' || show.revealed || !(show.deadline > now)) return false;
  const player = show.players.find(player => player.avatar + 1 === slot);
  const responses = show.choiceResponses ?? [];
  if (!player || !Number.isInteger(choice) || choice < 0 || choice > 3 ||
      responses.some(response => response.playerId === player.id)) return false;
  show.choiceResponses = [...responses, { playerId: player.id, choice }];
  return true;
}

export function finishChoiceQuiz(show, correctChoice, now = Date.now()) {
  const responses = show.choiceResponses ?? [];
  if (show.phase !== 'task' || show.revealed ||
      (show.deadline > now && responses.length < show.players.length)) return false;
  for (const { playerId, points } of choiceAwards(show, correctChoice)) {
    award(show, 'player', playerId, points);
  }
  Object.assign(show, { revealed: true, deadline: null });
  rememberChoiceResult(show, correctChoice);
  return true;
}

const choiceResultKey = position => `${position.element}:${position.index}`;

export function choiceResult(show, position = show.current) {
  return position ? show.choiceResults?.[choiceResultKey(position)] : undefined;
}

export function rememberChoiceResult(show, correctChoice) {
  if (!show.current || !show.revealed) return;
  show.choiceResults ??= {};
  show.choiceResults[choiceResultKey(show.current)] ??= {
    correctChoice, responses: [...(show.choiceResponses ?? [])]
  };
}

export function choiceAwards(show, correctChoice) {
  return (show.choiceResponses ?? []).filter(response => response.choice === correctChoice).slice(0, 2)
    .map(({ playerId }, index) => ({ playerId, points: 2 - index }));
}

export const rouletteWheel = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const spinDuration = 4500;
export const rouletteColors = { red: 'Rød', black: 'Sort', green: 'Grøn' };
export const rouletteColor = number => number === 0 ? 'green' :
  rouletteWheel.indexOf(number) % 2 ? 'red' : 'black';

export function musicQuizPoints(show, id) {
  return show.awards.reduce((sum, entry) => sum +
    (entry.musicQuiz && entry.kind === 'player' && entry.id === id ? entry.points : 0), 0);
}

export function lockBets(show, bets) {
  if (show.roulette || !show.players.length || bets.length !== show.players.length) return false;
  if (!show.players.every(player => {
    const bet = bets.find(entry => entry.id === player.id);
    return bet && Object.hasOwn(rouletteColors, bet.color) && Number.isSafeInteger(bet.stake) &&
      bet.stake >= 0 && bet.stake <= musicQuizPoints(show, player.id) &&
      bet.stake <= Math.floor(Number.MAX_SAFE_INTEGER / 36);
  })) return false;
  show.roulette = { kind: 'player', bets };
  return true;
}

export function rouletteDelta(bet, number) {
  return bet.color === rouletteColor(number) ? bet.stake * (number === 0 ? 35 : 1) : -bet.stake;
}

export function settleRoulette(show, number, now = Date.now()) {
  if (!show.roulette || show.roulette.number != null || !rouletteWheel.includes(number)) return false;
  Object.assign(show.roulette, { number, endsAt: now + spinDuration });
  return true;
}

function rank(entries) {
  return entries.sort((a, b) => b.score - a.score).map((entry, _, sorted) => ({
    ...entry, rank: sorted.findIndex(other => other.score === entry.score) + 1
  }));
}

export function standings(show) {
  const scoreFor = (kind, id) => show.awards.reduce((sum, entry) =>
    entry.kind === kind && entry.id === id ? sum + entry.points : sum, 0);
  const round = show.roulette;
  const spinScore = (kind, id) => {
    if (round?.number == null || (round.kind ?? 'team') !== kind) return 0;
    const bet = round.bets.find(entry => entry.id === id);
    return bet ? rouletteDelta(bet, round.number) : 0;
  };
  const players = show.players.map(player => ({
    ...player, score: scoreFor('player', player.id) + spinScore('player', player.id)
  }));
  const teams = show.teams.map(team => {
    const members = players.filter(player => player.team === team.id);
    return {
      ...team, members,
      score: scoreFor('team', team.id) + members.reduce((sum, player) => sum + player.score, 0) +
        spinScore('team', team.id)
    };
  });
  return { players: rank(players), teams: rank(teams) };
}

export function moveTo(show, target, { direct = false, secondsFor } = {}) {
  if (!target) return;
  show.pending = target;
  if (direct || show.phase === 'lobby') continueShow(show, { rememberRace: !direct, secondsFor });
  else show.phase = 'scores';
}

export function continueShow(show, { rememberRace = true, secondsFor } = {}) {
  if (!show.pending) return;
  if (rememberRace && show.phase === 'scores') {
    const { players, teams } = standings(show);
    show.raceScores = Object.fromEntries(players.map(player => [player.id, player.score]));
    show.teamRaceScores = Object.fromEntries(teams.map(team => [team.id, team.score]));
  }
  const seconds = secondsFor?.(show.pending);
  const result = choiceResult(show, show.pending);
  Object.assign(show, {
    current: show.pending, pending: null, phase: 'task', revealed: Boolean(result),
    deadline: !result && seconds > 0 ? Date.now() + seconds * 1000 : null,
    pausedMs: null, locks: {}, buzzedTeamId: null, buzzedPlayerId: null,
    choiceResponses: result?.responses ?? [], finaleStart: null, pointPopup: null
  });
}

export function canBuzz(show, id, now = Date.now()) {
  return show.phase === 'task' && !show.revealed && !show.buzzedTeamId &&
    show.teams.some(team => team.id === id) && !remaining(show.locks[id], now);
}

export function lockTeam(show, id, now = Date.now()) {
  if (!remaining(show.locks[id], now)) show.locks[id] = now + 10_000;
  if (show.buzzedTeamId === id) {
    show.buzzedTeamId = null;
    show.buzzedPlayerId = null;
  }
}

export function remaining(deadline, now = Date.now()) {
  return deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0;
}

export function racePosition(score) {
  return score > 0
    ? { day: (score - 1) % 24 + 1, lap: Math.floor((score - 1) / 24) + 1 }
    : { day: 0, lap: 1 };
}
