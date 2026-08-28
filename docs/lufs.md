---
title: Z64SongPacker | How to get the loudness (LUFS) of your song
---

# How to get the loudness (LUFS) of your song

Alright, you have your shiny new song ready for the upload. That's great!
But now, in the submission form they ask you to put a loudness recording? What the heck is that!
This guide will help you record a preview with direct emulator audio, and get their lufs.

## What is loudness and why it's important

If you haved played a rando with custom music enabled, it has probably happened to you that some songs are so silent you barely hear them, while others are so loud that make your ears bleed!

That happens, because the songs are **not audio balanced**.
Human perception of audio is different for everyone. Some players want their songs louder. Other prefers them more quieter. And doesn't help that the N64 Zelda games have a very dynamic volume for their music (boss music is much louder that town music, for example). That's why most games nowadays have a music volume slider!

### Loudness measurings to the rescue!

***Loudness Units Full Scale*** (commonly known as LUFS) is a measure of **perceived** volume. It's used on most of the music platforms (like Spotify or Apple Music) to normalize the volume, so that all songs sound similar to each other.

And the song packer is no exception! Most of the songs have a LUFS recording, and that allows the packer to adjust the volume of the songs dynamically, depending on user preference.

![Volume balancing on packer export](../img/lufs-export.png)
> Volume balancing is enabled by default. So if your song doesn't have it's LUFS recording, it may be omited on download.



# How to get it?

For the volume balancing to work, is essential that all recording come from the **same source**. We currently use BizHawk, since it allows audio recording directly from the game, without any modifications by any other program.


## 1. Install the necesary tools

These are the tools you'll need:

- [BizHawk](https://github.com/TASEmulators/BizHawk/releases/tag/2.11.1): Emulator to record audio (2.11 recommended)
- [Z64 Music Manager](https://github.com/CristobalPenaloza/Z64MusicManager/releases): Helper app to streamline the recording process (Windows only)
- [mm-rando](https://github.com/ZoeyZolotova/mm-rando/releases): Needed if you plan to record mmrs files
- [OoT-Randomizer](https://github.com/OoTRandomizer/OoT-Randomizer/releases): Needed if you plan to record ootrs files

Install all of these apps and have them in a known place.

**IMPORTANT**: For the randomizers, they need each to have their vanilla ROMs setup so that they are able to create randomizer seeds. Follow their respective guides on how to do it (altough you probably know that, already).


## 2. Record audio with Z64 Music Manager

> **WARNING**: Z64 Music Manager may give you a "Windows protected your PC" SmartScreen warning when trying to install. That's normal because the app is not currently validated. If you're worried, all the source code is published in GitHub, so you can check it out.
>
> But rest assured: *the app is not a virus*.

There are some steps you have to make so that Z64 Music Manager is ready to record audio. You only need to do this once.

1. When the app it's installed, you may notice that all your mmrs and ootrs files have a shiny new icon. **Double click any file**, the program will open and show information about it. **Do not press the "Record" button yet**.

    <img src="../img/lufs-z64mm-icons.png" width="280"/>
    <img src="../img/lufs-z64mm-main.png" width="220"/>

2. Go to **File > Settings** and in the new window you will be presented with some options. The ones under **Tools** is what you need to setup.

    <img src="../img/lufs-z64mm-go-to-settings.png" width="200"/>
    <img src="../img/lufs-z64mm-settings.png" width="300"/>

3. For **BizHawk path** press the **[...]** button and go to your installation of BizHawk and select **EmuHawk.exe**.

4. For **MMR CLI path** press the **[...]** button and go to your installation of mm-rando and select **MMR.CLI.exe**. Only need to do this if you plan to record MMRS files.

5. For **OOTR CLI path** press the **[...]** button and go to your installation of OoTRandomizer and select **OoTRandomizer.py**. Only need to do this if you plan to record OOTRS files.

6. Close the settings window, and press the **Record** button. After a while, the emulator will pop up and start recording your song really fast. Wait until the emulator closes itself.

    <img src="../img/lufs-z64mm-emu-recording.png" width="300"/>

7. You're done! An mp3 file with the recording will be next to your file.

    <img src="../img/lufs-z64mm-recording-done.png" width="150"/>


## 3. Get the LUFS value

For this will be using Ballam's Loudness Tester.
This was made for dk64randomizer.com, but it serves our purposes also.

1. Go here: https://theballaam96.github.io/loudness_tester.html

2. Press the big **Load file** button, and select the mp3 recording you just made.

    <img src="../img/lufs-lt-main.png" width="400"/>

3. You will be shown a fancy graphic with an analysis of the song. The value we are interested is the **Integrated Max**. Copy that value to a safe place.

    <img src="../img/lufs-lt-result.png" width="400"/>

4. And you're done! Just put that value in the submission form, and you are good to go!
