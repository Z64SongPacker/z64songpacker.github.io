

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
    read(data, offset){ return null; }
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
        return parseInt(this.dataType.match(/\d+/g)[0]) / 8;
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
    resolve(data, offset, parent){
        // Any offset zero is considered empty
        if(offset == 0) return;

        var ReferenceType;
        if(this.referencedType == "Envelope") ReferenceType = Envelope;
        else if(this.referencedType == "Sample") ReferenceType = Sample;
        else if(this.referencedType == "Book") ReferenceType = Book;
        else if(this.referencedType == "Loop") ReferenceType = Loop;
        var collection = this.referencedType.toLowerCase() + "s"; // Pluralized name of the type

        if(!parent[collection]) parent[collection] = [];

        var id = parent[collection].findIndex(e => e._offset == offset);
        if(id < 0) {
            parent[collection].push(new ReferenceType(data, offset, parent));
            id = parent[collection].length - 1;
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
    }

    get totalSizeInBits(){
        return this.properties.reduce((total, current) => total + current[1], 0);
    }

    size(){
        return this.totalSizeInBits / 8;
    }
}

// An array of basic properties, the count can be a method for deferred execution
class Array extends DataType {
    constructor(dataType, getCount){
        super();
        this.dataType = dataType;
        this.getCount = getCount;
    }

    read(data, offset){
        var array = [];
        for(var i = 0; i < this.count; i++){
            array.push(data[`get${this.dataType}`](offset + (i * this.dataTypeSize)));
        }
        return array;
    }

    write(data, offset, valueArray){
        for(var i = 0; i < valueArray.length; i++){
            data[`set${this.dataType}`](offset + (i * this.dataTypeSize), valueArray[i]);
        }
    }
    
    size(){
        return this.count * this.dataTypeSize;
    }
    
    get dataTypeSize(){
        return parseInt(this.dataType.match(/\d+/g)[0]) / 8;
    }
    get count(){
        if(typeof this.getCount === "function") return this.getCount();
        else return this.getCount;
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

class RomType {
    /**
     * @param {DataView} data - The data source we are reading to create this bank type
     * @param {number} offset - The offset where this type is located inside the data source
     * @param {RomType} parent - The bank where the information will be stored; needed to resolve offsets
     */
    constructor(data, offset, parent = null) {
        //console.log(`===============> Building ${this.constructor.name} with offset ${offset}`);
        this._offset = offset;
        var cursor = offset;

        // Process all the properties sequentially
        for(const p of this.properties){
            var name = p[0];
            var type = p[1];

            // Grab the value using the type and set it to this property
            // console.log(`Reading ${name} with offset ${cursor}`);
            var value = type.read(data, cursor);
            this[name] = value;
            //console.log(`${name} = ${value}`);

            // Resolve any offsets recursively
            if(type instanceof Offset) type.resolve(data, value, parent);

            // Move the cursor using this property's size
            cursor += type.size();
        }
    }
    write(data, offset){
        var cursor = offset;
        for(const p of this.properties){
            var name = p[0];
            var type = p[1];
            type.write(data, cursor, this[name]);
            cursor += type.size();
        }
    }
    get properties(){
        return [];
    }
    size(){
        return alignTo16(this.properties.reduce((total, current) => total + current[1].size(), 0));
    }
}

// =====================================

class Drum extends RomType{
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

class Instrument extends RomType{
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
class Envelope extends RomType{
    constructor(data, offset, parent){
        super(data, offset, parent);
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
    write(data, offset){
        var cursor = offset;
        for(var point of this.points){
            //console.log(`Writing point ${point.delay} | ${point.arg}`);
            data.setInt16(cursor, point.delay);
            data.setUint16(cursor + 2, point.arg);
            cursor += 4;
        }
    }
    size(){
        return alignTo16(this.points.length * 4);
    }
}

class Sample extends RomType{
    get properties(){
        return [
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

class Loop extends RomType {
    get properties(){
        return [
            ["start", UINT],
            ["end", UINT],
            ["count", UINT],
            ["numFrames", UINT],
            ["predictorState", new Array("Int16", () => this.count == 0 ? 0 : 16)]
        ];
    }
}

class Book extends RomType {
    get properties(){
        return [
            ["order", INT],
            ["npredictors", INT],
            ["book", new Array("Int16", () => 8 * this.order * this.npredictors)]
        ];
    }
}



// ======================================

export class Bank {
    // The 15 slots!
    instrumentSlots = [];

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
        this.numSfx = bankmeta.getUint16(6);

        // ZBANK
        // All offsets over here are relative to the bank, so we can use them directly as offsets for the reading!

        // INSTRUMENTS
        // This pointer list it's part of the header
        for(var i = 0; i < this.numInstruments; i++){
            var instrumentOffset = bank.getUint32(8 + (i * 4));
            var id = null;
            //console.log("Loading instrument at offset " + instrumentOffset.toString(16));

            if(instrumentOffset != 0){
                var id = this.instruments.findIndex(e => e._offset == instrumentOffset);
                if(id < 0) {
                    this.instruments.push(new Instrument(bank, instrumentOffset, this));
                    id = this.instruments.length - 1;
                    //console.log("Loading instrument from position: " + instrumentOffset.toString(16) + " with size: " + (this.instruments[id]?.size().toString(16)));
                }
            }
            
            this.instrumentSlots[i] = id;
        }

        // DRUMS
        // This offset points to a sequential list of pointers for each drum
        var drumListOffset = bank.getUint32(0);
        if(drumListOffset != 0){
            for(var i = 0; i < this.numDrums; i++){
                var drumOffset = bank.getUint32(drumListOffset + (i * 4));
                if(drumOffset != 0){
                    this.drums[i] = new Drum(bank, drumOffset, this);
                }
            }
        }
        

        /*for(var prop in this){
            console.dir(this[prop], { depth: null });
        }*/
    }

    writeBankMeta(){
        var out = new Uint8Array(8);
        var data = new DataView(out.buffer, out.byteOffset, out.byteLength);
        data.setUint8(0, this.medium);
        data.setUint8(1, this.cachePolicy);
        data.setUint8(2, this.sampleBankId1);
        data.setUint8(3, this.sampleBankId2);
        data.setUint8(4, this.numInstruments); // <-- TODO: GRAB THESE FROM THE ARRAYS
        data.setUint8(5, this.numDrums);
        data.setUint16(6, this.numSfx);
        return out;
    }

    writeZBank(){
        // First, we calculate their sizes, so we can resolve their offsets properly
        var drumListOffset = alignTo16(4 + 4 + (this.instrumentSlots.length * 4));
        var instrumentsOffset = alignTo16(drumListOffset + (this.drums.length * 4));
        var drumsOffset = instrumentsOffset + this.instruments.filter(i => i).reduce((p, c) => p + c.size(), 0);
        var envelopesOffset = drumsOffset + this.drums.reduce((p, c) => p + c.size(), 0);
        var samplesOffset = envelopesOffset + this.envelopes.reduce((p, c) => p + c.size(), 0);
        var booksOffset = samplesOffset + this.samples.reduce((p, c) => p + c.size(), 0);
        var loopsOffset = booksOffset + this.books.reduce((p, c) => p + c.size(), 0);
        var totalSize = loopsOffset + this.loops.reduce((p, c) => p + c.size(), 0);
        
        console.log("Building zbank with size " + totalSize);
        console.log("drumListOffset: " + drumListOffset.toString(16));
        console.log("instrumentsOffset: " + instrumentsOffset.toString(16));
        console.log("drumsOffset: " + drumsOffset.toString(16));
        console.log("envelopesOffset: " + envelopesOffset.toString(16));
        console.log("samplesOffset: " + samplesOffset.toString(16));
        console.log("booksOffset: " + booksOffset.toString(16));
        console.log("loopsOffset: " + loopsOffset.toString(16));

        var out = new Uint8Array(totalSize);
        var data = new DataView(out.buffer, out.byteOffset, out.byteLength);

        // HEADER
        data.setUint32(0, drumListOffset); // Drum list offset
        data.setUint32(4, 0); // SFX list offset
        for(var i = 0; i < this.instrumentSlots.length; i++){
            var instrumentIndex = this.instrumentSlots[i];
            if(instrumentIndex != null){
                console.log(`Adding instrument slot ${i} with instrument at position ${instrumentIndex} with offset ${this.instruments[instrumentIndex]._offset}`);
                data.setUint32(8 + (i * 4), this.instruments[instrumentIndex]._offset); // Instrument offsets
            }
        }

        // DRUM LIST
        for(var i = 0; i < this.drums.length; i++){
            data.setUint32(drumListOffset + (i * 4), this.drums[i]._offset);
        }

        // SFX LIST
        // None, we'll not implement it right now

        // INSTRUMENTS
        for(var instrument of this.instruments){
            if(instrument){
                console.log("Adding instrument at position: " + instrumentsOffset.toString(16) + " with size: " + instrument.size().toString(16));
                instrument.write(data, instrumentsOffset);
                instrumentsOffset += instrument.size();
            }
        }

        // DRUMS
        for(var drum of this.drums){
            drum.write(data, drumsOffset);
            drumsOffset += drum.size();
        }

        // ENVELOPES
        for(var envelope of this.envelopes){
            // console.log("Adding envelope at position: " + envelopesOffset.toString(16));
            envelope.write(data, envelopesOffset);
            envelopesOffset += envelope.size();

            // TODO: HERE, RESOLVE ANY OFFSETS!
        }

        // SAMPLES
        for(var sample of this.samples){
            sample.write(data, samplesOffset);
            samplesOffset += sample.size();

            // TODO: HERE, RESOLVE ANY OFFSETS!
        }

        // BOOKS
        for(var book of this.books){
            console.log("Adding book at position: " + booksOffset.toString(16));
            book.write(data, booksOffset);
            booksOffset += book.size();

            // TODO: HERE, RESOLVE ANY OFFSETS!
        }

        // LOOPS
        for(var loop of this.loops){
            loop.write(data, loopsOffset);
            loopsOffset += loop.size();

            // TODO: HERE, RESOLVE ANY OFFSETS!
        }
        
        return out;
    }
}

function alignTo16(value){
    return Math.ceil(value / 16) * 16;
}



// ============================


class SampleBank{
    samples = [];
    constructor(bytes, offset){
        this.bytes = bytes;
        this.offset = offset;
    }
}

class DecodedSample{
    constructor(sampleBankId, offset, size, codec, book, loop){
        this.sampleBankId = sampleBankId;
        this.offset = offset;
        this.size = size;
        this.codec = codec;
        this.book = book;
        this.loop = loop;
    }

    // TODO: DO DECODING SHENANIGANS
}


// =============================


class AudioTableEntry extends RomType{
    get properties(){
        return [
            ["offset", UINT],
            ["entrySize", UINT],
            ["medium", BYTE],
            ["cachePolicy", BYTE],
            ["data1hi", BYTE],
            ["data1lo", BYTE],
            ["data2hi", BYTE],
            ["data2lo", BYTE],
            ["data3", SHORT],
        ];
    }

    constructor(data, offset, parent){
        super(data, offset, parent);
        this.meta = new Uint8Array(data.buffer, data.byteOffset + offset + 8, 8);
    }
}

class AudioTable{
    constructor(rom, offset){
        var cursor = offset;
        var numEntries = rom.getInt16(cursor);
        cursor += 0x10; // Skip the header

        console.log("Loading audiotable: " + numEntries);

        this.entries = [];
        for(var i = 0; i < numEntries; i++){
            var entry = new AudioTableEntry(rom, cursor);
            this.entries.push(entry);
            cursor += entry.size();
        }
    }

    // If the size of the entry is 0, that means it's an alias!
    resolveAlias(id){
        var entry = this.entries[id];
        if(entry.entrySize == 0) return entry.offset;
        else return id;
    }
}

const OOT_TABLES = {
    banks: { tableOffset: 0xB896A0, dataOffset: 0x00D390 },
    samples: { tableOffset: 0xB8A1C0, dataOffset: 0x079470 },
    sequences: { tableOffset: 0xB89AD0, dataOffset: 0x029DE0 }, // Not gonna bother with this one tho...
};
const MM_TABLES = {} // TODO: ...

export class Z64Rom{
    banks = [];
    sampleBanks = [];
    samples = [];

    constructor(rom, game){
        if(rom instanceof Uint8Array) rom = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
        var t = game == "mm" ? MM_TABLES : OOT_TABLES;

        // Get the banks
        this.bankTable = new AudioTable(rom, t.banks.tableOffset);
        for(var entry of this.bankTable.entries){
            var bank = new Uint8Array(rom.buffer, t.banks.dataOffset + entry.offset, entry.entrySize);
            this.banks.push(new Bank(bank, entry.meta));
        }
        
        // Get the sample banks
        this.sampleTable = new AudioTable(rom, t.samples.tableOffset);
        for(var entry of this.sampleTable.entries){
            var sampleBytes = new Uint8Array(rom.buffer, t.samples.dataOffset + entry.offset, entry.entrySize);
            this.sampleBanks.push(new SampleBank(sampleBytes, entry.offset));
        }

        // Collect all samples used in the ROM
        for(var i = 0; i < this.banks.length; i++){
            var bank = this.banks[i];

            // Get the sample bank
            var sampleBankId = this.sampleTable.resolveAlias(bank.sampleBankId1); // sampleBankId2 is never used in vanilla
            if(game == "oot" && bank == 37) sampleBankId = bank.sampleBankId2; // EXCEPT for this bank for some reason (according to oot decomp)
            var sampleBank = this.sampleBanks[sampleBankId];

            // Search each instrument, drum, and SFX and collect the sample's information
            for(var sample of bank.samples){
                if(sampleBank.samples.some(s => s.sampleBankId == sampleBankId && s.offset == sample.sampleAddr)) continue;
                sampleBank.samples.push(new DecodedSample(
                    sampleBankId,
                    sample.sampleAddr,
                    sample.bitfield.size,
                    sample.bitfield.codec,
                    bank.books.find(b => b._offset == sample.book),
                    bank.loops.find(l => l._offset == sample.loop),
                ));
            }
        }

        for(var prop in this){
            console.dir(this[prop], { depth: null });
        }
    }

    solveAudioTableAlias(id){

    }
}
