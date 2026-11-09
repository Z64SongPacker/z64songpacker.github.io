
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

// The basic types
const BYTE = new BankDataType(1, (bank, offset) => bank.getUint8(offset), (bank, offset, value) => bank.setUint8(offset, value));
const SHORT = new BankDataType(2, (bank, offset) => bank.getInt16(offset), (bank, offset, value) => bank.setInt16(offset, value));
const INT = new BankDataType(4, (bank, offset) => bank.getInt32(offset), (bank, offset, value) => bank.setInt32(offset, value));
const UINT = new BankDataType(4, (bank, offset) => bank.getUint32(offset), (bank, offset, value) => bank.setUint32(offset, value));
const FLOAT = new BankDataType(4, (bank, offset) => bank.getFloat32(offset), (bank, offset, value) => bank.setFloat32(offset, value));

// The more complex ones

// Tuned sample includes a sample offset (NOT RELATIVE, this we must get it through a ROM) and it's tuning
// TODO: THE SAMPLE MAY BE RELATIVE (ABSound) !!!!
const TUNED_SAMPLE = new BankDataType(8,
    (bank, offset) => new TunedSample(bank.getUint32(offset), bank.getFloat32(offset+4)),
    (bank, offset, tunedSample) => {
        bank.setUint32(offset, tunedSample.sample);
        bank.setFloat32(offset+4, tunedSample.tuning);
    }
);
class TunedSample{
    constructor(sample, tuning){
        this.sample = sample;
        this.tuning = tuning;
    }
}

// Points to a relative offset of a specific type
class Offset extends BankDataType {
    static forType(type){
        const offsetTypes = {
            "Envelope": Envelope
        };
        var TypeReference = offsetTypes[type];
        return new BankDataType(4,
            (bank, offset) => new TypeReference(bank, bank.getUint32(offset)),
            (bank, offset, value) => {
                // TODO: WRITE THE ACTUAL OFFSET!
                //bank.setUint32(offset, tunedSample.sample);
                //bank.setFloat32(offset+4, tunedSample.tuning);
            }
        );
    }
}


// ====================================

// TODO: IMPLEMENT MULTIPLES TYPES OF READERS
// 1. STATIC TYPES: The ones with static properties
// 2. SEQUENTIAL TYPES: The ones read as sequences (like envelopes) that allow more dynamic creations
// Both types should allow:
// - Constructor to build them from a bank/offset combo
// - Reading it's full size (respecting padding to 16)
// - Writing to a dataview

class BankType {
    /**
     * @param {DataView} bank
     * @param {number} offset
     */
    constructor(bank, offset) {
        this._offset = offset;
        var cursor = offset;

        // Process all the properties sequentially
        for(const p of this.properties){
            var name = p[0];
            var type = p[1];

            // Grab the value using the type and set it to this property
            var value = type.getValue(bank, cursor);
            this[name] = value;
            // console.log(`${name} = ${value}`);

            // Move the cursor using this property's size
            cursor += type.size;
        }
    }
    get properties(){
        return [];
    }
    get size(){
        return this.properties.reduce((total, current) => total + current[1].size, 0);
    }
}

// =====================================

class Drum extends BankType{
    get properties(){
        return [
            ["releaseRate", BYTE], // adsrDecayIndex
            ["pan", BYTE],
            ["isRelocated", BYTE],
            ["padding", BYTE],
            ["tunedSample", TUNED_SAMPLE],
            //["envelope", UINT]
            ["envelope", Offset.forType("Envelope")]
        ];
    }
}

class Instrument extends BankType{
    get properties(){
        return [
            ["isRelocated", BYTE],
            ["normalRangeLo", BYTE],
            ["normalRangeHi", BYTE],
            ["releaseRate", BYTE], // adsrDecayIndex
            ["envelope", Offset.forType("Envelope")],
            ["lowPitchTunedSample", TUNED_SAMPLE],
            ["normalPitchTunedSample", TUNED_SAMPLE],
            ["highPitchTunedSample", TUNED_SAMPLE],
        ];
    }
}

// Envelopes contains an array of points: delay + arg
// They are read sequentially until a terminator is hit (which is a delay with zero or less)
// So... they can be any size, not limited to what seq64 permits
class EnvelopePoint{
    static DISABLE = 0;
    static HANG = -1;
    static GOTO = -2;
    static RESTART = -3;
    constructor(delay, arg){
        this.delay = delay;
        this.arg = arg;
    }
}
class Envelope extends BankType{
    constructor(bank, offset){
        super(bank, offset);
        this.points = [];
        var cursor = offset;

        do{
            var delay = bank.getInt16(cursor);
            var arg = bank.getUint16(cursor + 2);
            this.points.push(new EnvelopePoint(delay, arg));
            if(delay <= 0) break;
            cursor += 4;
        } while(true);
    }

    get size(){
        return this.points.length * 4;
    }
}


// ======================================

export class Bank {
    // Bank meta propeties
    medium = "";
    cachePolicy = "";
    sampleBankId1 = 1;
    sampleBankId2 = 0;
    numInstruments = 0;
    numDrums = 0;
    numSfx = 0;

    // Bank properties
    instruments = [];
    drums = [];
    envelopes = [];
    samples = [];
    books = [];
    loops = [];

    constructor(bank, bankmeta){
        if(bank instanceof Uint8Array) bank = new DataView(bank.buffer, bank.byteOffset, bank.byteLength);
        if(bankmeta instanceof Uint8Array) bankmeta = new DataView(bankmeta.buffer, bankmeta.byteOffset, bankmeta.byteLength);

        var cursor = 0;
        var commands = [];

        // BANK META
        // Get all necessary info, since we'll need it to read the bank itself
        this.medium = bankmeta.getUint8(0);
        this.cachePolicy = bankmeta.getUint8(1);
        this.sampleBankId1 = bankmeta.getUint8(2);
        this.sampleBankId2 = bankmeta.getUint8(3);
        this.numInstruments = bankmeta.getUint8(4);
        this.numDrums = bankmeta.getUint8(5);
        this.numSfx = bankmeta.getInt16(6);

        // ZBANK
        // All offsets over here are relative to the bank, so we can use them directly as offsets for the reading!

        // DRUMS
        // This offset points to a sequential list of pointers for each drum
        var drumListOffset = bank.getUint32(0);
        if(drumListOffset != 0){
            for(var i = 0; i < this.numDrums; i++){
                var drumOffset = bank.getUint32(drumListOffset + (i * 4));
                var drum = new Drum(bank, drumOffset);
                this.drums[i] = drum;
            }
        }

        // SFX
        // This offset points to a sequential list of pointers for each sfx
        var sfxListOffset = bank.getUint32(4);
        if(sfxListOffset != 0){
            // ... TODO: Altough no one uses this thing...
        }

        // INSTRUMENTS
        // This pointer list it's part of the header
        for(var i = 0; i < this.numInstruments; i++){
            var instrumentOffset = bank.getUint32(8 + (i * 4));
            var instrument = instrumentOffset == 0 ? null : new Instrument(bank, instrumentOffset);
            this.instruments[i] = instrument;
        }

        // ENVELOPES
        // We got these on the Drums and Intruments, so we grab the refereces from there
        

        for(var prop in this){
            console.dir(this[prop], { depth: null });
        }

        return;

        // DRUMS
        var drumListOffset = bank.getUint32(0);


        // SFX
        var sfxListOffset = bank.getUint32(4);


        // INSTRUMENTS
        var instrument ;
        // um...
        


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