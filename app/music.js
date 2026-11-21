const tracks = {
  '4QOTOTJsJjgrAf0BgnfaRF': ["Jul Det' Cool", '11737636bb850f834f04e9df'],
  '2FRnf9qhLbvw8fu4IBXx78': ['Last Christmas', 'f2d2adaa21ad616df6241e7d'],
  '0bYg9bo50gSsH3LtXe2SQn': ['All I Want for Christmas Is You', 'c0862332847213b151ffab31'],
  '1WA5av9UlqPNOKcaUdWbGM': ['Somewhere in My Memory', 'f497846e25233023ca7cb8b1'],
  '3nAp4IvdMPPWEH9uuXFFV5': ['Underneath the Tree', 'c87992b7588879f66d192905']
};

export function musicReveal(id) {
  const track = tracks[id];
  return track && { title: track[0], cover: `https://i.scdn.co/image/ab67616d0000b273${track[1]}` };
}
