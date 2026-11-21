const quiz = (topic, prompt, answer, source, buzzer = false) =>
  ({ topic, prompt, answer, source, buzzer, points: 1, seconds: 30 });
const choiceQuiz = (id, topic, prompt, choices, correctChoice) =>
  ({ id, topic, prompt, choices, correctChoice, points: 1, seconds: 30 });
const song = (topic, prompt, answer, track, note) =>
  ({ topic, prompt, answer, link: `https://open.spotify.com/track/${track}`, note, points: 1, seconds: 0 });
const karaoke = (id, topic, track, source) => ({
  id, topic, prompt: 'Syng med på skift. Gamemasteren vælger vinderholdet.',
  answer: '', link: `https://open.spotify.com/track/${track}`,
  note: 'Afspil sangen manuelt i Spotify. Giv point til det hold, du synes sang bedst.',
  source, points: 2, seconds: 0, karaoke: true
});
const challenge
 = (topic, prompt, note, seconds) =>
  ({ topic, prompt, answer: '', note, points: 0, seconds });

export const elements = [
  {
    id: 'julequiz', type: 'quiz', name: 'Julequiz',
    tasks: [
      quiz('Danske juletraditioner', 'Hvor mange lys er der på en traditionel adventskrans?', 'Fire', 'https://natmus.dk/historisk-viden/temaer/fester-og-traditioner/jul/jul-i-gamle-dage/jul-i-mellemkrigstiden/'),
      quiz('Julemad', 'Hvilken hel nød gemmer man traditionelt i risalamanden?', 'En mandel', 'https://lex.dk/risalamande', true),
      quiz('Julefilm og julekalendere', 'I hvilket år sendte DR Jul på Slottet første gang?', '1986', 'https://lex.dk/tv-julekalender'),
      quiz('Jul rundt om i verden', 'Hvilken dato fejrer Sverige luciadag?', '13. december', 'https://visitsweden.com/what-to-do/culture-history-and-art/swedish-traditions/christmas/lucia/', true),
      quiz('Juleeventyr', 'Hvem skrev Et juleeventyr med Ebenezer Scrooge?', 'Charles Dickens', 'https://www.youtube.com/watch?v=cTHAN3_P7uE'),
      choiceQuiz('julequiz-lillejuleaften', 'Lillejuleaften', 'Hvilken dato er lillejuleaften?',
        ['22. december', '23. december', '24. december', '25. december'], 1),
      choiceQuiz('julequiz-noeddeknaekkeren', 'Nøddeknækkeren', 'Hvem komponerede musikken til balletten Nøddeknækkeren?',
        ['Mozart', 'Beethoven', 'Tjajkovskij', 'Grieg'], 2)
    ]
  },
  {
    id: 'musikquiz', type: 'music', name: 'Musikquiz',
    tasks: [
      song('Danske julehits', 'Hvilken dansk gruppe står bag nummeret?', 'Mc Einar', '4QOTOTJsJjgrAf0BgnfaRF', 'Afspil et kort stykke af første vers.'),
      song('Internationale julehits', 'Hvilken duo synger nummeret?', 'Wham!', '2FRnf9qhLbvw8fu4IBXx78', 'Afspil cirka 15 sekunder fra begyndelsen.'),
      song('Gæt sangen på introen', 'Hvad hedder sangen?', 'All I Want for Christmas Is You', '0bYg9bo50gSsH3LtXe2SQn', 'Start fra 0:00. Stop før titlen bliver sunget.'),
      song('Kend melodien fra en julefilm', 'Hvilken julefilm kommer musikken fra?', 'Home Alone / Alene hjemme', '1WA5av9UlqPNOKcaUdWbGM', 'Spil cirka 15 sekunder fra starten.'),
      song('Gæt årtiet', 'Hvilket årti udkom sangen første gang?', '2010’erne (2013)', '3nAp4IvdMPPWEH9uuXFFV5', 'Afspil cirka 15 sekunder fra begyndelsen.'),
      karaoke('karaoke-trae', 'Højt fra træets grønne top', '6kCDz0in1wZ13338PwqyYM', 'https://spillefolk.dk/nodesamling/pdf/xx-hzzjtfratrzetsgrzznnetop.pdf'),
      karaoke('karaoke-nisse', 'På loftet sidder nissen', '0baBUw21cZ4IU7eYCpPW5A', 'https://fs-oest.dk/fileadmin/user_upload/Billeder_Vestegnen/HrNissen/Aktivitetssider/14_Pa__loftet.pdf'),
      karaoke('karaoke-bud', 'Julen har bragt velsignet bud', '0oCBruP0UzVdQwL8Euv1tb', 'https://www.folkekirken.dk/tro/salmer/julen-har-bragt-velsignet-bud')
    ]
  },
  {
    id: 'challenges', type: 'challenge', name: 'Challenges',
    tasks: [
      challenge('Stabl papkrus på tid', 'Byg en pyramide af 15 krus på 30 sekunder. Start med fem i nederste række. Ved tid tæller de krus, som står i hele rækker fra bunden.', '15 ens papkrus. Samme krus og underlag til alle.', 30),
      challenge('Ram en skål med papirbolde', 'Kast 10 papirbolde mod en skål fra to meters afstand. Tæl bolde, der bliver liggende i skålen.', 'Skål, papir og målebånd. Genbrug boldene.', 0),
      challenge('Flyt pebernødder med spisepinde', 'Flyt én pebernød ad gangen mellem to skåle på 30 sekunder. Kun nødder i målskålen tæller.', 'To skåle, pebernødder og spisepinde.', 30),
      challenge('Byg det højeste tårn af papir', 'Byg på 60 sekunder med fem A4-ark og 30 cm tape. Mål højden, hvis tårnet står frit i fem sekunder efter tid.', 'A4-papir, tape og målebånd.', 60),
      challenge('Husk flest ting fra en bakke', 'Se på bakken i 20 sekunder. Skriv derefter så mange af de ti ting som muligt på 30 sekunder. Ét korrekt navn tæller én gang.', 'Bakke, viskestykke, papir og blyant. Brug ti forskellige ting fra hjemmet. Brug timeren til de 20 sekunders kiggetid.', 20)
    ]
  }
];

export const supplies = 'Indkøb: papkrus, pebernødder, spisepinde, papir og tape. Skål, bakke, blyant og målebånd kan lånes. Planlægningsoverslag: 150 kr.';
