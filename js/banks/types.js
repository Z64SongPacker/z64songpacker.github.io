

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
class DataType{
    read(data, offset){ }
    write(data, offset, value){ }
    size(){ return 0; }
}

// The basic types
class BasicDataType extends DataType{
    constructor(dataType){
        super();
        this.dataType = dataType;
    }
    read(data, offset){
        return data[`get${this.dataType}`](offset);
    }
    write(data, offset, value){
        data[`set${this.dataType}`](offset, value)
    }
    size(){
        return this.dataType.match(/\d+/g)[0] / 8;
    }
}
const BYTE = new BasicDataType("Uint8");
const SHORT = new BasicDataType("Int16");
const INT = new BasicDataType("Int32");
const UINT = new BasicDataType("Uint32");
const FLOAT = new BasicDataType("Float32");

// ================================

// Points to a relative offset of a specific type
class Offset extends BasicDataType{
    constructor(referencedType){
        super("Uint32");
        this.referencedType = referencedType;
    }

    // Reads this object from the data, and adds it to the provided collection inside the main bank object
    // Also register the collection's id for future referencing
    resolve(bank, data, offset){
        // Any offset zero is considered empty
        if(offset == 0) return;

        var ReferenceType;
        if(this.referencedType == "Envelope") ReferenceType = Envelope;
        else if(this.referencedType == "Sample") ReferenceType = Sample;
        else if(this.referencedType == "Book") ReferenceType = Book;
        else if(this.referencedType == "Loop") ReferenceType = Loop;
        var collection = this.referencedType.toLowerCase() + "s"; // Pluralized name of the type

        if(!bank[collection]) bank[collection] = [];

        var id = bank[collection].findIndex(e => e._offset == offset);
        if(id < 0) {
            bank[collection].push(new ReferenceType(bank, data, offset));
            id = bank[collection].length - 1;
        }

        this.id = id;
    }
}
const ENVELOPE = new Offset("Envelope");
const SAMPLE = new Offset("Sample");
const BOOK = new Offset("Book");
const LOOP = new Offset("Loop");

// Convert a bitfield in with their respective properties
class BitField extends DataType{
    constructor(properties){
        super();
        this.properties = properties;
    }

    read(data, offset){
        var object = {};
        var bitField = data[`getUint${this.totalSizeInBits}`](offset);
        var bitOffset = this.totalSizeInBits; // Read backwards, since it's big-endian
        for(const p of this.properties){
            var name = p[0];
            var sizeInBits = p[1];
            
            bitOffset -= sizeInBits;
            object[name] = (bitField >>> bitOffset) & ((1 << sizeInBits) - 1);
        }
        //console.log(`bitfield: ${bitField} = ${this.write(data, offset, object)}`);
        return object;
    }

    write(data, offset, valueObject){
        var bitField = 0;
        var bitOffset = this.totalSizeInBits; // Read backwards, since it's big-endian
        for(const p of this.properties){
            var name = p[0];
            var sizeInBits = p[1];
            var value = valueObject[name];

            bitOffset -= sizeInBits;
            var mask = ((1 << sizeInBits) - 1) << bitOffset;
            bitField = ((bitField & ~mask) | ((value << bitOffset) & mask)) >>> 0;
        }
        data[`setUint${this.totalSizeInBits}`](offset, bitField);
        return bitField;
    }

    get totalSizeInBits(){
        return this.properties.reduce((total, current) => total + current[1], 0);
    }

    size(){
        return this.totalSizeInBits / 8;
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
     * @param {Bank} bank - The bank where the information will be stored; needed to resolve offsets
     * @param {DataView} data - The data source we are reading to create this bank type
     * @param {number} offset - The offset where this type is located inside the data source
     */
    constructor(bank, data, offset) {
        this._offset = offset;
        var cursor = offset;

        // Process all the properties sequentially
        for(const p of this.properties){
            var name = p[0];
            var type = p[1];

            // Grab the value using the type and set it to this property
            var value = type.read(data, cursor);
            this[name] = value;
            // console.log(`${name} = ${value}`);

            // Resolve any offsets recursively
            if(type instanceof Offset) type.resolve(bank, data, value);

            // Move the cursor using this property's size
            cursor += type.size();
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
            ["sample", SAMPLE],
            ["tuning", FLOAT],
            ["envelope", ENVELOPE]
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
            ["envelope", ENVELOPE],
            ["lowPitchSample", SAMPLE],
            ["lowPitchSampleTuning", FLOAT],
            ["normalPitchSample", SAMPLE],
            ["normalPitchSampleTuning", FLOAT],
            ["highPitchSample", SAMPLE],
            ["highPitchSampleTuning", FLOAT]
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
    constructor(bank, data, offset){
        super(bank, data, offset);
        this.points = [];
        var cursor = offset;

        do{
            var delay = data.getInt16(cursor);
            var arg = data.getUint16(cursor + 2);
            this.points.push(new EnvelopePoint(delay, arg));
            if(delay <= 0) break;
            cursor += 4;
        } while(true);
    }
    get size(){
        return this.points.length * 4;
    }
}

class Sample extends BankType{
    get properties(){
        return [
            /* bits 31..28  codec       (0 = ADPCM, 3 = "small" 2-bit ADPCM; others unused here)
            bits 27..26  medium      (0 = use sampleBank1, 1 = use sampleBank2)
            bit  25      cached      (0 in music banks)
            bit  24      isRelocated (must be 0)
            bits 23..0   size        (byte length of the compressed sample data) */
            //["bitfield", UINT],
            ["bitfield", new BitField([
                ["codec", 4],
                ["medium", 2],
                ["cached", 1],
                ["isRelocated", 1],
                ["size", 24],
            ])],
            ["sampleAddr", UINT],
            ["loop", LOOP], // <-- TODO: Maybe these 2 not make them offsets, since they are SO dependant on the sample itself...
            ["book", BOOK]
        ];
    }
}


// TODO: THESE TWO MAY NEED CUSTOM TYPES, SAME AS ENVELOPE, SINCE WE ARE GONNA BE EDITING THEM BY ARRAYS
// Altough, since they are arrays of a single type, it may work with a custom property...
class Loop extends BankType {
    get properties(){
        return [
            ["start", UINT],
            ["end", UINT],
            ["count", UINT],
            ["numFrames", UINT],
            // ["predictorState", SHORT] ARRAY BASED ON (count) VARIABLE
        ];
    }
}

class Book extends BankType {
    get properties(){
        return [
            ["order", INT],
            ["npredictors", INT],
            // ["book", SHORT] ARRAY BASED ON (8 * order * npredictors) VARIABLE
        ];
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
                this.drums[i] = new Drum(this, bank, drumOffset);
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
            this.instruments[i] = instrumentOffset == 0 ? null : new Instrument(this, bank, instrumentOffset);
        }
        

        for(var prop in this){
            console.dir(this[prop], { depth: null });
        }
    }
}