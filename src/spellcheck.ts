export function checkSpelling(message: string): string[] {
  const typos: string[] = [];

  // Common typos dictionary - you can expand this
  const commonTypos: { [key: string]: string } = {
    teh: "the",
    recieve: "receive",
    occured: "occurred",
    seperate: "separate",
    definately: "definitely",
    calender: "calendar",
    accomodate: "accommodate",
    achive: "achieve",
    adress: "address",
    begining: "beginning",
    beleive: "believe",
    biusiness: "business",
    commited: "committed",
    diference: "difference",
    enviroment: "environment",
    excercise: "exercise",
    existance: "existence",
    finaly: "finally",
    foriegn: "foreign",
    goverment: "government",
    gaurd: "guard",
    happend: "happened",
    immediatly: "immediately",
    independant: "independent",
    intrested: "interested",
    lenght: "length",
    libary: "library",
    maintainance: "maintenance",
    occassion: "occasion",
    prefered: "preferred",
    reccomend: "recommend",
    succesful: "successful",
    thier: "their",
    todays: "today's",
    truely: "truly",
    usualy: "usually",
    wierd: "weird",
    tasting: "testing",
  };

  // Split message into words and check each
  const words = message.toLowerCase().split(/\s+/);

  for (const word of words) {
    // Remove punctuation for checking
    const cleanWord = word.replace(/[^\w]/g, "");

    if (cleanWord && commonTypos[cleanWord]) {
      typos.push(cleanWord);
    }
  }

  return [...new Set(typos)]; // Remove duplicates
}

export function getSuggestion(word: string): string | null {
  const commonTypos: { [key: string]: string } = {
    teh: "the",
    recieve: "receive",
    occured: "occurred",
    seperate: "separate",
    definately: "definitely",
  };

  return commonTypos[word.toLowerCase()] || null;
}
