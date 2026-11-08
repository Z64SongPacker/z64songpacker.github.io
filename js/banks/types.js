
class BankMeta{

}

/* 
HOW TO DO THIS

There exists the following BASE types:
- u8   - BYTE
- u32  - INT
- s16  - SIGNED_SHORT
- s32  - SIGNED_INT
- f32  - FLOAT

Then, there are special types that use combinations of these as a backbone
- OFFSET (u32) - Points to another struct within the bank; should store it's type to pick it up afterwards
- TUNED_SAMPLE (u32+f32) - Offset of a sample + it's tuning

SO, using these, we should be capable of serializing and deserializing a bank proper
*/

// Type definitions to help with parsing... because javascript doesn't have type definitions to help :c
class BankDataType{
    /**
     * @callback DeserializationCallback
     * @param {DataView} bank
     * @param {number} offset
     * @returns {any}
     * 
     * @callback SerializationCallback
     * @param {DataView} bank
     * @param {number} offset
     * @param {any} value
     * @returns {void}
     * 
     * @param {number} size - The length this property uses in bytes
     * @param {DeserializationCallback} getValue - Deserialization callback
     * @param {SerializationCallback} setValue - Serialization callback
     */
    constructor(size, getValue, setValue){
        this.size = size;
        this.getValue = getValue;
        this.setValue = setValue;
    }
}



class TunedSample{
    constructor(sample, tuning){
        this.sample = sample;
        this.tuning = tuning;
    }
}

// The basic types
const BYTE = new BankDataType(1, (bank, offset) => bank.getUint8(offset), (bank, offset, value) => bank.setUint8(offset, value));
const SHORT = new BankDataType(2, (bank, offset) => bank.getInt16(offset), (bank, offset, value) => bank.setInt16(offset, value));
const INT = new BankDataType(4, (bank, offset) => bank.getInt32(offset), (bank, offset, value) => bank.setInt32(offset, value));
const UINT = new BankDataType(4, (bank, offset) => bank.getUint32(offset), (bank, offset, value) => bank.setUint32(offset, value));
const FLOAT = new BankDataType(4, (bank, offset) => bank.getFloat32(offset), (bank, offset, value) => bank.setFloat32(offset, value));

// The more complex ones
const TUNED_SAMPLE = new BankDataType(8,
    (bank, offset) => new TunedSample(bank.getUint32(offset), bank.getFloat32(offset+4)),
    (bank, offset, tunedSample) => {
        bank.setUint32(offset, tunedSample.sample);
        bank.setFloat32(offset+4, tunedSample.tuning);
    }
);
class Offset extends BankDataType {
    static forType(type){
        TypeReference = classRegistry[type];
        return new BankDataType(4,
            (bank, offset) => new TypeReference(bank, offset),
            (bank, offset, value) => {
                // TODO: WRITE THE ACTUAL OFFSET!
                //bank.setUint32(offset, tunedSample.sample);
                //bank.setFloat32(offset+4, tunedSample.tuning);
            }
        );
    }
}


// TODO: IMPLEMENT MULTIPLES TYPES OF READERS
// 1. STATIC TYPES: The ones with static properties
// 2. SEQUENTIAL TYPES: The ones read as sequences (like envelopes) that allow more dynamic creations
// Both types should allow:
// - Constructor to build them from a bank/offset combo
// - Reading it's full size (respecting padding to 16)
// - Writing to a dataview

class BankType{
    /**
     * @param {DataView} bank
     * @param {number} offset
     */
    constructor(bank, offset) {
        var cursor = offset;

        // Process all the properties sequentially
        for(const p of properties){
            var name = p[0];
            var type = p[1];

            // Grab the value using the type and set it to this property
            var value = type.getValue(bank, cursor);
            this[name] = value;

            // Move the cursor using this property's size
            cursor += type.size;
        }
    }
}

class Drum extends BankType{
    properties = [
        ["adsrDecayIndex", BYTE],
        ["pan", BYTE],
        ["isRelocated", BYTE],
        ["padding", BYTE],
        ["tunedSample", TUNED_SAMPLE],
        ["envelope", Offset.forType("Envelope")]
    ];
}

class Instrument extends BankType{
    properties = [
        ["isRelocated", BYTE],
        ["normalRangeLo", BYTE],
        ["normalRangeHi", BYTE],
        ["adsrDecayIndex", BYTE],
        ["envelope", Offset.forType("Envelope")],
        ["lowPitchTunedSample", TUNED_SAMPLE],
        ["normalPitchTunedSample", TUNED_SAMPLE],
        ["highPitchTunedSample", TUNED_SAMPLE],
    ];
}

class Envelope extends BankType{
    // This is a sequential type, meaning it reads with commands, similar to the sequences themselves!
    // So... can be any size. It only stops reading when it reaches a DELAY command with 0 or less (which are special wildcards)  
    commands = [
        ["delay", SHORT],
        ["arg", SHORT]
    ];


}

export class Bank {
    instruments = [];
    drums = [];
    envelopes = [];
    samples = [];
    books = [];
    loops = [];

    static readBank(bank){
        var cursor = 0;
        var commands = [];

        // DRUMS
        var drumListOffset = bank.getUint32(0);


        // SFX
        var sfxListOffset = bank.getUint32(4);

        // INSTRUMENTS
        var instrument ;
        
        


        drumListOffset, sfxListOffset, instOffsets;




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
            commands.push(commandString);

            // If we find the end, then stop searching the header
            if(id == 0xFF) break;

        } while(cursor < seq.length);

        return commands;
    }
}