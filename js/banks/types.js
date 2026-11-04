
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
     * @callback BankDeserializationCallback
     * @param {DataView} bank
     * @param {number} offset
     * @returns {any}
     * 
     * @callback BankSerializationCallback
     * @param {DataView} bank
     * @param {number} offset
     * @param {any} value
     * @returns {void}
     * 
     * @param {number} size - The length this property uses in bytes
     * @param {BankDeserializationCallback} getValue - Deserialization callback
     * @param {BankSerializationCallback} setValue - Serialization callback
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
const OFFSET = ["int", 4]; // <--- TODO!!!!
const TUNED_SAMPLE = new BankDataType(8,
    (bank, offset) => new TunedSample(bank.getUint32(offset), bank.getFloat32(offset+4)),
    (bank, offset, tunedSample) => {
        bank.setUint32(offset, tunedSample.sample);
        bank.setFloat32(offset+4, tunedSample.tuning);
    });


// USE INHERITANCE TO RECYCLE THE SERIALIZING!
class Instrument{
    // Property name | data type [for serialization]
    properties = [
        ["isRelocated", BYTE],
        ["normalRangeLo", BYTE],
        ["normalRangeHi", BYTE],
        ["adsrDecayIndex", BYTE],
        ["envelope", OFFSET, "Envelope"],
        ["lowPitchTunedSample", TUNED_SAMPLE],
        ["normalPitchTunedSample", TUNED_SAMPLE],
        ["highPitchTunedSample", TUNED_SAMPLE],
    ];

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