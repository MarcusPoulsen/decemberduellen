import { createWinter } from './winter.js';
import { musicReveal } from './music.js';
import { elements, supplies } from './content.js?v=farvequiz';
import {
  award, canBuzz, choiceAwards, choiceResult, continueShow, finishChoiceQuiz, lockBets, lockTeam, moveTo, musicQuizPoints, newShow,
  racePosition, remaining, rememberChoiceResult, rouletteColor, rouletteColors, rouletteDelta, rouletteWheel,
  settleRoulette, spinDuration, standings, submitChoice
} from './show.js?v=pointkort';
import { createShowAudio } from './show-audio.js?v=juleloop';

const app = document.querySelector('#app');
const key = 'decemberduellen-v1';
const isTV = new URLSearchParams(location.search).has('tv');
const winter = isTV ? createWinter() : null;
const showAudio = isTV ? createShowAudio() : null;
const maxPlayers = 8;
const maxTeams = 4;
const playerCounts = Array.from({ length: maxPlayers }, (_, index) => index + 1);
const teamCounts = playerCounts.slice(0, maxTeams);
const avatarNames = ['rensdyr', 'pingvin', 'snemand', 'nisse', 'juletrae', 'gave', 'honningkage', 'klokke'];
const defaultAvatars = avatarNames.map(name => `assets/${name}.svg`);
const finaleStepMs = 5000;
const initialData = () => ({ elements: structuredClone(elements), avatars: [...defaultAvatars], keyboardBuzz: true, show: newShow() });
function read() {
  const saved = JSON.parse(localStorage.getItem(key) || 'null');
  if (!saved) return initialData();
  saved.avatars = defaultAvatars.map((image, index) => {
    const savedImage = saved.avatars?.[index];
    const duplicateDefault = index >= 4 && savedImage === defaultAvatars[index - 4];
    return duplicateDefault ? image : savedImage ?? image;
  });
  saved.keyboardBuzz ??= true;
  for (const element of elements) {
    const existing = saved.elements.find(item => item.id === element.id);
    if (!existing) saved.elements.push(structuredClone(element));
    else for (const task of element.tasks.filter(item => item.id)) {
      if (!existing.tasks.some(item => item.id === task.id)) existing.tasks.push(structuredClone(task));
    }
  }
  if (saved.show.roulette && saved.show.roulette.kind !== 'player' && saved.show.roulette.number == null) {
    delete saved.show.roulette;
  }
  const position = saved.show.current;
  const task = saved.elements.find(element => element.id === position?.element)?.tasks[position.index];
  if (task?.choices) rememberChoiceResult(saved.show, task.correctChoice);
  return saved;
}
let data = read();
let tab = data.show.phase === 'lobby' ? 'setup' : 'control';
let editor = data.elements[0].id;
let editedIndex = 0;
let notice = '';

const html = value => String(value ?? '').replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const findElement = id => data.elements.find(element => element.id === id);
const rouletteTask = { topic: 'Roulette', roulette: true };
const speedRoundIntro = { topic: 'Lynrunde · Regler', speedRoundIntro: true };
const speedRoundIntroIndex = -2;
const taskAt = position => {
  if (position?.index === -1) return rouletteTask;
  if (position?.index === speedRoundIntroIndex) return speedRoundIntro;
  return findElement(position?.element)?.tasks[position?.index];
};
const secondsFor = position => taskAt(position)?.seconds;
const answerColors = { blue: 'Blå', orange: 'Orange', green: 'Grøn', yellow: 'Gul' };
const answerColorKeys = Object.keys(answerColors);
const isBuzzerTask = (element, task) => Boolean(task && !task.karaoke && !task.roulette && !task.choices && !task.speedRoundIntro &&
  (element.type === 'quiz' || element.type === 'music'));
function buzzStatus(show) {
  const team = show.teams.find(team => team.id === show.buzzedTeamId);
  const player = show.players.find(player => player.id === show.buzzedPlayerId && player.team === team?.id);
  return team ? `<p class="buzz-status" role="status">
    ${player ? avatar(player.avatar, player.name) : ''}<span>${player ? `${html(player.name)} · ` : ''}${html(team.name)} har buzzet!</span></p>` : '';
}
const clock = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const shortcuts = { timer: 'a', 'stop-timer': 's', 'clear-timer': 'd', reveal: 'c',
  previous: 'q', next: 'w', continue: 'e' };
const button = (action, label, attrs = '', shortcut = shortcuts[action]) =>
  `<button type="button" data-action="${action}" ${attrs}
    ${shortcut ? `data-shortcut="${shortcut}" aria-keyshortcuts="${shortcut.toUpperCase()}"` : ''}>
    ${label}${shortcut ? `<kbd aria-hidden="true">${shortcut.toUpperCase()}</kbd>` : ''}</button>`;
const option = (value, label, selected) => `<option value="${html(value)}" ${value === selected ? 'selected' : ''}>${html(label)}</option>`;
const avatar = (index, name = '') => `<img class="avatar" src="${html(data.avatars[index])}" alt="${html(name)}">`;
const trackId = link => /^(?:https:\/\/open\.spotify\.com\/track\/|spotify:track:)([a-zA-Z0-9]{22})(?:[?#].*)?$/.exec(link ?? '')?.[1];
const timerAttrs = (show, task) => `data-deadline="${show.deadline ?? 0}" data-fallback="${show.pausedMs == null ? task.seconds : Math.ceil(show.pausedMs / 1000)}"`;
const positions = () => data.elements.flatMap(element => {
  const tasks = element.tasks.map((task, index) => ({ element: element.id, index, task }));
  if (element.id === 'julequiz') {
    const firstChoice = tasks.findIndex(({ task }) => task.choices);
    if (firstChoice !== -1) tasks.splice(firstChoice, 0,
      { element: element.id, index: speedRoundIntroIndex, task: speedRoundIntro });
  }
  if (element.id === 'musikquiz') {
    return [...tasks.filter(({ task }) => !task.karaoke),
      { element: element.id, index: -1, task: rouletteTask },
      ...tasks.filter(({ task }) => task.karaoke)];
  }
  return tasks;
});
const positionIndex = position => positions().findIndex(item => item.element === position?.element && item.index === position?.index);
const positionAt = index => {
  const item = positions()[index];
  return item ? { element: item.element, index: item.index } : null;
};
const challengePoints = value => /^\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
const deadlineText = (deadline, fallback = 0) => clock(deadline ? remaining(deadline) : fallback);

function persist() {
  localStorage.setItem(key, JSON.stringify(data));
}

function update(mutator, { redraw = true } = {}) {
  const previous = structuredClone(data);
  try {
    mutator();
    persist();
  } catch (error) {
    data = previous;
    notice = error.name === 'QuotaExceededError' ? 'Der er ikke mere plads til lokal lagring.' : 'Ændringen kunne ikke gemmes.';
  }
  if (redraw) render();
  else if (notice) app.querySelector('.notice').textContent = notice;
}

function rankingRows(entries, kind, compact = false) {
  return entries.map(entry => `<li class="${entry.rank === 1 ? 'leader' : ''}">
    ${compact ? '' : `<span class="rank">${entry.rank}.</span>`}
    ${kind === 'players' ? avatar(entry.avatar) : `<span class="members">${entry.members.map(player => avatar(player.avatar, player.name)).join('')}</span>`}
    <span class="entry-name">${html(entry.name)}${kind === 'teams' && !compact ?
      `<small>${entry.members.map(player => html(player.name)).join(' · ')}</small>` : ''}</span>
    <strong>${entry.score}${compact ? '' : ' point'}</strong></li>`).join('');
}

function scoreboard(kind, entries, compact = false) {
  return `<section class="${compact ? 'mini-score' : 'board'}"><h2>${kind === 'teams' ? 'Holdstilling' : 'Spillerstilling'}</h2>
    <ol>${rankingRows(entries, kind, compact)}</ol></section>`;
}

function setupView(show) {
  if (show.phase !== 'lobby') return `<section class="panel"><h2>Holdene er klar</h2><p>Holdfordelingen er fast under showet. Brug Nulstil show for at oprette nye hold.</p></section>`;
  const count = show.teams.length || 2;
  const playerCount = show.players.length || 4;
  return `<section class="panel"><h2>Gør holdene klar</h2>
    <form data-form="setup">
      <div class="form-grid">
        <label>Antal hold <select name="count">${teamCounts.map(n => option(n, n, count)).join('')}</select></label>
        <label>Antal spillere <select name="players">${playerCounts.map(n => option(n, n, playerCount)).join('')}</select></label>
      </div>
      <div id="team-fields" class="form-grid"></div>
      <div class="form-grid player-fields">${playerCounts.map((number, index) => `<fieldset class="player-setup" data-player-card ${number > playerCount ? 'hidden disabled' : ''}>
        <legend>Spiller ${number}</legend>
        <label class="avatar-upload" title="Udskift avatar">${avatar(index)}<span>Skift billede</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-avatar="${index}"></label>
        <label>Spillernavn<input name="player-${index}" value="${html(show.players[index]?.name ?? `Spiller ${number}`)}" required maxlength="40"></label>
        <label>Hold<select name="assignment-${index}" data-assignment="${index}"></select></label>
      </fieldset>`).join('')}</div>
      <div class="keyboard-setup">
        <label class="check"><input name="keyboard-buzz" type="checkbox" ${data.keyboardBuzz ? 'checked' : ''} aria-describedby="keyboard-help"> Jeg har ikke buzzere</label>
        <p id="keyboard-help" class="muted">Lad værten bruge tasterne 1–8. Spillerknapperne på skærmen kan også bruges med musen.</p>
      </div>
      <button class="primary" type="submit">Gem hold</button>
    </form></section>`;
}

function setupFields(form, reset = false) {
  const count = Number(form.elements.count.value);
  const show = data.show;
  const names = Array.from({ length: count }, (_, index) =>
    form.elements[`team-${index}`]?.value ?? show.teams[index]?.name ?? '');
  const assignments = Array.from(form.querySelectorAll('[data-assignment]'), (select, index) =>
    Number(select.value || show.players[index]?.team || (index % count + 1)));
  if (reset) {
    form.querySelector('#team-fields').innerHTML = names.map((name, index) =>
      `<label>Hold ${index + 1}<input name="team-${index}" value="${html(name)}" placeholder="Holdnavn" required maxlength="40"></label>`).join('');
  }
  form.querySelectorAll('[data-player-card]').forEach((card, index) => {
    card.hidden = card.disabled = index >= Number(form.elements.players.value);
  });
  form.querySelectorAll('[data-assignment]').forEach((select, index) => {
    const selected = String(Math.min(assignments[index], count));
    select.innerHTML = names.map((name, team) => option(String(team + 1), name || `Hold ${team + 1}`, selected)).join('');
  });
}

function editorView() {
  const element = findElement(editor);
  const task = element.tasks[editedIndex] ?? { topic: '', prompt: '', points: 1, seconds: 0 };
  return `<section class="panel"><h2>Rediger program</h2>
    <div class="program">${data.elements.map((item, index) => `<div><strong>${html(item.name)}</strong>
      ${button('reorder', '↑', `data-index="${index}" data-step="-1" aria-label="Flyt ${html(item.name)} op" ${index === 0 || data.show.phase !== 'lobby' ? 'disabled' : ''}`)}
      ${button('reorder', '↓', `data-index="${index}" data-step="1" aria-label="Flyt ${html(item.name)} ned" ${index === data.elements.length - 1 || data.show.phase !== 'lobby' ? 'disabled' : ''}`)}</div>`).join('')}</div>
    <div class="form-grid">
      <label>Element<select data-select="editor">${data.elements.map(item => option(item.id, item.name, editor)).join('')}</select></label>
      <label>Opgave<select data-select="task">${element.tasks.map((item, index) => option(index, item.topic, editedIndex)).join('')}${editedIndex === element.tasks.length ? option(editedIndex, 'Ny opgave', editedIndex) : ''}</select></label>
    </div>
    <form data-form="editor">
      <label>Emne<input name="topic" value="${html(task.topic)}" required maxlength="100"></label>
      <label>${element.type === 'challenge' ? 'Regler' : 'Spørgsmål'}<textarea name="prompt" required maxlength="1000">${html(task.prompt)}</textarea></label>
      ${task.choices ? `<fieldset><legend>Svarmuligheder</legend>
        ${answerColorKeys.map((color, index) => `<label>${answerColors[color]}<input name="choice-${index}" value="${html(task.choices[index])}" required maxlength="200"></label>`).join('')}
        <label>Korrekt svar<select name="correctChoice">${answerColorKeys.map((color, index) => option(index, answerColors[color], task.correctChoice)).join('')}</select></label>
        </fieldset>` : element.type !== 'challenge' && !task.karaoke ? `<label>Facit<input name="answer" value="${html(task.answer)}" required maxlength="200"></label>` : ''}
      ${element.type === 'music' ? `<label>Spotify-link<input name="link" value="${html(task.link)}"></label>` : ''}
      ${element.type !== 'quiz' ? `<label>Værtsnote<textarea name="note" maxlength="500">${html(task.note)}</textarea></label>` : ''}
      ${task.choices ? '' : `<div class="form-grid">
        ${element.type !== 'challenge' ? `<label>Faste point<input type="number" name="points" min="0" max="999" value="${task.points}" required></label>` : ''}
        <label>Nedtælling (sekunder, 0 = fra)<input type="number" name="seconds" min="0" max="3600" value="${task.seconds}" required></label>
      </div>`}
      <div class="actions"><button class="primary" type="submit">Gem opgave</button>${button('add-task', 'Tilføj opgave')}</div>
    </form>
    ${element.type === 'challenge' ? `<p class="muted">${html(supplies)}</p>` : ''}
  </section>`;
}

function karaokeTurns(show, task) {
  const firstVerse = task.id === 'karaoke-nisse' ? 2 : 1;
  return `<ol class="karaoke-turns" aria-label="Versfordeling">${show.teams.map((team, index) =>
    `<li><strong>${html(team.name)}</strong><span>Vers ${(firstVerse - 1 + index) % 2 + 1}</span></li>`).join('')}</ol>`;
}

function pointControls(show, scores, task, element) {
  const dynamic = element.type === 'challenge';
  const result = show.results[`${show.current.element}:${show.current.index}`] ?? {};
  return `<section class="panel"><h2>Giv point</h2>
    ${dynamic ? '<p class="muted">Skriv point ud for spilleren eller holdet, og tryk på plus.</p>' : ''}
    ${[['team', 'Hold', scores.teams], ['player', 'Spillere', scores.players]].filter(([kind]) => !task.karaoke || kind === 'team').map(([kind, title, rows]) =>
      `<h3>${title}</h3><ul class="points-list">${rows.map(entry => `<li>
        ${kind === 'player' ? avatar(entry.avatar) : ''}<span>${html(entry.name)}</span><strong>${entry.score}</strong>
        ${dynamic ? `<input class="result" data-result="${kind}:${entry.id}" aria-label="Resultat for ${html(entry.name)}" inputmode="numeric" placeholder="Fx 7" maxlength="80" value="${html(result[`${kind}:${entry.id}`])}">` : ''}
        ${button('award', dynamic ? '+' : `+${task.points}`, `data-kind="${kind}" data-id="${entry.id}" aria-label="Giv point til ${html(entry.name)}"`)}
      </li>`).join('')}</ul>`).join('')}
    ${button('undo', 'Fortryd sidste point', show.awards.length &&
      !(show.roulette && show.awards.at(-1).musicQuiz) ? '' : 'disabled')}</section>`;
}

function rouletteBets(show, finished = false) {
  const round = show.roulette;
  const participants = round.kind === 'player' ? show.players : show.teams;
  return `<ul class="roulette-bets">${round.bets.map(bet => {
    const participant = participants.find(entry => entry.id === bet.id);
    const delta = finished ? rouletteDelta(bet, round.number) : 0;
    return `<li><strong>${html(participant?.name)}</strong><span>${bet.stake ?
      `${bet.stake} point · ${rouletteColors[bet.color]}` : 'Står over'}</span>
      ${finished && bet.stake ? `<strong>${delta > 0 ? '+' : ''}${delta} point</strong>` : ''}</li>`;
  }).join('')}</ul>`;
}

function rouletteControls(show, currentIndex, next, jump) {
  const round = show.roulette;
  return `<section class="panel task">
    <h2>Roulette</h2>
    ${round ? '<div data-roulette-bets></div>' :
      `<p>Hver spiller vælger en farve og satser op til sine egne musikquizpoint. En indsats på 0 point betyder, at spilleren står over.</p>
      <form data-form="roulette">${show.players.map(player => {
        const max = musicQuizPoints(show, player.id);
        return `<fieldset class="form-grid"><legend>${html(player.name)} · ${max} musikquizpoint</legend>
          <label>Indsats<input type="number" name="stake-${player.id}" min="0" max="${max}" value="0" required></label>
          <label>Farve<select name="color-${player.id}">${Object.entries(rouletteColors).map(([key, label]) =>
            option(key, label)).join('')}</select></label></fieldset>`;
      }).join('')}<button class="primary" type="submit">Lås indsatser</button></form>`}
    ${round?.number != null ? '<p data-roulette-status></p>' : ''}
    <div class="actions bottom-actions">
      ${currentIndex > 0 ? button('previous', '← Forrige opgave', 'data-after-spin') : ''}
      ${round && round.number == null ? button('spin', 'Spin hjulet', 'class="primary"') : ''}
      ${next && round?.number != null ? button('next', 'Videre til næste opgave →', 'class="primary" data-after-spin') : ''}
      ${!round || round.number == null ? jump : `<div data-after-spin>${jump}</div>`}
    </div></section>`;
}

function choiceQuizView(show, task) {
  const responses = show.choiceResponses ?? [];
  const correctChoice = choiceResult(show)?.correctChoice ?? task.correctChoice;
  const answeredPlayers = show.players.filter(player => responses.some(response => response.playerId === player.id));
  const winners = show.revealed ? choiceAwards(show, correctChoice) : [];
  return `<ol class="quiz-choices" aria-label="Svarmuligheder">${task.choices.map((choice, index) => {
    const color = answerColorKeys[index];
    const correct = show.revealed && index === correctChoice;
    return `<li data-buzzer-color="${color}"${correct ? ' class="is-correct"' : ''}>
      <span class="buzzer-color">${answerColors[color]}</span><strong>${html(choice)}</strong>
      ${correct ? '<span class="quiz-correct-label">✓ Korrekt</span>' : ''}</li>`;
  }).join('')}</ol>
  <p class="quiz-responses" role="status">${responses.length} af ${show.players.length} har svaret</p>
  <ul class="quiz-responders" aria-label="Spillere, der har svaret">${answeredPlayers.map(player =>
    `<li>${avatar(player.avatar, player.name)}</li>`).join('')}</ul>
  ${winners.length ? `<ol class="quiz-winners" aria-label="Point for spørgsmålet">${winners.map(({ playerId, points }) => {
    const player = show.players.find(player => player.id === playerId);
    return `<li>${html(player?.name)} <strong>+${points}</strong></li>`;
  }).join('')}</ol>` : ''}`;
}

function speedRoundRules() {
  return `<ul class="speed-round-rules">
    <li>Alle spillere har <strong>30 sekunder</strong> til hvert spørgsmål.</li>
    <li>Vælg <strong>én farve</strong>, der matcher dit svar på skærmen. Værten registrerer dit første svar.</li>
    <li>Første rigtige svar giver <strong>2 point</strong>. Næste rigtige svar giver <strong>1 point</strong>. Øvrige svar giver 0.</li>
  </ul>`;
}

function choiceControls(show) {
  if (show.revealed) return '';
  return `<div class="browser-choices"><p>Registrér spillernes svar i den rækkefølge, de svarer.</p>
    ${show.players.map(player => {
      const answered = show.choiceResponses.some(response => response.playerId === player.id);
      return `<div class="actions"><strong>${html(player.name)}</strong>${answerColorKeys.map((color, choice) =>
        button('choice', answerColors[color], `data-slot="${player.avatar + 1}" data-choice="${choice}" ${answered ? 'disabled' : ''}`)).join('')}</div>`;
    }).join('')}</div>`;
}

function controlView(show, scores) {
  const position = show.current;
  const element = findElement(position?.element);
  const task = taskAt(position);
  const currentIndex = positionIndex(position);
  const next = positionAt(currentIndex + 1);
  const jump = `<label>Spring til opgave<select data-select="jump"><option value="">Vælg side</option>${positions().map((item, index) =>
    option(String(index), `${index + 1}. ${findElement(item.element).name} · ${item.task.topic}`)).join('')}</select></label>`;
  if (show.phase === 'lobby') {
    return `<section class="panel"><h2>Klar til show?</h2><p>${show.players.length ? 'Holdene er gemt.' : 'Gem holdene i Opsætning først.'}</p>
      <div class="actions">${button('start', 'Start show', 'class="primary"' + (show.players.length ? '' : ' disabled'))}</div></section>`;
  }
  if (show.phase === 'scores') {
    return `<section class="panel"><h2>Stillingen vises på TV</h2><p>Næste opgave er ${html(taskAt(show.pending)?.topic)}.</p>
      <div class="actions">${button('continue', 'Fortsæt', 'class="primary"')}${jump}</div></section>`;
  }
  if (show.phase === 'finale') {
    return `<section class="panel"><h2>Finalen vises på TV</h2><div class="actions">
      ${button('finale', 'Afspil finale igen')}${button('back', 'Tilbage til opgaven')}${jump}</div></section>`;
  }
  if (task.roulette) return rouletteControls(show, currentIndex, next, jump);
  if (task.speedRoundIntro) {
    return `<section class="panel"><h2>Lynrunde</h2>${speedRoundRules()}
      <div class="actions">${currentIndex > 0 ? button('previous', '← Forrige opgave') : ''}
        ${button('next', 'Start lynrunden', 'class="primary"')}${jump}</div></section>`;
  }
  const track = trackId(task.link);
  const buzzedTeam = show.teams.find(team => team.id === show.buzzedTeamId);
  const musicQuizPlayer = element.id === 'musikquiz' && show.players.find(player =>
    player.id === show.buzzedPlayerId && player.team === buzzedTeam?.id);
  return `<div class="control-grid${task.choices ? ' choice-control-grid' : ''}"><section class="panel task">
    <p class="eyebrow">${html(element.name)} · ${position.index + 1} / ${element.tasks.length}</p>
    <h2>${html(task.topic)}</h2><p class="prompt">${html(task.prompt)}</p>
    ${task.choices ? choiceQuizView(show, task) + choiceControls(show) : ''}
    ${task.karaoke ? karaokeTurns(show, task) : ''}
    ${task.answer ? `<p class="answer"><span>Facit</span><strong>${html(task.answer)}</strong></p>` : ''}
    ${task.note ? `<p class="muted">${html(task.note)}</p>` : ''}
    ${track ? `<div class="actions"><a class="button" href="spotify:track:${track}">Åbn Spotify-appen ↗</a><a href="https://open.spotify.com/track/${track}" target="_blank" rel="noopener noreferrer">Åbn i browser ↗</a></div>` : ''}
    ${task.source ? `<a href="${html(task.source)}" target="_blank" rel="noopener noreferrer">${task.karaoke ? 'Åbn sangtekst' : 'Kilde'} ↗</a>` : ''}
    <div class="actions">
      ${task.seconds && !(task.choices && show.revealed) ? `<span class="timer" ${timerAttrs(show, task)}>${deadlineText(show.deadline, task.seconds)}</span>
        ${task.choices ? '' : `${button('timer', show.pausedMs > 0 ? 'Fortsæt tid' : 'Start tid')}${button('stop-timer', 'Stop tiden')}${button('clear-timer', 'Nulstil tid')}`}` : ''}
      ${task.answer ? button('reveal', show.revealed ? 'Skjul facit' : 'Afslør facit', 'class="primary"') : ''}
    </div>
    ${isBuzzerTask(element, task) ? `<div class="buzzer"><h3>Buzzer</h3>
      <p class="muted buzzer-help">Klik på spilleren${data.keyboardBuzz ? ', eller tryk på tallet ved navnet.' : '.'}</p>
      ${buzzStatus(show)}
      ${buzzedTeam && !show.revealed ? `<div class="actions">${button('award',
        `Korrekt · ${html(musicQuizPlayer?.name ?? buzzedTeam.name)} (+${task.points})`,
        `class="primary" data-kind="team" data-id="${buzzedTeam.id}" data-buzz-award`, 'k')}</div>` : ''}
      <div class="actions">${show.players.map(player =>
        button('buzz', html(player.name),
          `data-buzz="${player.id}" data-team="${player.team}"`, data.keyboardBuzz ? String(player.avatar + 1) : undefined)).join('')}</div>
      <div class="actions">${show.teams.map(team =>
        button('lock', `<span data-lock-label>Forkert: ${html(team.name)}</span>`,
          `data-id="${team.id}" data-name="${html(team.name)}" data-lock="${show.locks[team.id] ?? 0}"`,
          { 1: 'z', 2: 'x' }[team.id])).join('')}</div></div>` : ''}
    <div class="actions bottom-actions">
      <span>Side ${currentIndex + 1} af ${positions().length}</span>
      ${currentIndex > 0 ? button('previous', '← Forrige opgave') : ''}
      ${next ? button('next', 'Næste opgave →', 'class="primary"') : ''}
      ${button('finale', 'Vis finale')}${jump}
    </div>
  </section>${task.choices ? '' : pointControls(show, scores, task, element)}</div>`;
}

function guideView() {
  return `<section class="panel show-guide" aria-labelledby="guide-heading">
    <h2 id="guide-heading">Lav dit eget juleshow</h2>
    <ol class="guide-steps">
      <li><div class="guide-preview guide-teams" aria-hidden="true">
        <span><img src="assets/nisse.svg" alt="">Nisserne</span><span><img src="assets/rensdyr.svg" alt="">Rensdyrene</span>
      </div><h3>Gør holdene klar</h3><p>Vælg op til 4 hold og 8 spillere i alt. Fordel spillerne, vælg tastaturstyring med <strong>Jeg har ikke buzzere</strong>, og klik <strong>Gem hold</strong>.</p>
      ${button('tab', 'Åbn Opsætning', 'data-tab="setup"')}</li>
      <li><div class="guide-preview guide-question" aria-hidden="true">
        <small>Julequiz</small><span>Hvad er der i risalamanden?</span><b>Gem opgave</b>
      </div><h3>Byg dit program</h3><p>Vælg en runde under <strong>Rediger program</strong>. Ret en opgave, eller vælg <strong>Tilføj opgave</strong>. Udfyld felterne, og klik <strong>Gem opgave</strong> for hver ændring.</p>
      ${button('tab', 'Åbn Rediger program', 'data-tab="editor"')}</li>
      <li><div class="guide-preview guide-storage" role="img" aria-label="Spilprogrammet gemmes i browserens lokale lager">
        <strong>Dit program</strong><span aria-hidden="true">↓</span><span>✓ Gemt i browseren</span>
      </div><h3>Fortsæt en anden dag</h3><p>Showet gemmes i browserens lokale lager (<code>localStorage</code>). Åbn samme link på samme enhed og i samme browserprofil. Andre enheder har deres eget lager. Hvis du rydder webstedsdata, slettes dit gemte show.</p></li>
      <li><div class="guide-preview guide-tv" aria-hidden="true">
        <span>❄</span><strong>Decemberduellen</strong><span>❄</span>
      </div><h3>Start showet</h3><p>Åbn TV-vinduet, flyt det til storskærmen, og vælg <strong>Fuldskærm</strong>. Start fra <strong>Afvikling</strong>. Brug spillernes taltaster i buzzerrunderne.</p>
      <a class="button" href="?tv" target="decemberduellen-tv">Åbn TV-vindue ↗</a></li>
    </ol>
    <p><strong>Nulstil show</strong> rydder hold, point og fremdrift og beholder dine opgaver og avatarbilleder.</p>
  </section>`;
}

function hostView() {
  const show = data.show;
  const scores = standings(show);
  app.innerHTML = `<header class="host-header"><div><p class="eyebrow">Værtens kontrolpult</p><h1>Decemberduellen</h1></div>
    <div class="actions"><a class="button" href="?tv" target="decemberduellen-tv">Åbn TV-vindue ↗</a>
    ${button('reset', 'Nulstil show')}</div></header>
    <main class="host"><nav class="tabs" aria-label="Værtsvisninger">${[
      ['setup', 'Opsætning'], ['editor', 'Rediger program'], ['control', 'Afvikling'], ['guide', 'Guide']
    ].map(([id, label]) => button('tab', label, `data-tab="${id}" aria-pressed="${id === tab}"`)).join('')}</nav>
    <p class="notice" role="status">${html(notice)}</p>
    ${tab === 'setup' ? setupView(show) : tab === 'editor' ? editorView() : tab === 'guide' ? guideView() :
      `${controlView(show, scores)}`}
    ${show.players.length ? `<div class="host-scores">${scoreboard('teams', scores.teams, true)}${scoreboard('players', scores.players, true)}</div>` : ''}
    </main>`;
  const form = app.querySelector('[data-form="setup"]');
  if (form) setupFields(form, true);
}

function podiumMarkup(players) {
  return `<section class="final-card final-podium">
    <h1>Tak for spillet!</h1>
    <ol class="podium-places" aria-label="Spillerpodie">${[1, 2, 3].map(rank => {
      const placed = players.filter(player => player.rank === rank);
      return `<li class="podium-place" data-rank="${rank}">
        <ul class="podium-players" aria-label="${rank}. plads">${placed.map(player => `<li>
          ${avatar(player.avatar)}<strong>${html(player.name)}</strong><span>${player.score} point</span>
        </li>`).join('')}</ul>
        <div class="podium-step"><strong>${rank}</strong><span>${placed.length > 1 ? 'Delt plads' : 'Plads'}</span></div>
      </li>`;
    }).join('')}</ol>
  </section>`;
}

function finaleMarkup(show, scores) {
  const places = [...new Set(scores.players.map(player => player.rank))].reverse();
  const elapsed = Date.now() - show.finaleStart;
  const stage = Math.min(places.length, Math.floor(elapsed / finaleStepMs));
  if (elapsed >= (places.length + 1) * finaleStepMs) {
    return podiumMarkup(scores.players);
  }
  if (stage === places.length) {
    const winners = scores.teams.filter(team => team.rank === 1);
    return `<div class="final-card"><p class="eyebrow">${winners.length === 1 ? 'Vinderholdet' : 'Delt holdsejr'}</p>
      <h1>${winners.map(team => html(team.name)).join(' &amp; ')}</h1>
      <div class="final-avatars">${winners.flatMap(team => team.members).map(player => avatar(player.avatar, player.name)).join('')}</div>
      <p class="final-points">${winners[0]?.score ?? 0} point</p></div>`;
  }
  const rank = places[stage];
  const players = scores.players.filter(player => player.rank === rank);
  return `<div class="final-card"><p class="eyebrow">${players.length > 1 ? 'Delt ' : ''}${rank}. plads</p>
    <div class="final-avatars">${players.map(player => avatar(player.avatar, player.name)).join('')}</div>
    <h1>${players.map(player => html(player.name)).join(' &amp; ')}</h1><p class="final-points">${players[0].score} point</p></div>`;
}

function raceMarkup(scores, show) {
  const markers = [1, 6, 12, 18, 24];
  const labels = markers.map(day => `<span style="--fraction:${day / 24}">${day}. dec.</span>`).join('');
  const lanes = (entries, previousScores, team = false) => entries.map(entry => {
      const { day, lap } = racePosition(entry.score);
      const previous = racePosition(previousScores?.[entry.id] ?? 0);
      const start = previous.lap === lap ? previous.day : 0;
      const marker = team ? `<span class="team-runner">${entry.members.map(member => avatar(member.avatar)).join('')}</span>` : avatar(entry.avatar);
      return `<li class="race-lane ${entry.rank === 1 ? 'leader' : ''}">
        <div class="race-label"><strong>${html(entry.name)}</strong>
          <span>${entry.rank}. plads · ${entry.score} point · Omgang ${lap}</span></div>
        <div class="race-track"><div class="race-distance">
          <div class="race-runner" style="--start:${start / 24 * 100}%;--position:${day / 24 * 100}%">
            ${marker}<span class="sr-only">${day ? day + '. december' : 'Start'}</span>
          </div>
        </div></div>
      </li>`;
    }).join('');
  return `<div class="race${scores.players.length + scores.teams.length > 7 ? ' race-dense' : ''}">
    <div class="race-axis" aria-hidden="true"><span style="--fraction:0">Start</span>${labels}</div>
    <ol class="race-lanes" aria-label="Spillerræs">${lanes([...scores.players].sort((a, b) => a.avatar - b.avatar), show.raceScores)}</ol>
    <h2 class="race-team-title">Holdræs</h2>
    <ol class="race-lanes race-teams" aria-label="Holdræs">${lanes([...scores.teams].sort((a, b) => Number(a.id) - Number(b.id)), show.teamRaceScores, true)}</ol>
  </div>`;
}

function rouletteTV(show) {
  const round = show.roulette;
  const step = 360 / rouletteWheel.length;
  const angle = round?.number == null ? 0 : 360 * 6 - rouletteWheel.indexOf(round.number) * step;
  const elapsed = round?.endsAt ? Math.min(spinDuration, Math.max(0, Date.now() - round.endsAt + spinDuration)) : 0;
  const colors = rouletteWheel.map((number, index) =>
    `var(--roulette-${rouletteColor(number)}) ${step * index}deg ${step * (index + 1)}deg`).join(', ');
  return `<div class="tv-center roulette-tv"><h1>Roulette</h1>
    <div class="roulette-dial" aria-hidden="true">
      <div class="roulette-wheel" style="--step:${step}deg; --angle:${angle}deg; --elapsed:-${elapsed}ms; --wheel-colors:${colors}" ${angle ? 'data-spinning' : ''}>
        ${rouletteWheel.map((number, index) => `<span style="--pocket:${step * index}deg">${number}</span>`).join('')}
      </div>
    </div><p data-roulette-status></p><div data-roulette-bets></div></div>`;
}

let tvFinalStage = '';
function tvView() {
  const show = data.show;
  const scores = standings(show);
  const element = findElement(show.current?.element);
  const task = taskAt(show.current);
  const smallScores = show.players.length ? `<footer class="tv-scores">${scoreboard('teams', scores.teams, true)}${scoreboard('players', scores.players, true)}</footer>` : '';
  const tvControl = `<div class="tv-controls">${button('audio', showAudio.enabled ? 'Slå lyd fra' : 'Aktivér lyd')}
    ${button('fullscreen', 'Fuldskærm')}</div>`;
  tvFinalStage = '';
  const music = show.revealed && element?.type === 'music' ? musicReveal(trackId(task.link)) : null;
  let main;
  if (show.phase === 'lobby') {
    main = '<div class="tv-center lobby"><p class="eyebrow">✦ Glædelig jul ✦</p><h1>Decemberduellen</h1><p>Showet starter snart</p></div>';
  } else if (show.phase === 'scores') {
    main = `<div class="tv-board"><h1 aria-label="Stillingen"><span aria-hidden="true">🎄</span> Stillingen <span aria-hidden="true">🎄</span></h1>
      ${raceMarkup(scores, show)}</div>`;
  } else if (show.phase === 'finale') {
    main = '<div class="tv-center final"><div class="fireworks" aria-hidden="true"></div><div id="final-stage"></div></div>';
  } else if (task.roulette) {
    main = rouletteTV(show);
  } else if (task.speedRoundIntro) {
    main = `<section class="tv-center tv-speed-round"><h1>Lynrunde</h1>${speedRoundRules()}</section>`;
  } else {
    main = `<div class="tv-center"><p class="eyebrow">${html(element.name)} · ${html(task.topic)}</p>
      <h1 class="${element.type === 'challenge' ? 'challenge-prompt' : ''}">${html(task.karaoke ? task.topic : task.prompt)}</h1>
      ${task.karaoke ? `<p>${html(task.prompt)}</p>${karaokeTurns(show, task)}` : ''}
      ${task.choices ? choiceQuizView(show, task) : ''}
      ${task.seconds && !(task.choices && show.revealed) ? `<p class="tv-timer timer" ${timerAttrs(show, task)}>${deadlineText(show.deadline, task.seconds)}</p>` : ''}
      ${music ? `<figure class="music-reveal"><a href="https://open.spotify.com/track/${trackId(task.link)}" target="_blank" rel="noopener noreferrer"><img src="${music.cover}" alt="Albumcover" onerror="this.hidden=true"></a><figcaption>${html(music.title)} · Spotify</figcaption></figure>` : ''}
      ${show.revealed && task.answer ? `<p class="tv-answer">${html(task.answer)}</p>` : ''}
      ${isBuzzerTask(element, task) ? `${buzzStatus(show)}<p class="lock-info" id="tv-locks"></p>` : ''}</div>`;
  }
  app.innerHTML = `<main class="tv-shell phase-${show.phase}">
    ${tvControl}${main}${show.phase === 'scores' || (show.phase === 'task' && (task.roulette || task.speedRoundIntro)) ? '' : smallScores}
    ${show.phase === 'task' ? pointPopupMarkup(show) : ''}</main>`;
  app.querySelector('.tv-shell').prepend(winter);
  if (show.phase === 'finale') {
    app.querySelector('.fireworks').innerHTML = Array.from({ length: 36 }, (_, i) =>
      `<i style="--x:${(i * 37) % 101}%;--delay:${(i % 13) * -0.33}s;--h:${[44, 355, 145, 52][i % 4]}"></i>`).join('');
  }
}

function render() {
  if (isTV) tvView();
  else hostView();
  tick();
}

function pointPopupMarkup(show) {
  const popup = show.pointPopup;
  if (!popup || popup.until <= Date.now()) return '';
  const isPlayer = popup.kind === 'player';
  const recipient = (isPlayer ? show.players : show.teams).find(entry => entry.id === popup.id);
  if (!recipient) return '';
  const players = isPlayer ? [recipient] : show.players.filter(player => player.team === recipient.id);
  return `<div class="point-popup" data-point-popup-until="${popup.until}" role="status">
    <span class="point-popup-avatars">${players.map(player => avatar(player.avatar, player.name)).join('')}</span>
    <strong>+${popup.points} point</strong><span>${html(recipient.name)}</span></div>`;
}

function tick() {
  const show = data.show;
  const pointPopup = app.querySelector('[data-point-popup-until]');
  if (pointPopup && Number(pointPopup.dataset.pointPopupUntil) <= Date.now()) pointPopup.remove();
  if (!isTV && show.phase === 'task' && !show.revealed && show.deadline <= Date.now()) {
    const task = taskAt(show.current);
    if (task?.choices) {
      const current = read();
      if (current.show.current?.element === show.current.element &&
          current.show.current.index === show.current.index &&
          finishChoiceQuiz(current.show, task.correctChoice)) {
        update(() => { data = current; });
        return;
      }
    }
  }
  if (showAudio) {
    const winnerDelay = show.phase === 'finale' ? new Set(standings(show).players.map(player => player.rank)).size * finaleStepMs : 0;
    const isMusic = position => findElement(position?.element)?.type === 'music';
    const musicRound = (show.phase === 'task' && isMusic(show.current)) ||
      (show.phase === 'scores' && (isMusic(show.current) || isMusic(show.pending)));
    showAudio.sync(show, winnerDelay, musicRound);
  }
  const rouletteStatus = app.querySelector('[data-roulette-status]');
  if (rouletteStatus) {
    const round = show.roulette;
    const finished = round?.endsAt <= Date.now();
    const status = finished ? `${round.number} · ${rouletteColors[rouletteColor(round.number)]}` :
      round?.endsAt ? 'Hjulet spinner …' : round ? 'Indsatserne er låst' : 'Holdene vælger deres indsatser';
    if (rouletteStatus.textContent !== status) rouletteStatus.textContent = status;
  }
  const bets = app.querySelector('[data-roulette-bets]');
  if (bets && show.roulette) {
    const state = show.roulette.endsAt <= Date.now() ? 'finished' : 'locked';
    if (bets.dataset.state !== state) {
      bets.innerHTML = rouletteBets(show, state === 'finished');
      bets.dataset.state = state;
    }
  }
  const spinning = show.roulette?.endsAt > Date.now();
  for (const control of app.querySelectorAll('[data-after-spin]')) control.hidden = spinning;
  const hostScores = app.querySelector('.host-scores');
  if (hostScores) hostScores.hidden = spinning;
  const tvScores = app.querySelector('.tv-scores');
  if (tvScores) tvScores.hidden = spinning;
  for (const timer of app.querySelectorAll('[data-deadline]')) {
    timer.textContent = deadlineText(Number(timer.dataset.deadline), Number(timer.dataset.fallback));
  }
  const stop = app.querySelector('[data-action="stop-timer"]');
  if (stop) {
    stop.disabled = !remaining(data.show.deadline);
    app.querySelector('[data-action="timer"]').disabled = !stop.disabled;
  }
  for (const buzzButton of app.querySelectorAll('[data-buzz]')) {
    buzzButton.disabled = !canBuzz(data.show, buzzButton.dataset.team);
  }
  for (const lock of app.querySelectorAll('[data-lock]')) {
    const seconds = remaining(Number(lock.dataset.lock));
    lock.disabled = seconds > 0;
    lock.querySelector('[data-lock-label]').textContent = seconds ?
      `${lock.dataset.name} · ${seconds} s` : `Forkert: ${lock.dataset.name}`;
  }
  const locks = app.querySelector('#tv-locks');
  if (locks) {
    locks.textContent = data.show.teams.map(team => {
      const seconds = remaining(data.show.locks[team.id]);
      return seconds ? `${team.name} kan svare om ${seconds} s` : '';
    }).filter(Boolean).join(' · ');
  }
  const stage = app.querySelector('#final-stage');
  if (stage) {
    const markup = finaleMarkup(data.show, standings(data.show));
    if (markup !== tvFinalStage) {
      stage.innerHTML = markup;
      tvFinalStage = markup;
    }
  }
}

function startShow() {
  if (!data.show.players.length) return;
  tab = 'control';
  update(() => moveTo(data.show, positionAt(0), { secondsFor }));
}

function pauseTimer(show) {
  if (!show.deadline) return;
  show.pausedMs = Math.max(0, show.deadline - Date.now());
  show.deadline = null;
}

function buzz(playerFor) {
  // The other window may have persisted a change before its storage event arrives.
  data = read();
  const show = data.show;
  const player = show.players.find(playerFor);
  if ((!isTV && tab !== 'control') || !player || !canBuzz(show, player.team) ||
      !isBuzzerTask(findElement(show.current?.element), taskAt(show.current))) return;
  update(() => {
    show.buzzedTeamId = player.team;
    show.buzzedPlayerId = player.id;
  }, { redraw: isTV || tab === 'control' });
}

const actions = {
  tab: button => {
    tab = button.dataset.tab;
    render();
  },
  reset: () => {
    if (!confirm('Nulstil showet? Hold, spillere, point, resultater og fremdrift ryddes. Opgaver og avatarbilleder gemmes.')) return;
    tab = 'setup';
    update(() => { data.show = newShow(); });
  },
  start: startShow,
  choice: button => {
    const current = read();
    const show = current.show;
    const task = current.elements.find(element => element.id === show.current?.element)?.tasks[show.current.index];
    if (!task?.choices || !submitChoice(show, Number(button.dataset.slot), Number(button.dataset.choice))) return;
    finishChoiceQuiz(show, task.correctChoice);
    update(() => { data = current; });
  },
  spin: () => {
    data = read();
    if (data.show.phase === 'task' && taskAt(data.show.current)?.roulette) {
      update(() => settleRoulette(data.show, rouletteWheel[Math.floor(Math.random() * rouletteWheel.length)]));
    }
  },
  next: () => update(() => {
    const position = data.show.current;
    moveTo(data.show, positionAt(positionIndex(position) + 1),
      { secondsFor, direct: taskAt(position)?.speedRoundIntro });
  }),
  previous: () => update(() => moveTo(data.show, positionAt(positionIndex(data.show.current) - 1), { secondsFor })),
  continue: () => update(() => continueShow(data.show, { secondsFor })),
  reveal: () => update(() => {
    data.show.revealed = !data.show.revealed;
    data.show.buzzedTeamId = null;
    data.show.buzzedPlayerId = null;
  }),
  timer: () => update(() => {
    const show = data.show;
    if (remaining(show.deadline)) return;
    show.deadline = Date.now() + (show.pausedMs ?? taskAt(show.current).seconds * 1000);
    show.pausedMs = null;
  }),
  'stop-timer': () => update(() => pauseTimer(data.show)),
  'clear-timer': () => update(() => { data.show.deadline = null; data.show.pausedMs = null; }),
  buzz: button => buzz(player => player.id === button.dataset.buzz),
  lock: button => {
    data = read();
    update(() => {
      const show = data.show;
      const teamId = button.dataset.id;
      lockTeam(show, teamId);
    });
  },
  award: button => {
    const field = button.closest('li')?.querySelector('[data-result]');
    const points = field ? challengePoints(field.value) : taskAt(data.show.current).points;
    if (points === null) {
      app.querySelector('.notice').textContent = 'Indtast et helt antal point på 0 eller derover.';
      field.focus();
      return;
    }
    update(() => {
      const show = data.show;
      const position = show.current;
      const task = taskAt(position);
      const quiz = isBuzzerTask(findElement(position.element), task);
      const musicQuiz = position.element === 'musikquiz' && quiz;
      const player = musicQuiz && button.hasAttribute('data-buzz-award') &&
        show.players.find(player => player.id === show.buzzedPlayerId && player.team === button.dataset.id);
      const kind = player ? 'player' : button.dataset.kind;
      const id = player ? player.id : button.dataset.id;
      award(show, kind, id, points, { musicQuiz, announce: true });
      if (quiz) {
        pauseTimer(show);
        show.revealed = true;
        show.buzzedTeamId = null;
        show.buzzedPlayerId = null;
      }
    });
  },
  undo: () => update(() => {
    if (data.show.roulette && data.show.awards.at(-1)?.musicQuiz) return;
    data.show.awards.pop();
    data.show.pointPopup = null;
  }),
  finale: () => update(() => { data.show.phase = 'finale'; data.show.finaleStart = Date.now(); }),
  back: () => update(() => { data.show.phase = 'task'; data.show.finaleStart = null; }),
  reorder: button => update(() => {
    const index = Number(button.dataset.index);
    const [element] = data.elements.splice(index, 1);
    data.elements.splice(index + Number(button.dataset.step), 0, element);
  }),
  'add-task': () => { editedIndex = findElement(editor).tasks.length; render(); },
  audio: async () => {
    try {
      await showAudio.toggle();
      render();
    } catch {
      app.querySelector('[data-action="audio"]').textContent = 'Prøv at aktivere lyd igen';
    }
  },
  fullscreen: () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
};

app.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  notice = '';
  actions[button.dataset.action](button);
});

window.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey ||
      event.metaKey || event.altKey || event.shiftKey ||
      event.target.closest?.('input, textarea, select, [contenteditable]')) return;
  if (data.keyboardBuzz && /^[1-8]$/.test(event.key)) {
    buzz(player => player.avatar + 1 === Number(event.key));
    return;
  }
  if (isTV || tab !== 'control' || !/^[asdcxzqwek]$/.test(event.key.toLowerCase())) return;
  const control = app.querySelector(`[data-shortcut="${event.key.toLowerCase()}"]`);
  if (!control || control.disabled || control.closest('[hidden]')) return;
  event.preventDefault();
  control.click();
});

app.addEventListener('input', event => {
  const input = event.target;
  if (input.name?.startsWith('team-')) setupFields(input.form);
});

app.addEventListener('change', async event => {
  const input = event.target;
  notice = '';
  if (input.name === 'count' || input.name === 'players') {
    const { count, players } = input.form.elements;
    if (Number(count.value) > Number(players.value)) {
      if (input === count) players.value = count.value;
      else count.value = players.value;
    }
    setupFields(input.form, true);
  }
  if (input.dataset.select === 'editor') { editor = input.value; editedIndex = 0; render(); }
  if (input.dataset.select === 'task') { editedIndex = Number(input.value); render(); }
  if (input.dataset.select === 'jump' && input.value) {
    const target = positionAt(Number(input.value));
    if (target && (data.show.phase !== 'task' || Number(input.value) !== positionIndex(data.show.current))) update(() => moveTo(data.show, target, { direct: true, secondsFor }));
    else input.value = '';
  }
  if (input.dataset.result) {
    const { element, index } = data.show.current;
    const results = data.show.results;
    const taskKey = `${element}:${index}`;
    const previous = results[taskKey];
    results[taskKey] = { ...previous, [input.dataset.result]: input.value.trim() };
    try {
      persist();
    } catch {
      if (previous) results[taskKey] = previous;
      else delete results[taskKey];
      input.value = previous?.[input.dataset.result] ?? '';
      app.querySelector('.notice').textContent = 'Resultatet kunne ikke gemmes.';
    }
  }
  if (input.dataset.avatar !== undefined && input.files[0]) {
    const file = input.files[0];
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 512 * 1024) {
      alert('Vælg PNG, JPEG, WebP eller GIF på højst 512 kB.');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const index = Number(input.dataset.avatar);
      const previous = data.avatars[index];
      data.avatars[index] = reader.result;
      try {
        persist();
        const image = app.querySelector(`[data-avatar="${index}"]`)?.closest('label')?.querySelector('img');
        if (image) image.src = reader.result;
      } catch {
        data.avatars[index] = previous;
        alert('Billedet kunne ikke gemmes.');
      }
    };
    reader.readAsDataURL(file);
  }
});

app.addEventListener('submit', event => {
  const form = event.target;
  const formData = new FormData(form);
  const get = name => String(formData.get(name) ?? '').trim();
  event.preventDefault();
  if (form.dataset.form === 'roulette') {
    data = read();
    const bets = data.show.players.map(player => ({
      id: player.id, color: get(`color-${player.id}`), stake: challengePoints(get(`stake-${player.id}`))
    }));
    if (data.show.phase !== 'task' || !taskAt(data.show.current)?.roulette) return;
    let locked;
    update(() => { locked = lockBets(data.show, bets); });
    if (!locked) {
      app.querySelector('.notice').textContent = 'Kontrollér farverne og indsatsen for hver spiller.';
    }
  }
  if (form.dataset.form === 'setup') {
    const teams = Array.from({ length: Number(get('count')) }, (_, index) =>
      ({ id: String(index + 1), name: get(`team-${index}`) }));
    const players = Array.from({ length: Number(get('players')) }, (_, index) => ({
      id: String(index + 1), avatar: index, name: get(`player-${index}`).trim(), team: get(`assignment-${index}`)
    }));
    if ([...teams, ...players].some(entry => !entry.name) || teams.some(team => !players.some(player => player.team === team.id))) {
      app.querySelector('.notice').textContent = 'Udfyld alle navne, og sæt mindst én spiller på hvert hold.';
      return;
    }
    tab = 'control';
    notice = 'Holdene er gemt.';
    update(() => {
      data.keyboardBuzz = formData.has('keyboard-buzz');
      Object.assign(data.show, { teams, players });
    });
  }
  if (form.dataset.form === 'editor') {
    const element = findElement(editor);
    const task = element.tasks[editedIndex] ?? {};
    const link = get('link');
    if (link && !trackId(link)) {
      app.querySelector('.notice').textContent = 'Brug et link til et nummer på open.spotify.com.';
      return;
    }
    notice = 'Opgaven er gemt.';
    const choices = task.choices && answerColorKeys.map((_, index) => get(`choice-${index}`));
    if (!get('topic') || !get('prompt') || (choices ? choices.some(choice => !choice) :
      element.type !== 'challenge' && !task.karaoke && !get('answer'))) {
      app.querySelector('.notice').textContent = 'Udfyld emne, opgave og eventuelt facit.';
      return;
    }
    update(() => {
      element.tasks[editedIndex] = {
        ...task, topic: get('topic'), prompt: get('prompt'), answer: get('answer'), note: get('note'),
        link, points: Number(get('points')), seconds: choices ? task.seconds : Number(get('seconds')),
        ...(choices ? { choices, correctChoice: Number(get('correctChoice')) } : {})
      };
    });
  }
});

window.addEventListener('storage', event => {
  if (event.key !== key) return;
  data = read();
  render();
});


document.body.classList.toggle('audience', isTV);
render();
setInterval(tick, 150);
