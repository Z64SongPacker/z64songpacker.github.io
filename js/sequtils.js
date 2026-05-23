export class SeqUtils{

    // Amplifies the volume byte of this by an specific amount (additive)
    static preAmplifyVolume(seq, volumePreAmplifying){
        var mainVolumeCommandIndex = seq.indexOf(0xDB);
        var mainVolume = seq[mainVolumeCommandIndex + 1];
        var finalVolume = Math.min(Math.max(mainVolume + volumePreAmplifying, 0x0), 0xFF); // <- Clamp to 8bits
        console.log("Main volume changed: " + mainVolume + " -> " + finalVolume);
        seq[mainVolumeCommandIndex + 1] = finalVolume;
    }
}