
const OFFSET = ["offset", 0];
const BYTE = ["fixed", 1];
const SHORT = ["fixed", 2];
const VARIABLE = ["variable", 0] // <-- CAN BE 1 OR 2

// DON'T KNOW HOW TO HANDLE THESE !!!
// In the meantime I'll just skip them, seems that's what SEQ64 does?
// Maybe they are only used in processing?
// https://github.com/sauraen/seq64/blob/master/Source/SeqFile.cpp#L390C4-L390C62
const CONSTANT = ["constant", 0]; 
const CONSTANT_16 = ["constant", 0];

// Really loose implementation, for fixing current issues.
// Expand in the future to be able to read all commands!
// [Name, Command, Params]
const SEQ_HEADER = [
    ["testchan", [0x00, 0x0F], [OFFSET]],

    ["stopchan", [0x40, 0x4F], [OFFSET]],
    ["subio", [0x50, 0x5F], [OFFSET]],
    ["loadbank", [0x60, 0x6F], [OFFSET, BYTE, BYTE]],
    ["stio", [0x70, 0x7F], [OFFSET]],
    ["ldio", [0x80, 0x8F], [OFFSET]],
    ["startchan", [0x90, 0x9F], [OFFSET, SHORT]],
    ["rstartchan", [0xA0, 0xAF], [OFFSET, SHORT]],
    ["loadseq", [0xB0, 0xBF], [OFFSET, BYTE, SHORT]],

    ["unk_C4", 0xC4, [BYTE, BYTE]],
    ["unk_C5", 0xC5, [SHORT]],
    ["unk_C6", 0xC6, []],
    ["sts", 0xC7, [BYTE, SHORT, CONSTANT]],
    ["sub", 0xC8, [BYTE]],
    ["and", 0xC9, [BYTE]],

    ["ldi", 0xCC, [BYTE]],
    ["tblcall", 0xCD, [SHORT]],
    ["rand", 0xCE, [BYTE]],
    ["noteallocpolicy", 0xD0, [BYTE]],
    ["ldshorttablegate", 0xD1, [SHORT, CONSTANT_16]],
    ["ldshorttablevel", 0xD2, [SHORT, CONSTANT_16]],
    ["mutebhv", 0xD3, [BYTE]],
    ["mute", 0xD4, []],
    ["mutescale", 0xD5, [BYTE]],
    ["disablechan", 0xD6, [SHORT]],
    ["initchan", 0xD7, [SHORT]],

    ["sexp", 0xD9, [BYTE]],
    ["sfade", 0xDA, [BYTE, SHORT]],
    ["svol", 0xDB, [BYTE]], // <-- THE IMPORTANT ONE  \(.__.\) the master volume!
    ["tempovar", 0xDC, [BYTE]],
    ["tempo", 0xDD, [BYTE]],
    ["stprel", 0xDE, [BYTE]],
    ["stp", 0xDF, [BYTE]],

    ["print", 0xEF, [SHORT, BYTE]],
    ["unreservenotes", 0xF0, []],
    ["reservenotes", 0xF1, [BYTE]],
    ["rbltz", 0xF2, [BYTE]],
    ["rbeqz", 0xF3, [BYTE]],
    ["rjump", 0xF4, [BYTE]],
    ["bgez", 0xF5, [SHORT]],
    ["break", 0xF6, []],
    ["loopend", 0xF7, []],
    ["loop", 0xF8, [BYTE]],
    ["bltz", 0xF9, [SHORT]],
    ["beqz", 0xFA, [SHORT]],
    ["jump", 0xFB, [SHORT]],
    ["call", 0xFC, [SHORT]],
    ["delay", 0xFD, [VARIABLE]],
    ["yield", 0xFE, []],
    ["end", 0xFF, []]
]

export class SeqUtils{

    static getCommandDefinition(id){
        for(const c of SEQ_HEADER){
            var cid = c[1];
            if(Array.isArray(cid)){
                if(cid[0] <= id && cid[1] >= id) return c;

            } else{
                if(id == cid) return c;
            }
        }
        return null;
    }

    static seqReader(seq, processCommandCallback = null, verbose = false){
        var cursor = 0;
        do{
            // Get the command by it's ID
            var id = seq[cursor];
            var command = this.getCommandDefinition(id);

            // If we do not find it, abort the process!
            // That means the header is malformed and we can break stuff if we continue.
            if(command == null){
                console.error(`ABORTING! Found a non-valid command ${id.toString(16).toUpperCase()} at address ${cursor.toString(16).padStart(4, '0').toUpperCase()} in header. The sequence may be malformed.`)
                return;
            }

            var commandString = `${cursor.toString(16).padStart(4, '0').toUpperCase()} ${command[0]}`;

            // Calculate the data length to skip after the command
            // Check every param and how much space it uses
            var paramCursor = 0;
            for(const p of command[2]){
                var type = p[0];
                var dataLength = p[1];
                var value = 0;
                
                if(type == "offset"){
                    // Get the rightmost nibble
                    value = id % 16;

                } else{
                    // Get the next byte
                    // We assume that a fixed or variable param can't be of zero length
                    // So... we always grab one at least!
                    value = seq[cursor + paramCursor + 1];

                    if(type == "fixed") dataLength = p[1];
                    else if(type == "variable") dataLength = (value >= 0x80) ? 2 : 1;

                    // If the param is 2 bytes, combine the value with the next byte
                    if(dataLength == 2) {
                        value = (value << 8) | seq[cursor + paramCursor + 2];
                        if(type == "variable") value -= 0x8000 // Don't forget to remove the var header!
                    }
                }

                commandString += ", " + value.toString(16).padStart(2 * dataLength, '0').toUpperCase();

                // Process the params here!
                // This gives us a lot of options to modify seqs on the go
                processCommandCallback?.(id, value, cursor + paramCursor + 1);

                // Advance the param cursor by the length of the value
                // That way, we can grab the next parameter
                paramCursor += dataLength;
            }

            // Always move by one extra, since we need to consider the space taken by our own command
            cursor += 1 + paramCursor;

            // Print in a similar way to seq64
            if(verbose) console.log(commandString);

            // If we find the end, then stop searching the header
            if(id == 0xFF) break;

        } while(cursor < seq.length);
    }


    // Amplifies the volume byte of this by an specific amount (linear additive)
    static preAmplifyVolume(seq, volumePreAmplifying){
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];
        var finalVolume = Math.min(Math.max(mainVolume + volumePreAmplifying, 0x0), 0xFF); // <- Clamp to 8bits
        // console.log("Main volume changed: " + mainVolume + " -> " + finalVolume);
        seq[mainVolumeCommandIndex + 1] = finalVolume;
        return seq;
    }

    // ye olde method
    /*static setLoudness_old(seq, originalLoudness, targetLoudness){
        console.log("Setting loudness (OLD)...");
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];
        //console.log("Getting current volume... " + mainVolume);
        var finalVolume = this.convertMidiVolumeByLoudness(mainVolume, originalLoudness, targetLoudness);

        console.log(`Volume balanced: ${originalLoudness} LUFS -> ${targetLoudness} LUFS  | ${mainVolume} -> ${finalVolume}`);
        // seq[mainVolumeCommandIndex + 1] = finalVolume;
        return seq;
    }*/
    static setLoudness(seq, originalLoudness, targetLoudness){
        this.seqReader(seq, function(command, value, cursor){
            if(command == 0xDB){
                var finalVolume = SeqUtils.convertMidiVolumeByLoudness(value, originalLoudness, targetLoudness);
                seq[cursor] = finalVolume;
                console.log(`Volume balanced: ${originalLoudness} LUFS -> ${targetLoudness} LUFS  | ${value} -> ${finalVolume}`);
            }
        });
        return seq;
    }

    static convertMidiVolumeByLoudness(midiVolume, originalLoudness, targetLoudness){
        //console.log("convertMidiVolumeByLoudness");

        // First, we need to convert our current volume to decibels
        var currentDb = this.midiToDb(midiVolume);
        //console.log("Current dB: " + currentDb);

        // Now, calculate the target dB using the loudness LUFS
        var targetDb = currentDb + (+targetLoudness - +originalLoudness);
        //console.log("Target dB: " + targetDb);

        // Finally, convert back to midi and clamp
        var finalMidiVolume = this.dbToMidi(targetDb);
        //console.log("Final MIDI volume: " + finalMidiVolume);

        // Clamp to 8bits
        return Math.min(Math.max(finalMidiVolume, 0x0), 0xFF);
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
        return parseInt(bank, 16).toString(16).toUpperCase()
    }


    static ootToMMBankMap = {
        0x03: 0x03, // Hyrule Field
        0x05: 0x04, // Market
        0x08: 0x05, // Kakariko (Guitar)
        0x09: 0x06, // Fairy Fountain
        0x0D: 0x07, // Lon Lon Ranch
        0x0E: 0x26, // Goron City
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
        if(!Number.isInteger(bank)) throw new Error(`Bank ${bank} is not a number!`);
        return this.ootToMMBankMap[bank] ?? -1;
    }

    static mmToOOTBank(bank){
        if(!Number.isInteger(bank)) throw new Error(`Bank ${bank} is not a number!`);
        var mmToOOTBankMap = Object.fromEntries(
            Object.entries(this.ootToMMBankMap).map(([key, value]) => [value, key])
        );
        return mmToOOTBankMap[bank] ?? -1;
    }

    static convertIfRomanNumeral(word){
        // 1. Ensure input is a string and force upper
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