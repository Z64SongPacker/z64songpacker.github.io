export class SeqUtils{

    // Amplifies the volume byte of this by an specific amount (additive)
    static preAmplifyVolume(seq, volumePreAmplifying){
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];
        var finalVolume = Math.min(Math.max(mainVolume + volumePreAmplifying, 0x0), 0xFF); // <- Clamp to 8bits
        console.log("Main volume changed: " + mainVolume + " -> " + finalVolume);
        seq[mainVolumeCommandIndex + 1] = finalVolume;
    }

    static replaceFilenameWithSafeAlternatives(filename){
        var unsafeCharacters = /[\\\/:*?"<>|]/g
        return filename.replace("/", "∕") // U+2215 (Division Slash)
                       .replace(":", "꞉") // U+A789 (Modifier Letter Colon)
                       .replace(unsafeCharacters, ""); // Add more variant if needed... might need to ask randos to convert them on import... or add that myself T.T
    }

    static convertIfRomanNumeral(word){
        // 1. Ensure input is a string and force uppercase
        if (typeof word !== 'string') return word;
        const str = word.toUpperCase().trim();

        // 2. Regex validating standard Roman numerals up to 3999 (MMMCMXCIX)
        const romanRegex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
        
        // Reject empty string or unmatched patterns
        if (str === '' || !romanRegex.test(str)) {
            return word;
        }

        // 3. Define mapping for valid Roman characters
        const romanMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
        let total = 0;

        // 4. Convert Roman numeral to an integer
        for (let i = 0; i < str.length; i++) {
            const currentVal = romanMap[str[i]];
            const nextVal = romanMap[str[i + 1]];

            // If a smaller value precedes a larger value, subtract it
            if (nextVal && currentVal < nextVal) {
                total -= currentVal;
            } else {
                total += currentVal;
            }
        }

        return total;
    }
}