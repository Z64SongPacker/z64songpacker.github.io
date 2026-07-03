export class SeqUtils{

    // Amplifies the volume byte of this by an specific amount (linear additive)
    static preAmplifyVolume(seq, volumePreAmplifying){
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];
        var finalVolume = Math.min(Math.max(mainVolume + volumePreAmplifying, 0x0), 0xFF); // <- Clamp to 8bits
        // console.log("Main volume changed: " + mainVolume + " -> " + finalVolume);
        seq[mainVolumeCommandIndex + 1] = finalVolume;
        return seq;
    }

    static setLoudness(seq, originalLoudness, targetLoudness){
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];

        // First, we need to convert our current volume to decibels
        var currentDb = this.midiToDb(mainVolume);
        //console.log("Current dB: " + currentDb);

        // Now, calculate the target dB using the loudness LUFS
        var targetDb = currentDb + (+targetLoudness - +originalLoudness);
        //console.log("Target dB: " + targetDb);

        // Finally, convert back to midi and clamp
        var finalMidiVolume = this.dbToMidi(targetDb);
        //console.log("Final MIDI volume: " + finalMidiVolume);

        var finalVolume = Math.min(Math.max(finalMidiVolume, 0x0), 0xFF); // <- Clamp to 8bits

        console.log(`Volume balanced: ${originalLoudness} LUFS -> ${targetLoudness} LUFS  | ${mainVolume} -> ${finalVolume}`);
        seq[mainVolumeCommandIndex + 1] = finalVolume;
        return seq;
    }

    static midiToDb(midiVolume){
        return 40 * Math.log10(midiVolume / 127);
    }

    static dbToMidi(decibels){
        return Math.round(127 * Math.pow(10, (decibels / 40)));
    }

    static replaceFilenameWithSafeAlternatives(filename){
        var unsafeCharacters = /[\\\/:*?"<>|]/g
        return filename.replace("/", "∕") // U+2215 (Division Slash)
                       .replace(":", "꞉") // U+A789 (Modifier Letter Colon)
                       .replace(unsafeCharacters, ""); // Add more variant if needed... might need to ask randos to convert them on import... or add that myself T.T
    }

    // Normalizes to format 0x00
    static normalizeBank(bank){
        return parseInt(bank, 16).toString(16).toUpper()
    }


    static ootToMMBankMap = {
        0x03: 0x03, // Hyrule Field
        0x05: 0x04, // Market
        0x08: 0x05, // Kakariko (Guitar)
        0x09: 0x06, // Fairy Fountain
        0x0D: 0x07, // Lon Lon Ranch
        0x11: 0x08, // Horse Race
        0x12: 0x09, // Warp Songs
        0x14: 0x0A, // Shooting Gallery
        0x15: 0x0B, // Zora's Domain
        0x16: 0x0C, // Shop
        0x1C: 0x0D, // Lakeside Laboratory
        0x1D: 0x0E, // Koume and Kotake
        0x23: 0x0F, // Fanfares
        0x24: 0x10, // Owl
    };

    static ootToMMBank(bank){
        var bankInt = parseInt(bank, 16);
        return this.ootToMMBankMap[bankInt] ?? -1;
    }

    static mmToOOTBank(bank){
        var bankInt = parseInt(bank, 16);
        var mmToOOTBankMap = Object.fromEntries(
            Object.entries(this.ootToMMBankMap).map(([key, value]) => [value, key])
        );
        return mmToOOTBankMap[bankInt] ?? -1;
    }

    static convertIfRomanNumeral(word){
        // 1. Ensure input is a string and force upper
        if (typeof word !== 'string') return word;
        const str = word.toUpper().trim();

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