import test from 'node:test';
import assert from 'node:assert/strict';
import { newShow, award, standings, moveTo, continueShow, lockTeam, remaining, musicQuizPoints, lockBets, settleRoulette, submitChoice, finishChoiceQuiz } from '../app/show.js';

test('et afsluttet lynrundespørgsmål viser facit igen uden nye point', () => {
  const show = newShow();
  show.players = [{ id: '1', avatar: 0 }, { id: '2', avatar: 1 }];
  const first = { element: 'julequiz', index: 5 };
  const second = { element: 'julequiz', index: 6 };
  const options = { direct: true, secondsFor: () => 30 };
  moveTo(show, first, options);
  assert.equal(submitChoice(show, 2, 1), true);
  assert.equal(submitChoice(show, 1, 1), true);
  assert.equal(finishChoiceQuiz(show, 1), true);
  moveTo(show, second, options);

  const reloaded = JSON.parse(JSON.stringify(show));
  moveTo(reloaded, first, options);
  assert.equal(reloaded.revealed, true);
  assert.equal(reloaded.deadline, null);
  assert.deepEqual(reloaded.choiceResponses.map(response => response.playerId), ['2', '1']);
  assert.equal(submitChoice(reloaded, 1, 1), false);
  assert.equal(finishChoiceQuiz(reloaded, 1), false);
  assert.deepEqual(reloaded.awards.map(({ id, points }) => [id, points]), [['2', 2], ['1', 1]]);
});

test('spillerpoint og holdpoint summeres, og sidste tildeling kan fortrydes', () => {
  const show = newShow();
  show.teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  show.players = [{ id: '1', name: 'Ada', team: 'a' }, { id: '2', name: 'Bo', team: 'b' }];
  award(show, 'player', '1', 3);
  award(show, 'team', 'b', 3);
  assert.deepEqual(standings(show).teams.map(({ score, rank }) => [score, rank]), [[3, 1], [3, 1]]);
  show.awards.pop();
  assert.deepEqual(standings(show).teams.map(({ score, rank }) => [score, rank]), [[3, 1], [0, 2]]);
});

test('stillingen kommer før næste opgave og buzzerkarantænen varer ti sekunder', () => {
  const show = newShow();
  show.phase = 'task';
  lockTeam(show, 'a', 1000);
  lockTeam(show, 'a', 3000);
  assert.equal(remaining(show.locks.a, 9999), 2);
  assert.equal(remaining(show.locks.a, 11000), 0);
  moveTo(show, { element: 'music', index: 0 });
  assert.equal(show.phase, 'scores');
  assert.equal(show.current, null);
  continueShow(show);
  assert.deepEqual(show.current, { element: 'music', index: 0 });
  assert.deepEqual(show.locks, {});
});

test('roulette afregner hver spillers indsats og fører resultatet én gang til holdstillingen', () => {
  const show = newShow();
  show.teams = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
  show.players = [{ id: '1', name: 'Ada', team: 'a' }, { id: '2', name: 'Bo', team: 'a' }];
  award(show, 'player', '1', 4, { musicQuiz: true });
  award(show, 'player', '2', 1, { musicQuiz: true });
  award(show, 'team', 'a', 2, { musicQuiz: true });
  award(show, 'team', 'a', 20);
  award(show, 'player', '2', 3);
  assert.equal(musicQuizPoints(show, '1'), 4);
  assert.equal(musicQuizPoints(show, '2'), 1);
  const bets = [{ id: '1', color: 'green', stake: 4 }, { id: '2', color: 'red', stake: 1 }];
  assert.equal(lockBets(show, [{ ...bets[0], stake: 5 }, bets[1]]), false);
  assert.equal(lockBets(show, [bets[0], { ...bets[1], stake: 2 }]), false);
  assert.equal(lockBets(show, bets), true);
  assert.equal(settleRoulette(show, 0, 1000), true);
  assert.equal(settleRoulette(show, 1, 1001), false);
  assert.deepEqual(standings(show).players.map(({ score }) => score), [144, 3]);
  assert.deepEqual(standings(show).teams.map(({ score }) => score), [169, 0]);
});

test('et tidligere holdspin beholder sit resultat på holdstillingen', () => {
  const show = newShow();
  show.teams = [{ id: '1', name: 'A' }];
  show.players = [{ id: '1', name: 'Ada', team: '1' }];
  award(show, 'player', '1', 2);
  show.roulette = { bets: [{ id: '1', stake: 2, color: 'black' }], number: 24 };
  const scores = standings(show);
  assert.equal(scores.players[0].score, 2);
  assert.equal(scores.teams[0].score, 4);
});
