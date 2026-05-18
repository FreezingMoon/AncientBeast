# Version 0.4 Press Release Draft

## Version 0.4 was released

Hello to all sinners!

Version 0.4 of Ancient Beast has finally been released on GitHub, and it marks another meaningful step forward for the project. This build closes out a long stretch of work with more creatures, more polish, better multiplayer support, and a cleaner development pipeline for what comes next.

This is still pre-alpha, but it pushes the game toward a more complete and stable state. A lot of this progress is visible in matches, while another part of it is foundational work that makes future versions easier to build and ship.

The scale of this milestone is hard to overstate: it spans about 5 years and 11 months between v0.3 and v0.4, touched 2,229 files, and changed 40,251 lines added against 244,371 lines removed. 118 people contributed code along the way.

## Game changes

The v0.4 release added 3 new playable creatures: Stomper, Vehemoth, and Golden Wyrm.

Alongside those additions, this cycle delivered heavy ability implementation and follow-up refinement across multiple creatures and combat interactions.

### Stomper

Stomper fills a very specific battlefield role: durable tempo control in midrange lanes. Its entire kit is built around disrupting enemy action order rather than racing to kill.

**Tankish Build** (passive) stacks +1 defense every round, +2 if it took no damage that turn, capping at 40. The longer Stomper survives, the harder it becomes to trade into — which punishes opponents who fail to commit to killing it early. **Seismic Stomp** is a directional ground strike reaching three hexes out, delaying the target. **Earth Shaker** expands that into board-wide timing control: it delays every creature caught in a large front-and-back arc, and hitting a creature that already carries the Earth Shaker debuff makes it Dizzy, skipping its turn entirely. **Stone Grinder** is the high-risk closer — a stampede down a full row that damages everything in its path, including your own units, so it rewards setting up clear lanes first.

Stat-wise, Stomper is the tankiest level 3 in the roster by a wide margin: #1 endurance (100) and #1 defense (16) among its peers, with solid health and movement. The tradeoff is initiative — at 10 it is the slowest level 3 unit, so it plays best as a front-line anchor that absorbs pressure and opens better turns for faster allies behind it.

### Vehemoth

Vehemoth is a high-mass control bruiser that converts positioning into kill pressure, built around a specific window: it can only freeze enemies that are already fatigued, meaning it forces you to play around the endurance system rather than brute-forcing a target.

**Lamellar Body** (passive) scales its defense and frost resistance with the number of Sloth-realm allies alive — +2 defense and +2 frost per Sloth unit on the field, rewarding Sloth-heavy drafts. **Flake Convertor** is the setup move: a ranged frost shot that locks fatigued enemies frozen and skips their turn. **Flat Frons** is the payoff: a charge that shatters any frozen target below 50 health outright, no damage roll, just gone — and upgraded it can charge from range to knock targets back. **Falling Arrow** covers the rest: a wide cone attack that scales bonus frost damage from the level gap between Vehemoth and its target, punishing weaker creatures disproportionately.

Among level 7 units, Vehemoth leads in both health (245) and endurance (90) by a large margin, making it nearly impossible to burst down. The cost is initiative (35, lowest in its tier) and energy — it plays best as a methodical space-holder that forces favorable trades rather than a fast initiator.

### Golden Wyrm

Golden Wyrm is a premium finisher-support hybrid that is dangerous to both ignore and engage. It can threaten executes, reposition aggressively, and keep allies alive in the same loadout.

**Battle Cry** (passive) is a retaliation tool: if Golden Wyrm took damage last round, it opens its next turn with a 30 sonic burst hitting everything adjacent — walking up to trade into it costs you. **Executioner Axe** deals standard slash damage but instantly kills any target at 45 health or below; upgraded, a successful execution resets the ability for another use that same turn. **Dragon Flight** lets it leap up to 10 hexes ignoring all obstacles and units, with no movement cost; upgraded, landing adds a +25 offense buff for the next Executioner Axe strike, turning a repositioning move into a dive-and-execute opener. **Visible Stigmata** closes the loop: it transfers up to 50 health from Golden Wyrm to an adjacent ally; upgraded, each use also permanently grants +10 regrowth, so a Golden Wyrm that keeps healing becomes progressively harder to grind down.

Stat-wise, Golden Wyrm is the most offensively loaded of the level 7 group: #1 offense (25) and #1 defense (24) in its tier, with high energy and second-highest initiative. Its clear weakness is endurance (25, lowest of the three), so optimal play is burst-and-reposition rather than prolonged attrition.

### Unit roles at a glance

- **Stomper:** Frontline tempo anchor — delays, disrupts action order, and gets tougher to crack every round.
- **Vehemoth:** High-durability control bruiser — starves enemies of endurance, freezes them, then shatters them.
- **Golden Wyrm:** Aggressive finisher-support hybrid — executes weakened targets, repositions fast, and sustains allies at its own expense.

### Big revamps and fixes to existing units

v0.4 also spent serious effort on improving older units and inherited mechanics:

**Tentacle Bush** — behavior was redesigned to only trigger at end of phase instead of immediately, and stacking on the attacker was blocked:
- Before: could stack on the same creature mid-sequence, causing unreliable damage spikes.
- After: consistent timing, predictable counterplay.

**Snow Bunny** — Bunny Hop received the new "Evading" status and a "Cryostasis" interaction effect:
- Before: ability interactions in edge cases were inconsistent and status feedback was unclear.
- After: cleaner state tracking and legible status icons.

**Nutcase** — War Horn damage was fixed for both players, with corrected charge targeting direction for the Blue side. Nutcase was also made immobile while inactive. Additionally, Nutcase and Cycloper were swapped in the unit progression order.

**Headless** — Whip Move received targeting and range indicator fixes that had been affecting accuracy feedback.

**Seismic Stomp** — upgraded-form path-trigger bugs and point-blank dual-damage issues were fixed across all units that use it, including Magma Spawn.

The battle interface also became easier to read and use. The scoreboard was split out and polished, the turn queue received better behavior, and hover and action feedback were improved so it is easier to follow what is happening during a match.

Gameplay presentation saw additional updates too, including clearer combat feedback, hotkey improvements, and better handling for mobile and fullscreen play.

## Visual and audio changes

Several presentation upgrades landed alongside the gameplay work. We added new ability sprites and icons, improved some upgrade sounds, and continued reworking music support with a more useful player and refreshed track layout.

The score and portrait feedback was also made clearer, helping matches feel easier to read at a glance.

## Multiplayer and platform changes

Online multiplayer was enabled and hardened during this release cycle, with lobby and match-presence fixes helping the flow feel more dependable.

There were also practical platform improvements, including manifest, favicon, webpack, dotenv, lint, and TypeScript maintenance. The release tag itself, v0.4, points to a webpack watch fix that helped prevent unnecessary root-folder watching.

## Notable issues and PR highlights

The v0.4 cycle closed a very large number of tracked items (over 480 according to the release notes), with major progress across gameplay, UI, multiplayer, and tooling.

Some higher-signal examples include:

- Online multiplayer foundation and client work (Issue #1616, plus Nakama PRs #1765 and #1785).
- New playable creature ability delivery: Stomper abilities (PR #1718), Vehemoth basic/passive/ultimate work (PRs #1794, #1813, #1984), and Golden Wyrm passive/ability work (PRs #1822, #1959, #1972, #1975).
- Important ability stability fixes such as Seismic Stomp and Whip Move improvements (PRs #2075, #2080, #2099, #2121, #2097).
- Mobile and fullscreen improvements, including prematch/scoreboard and fullscreen behavior fixes (Issue #1753 with PRs #1755 and #1767, plus PRs #1684 and #1751).
- Tooling and pipeline upgrades, including workflow modernization and build updates (PR #1309), webpack update for faster builds and live rebuild support (PR #1328), and dotenv dependency updates (PR #2048).

## Known issues

Ancient Beast is still a pre-alpha project, so there are rough edges and unfinished systems. If you spot bugs, broken interactions, or anything that feels off, please report it so it can be tracked and fixed.

## Support needed

This project keeps moving because of people who contribute time, feedback, artwork, code, testing, or financial support. If you want to help Ancient Beast keep growing, please consider contributing in whatever way fits you best.

The project had about 1,162 stars on GitHub at the time of this release. If you haven't starred it yet, now is a great time — it helps more people find the game.

## Special thanks

Thanks to everyone who tested, contributed, reported issues, or helped keep the project alive. Releases like this one are a mix of visible game improvements and less visible groundwork, and both matter.

## Additional Links

- [Ancient Beast](https://ancientbeast.com/)
- [Documentation](https://ancientbeast.com/documentation/)
- [Multimedia](https://ancientbeast.com/multimedia/)
- [Contribute](https://ancientbeast.com/contribute/)
- [GitHub](https://github.com/FreezingMoon/AncientBeast)
