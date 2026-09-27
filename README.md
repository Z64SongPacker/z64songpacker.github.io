# Z64 Song Packer
This project is a web site that allows easy search and download of custom audio sequences for various Zelda 64 randomizers projects. 

### Check it out here: https://z64songpacker.github.io/

Made with ❤️ for the OoT & MM randomizer communities.


## Important disclaimer

>### Was this project made with Gen-AI?
>
>**No, for the most part.**
>
>All the pages, submission form, graphic design, documentation, automation workflows and code in all of those areas was entirely made by hand by [me](https://github.com/CristobalPenaloza). Absolutely no gen-AI used there.
>
>**But, there are 2 exceptions**, which are the conversion modules for 3DS and OTR formats. You can read what they do, which code they are based on, and why they were made with AI [over here](#ai-generated-modules).


## Features

### Search and select

Shows songs in a tidy and organized way. You have access to multiple tools and filters to search, find and choose the songs you want.

Is able to source the songs from any repository that can connect. By default comes with:

- [Darunia's Joy](https://github.com/DaruniasJoy/OoT-Custom-Sequences): for ootrs files, made with Ocarina of Time in mind.
- [Japas' Jams](https://github.com/Japas-Jams/MM-Custom-Sequences): for mmrs files, made with Majora's Mask in mind.

> Psst... any repository with the proper setup can connect, so if you know other repos, high chance they can also be used here in the packer. For personal use only!


### Song player

Includes an audio player, so you can preview the songs before you include them in your pack. Or you hear the awesome conversions made by the community!

### Formats

Allows exporing packs in the formats used by the different randomizer projects:

- **N64 (zip)**: mmrs and ootrs files for use in N64, Wii VC, MM Decomp, and emulators. 
- **SoH (otr)**: a mod pack for use in Ship of Harkinian. Only compatible files are exported (vanilla ootrs files, and mmrs files that share banks with OoT). 
- **2S2H (otr)**: a mod pack for use in 2Ship2Harkinian. Only compatible files are exported (vanilla mmrs files, and ootrs files that share banks with MM). 
- **3DS (bcseq)**: bcseq+cmeta files for use in OoT3D randomizer. Only compatible files are exported (vanilla ootrs files, and mmrs files that share banks with OoT). No categorization currently, but planned for the future. 

### Volume balancing

The packs are audio balanced by default. Each song has a loudness measuring (in LUFS) that allows the packer to balance them on export by user preference. Not more ear-bleeding vs almost silent tracks!

### Import and export

You can import and export selections in a very small format, for easy pack sharing. You can also import a zip with music files, and the packer will recognize and apply them as selections.

#### And multiple more features are planned to be added in the future...


## AI generated modules

Two modules in this repository were made using gen-AI (*Claude Code*, to be more specific). You can find them inside the `js/` folder. Here I detail what they do exactly, and to what extent AI was used.

### bcseqwebtools

This is a javascript module, which handles the conversion from **seq** format (the one N64 uses) to **bcseq** format (the one 3DS uses).

So, it handles a big portion of the export to OoT3D feature.

The process is based on this guide made by **Kewlan**: https://github.com/Kewlan/OoT3D-Custom-Sequences/wiki/Contributing

The code itself pretty much a javascript mixing and conversion from these two projects by **Gota7**:

- [midi2sseq.exe](https://github.com/Gota7/NitroStudio2/blob/master/Nitro%20Studio%202/midi2sseq.exe): executable from Nitro Studio 2, that can convert midi to sseq; was the base for the direct seq to bcseq conversion.
- [SequenceConvert](https://github.com/Gota7/SequenceConvert): converts sseq to text format. Was used in investigation for mapping audio commands from one format to the other.

The bank, instrument, drum mappings were entirely made by hand (or ear, I should say), and feed to the module to allow conversion that sound the most similar to the N64 originals.

You can see my findings about this topic over here: [N64 to 3DS bank, instrument and drum mappings](docs/n64-to-3ds.md).


### otrwebtools

This is a [WASM](https://webassembly.org/) (or WebAssembly) module that allows **OTR packing**, which is the mod format for libultra projects (specifically, Ship of Harkinian and 2Ship).

Initially started as a conversion of [SequenceOTRizer](https://github.com/leggettc18/SequenceOTRizer) made by **leggettc18**, that was used to build the "Ship of Harkinian" bundle from Darunia's Joy.

But in the end, became a basic OTR packer using the [StormLib](https://github.com/ladislav-zezula/StormLib) by **Ladislav Zezula**, which is the internal format used in OTR files.

This allow me to *fully control* what gets packed in every OTR, so it's easily integrated with the rest of the packer's features.


---

### Why did you use AI tools?

**None of these two features were planned initially** for the packer. I really wanted to be able to include both 3DS and OTR conversion. But I was missing some steps that could take a long time to investigate and build.

Around the time I was working on this project, I learned to use AI tools for my job since I was given a Claude Code subscription.

So, I tried building these as a proof of concept. In the end both worked, I didn't wanted to gatekeep them left them out, since I was using both in my own runs.

Was just afterwards I learned the Gen-AI issues that arose on the Zelda 64 communities. That push me to write this detailed explanation, for transparency sake.

### Ok, so now what?

I will **not** take part in the "pro-AI vs anti-AI" discussion, so don't ask me about it.

But, I ***do*** want to make all members of these communities happy. That's the reason I started this project in the first place. So, here is my position:

- **Everyone decides**: I just laid out what I made. What you do with this information is up to you now! If you don't want to use nor promote this project because of these reasons, I fully respect your position.
- **No AI contributions**: to prevent future issues, all AI-made contributions to this project will be politely rejected.
- **Replacements for these modules are wanted**: all AI-gen'd code has the same issue: you as a dev don't know exactly it's in-and-outs. That obviously causes issues for maintenance and contributing. So, if you want to replace any of these modules with your AI-free code, please do!

---

Wow, you got to the end! Thank you so much for reading!

Hope you enjoy the packer!
