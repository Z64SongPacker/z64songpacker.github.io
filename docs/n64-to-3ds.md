---
title: Z64 Song Packer - N64 to 3DS mappings
---

# Drums

Each drum instrument on 3DS is very shuffled within themselves. They can have different ranges (some clamped in one note or a small range). Others have their pitch inverted.

So, here is a rough documentation of my findings. To the left is the 3DS range of the instrument. While in the right is what range from N64 matches the best with that 3DS range.


## Orchestra Kit

| 3DS range     | Name           | Conversion from N64                        |
|---------------|----------------|--------------------------------------------|
| 13 - 27       | Timpani Low    | Inverse range (26 - 36)                    |
| 28            | Timpani Low    | Clamped range (21 - 25)                    |
| 29 - 30       | Snare High     | Exact note range, inverse pitch            | <- ANALIZE
| 31 - 33       | Snare Low      | Exact note range, inverse pitch            | <- ANALIZE
| 34 - 45       | Crash Cymbal   | Exact note range, inverse pitch            | <- ANALIZE
| 46            | Timpani High   | Ignore (think is note 58)                  |
| 57 - 69       | Timpani High?  | Ignore                                     |
| 70 - 75       | Timpani High   | Inverse range (54 - 59)                    |
| 76            | Timpani High   | Clamped range (60 - 84)                    |
| 77            | Timpani High?  | Ignore                                     |

## Tambourine

| 3DS range     | Name                 | Conversion from N64                       |
|---------------|----------------------|-------------------------------------------|
| 1 - 27        | Tambourine Edge Slap | Exact note range, correct pitch           |
| 28 - 53       | Cowbell?             | Ignore                                    |
| 54 - 55       | Tambourine Head Slap | Exact note range, inverse pitch           |
| 56            | Tambourine Head Tap  | Clamped range (50 - 51)                   |
| 57            | Tambourine Head Tap  | Clamped range (52 - 73)                   |
| 58 - 90       | Tambourine Head Tap? | Ignore                                    |


## Conga / Shaker

| 3DS range     | Name        | Implementation notes                      |
|---------------|-------------|-------------------------------------------|
| 25 - 45       | Conga Mute  | Exact note range, inverse pitch           |
| 46 - 64       | Conga Open  | Exact note range, inverse pitch (some exceptions, doc later)
| 65 - 84       | Conga Slap  | Exact note range, inverse pitch (some exceptions, doc later)
| 85 - 88       | Shaker      | Exact note range, inverse pitch           |


## Trip Hopping

| 3DS range     | Name               | Implementation notes                      |
|---------------|--------------------|-------------------------------------------|
| 17 - 33       | Trip Hopping Kick  | Exact note range, inverse pitch           |
| 34            | Trip Hopping Snare | Clamped range (38 - 62)                   |
| 35 - 80       | Trip Hopping Snare | Ignore                                    |


## Tambourine / Rain (used in bank 0x00)

| 3DS range     | Name                  | Implementation notes    |
|---------------|-----------------------|-------------------------|
| 1             | Tambourine Edge Slap  | Note 21                 |
| 2 - 3         | Rain                  | Clamped range (23 - 24) |
| 4             | Tambourine Head Tap   | Note 22                 |


## Lute Tambourine

TODO: *Currently no custom audio track uses this drumset*.


## Gong / Windchimes

TODO: *Currently no custom audio track uses this drumset*.


# Sound effect banks

The location of the instrument of all of these are shuffled between multiple banks.

Not all instrument are fully identified by name, but all are matched between N64 and 3DS.


Here you can see which N64 instrument maps to which bank + instrument number on 3DS:


## Chiptune Instruments
| N64  | 3DS LOCATION |
|------|--------------|
| 0x80  Saw Wave                  | Bank 04, Instrument 011
| 0x81  Triangle Wave             | Bank 04, Instrument 014
| 0x82  Sine Wave                 | Bank 04, Instrument 009
| 0x83  Square Wave               | Bank 04, Instrument 017
| 0x84  Sawtooth Wave             | Bank 04, Instrument 012
| 0x85  Noisy / Smooth Wave       | Bank 04, Instrument 010 [<-- Close enough]
| 0x86  Smooth Square Wave        | Bank 04, Instrument 015 [<-- Close enough]
| 0x87  Softer Square             | Bank 04, Instrument 015 [<-- Close enough]


## Bank 0x00 (Ocarina Songs/SFX)
| N64  | 3DS LOCATION |
|------|--------------|
| 000	Normal Step               | Bank 00, Instrument 000
| 001	Sand Step                 | Bank 00, Instrument 001
| 002	Stone Step                | Bank 00, Instrument 002
| 003	Slime Step                | Bank 00, Instrument 003
| 004	Water Step                | Bank 00, Instrument 004
| 005	Grass Step                | Bank 00, Instrument 005
| 006	Deep Step                 | Bank 00, Instrument 006
| 007	Bush                      | Bank 00, Instrument 007
| 008	Sword Charge              | Bank 00, Instrument 009
| 009	Loud Rustling             | Bank 00, Instrument 010
| 010	Dirt Smash                | Bank 00, Instrument 011
| 011	Wood Step                 | Bank 00, Instrument 008
| 012	Normal Sliding            | Bank 00, Instrument 012
| 013	Sand Sliding              | Bank 00, Instrument 013
| 014	Stone Sliding             | Bank 00, Instrument 014
| 015	Slime Sliding             | Bank 00, Instrument 015
| 016	Water Sliding             | Bank 00, Instrument 018
| 017	Grass Sliding             | Bank 00, Instrument 016
| 018	Deep Sliding              | Bank 00, Instrument 017
| 019	Large Splash              | Bank 00, Instrument 018 [<-- No loop of Water Sliding ]
| 020	Bubbles                   | Bank 00, Instrument 019
| 021	Boom Hit                  | Bank 00, Instrument 020
| 022	Wood Creek                | Bank 00, Instrument 021
| 023	Slime Step Alt            | Bank 00, Instrument 022
| 024	Iron Boots                | Bank 00, Instrument 023
| 025	Stone Step Alt            | Bank 00, Instrument 024
| 026	Sword Clank 1/2           | Bank 01, Instrument 000
| 027	Quick Whish               | Bank 01, Instrument 001
| 028	Put Away                  | Bank 01, Instrument 002
| 029	Take Out Sword            | Bank 01, Instrument 003
| 030	Slow Whish                | Bank 01, Instrument 004
| 031	Weird Whish               | Bank 01, Instrument 005
| 032	Metal Hit                 | Bank 01, Instrument 007
| 033	Pull Bow / No Arrows      | Bank 01, Instrument 006
| 034	Chains Moving             | Bank 01, Instrument 008
| 035	Fire Burning              | Bank 01, Instrument 009 [<-- Bombchu sounds, actually]
| 036	Deep Hit                  | Bank 01, Instrument 010
| 037	Slime Hit                 | Bank 01, Instrument 014
| 038	Wood Flick                | Bank 01, Instrument 015
| 039	Spin Woosh                | Bank 01, Instrument 016
| 040	Deep Slime                | Bank 01, Instrument 017
| 041	Whip Crack / Marimba      | Bank 01, Instrument 018
| 042	Electric Aura             | Bank 01, Instrument 019
| 043	Sand Hit                  | Bank 01, Instrument 020
| 044	Lens / Magic Whoosh       | Bank 01, Instrument 021
| 045	Door Open / Close         | Bank 02, Instrument 000
| 046	Crystal Pad / Charge      | Bank 02, Instrument 033
| 047	Volcanic Explosion        | Bank 02, Instrument 001
| 048	Horse Gallop              | Bank 02, Instrument 002
| 050	Horse Neigh / Snort       | Bank 02, Instrument 003
| 051	Stream / Waterfall        | Bank 02, Instrument 004
| 052	Ocarina                   | Bank 01, Instrument 012
| 053	Ocarina Alt               | Bank 01, Instrument 013
| 054	Moving / Metal Shut       | Bank 02, Instrument 005
| 055	Lava Moving               | Bank 02, Instrument 006
| 056	Lava Ambience             | Bank 02, Instrument 007
| 057	Drawbridge Moving         | Bank 02, Instrument 008
| 058	Cucoo / Frog              | Bank 02, Instrument 009
| 059	Slam                      | Bank 02, Instrument 010
| 060	Wind                      | Bank 02, Instrument 029
| 061	Cucoo Call / Howling      | Bank 02, Instrument 011
| 062	Small Splash              | Bank 02, Instrument 012
| 063	Wood Hit / Xylo Hit       | Bank 02, Instrument 013
| 064	Sparkle Pad               | Bank 02, Instrument 014
| 065	Deep Hit Alt              | Bank 02, Instrument 015
| 066	Door Creek 1/2            | Bank 02, Instrument 016
| 067	Cape Whoosh               | Bank 02, Instrument 017
| 068	Farore's Wind Pad         | Bank 02, Instrument 018
| 069	Fairy Dust Pad            | Bank 02, Instrument 019
| 070	Elec Charge / Pot         | Bank 02, Instrument 020
| 071	Dripping Water            | Bank 02, Instrument 021
| 072	Slimey Water              | Bank 02, Instrument 022
| 073	Fire Crackling / Moo      | Bank 02, Instrument 023
| 074	Wind Burst / Thunder      | Bank 02, Instrument 024
| 075	Moving Machinery          | Bank 02, Instrument 025
| 076	Machinery Slam            | Bank 02, Instrument 026
| 077	Wind / Engine Rev         | Bank 02, Instrument 027
| 078	Cape Whoosh Alt           | Bank 02, Instrument 028
| 079	Crowd / Ice Shatter       | Bank 02, Instrument 030
| 080	Stretching                | Bank 02, Instrument 031
| 081	Dodongo / Puppy           | Bank 02, Instrument 032
| 082	Flute                     | Bank 04, Instrument 008
| 083	Accordion                 | Bank 04, Instrument 007
| 084	Harp Alt                  | Bank 04, Instrument 000
| 085	Malon                     | Bank 04, Instrument 005
| 086	Whistle                   | Bank 04, Instrument 006
| 087	Bell / Crystal            | Bank 04, Instrument 001
| 088	Guard Whistle             | Bank 04, Instrument 002
| 089	Harp                      | Bank 04, Instrument 003
| 090	Z-Target Lock-Off/On      | Bank 04, Instrument 004
| 091	Chain Slam                | Bank 01, Instrument 011
| 127	Tambourine / Rain         | Bank 04, Instrument 013 [Check mapping on drums.md]

## Bank 0x01 (Actor Sounds)
| N64  | 3DS LOCATION |
|------|--------------|
| 000	King Dodongo Stomp        | Bank 03, Instrument 000
| 001	King Dodongo Exhale       | Bank 03, Instrument 001
| 002	King Dodongo Flame        | Bank 03, Instrument 002
| 003	King Dodongo Scream       | Bank 03, Instrument 006
| 004	Deku Scrub Up             | Bank 03, Instrument 007
| 005	Gohma Larva Hatch         | Bank 03, Instrument 008
| 006	Deku Scrub Spit, Step ??? | Bank 03, Instrument 009
| 007	Gohma Larva Lurk          | Bank 03, Instrument 010
| 008	Wallmaster Away           | Bank 03, Instrument 012
| 009	Keese Attack              | Bank 03, Instrument 013
| 010	Keese Flap                | Bank 03, Instrument 014
| 011	Monster Screech ???       | Bank 03, Instrument 011
| 012	Baby Dodongo Crawl        | Bank 03, Instrument 016
| 013	Moblin Growl              | Bank 03, Instrument 017
| 014	Cackle Laugh ???          | Bank 03, Instrument 019
| 015	Moblin Roar ?             | Bank 03, Instrument 018
| 016	Moan, Deku Screech ???    | Bank 03, Instrument 020
| 017	Poe Lantern Shatter       | Bank 03, Instrument 021
| 018	Machine-like loop ???     | Bank 03, Instrument 003
| 019	Anubis Fire Shoot         | Bank 03, Instrument 004
| 020	Like Like Grab            | Bank 03, Instrument 005
| 021	Deku Baba Bite            | Bank 03, Instrument 026
| 022	Blowing ???               | Bank 03, Instrument 048
| 023	Hawk                      | Bank 03, Instrument 015
| 024	Saw / ???                 | Bank 03, Instrument 027
| 025	Bubble Attack             | Bank 03, Instrument 022
| 026   Stalfos Hit               | Bank 03, Instrument 023
| 027	Stalfos Laugh             | Bank 03, Instrument 024
| 028	Stalfos Attack            | Bank 03, Instrument 025
| 029	Phantom Ganon Lightning   | Bank 03, Instrument 028
| 030	Phantom Ganon Static      | Bank 03, Instrument 029
| 031	Phantom Ganon Float       | Bank 03, Instrument 030
| 032	Phantom Ganon Ball Throw  | Bank 03, Instrument 031
| 033	P. Ganon Lightning Throw  | Bank 03, Instrument 032
| 034	Phantom Ganon Torpedo     | Bank 03, Instrument 033
| 035	Phantom Ganon Die         | Bank 03, Instrument 034
| 036	Phantom Ganon Ha!         | Bank 03, Instrument 035
| 037	Moan ???                  | Bank 03, Instrument 036
| 038	Water Slide ???           | Bank 03, Instrument 044
| 039	Water Step ???            | Bank 03, Instrument 045
| 040	Explosion / Lava ???      | Bank 03, Instrument 046
| 041	Dinosaur Screech ???      | Bank 03, Instrument 037
| 042	ReDead Moan / Bigoron Ahh | Bank 03, Instrument 038
| 043   Poe Laugh                 | Bank 03, Instrument 039
| 044	Morpha Swim ???           | Bank 03, Instrument 047
| 045	Growl / Female Scream ??? | Bank 03, Instrument 040
| 046	Goron Oop / Goron Ohrr    | Bank 03, Instrument 041
| 047	Metal Clank / Waterfall ? | Bank 03, Instrument 049
| 048	Bongo's Bongo / Chant     | Bank 03, Instrument 042
| 049	Wolfos Howl / Frog        | Bank 03, Instrument 050
| 050	HYENAS / Ganon Smash      | Bank 03, Instrument 043

## Bank 0x02 (Nature Sounds)
| N64  | 3DS LOCATION |
|------|--------------|
| 000	None                      | -
| 001	Bird Chirp 1              | Bank 42, Instrument 000
| 002	Bird Chirp 2              | Bank 42, Instrument 001
| 003	Bird Cackling             | Bank 42, Instrument 002
| 004	Cricket                   | Bank 42, Instrument 003
| 005	Bird Chirp 3              | Bank 42, Instrument 004
| 006	Crow                      | Bank 42, Instrument 005
| 007	Geese Honk?               | Bank 42, Instrument 006
| 008	Seagull? (Loop)           | Bank 42, Instrument 007
| 009	Bird Sing                 | Bank 42, Instrument 008
| 010	Cucco Call                | Bank 42, Instrument 019
| 011	Owl Hoot                  | Bank 42, Instrument 009
| 012	Hawk                      | Bank 42, Instrument 010
| 013	Cicada (Loop)             | Bank 42, Instrument 011
| 014	Frog                      | Bank 42, Instrument 012
| 015	Waterfall?                | Bank 42, Instrument 013
| 016	Fan (Loop)                | Bank 42, Instrument 014
| 017	Sandstorm                 | Bank 42, Instrument 015
| 018	Rain                      | Bank 42, Instrument 016
| 019	Thunder Distant (Rain)    | Bank 42, Instrument 017
| 020	Thunder Strike (Rain)     | Bank 42, Instrument 018