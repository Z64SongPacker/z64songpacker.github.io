

export const DEFAULT_SETTINGS = {
    // Main
    darkTheme: true,
    autosaveSelections: false,
    showDMCACriticalTracks: false,
    githubFetchDelay: 1250,
    preset: "", // <-- This will force a bunch of settings on load, the user can change them, but will be overwritten

    // Layout
    isListView: true,
    viewComposers: false,
    viewConverters: false,
    viewCategories: false,
    viewFormat: true,
    viewSourceRepository: true,
    viewNotes: true,

    // Export
    includeSelectionsAndSettings: false,
    maintainFolderStructure: false,
    includeGameLogos: false,
    excludeUnsafeTracks: false,
    excludeDuplicates: true,
    gameNamesFormat: "full",
    volumePreAmplifying: 0,
    volumeBalancing: "flat",
    includeOnlyVolumeBalancedTracks: true,
    packFormat: "zip",

    // Filters
    // Not used for the user, but for presets!
    /*filterGameName: "",
    filterSongName: "",
    filterSequenceType: "",
    filterMusicGroups: "",
    filterComposer: "",
    filterConverter: "",
    showFormatOOTRS: true, // This includes vanilla MMRS with cross game bank
    showFormatMMRS: true, // This includes vanilla OOTRS with cross game bank
    showFormatVanilla: true,
    showFormatCustomBank: true,
    showFormatCustomSamples: true,
    showFormatFormmask: true,*/

    // Repo & selections
    // These repos CANNOT be deleted by the user, they will always be available, ya like it or not!
    // Should we put an ID also on this...? Make it a dictionary...?
    userRepos: [
        "Japas-Jams/MM-Custom-Sequences/main",
        "DaruniasJoy/OoT-Custom-Sequences/Custom-Music-2.0"
    ],
    selectedReposIndices: [0, 1],
    selections: []
}

// Comparing these presets should be the way to identify what the user has set currently...
// What could be the best way?
// I think we should FORCE the settings on load, and then the user can modify.
// You can replace stuff, but on reload the preset will apply again.

export const PRESETS = {
    "ootrs": {
        fullName: "Ocarina of Time Randomizer",
        shortName: "OOTR",
        logo: "https://wiki.ootrandomizer.com/images/ootr-logo_sm.png",
        color: "rgba(16, 36, 57, .4)",
        packFormat: "zip",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "dynamic",
        showFormatOOTRS: true,
        showFormatMMRS: false,
        showFormatVanilla: true,
        showFormatCustomBank: true,
        showFormatCustomSamples: true,
        showFormatFormmask: false
    },
    "mmrs": {
        fullName: "Majora's Mask Randomizer",
        shortName: "MMR",
        logo: "https://mmrandomizer.com/img/logo/full/png/mm-randomizer-logo_md.png",
        color: "rgba(56, 4, 51, .3)",
        packFormat: "zip",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "dynamic",
        showFormatOOTRS: true,
        showFormatMMRS: true,
        showFormatVanilla: true,
        showFormatCustomBank: true,
        showFormatCustomSamples: true,
        showFormatFormmask: true
    },
    "ootmm": {
        fullName: "OoTMM",
        logo: "https://ootmm.com/assets/logo-BwfJkge3.png",
        logoClass: "mb-2",
        color: "rgba(34, 55, 142, .3)",
        packFormat: "zip",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "dynamic",
        showFormatOOTRS: true,
        showFormatMMRS: true,
        showFormatVanilla: true,
        showFormatCustomBank: true,
        showFormatCustomSamples: false,
        showFormatFormmask: false
    },
    "mmrecomp": {
        fullName: "Majora's Mask Recompiled",
        shortName: "MM Recomp",
        logo: "https://avatars.githubusercontent.com/u/170279347",
        logoClass: "py-2",
        color: "rgba(22, 181, 195, .2)",
        packFormat: "zip",
        maintainFolderStructure: true,
        includeGameLogos: true,
        gameNamesFormat: "full",
        showFormatOOTRS: true,
        showFormatMMRS: true,
        showFormatVanilla: true,
        showFormatCustomBank: true,
        showFormatCustomSamples: true,
        showFormatFormmask: true
    },
    "soh": {
        fullName: "Ship of Harkinian",
        shortName: "SoH",
        logo: "https://www.harbourmasters.org/icons/games/ShipOfHarkinian.webp",
        logoClass: "mb-2",
        color: "rgba(85, 150, 82, .25)",
        packFormat: "otr-soh",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "full",
        showFormatOOTRS: true,
        showFormatMMRS: false,
        showFormatVanilla: true,
        showFormatCustomBank: false,
        showFormatCustomSamples: false,
        showFormatFormmask: false
    },
    "s2h2": {
        fullName: "2Ship2Hakinian",
        shortName: "2S2H",
        logo: "https://www.harbourmasters.org/icons/games/2Ship2Hakinian.webp",
        logoClass: "mb-2",
        color: "rgba(155, 99, 183, .3)",
        packFormat: "otr-2s2h",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "full",
        showFormatOOTRS: false,
        showFormatMMRS: true,
        showFormatVanilla: true,
        showFormatCustomBank: false,
        showFormatCustomSamples: false,
        showFormatFormmask: false
    },
    "oot3dr": {
        fullName: "OoT3D Randomizer",
        shortName: "OoT3DR",
        logo: "img/oot3d-randomizer-icon-srgb.png",
        logoClass: "py-2 mb-2",
        color: "rgba(222, 187, 24, .2)",
        packFormat: "bcseq",
        maintainFolderStructure: false,
        includeGameLogos: false,
        gameNamesFormat: "full",
        showFormatOOTRS: true,
        showFormatMMRS: false,
        showFormatVanilla: true,
        showFormatCustomBank: false,
        showFormatCustomSamples: false,
        showFormatFormmask: false
    },
    "none": {
        fullName: "None",
        subtitle: "Show all songs with default settings",
        shortName: "No preset",
        color: "rgba(255, 255, 255, .2)",
    }
}


