const axios = require('axios');

const actualMenNames = [
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

const actualWomenNames = [
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

async function verifyNames() {
  try {
    console.log('Fetching Men\'s names...\n');
    const menResponse = await axios.get('http://localhost:3001/api/scrape?url=' +
      encodeURIComponent('https://app.liveresults.it/mtbowcup2025/sprint/Men/startlist'));

    if (menResponse.data && menResponse.data.competitors) {
      console.log('Men\'s Start List Comparison:');
      console.log('=' .repeat(60));

      menResponse.data.competitors.forEach((comp, i) => {
        const extractedName = comp.cells?.[1]?.split('   ')[0]?.trim() || 'UNKNOWN';
        const actualName = actualMenNames[i] || 'NO DATA';

        if (extractedName !== actualName) {
          console.log(`❌ Position ${i+1}:`);
          console.log(`   Expected: "${actualName}"`);
          console.log(`   Got:      "${extractedName}"`);
          console.log(`   Raw cell: "${comp.cells?.[1]}"`);
        } else {
          console.log(`✓ Position ${i+1}: ${actualName}`);
        }
      });
    }

    console.log('\n\nFetching Women\'s names...\n');
    const womenResponse = await axios.get('http://localhost:3001/api/scrape?url=' +
      encodeURIComponent('https://app.liveresults.it/mtbowcup2025/sprint/Women/startlist'));

    if (womenResponse.data && womenResponse.data.competitors) {
      console.log('Women\'s Start List Comparison:');
      console.log('=' .repeat(60));

      womenResponse.data.competitors.forEach((comp, i) => {
        const extractedName = comp.cells?.[1]?.split('   ')[0]?.trim() || 'UNKNOWN';
        const actualName = actualWomenNames[i] || 'NO DATA';

        if (extractedName !== actualName) {
          console.log(`❌ Position ${i+1}:`);
          console.log(`   Expected: "${actualName}"`);
          console.log(`   Got:      "${extractedName}"`);
          console.log(`   Raw cell: "${comp.cells?.[1]}"`);
        } else {
          console.log(`✓ Position ${i+1}: ${actualName}`);
        }
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

verifyNames();