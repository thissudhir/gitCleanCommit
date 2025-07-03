export function checkSpelling(message: string): string[] {
  const typos: string[] = [];

  // Expanded dictionary of common programming and general typos
  const commonTypos: { [key: string]: string } = {
    // Programming specific
    functionallity: "functionality",
    conditon: "condition",
    lenght: "length",
    widht: "width",
    heigth: "height",
    commited: "committed",
    commiting: "committing",
    sucessful: "successful",
    sucessfully: "successfully",
    acording: "according",
    compatability: "compatibility",
    dependancy: "dependency",
    recieve: "receive",
    recieved: "received",
    recieving: "receiving",
    seperate: "separate",
    seperated: "separated",
    seperately: "separately",
    definately: "definitely",
    perfomance: "performance",
    perfom: "perform",
    optmize: "optimize",
    optmized: "optimized",
    optmization: "optimization",

    // General typos
    teh: "the",
    hte: "the",
    adn: "and",
    nad: "and",
    occured: "occurred",
    occuring: "occurring",
    calender: "calendar",
    accomodate: "accommodate",
    achive: "achieve",
    achived: "achieved",
    adress: "address",
    begining: "beginning",
    beleive: "believe",
    buiness: "business",
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
    libary: "library",
    maintainance: "maintenance",
    occassion: "occasion",
    prefered: "preferred",
    reccomend: "recommend",
    thier: "their",
    truely: "truly",
    usualy: "usually",
    wierd: "weird",
    tasting: "testing",
    implmentation: "implementation",
    implimentation: "implementation",
    documention: "documentation",
    confguration: "configuration",
    configuraton: "configuration",
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
    commited: "committed",
    sucessful: "successful",
    perfomance: "performance",
    implmentation: "implementation",
    documention: "documentation",
  };

  return commonTypos[word.toLowerCase()] || null;
}
