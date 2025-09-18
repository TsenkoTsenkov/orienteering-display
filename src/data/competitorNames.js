// Hardcoded correct names for mtbowcup2025 competitors
export const correctMenNames = [
    "Mihkel Mahla",
    "Mihail Stoev",
    "Sergi Oliveras i Ferrer",
    "Matteo Traversi Montani",
    "Marek Hasman",
    "Daumantas Kiela",
    "Bernhard Kogler",
    "Mark Huster",
    "Nikolay Nachev",
    "Petar Popunkyov",
    "Jocelin Lauret",
    "Krzysztof Wroniak",
    "Mathieu Vayssat",
    "Michele Traversi Montani",
    "Daniel Marques",
    "Marco Pelov",
    "Antoine Lesquer",
    "Juan Sanz",
    "Rostislav Kostadinov",
    "Martin Illig",
    "Noah Tristan Hoffmann",
    "Filip Janowski",
    "Per Haehnel",
    "Ildar Mihnev",
    "Oliver Friis",
    "Stanimir Belomazhev",
    "Grzegorz Nowak",
    "Georg Koffler",
    "Joao Ferreira",
    "Augustin Leclere",
    "Tomi Nykanen",
    "Luca Dallavalle",
    "Teemu Kaksonen",
    "Flurin Schnyder",
    "Jussi Laurila",
    "Noah Rieder",
    "Jeremi Pourre",
    "Riccardo Rossetto",
    "Paul Debray",
    "Bartosz Niebielski",
    "Vojtech Stransky",
    "Ignas Ambrazas",
    "Vojtech Ludvik",
    "Andreas Waldmann",
    "Krystof Bogar",
    "Samuel Pokala",
    "Jan Hasek",
    "Hannes Hnilica",
    "Jonas Maiselis",
    "Fabiano Bettega",
    "Armel Berthaud"
];

export const correctWomenNames = [
    "Lola Colle",
    "Gergana Stoycheva",
    "Vytene Puisyte",
    "Teodora Tabakova",
    "Chiara Magni",
    "Slavena Petkova",
    "Nerea Garcia Rodriguez",
    "Greta Dimitrova",
    "Marii Isabel Allikberg",
    "Ivana Pedeva",
    "Lou Colle",
    "Kosara Boteva",
    "Karolina Mickeviciute Juodisiene",
    "Marisa Costa",
    "Anna Tkaczuk",
    "Jade Boussier",
    "Silja YliHietanen",
    "Jana Luscher Alemany",
    "Marketa Mulickova",
    "Lou Garcin",
    "Ewa Haltof",
    "Jana Hnilica",
    "Lucie Nedomlelova",
    "Siiri Rasimus",
    "Rozalie Kucharova",
    "Anna Kaminska",
    "Constance Devillers",
    "Nikoline Splittorff",
    "Iris Aurora Pecorari",
    "Caecilie Christoffersen",
    "Marika Hara",
    "Camilla Soegaard",
    "Valerie Kamererova",
    "Algirda Mickuviene",
    "Celine Wellenreiter",
    "Ruska Saarela",
    "Ursina Jaeggi",
    "Gabriella Gustafsson"
];

// Simple fuzzy matching function to find the closest name
export function findClosestName(extractedName, isMen = true) {
    const nameList = isMen ? correctMenNames : correctWomenNames;

    // Clean the extracted name
    const cleanExtracted = extractedName
        .toLowerCase()
        .replace(/[^a-z\s]/gi, '')
        .trim();

    if (!cleanExtracted) {
        return nameList[0]; // Return first name if extraction failed
    }

    let bestMatch = nameList[0];
    let bestScore = 0;

    for (let i = 0; i < nameList.length; i++) {
        const correctName = nameList[i];
        const cleanCorrect = correctName.toLowerCase().replace(/[^a-z\s]/gi, '');

        // Calculate similarity score
        let score = 0;

        // Check if last names match (most important)
        const extractedParts = cleanExtracted.split(' ');
        const correctParts = cleanCorrect.split(' ');

        const extractedLastName = extractedParts[extractedParts.length - 1];
        const correctLastName = correctParts[correctParts.length - 1];

        if (extractedLastName === correctLastName) {
            score += 50;
        } else if (correctLastName.includes(extractedLastName) || extractedLastName.includes(correctLastName)) {
            score += 30;
        }

        // Check if first names match
        if (extractedParts[0] === correctParts[0]) {
            score += 30;
        } else if (correctParts[0].includes(extractedParts[0]) || extractedParts[0].includes(correctParts[0])) {
            score += 15;
        }

        // Check overall string similarity
        const minLength = Math.min(cleanExtracted.length, cleanCorrect.length);
        let matchingChars = 0;
        for (let j = 0; j < minLength; j++) {
            if (cleanExtracted[j] === cleanCorrect[j]) {
                matchingChars++;
            }
        }
        score += (matchingChars / minLength) * 20;

        // Position-based matching (names should be in roughly the same order)
        const positionDiff = Math.abs(i - nameList.indexOf(bestMatch));
        if (positionDiff < 3) {
            score += 5;
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = correctName;
        }
    }

    return bestMatch;
}

// Get name by index (for when we know the exact position)
export function getNameByIndex(index, isMen = true) {
    const nameList = isMen ? correctMenNames : correctWomenNames;
    return nameList[index] || nameList[0];
}