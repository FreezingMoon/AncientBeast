-- phpMyAdmin SQL Dump
-- version 3.5.3
-- http://www.phpmyadmin.net
--
-- Gazda: 127.0.0.1
-- Timp de generare: 03 Dec 2012 la 02:45
-- Versiune server: 5.1.51-community-log
-- Versiune PHP: 5.2.6

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_abilities`
--
-- Creare: 12 Iul 2012 la 07:26
-- Ultima actualizare: 01 Dec 2012 la 08:06
-- Ultima verficare: 01 Sep 2012 la 13:17
--

CREATE TABLE IF NOT EXISTS `ab_abilities` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `passive` varchar(20) NOT NULL DEFAULT 'No name',
  `passive info` varchar(110) NOT NULL DEFAULT 'No description',
  `weak` varchar(20) NOT NULL DEFAULT 'No name',
  `weak info` varchar(110) NOT NULL DEFAULT 'No description',
  `medium` varchar(20) NOT NULL DEFAULT 'No name',
  `medium info` varchar(110) NOT NULL DEFAULT 'No description',
  `strong` varchar(20) NOT NULL DEFAULT 'No name',
  `strong info` varchar(110) NOT NULL DEFAULT 'No description',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_abilities`
--

INSERT INTO `ab_abilities` (`id`, `passive`, `passive info`, `weak`, `weak info`, `medium`, `medium info`, `strong`, `strong info`) VALUES
(1, 'Post Mortem', 'Drops a powerful fuse bomb on the ground when dying.', 'Sword Slash', 'Swift attack on a nearby foe.', 'Pistol Shot', 'Medium range shot.', 'Rifle Shot', 'Very powerful long range attack.'),
(2, 'Backstabber', 'Reduces damage from behind and returns some to melee attackers.', 'Metallic Claws', 'Razor sharp claws help him really shred his foes.', 'Tail Mace', 'Whips out it''s scepter like tail to bluntly punish a distant foe.', 'Brain Power', 'Electro-charges it''s brain functions to shock all nearby foes.'),
(3, 'Frogger', 'Leaps in straight line over obstacles.', 'Chomp', 'Takes a huge bite out of his foe.', 'Blade Kick', 'Slashes nearby foe using feet claws.', 'Goo Blast', 'Sneezes poisonous goo at any inline foe, weakening it with every hit.'),
(4, 'Infernal Temper', 'Bursts into flames when it''s turn comes, damaging nearby foes.', 'Pulverize', 'Smacks a foe with its heavy hand.', 'Fissure', 'Smashes his fists into the ground, wreaking fierce havoc ahead.', 'Molten Hurl', 'Turns into a molten boulder, bowling itself into first foe in a straight line.'),
(5, 'Armor Penetration', 'Attacks gradually break through enemy defense.', 'Jab Attack', 'Horn attack that does bonus pierce damage based on distance traveled.', 'Static Charge', 'Shakes hair to create friction and imbue next attack with lightning.', 'Envenom', 'Makes use of tongue to smear the horn with highly venomous saliva.'),
(6, 'Cryosauna', 'Foes have their movement reduced and initiative constantly decreased.', 'Frost Bite', 'Pokes ice teeth into nearby foe.', 'Nitrogen Splash', 'Exhales freezing gas that does more damage as it travels.', 'Glacial Spikes', 'Several spears of ice erupt in the area nearby, impaling all creatures.'),
(7, 'Eye of the Fire', 'Strategically teleports to a new location on the combat field.', 'Fiery Claw', 'Scratch and burn a nearby foe.', 'Fire Ball', 'Throws a ball of fire that explodes on impact, damaging several creatures.', 'Infernal Pyre', 'Increases power of it''s back fire in order to burn all adjacent creatures.'),
(8, 'Unstopable', 'Successfully resists first signs of fatigue, being able to carry on.', 'Knuckle Head', 'Smashes ringed head into a foe.', 'Meat Hook', 'Drags a foe, doing bonus damage if it doesn''t have any movement points left.', 'Double Swipe', 'Slashes nearby foes with both claws.'),
(9, 'Frozen Tower', 'Temporary increases offense and defense by holding the same spot.', 'Icy Talons', 'Scratches nearby foe using claws.', 'Tail Uppercut', 'Sucker punches a near enemy using tail, ignoring most of it''s defense.', 'Icicle Tongue', 'Launches tongue, piercing all foes sitting in front in a straight line.'),
(10, 'Inner Vision', 'Lack of sight forces the creature to focus on it''s other senses.', 'Tongue Dagger', 'Melee attack on a nearby foe.', 'Sonic Scream', 'Shock waves that travel far.', 'Psychic Blast', 'Focuses the power of mind in order to attack foes from a small region.'),
(11, 'Spore Contamination', 'Nearby foes have their regrowth constantly reduced with each round.', 'Head Bash', 'Bumps it''s large cap into nearby foe.', 'Organic Recycling', 'Consumes the corpse underneath, restoring a minor amount of health.', 'Noxious Cloud', 'Releases several toxic clouds all around, persisting for several rounds.'),
(12, 'Bunny Hopping', 'Avoids basic attack by moving to an available adjacent location.', 'Big Nip', 'Dents nearby foe using it''s big teeth.', 'Blowing Wind', 'Pushes an inline creature several hexagons backwards, based on size.', 'Chilling Spit', 'Spits inline foe with cold saliva. Bonus damage based on distance.'),
(13, 'Decaying Carcass', 'When dead, it''s corpse rots fast and emanates poisonous gases.', 'Sync Teeth', 'Bites a nearby foe.', 'Bad Breath', 'Stinks up several nearby enemies.', 'Toxic Bubble', 'Creates a mucus bubble from it''s nose and pushes it away.'),
(14, 'Self Flatten', 'Squishes itself in order to avoid a melee attack or allow an ally to pass.', 'Gummy Mallet', 'Transforms itself into a rubber hammer to strike a nearby foe.', 'Royal Seal', 'Sticks chewing gum in place to hinder enemy movement.', 'Boom Box', 'Turns belly into a speaker, blasting an inline foe, pushing it back a bit.'),
(15, 'Fried Chicken', 'Corpse can be consumed by other creatures, regaining some health.', 'Face Smash', 'Bashes nearby foe using it''s head.', 'Optic Blast', 'Zaps a foe with it''s laser cannon.', 'Magic Act', 'Swaps places of any two creatures in front that have similar sizes overall.'),
(16, 'Ground Shaker', 'Stomps the ground when walking, increasing the delay of all it''s foes.', 'Lava Splash', 'Hits a near foe with a handful of lava.', 'Volcanic Cannon', 'Fires a flaming boulder projectile at a target foe.', 'Spitfire', 'Erupts with rage, bombarding the battlefield with burning lava.'),
(17, 'Spiked Fence', 'When dead, enemies walking on it''s corpse get their limbs impaled.', 'Trident Forehead', 'Pokes nearby enemy with it''s large forehead spikes.', 'Trap Jaw', 'Bites nearby foe, crippling it.', 'Circular Saw', 'Travels in a straight line and back, cutting through encountered foes.'),
(18, 'Pulse of the Maggots', 'Gains one regrowth point for each corpse located on the battlefield.', 'Claw Strike', 'Slashes nearby foe using claws.', 'Fly Swarm', 'Damages and distracts a foe, lowering it''s offense and defense.', 'Shadow Army', 'Allows any dead creature to fight again for it''s life, as a shadow being.'),
(19, 'Blood Chalice', 'Doing damage restores own health.', 'Slice', 'Claw swipe gesture, slashing a nearby foe.', 'Fatal Attraction', 'Causes a target foe to come close to her, while depleting it''s movement.', 'Tentacle Feet', 'All nearby foes have their movement restrained and take some damage.'),
(20, 'Cryosauna', 'Foes have their movement reduced and initiative constantly decreased.', 'Suction cups', 'Crushes a frontal foe while draining a very small amount of it''s energy.', 'Tentacle Grasp', 'Pulls a rather distant inline foe nearby while also crushing it.', 'Frostbite Shower', 'Sprinkles the area in front with liquid nitrogen, doing cold damage.'),
(21, 'Half Life', 'Can regenerate health up to double.', 'Bone Scythe', 'Slashes nearby foe, causing it to bleed and lose health if moving.', 'Blood Puke', 'Target''s regrowth becomes nulled if it''s a foe or doubles if it''s an ally.', 'Symbiotic Tumor', 'Engulfs body into a meat cocoon for bonus protection and regrowth. '),
(22, 'Lava Pool', 'When dead, melts into puddle of boiling lava that damages foes.', 'Poked Eye', 'Wings it''s eye at a nearby foe.', 'Iron Shell', 'Solidifies from magma state into iron, greatly increasing resistances.', 'Black Pearl', 'Fires a durable sphere up in to the air, falling on target the next round.'),
(23, 'Forced Involution', 'When dead, reconfigures itself as a weaker creature, the Magma Spawn.', 'Forked Hand', 'Pierces foe using it''s metallic harpoon shaped fingers.', 'Fire Dump', 'Ignites the ground, the fire expands and contracts over several rounds.', 'Shotgun Blast', 'Blows a handful of shrapnel in a conic area, doing versatile damage.'),
(24, 'Healing Factor', 'Bonus regrowth for all nearby allies.', 'Gauntlet Strike', 'Punches a nearby foe with it''s heavy armored hand, leaving quite a mark.', 'Bloody Greed', 'Powerful sword penetrating attack, affecting multiple inline hexagons.', 'Supreme Motivation', 'Greed drives it to do an extra effort and act twice in the current round.'),
(25, 'Self Sewing', 'Partially repairs itself if not taking any damage for a whole round.', 'Free Haircut', 'Takes out it''s pair of scissors and cuts a nearby foe, keeping a sample.', 'Scarecrow', 'Intimidates target foe, making it run away at the beginning of it''s turn.', 'Voodoo Doll', 'Stabs itself, doing mental damage to any of the previously attacked foes.'),
(26, 'Ressurection', 'No description', 'Stalagmite Teeth', 'Crunches nearby foe with it''s rocky danture.', 'Waterfall Burst', 'Powerful jet of water (Waterfall Cannon?)', 'Weed Field', 'Nasty weeds spring allover a region, growing with time.'),
(27, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(28, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(29, 'Bad Touch', 'Every three strikes, a melee attacker is turned to gold for several rounds.', 'Red Crystal', 'Pokes nearby foe using staff.', 'Winged Orb', 'Heals an ally or damages a foe that''s at the target location next round.', 'Burning Light', 'Conjures a beam of pure energy that will cause burns to all inline foes.'),
(30, 'Offspring', 'Spawns a little hungry eggplant that chases nearest foe and attacks it.', 'Dinner Time', 'Bites a nearby foe.', 'Pony Tail', 'Whips and poisons nearby foes, knocking them back.', 'Snake Tongue', 'Throws tongue at a distant target, having it come back with time.'),
(31, 'Retaliation', 'Returns favor to frontal attackers, by slashing them with it''s heavy claws.', 'Pummel', 'Severly punches a nearby foe.', 'Frightening Howl', 'Removes positive buffs and reduces offense and defense of nearby foes.', 'Slice and Dice', 'Brutally slashes all frontal foes using it''s extremely sharp claws.'),
(32, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(33, 'Percussion Spear', 'Attacks cause rear spear strike, which cannot be dodged.', 'Executioner Axe', 'Slashes nearby foe, doing bonus damage based on it''s max health.', 'Dragon Flight', 'Travels to a location passing over obstacles with no movement cost.', 'Breath of Life', 'Brings back to life a dead ally, with health equal to the fatigue stat.'),
(34, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(35, 'Shield Block', 'Uses shield to defend against frontal attacks, greatly reducing damage.', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(36, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(37, 'Spa Mud', 'Gains temporary bonus regrowth and defense when entering a mud bath.', 'Power Bat', 'Pokes baseball bat into nearby foe.', 'Ground Ball', 'Strikes a mud boulder towards a foe.', 'Mud Bath', 'Orders a pile of mud at a location, slowing foes passing through.'),
(38, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(39, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(40, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(41, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(42, 'Like Butter', 'Ignores half of target''s defense.', 'Slicer', 'Slashes nearby foe using claws.', 'Mesmerize', 'Does sonic damage to an inline foe, also causing it to skip next turn.', 'Eclipsing Strike', 'Catapults itself at a foe, reaching it and striking it the next round.'),
(43, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(44, 'Flyer', 'Can fly to available locations within movement range, avoiding obstacles.', 'Slicing Talon', 'Slashes nearby foe using claw.', 'Turn Back', 'Returns to a previous visited location without using any movement points.', 'Moon Grip', 'Carries any small or medium creature to a new location. Damages foes.'),
(45, 'Duality', 'Allows the use of an attack twice.', 'Tooth Fairy', 'Syncs teeth into nearby foe.', 'Power Note', 'Sings a very powerful note to a foe.', 'Chain Lightning', 'Releases a lightning bolt that will arch, shocking multiple foes.'),
(46, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(47, 'Plate Mail', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(48, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(49, 'No name', 'No description', 'No name', 'No description', 'No name', 'No description', 'No name', 'No description'),
(0, 'Plasma Shield', 'The shield protects from any harm.', 'Disintegrate', 'Turns any nearby foe into a pile of dust by using plasma in exchange.', 'Materialize', 'Summons a creature right in front.', 'Energize', 'Satellite beams down a creature to any specified non-occupied location.'),
(50, 'Immaterial', 'Passes through obstacles and takes half the damage.', 'Hand Jaw', 'Bites nearby foe using it''s ... hand.', 'Opression', 'Causes nearby foe to fall into depression and not act for a turn.', 'Life and Death', 'Ressurects itself by stealing the life of a fatigued foe, if corpse available.');

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_creatures`
--
-- Creare: 15 Sep 2012 la 16:43
-- Ultima actualizare: 01 Dec 2012 la 08:02
--

CREATE TABLE IF NOT EXISTS `ab_creatures` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(15) NOT NULL,
  `sin` varchar(1) NOT NULL,
  `lvl` varchar(1) NOT NULL DEFAULT '1',
  `hex` tinyint(1) NOT NULL DEFAULT '1',
  `embed` tinytext,
  PRIMARY KEY (`id`),
  UNIQUE KEY `Name` (`name`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_creatures`
--

INSERT INTO `ab_creatures` (`id`, `name`, `sin`, `lvl`, `hex`, `embed`) VALUES
(1, 'Bounty Hunter', 'A', '2', 1, NULL),
(2, 'Marauder', 'G', '6', 2, NULL),
(3, 'Uncle Fungus', 'G', '3', 2, NULL),
(4, 'Magma Spawn', 'L', '2', 3, NULL),
(5, 'Impaler', 'S', '6', 3, NULL),
(6, 'Ice Demon', 'S', '7', 3, NULL),
(7, 'Abolished', 'P', '7', 3, NULL),
(8, 'Horn Head', 'W', '5', 2, '<iframe frameborder="0" height="520" width="400" src="http://skfb.ly/k4j3hfdc0?autostart=1&transparent=1&autospin=1&controls=0&watermark=0&desc_button=0&stop_button=0"></iframe>'),
(9, 'Nightmare', 'S', '4', 2, NULL),
(10, 'Troglodyte', 'P', '3', 3, NULL),
(11, 'Toxic Shroom', 'G', '1', 1, NULL),
(12, 'Snow Bunny', 'S', '1', 1, NULL),
(13, 'Swampler', 'G', '2', 1, NULL),
(14, 'Gumble', 'P', '1', 1, NULL),
(15, 'Cycloper', 'E', '1', 1, NULL),
(16, 'Vulcan', 'L', '6', 2, NULL),
(17, 'Razorback', 'E', '6', 2, NULL),
(18, 'Sarcophag', 'W', '7', 3, NULL),
(19, 'Miss Creeper', 'G', '4', 1, NULL),
(20, 'Adaptation', 'S', '5', 3, NULL),
(21, 'Flayed', 'W', '4', 2, NULL),
(22, 'Lava Mollusk', 'L', '1', 1, NULL),
(23, 'Metal Face', 'L', '4', 3, NULL),
(24, 'Living Armor', 'A', '6', 2, NULL),
(25, 'Mr. Stitches', 'E', '3', 1, NULL),
(26, 'Moss Hound', 'G', '7', 3, NULL),
(27, 'Sand Shrimp', 'P', '2', 3, NULL),
(28, 'Stomper', 'P', '5', 2, NULL),
(29, 'Gilded Maiden', 'A', '5', 1, NULL),
(30, 'Eggplant', 'G', '5', 2, NULL),
(31, 'Cyber Hound', 'A', '3', 2, NULL),
(32, 'Deep Beauty', 'S', '3', 2, NULL),
(33, 'Golden Wyrm', 'A', '7', 3, NULL),
(34, 'Bouncer', 'S', '2', 2, NULL),
(35, 'Greedy Knight', 'A', '4', 1, NULL),
(36, 'Vertigo', 'E', '4', 1, NULL),
(37, 'Swine Thug', 'A', '1', 1, NULL),
(38, 'Infernal', 'L', '3', 2, NULL),
(39, 'Headless', 'W', '3', 2, NULL),
(40, 'Nutcase', 'W', '1', 1, NULL),
(41, 'Flesh Cleanser', 'W', '2', 2, NULL),
(42, 'Night Stalker', 'E', '7', 2, NULL),
(43, 'Fire Bird', 'L', '7', 2, NULL),
(44, 'Scavenger', 'E', '2', 2, NULL),
(45, 'Chimera', 'P', '4', 2, NULL),
(46, 'Scorpius', 'E', '5', 3, NULL),
(47, 'Royal Guard', 'P', '6', 3, NULL),
(48, 'Satyr', 'W', '6', 3, NULL),
(49, 'Volpyr', 'L', '5', 3, NULL),
(0, 'Dark Priest', '-', '-', 1, NULL),
(50, 'Shadow Leech', 'W', 'S', 1, NULL);

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_items`
--
-- Creare: 11 Apr 2012 la 22:03
-- Ultima actualizare: 17 Oct 2012 la 04:46
-- Ultima verficare: 01 Sep 2012 la 13:17
--

CREATE TABLE IF NOT EXISTS `ab_items` (
  `id` int(100) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `type` varchar(10) NOT NULL,
  `value` mediumint(255) NOT NULL,
  `health` tinyint(4) DEFAULT NULL,
  `regrowth` tinyint(4) DEFAULT NULL,
  `endurance` tinyint(4) DEFAULT NULL,
  `energy` tinyint(4) DEFAULT NULL,
  `meditation` tinyint(4) DEFAULT NULL,
  `initiative` tinyint(4) DEFAULT NULL,
  `offense` tinyint(4) DEFAULT NULL,
  `defense` tinyint(4) DEFAULT NULL,
  `movement` tinyint(2) DEFAULT NULL,
  `pierce` tinyint(4) DEFAULT NULL,
  `slash` tinyint(4) DEFAULT NULL,
  `crush` tinyint(4) DEFAULT NULL,
  `shock` tinyint(4) DEFAULT NULL,
  `burn` tinyint(4) DEFAULT NULL,
  `frost` tinyint(4) DEFAULT NULL,
  `poison` tinyint(4) DEFAULT NULL,
  `sonic` tinyint(4) DEFAULT NULL,
  `mental` tinyint(4) DEFAULT NULL,
  UNIQUE KEY `ID` (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=25 ;

--
-- Salvarea datelor din tabel `ab_items`
--

INSERT INTO `ab_items` (`id`, `name`, `type`, `value`, `health`, `regrowth`, `endurance`, `energy`, `meditation`, `initiative`, `offense`, `defense`, `movement`, `pierce`, `slash`, `crush`, `shock`, `burn`, `frost`, `poison`, `sonic`, `mental`) VALUES
(1, 'Simple dagger', 'dagger', 80, NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 'Throwing spear', 'spear', 100, NULL, NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 'Throwing blade', 'blade', 120, NULL, NULL, NULL, NULL, NULL, NULL, 4, NULL, NULL, 2, 1, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 'Short bow', 'bow', 110, NULL, NULL, NULL, NULL, NULL, NULL, 3, NULL, NULL, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 'Ivy bow', 'bow', 140, NULL, NULL, NULL, NULL, NULL, NULL, 4, NULL, NULL, 2, NULL, NULL, NULL, NULL, NULL, 6, NULL, NULL),
(6, 'Blade bow', 'bow', 150, NULL, NULL, NULL, NULL, NULL, NULL, 4, 2, NULL, 3, 3, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(7, 'Crystallized Lightning', 'staff', 400, NULL, NULL, NULL, 3, 2, NULL, 3, NULL, NULL, 1, 1, 1, 5, NULL, NULL, NULL, 3, 3),
(8, 'Thunderbird feather', 'feather', 160, NULL, NULL, NULL, 5, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL, 2, NULL, NULL, NULL, NULL, NULL),
(9, 'Phoenix feather', 'feather', 170, NULL, 1, NULL, NULL, 1, 2, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 2, 1, NULL, NULL, NULL),
(10, 'Sting shield', 'shield', 190, NULL, NULL, NULL, NULL, NULL, NULL, 2, 4, NULL, 2, 2, 2, NULL, NULL, NULL, NULL, NULL, NULL),
(11, 'Bloody Crystal necklace', 'amulet', 300, 30, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(12, 'Blue Sparrow amulet', 'amulet', 5000, NULL, NULL, 5, 10, NULL, 10, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, 2, NULL, NULL, NULL),
(13, 'Thunderbird cape', 'cape', 600, NULL, NULL, NULL, 5, NULL, NULL, NULL, 2, NULL, NULL, 1, NULL, 10, NULL, 2, NULL, NULL, 2),
(14, 'Death''s Touch bow', 'bow', 13000, 99, -1, -10, 99, 99, 10, 50, 99, 99, -5, -5, -5, -5, -5, -5, -5, -5, -5),
(15, 'Cameleon ring', 'ring', 300, NULL, NULL, NULL, NULL, 5, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(16, 'Sulfur ring', 'ring', 450, NULL, -3, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 5, NULL, NULL, NULL, NULL),
(17, 'Volcanic Pearl ring', 'ring', 450, NULL, NULL, NULL, NULL, 1, 1, 1, 1, NULL, NULL, NULL, 1, NULL, 2, 1, NULL, 1, NULL),
(18, 'Spider belt', 'belt', 320, NULL, NULL, 3, NULL, 3, 5, NULL, 3, NULL, 1, 1, NULL, NULL, NULL, NULL, 2, NULL, NULL),
(19, 'Scout''s Journal', 'misc', 500, 1, 1, 15, 5, 1, 15, 5, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL),
(20, 'Deer helmet', 'helmet', 360, 10, NULL, NULL, 5, NULL, 5, 2, 4, NULL, NULL, NULL, 2, NULL, NULL, 1, NULL, NULL, NULL),
(21, 'Demonic helmet', 'helmet', 555, NULL, NULL, NULL, NULL, NULL, NULL, 5, 5, NULL, 2, 2, 2, NULL, NULL, NULL, NULL, 2, NULL),
(22, 'Curved axe', 'axe', 1000, NULL, NULL, NULL, NULL, NULL, NULL, 5, 1, NULL, 3, 6, 2, NULL, NULL, NULL, NULL, NULL, NULL),
(23, 'Leather boots', 'boots', 250, NULL, NULL, NULL, NULL, NULL, 5, NULL, 1, 2, NULL, NULL, 1, NULL, NULL, NULL, NULL, NULL, NULL),
(24, 'Studded club', 'club', 400, NULL, NULL, NULL, NULL, NULL, NULL, 2, 1, NULL, 2, 1, 3, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_progress`
--
-- Creare: 16 Mar 2012 la 02:43
-- Ultima actualizare: 01 Dec 2012 la 07:56
-- Ultima verficare: 01 Sep 2012 la 13:17
--

CREATE TABLE IF NOT EXISTS `ab_progress` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `info` tinyint(3) NOT NULL DEFAULT '0',
  `artwork` tinyint(3) NOT NULL DEFAULT '0',
  `icons` tinyint(3) NOT NULL DEFAULT '0',
  `model` tinyint(3) NOT NULL DEFAULT '0',
  `unwrap` tinyint(3) NOT NULL DEFAULT '0',
  `texture` tinyint(3) NOT NULL DEFAULT '0',
  `rig` tinyint(3) NOT NULL DEFAULT '0',
  `animation` tinyint(3) NOT NULL DEFAULT '0',
  `sound` tinyint(3) NOT NULL DEFAULT '0',
  `coding` tinyint(3) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_progress`
--

INSERT INTO `ab_progress` (`id`, `info`, `artwork`, `icons`, `model`, `unwrap`, `texture`, `rig`, `animation`, `sound`, `coding`) VALUES
(1, 80, 100, 100, 80, 0, 20, 0, 0, 10, 0),
(2, 80, 60, 100, 80, 0, 0, 90, 10, 10, 0),
(3, 80, 80, 100, 70, 0, 0, 50, 0, 10, 0),
(4, 90, 100, 100, 100, 100, 100, 100, 20, 10, 30),
(5, 90, 100, 90, 80, 90, 80, 80, 0, 30, 40),
(6, 90, 100, 90, 100, 0, 0, 50, 0, 10, 0),
(7, 80, 70, 100, 80, 0, 0, 50, 0, 10, 0),
(8, 90, 60, 100, 100, 100, 90, 30, 0, 10, 0),
(9, 90, 60, 100, 0, 0, 0, 0, 0, 10, 0),
(10, 80, 100, 100, 100, 100, 100, 100, 10, 10, 0),
(11, 80, 90, 100, 60, 0, 30, 0, 0, 10, 0),
(12, 80, 100, 100, 70, 0, 20, 0, 0, 10, 60),
(13, 80, 100, 100, 100, 100, 100, 100, 30, 10, 0),
(14, 80, 70, 100, 90, 0, 70, 0, 0, 10, 0),
(15, 70, 70, 100, 50, 0, 20, 0, 0, 10, 0),
(16, 80, 70, 100, 60, 0, 10, 50, 0, 10, 0),
(17, 70, 100, 100, 90, 100, 90, 0, 0, 10, 0),
(18, 10, 100, 100, 60, 0, 10, 0, 0, 10, 0),
(19, 80, 100, 100, 100, 100, 100, 100, 0, 10, 0),
(20, 80, 90, 100, 0, 0, 10, 0, 0, 10, 0),
(21, 70, 80, 100, 0, 0, 10, 0, 0, 10, 0),
(22, 80, 70, 100, 40, 0, 10, 0, 0, 10, 0),
(23, 70, 100, 100, 30, 0, 10, 0, 0, 10, 0),
(24, 80, 90, 100, 20, 0, 10, 0, 0, 10, 0),
(25, 80, 50, 100, 80, 100, 80, 0, 0, 10, 0),
(26, 40, 80, 80, 0, 0, 10, 0, 0, 10, 0),
(27, 20, 90, 0, 0, 0, 0, 0, 0, 10, 0),
(28, 20, 90, 0, 0, 0, 0, 0, 0, 10, 0),
(29, 90, 100, 100, 90, 90, 90, 50, 0, 10, 0),
(30, 80, 70, 100, 0, 0, 10, 0, 0, 10, 0),
(31, 40, 80, 100, 60, 0, 0, 0, 0, 10, 0),
(32, 20, 100, 0, 0, 0, 0, 0, 0, 10, 0),
(33, 90, 90, 100, 20, 0, 10, 0, 0, 10, 0),
(34, 20, 80, 0, 20, 0, 0, 0, 0, 10, 0),
(35, 50, 90, 0, 0, 0, 0, 0, 0, 10, 0),
(36, 20, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(37, 80, 100, 100, 0, 0, 20, 0, 0, 10, 0),
(38, 20, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(39, 20, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(40, 10, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(41, 10, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(42, 60, 80, 100, 0, 0, 0, 0, 0, 10, 0),
(43, 10, 50, 0, 0, 0, 0, 0, 0, 10, 0),
(44, 80, 40, 100, 0, 0, 0, 0, 0, 10, 0),
(45, 60, 40, 100, 0, 0, 0, 0, 0, 10, 0),
(46, 10, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(47, 20, 80, 0, 0, 0, 0, 0, 0, 10, 0),
(48, 20, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(49, 20, 60, 0, 0, 0, 0, 0, 0, 10, 0),
(0, 90, 60, 100, 30, 0, 20, 0, 0, 10, 70),
(50, 80, 80, 100, 0, 0, 10, 0, 0, 10, 0);

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_stats`
--
-- Creare: 09 May 2012 la 04:01
-- Ultima actualizare: 03 Dec 2012 la 05:15
-- Ultima verficare: 01 Sep 2012 la 13:17
--

CREATE TABLE IF NOT EXISTS `ab_stats` (
  `id` smallint(4) NOT NULL AUTO_INCREMENT,
  `health` smallint(4) NOT NULL DEFAULT '0',
  `regrowth` smallint(4) NOT NULL DEFAULT '0',
  `endurance` smallint(4) NOT NULL DEFAULT '0',
  `energy` smallint(4) NOT NULL DEFAULT '0',
  `meditation` smallint(4) NOT NULL DEFAULT '0',
  `initiative` smallint(4) NOT NULL DEFAULT '0',
  `offense` smallint(4) NOT NULL DEFAULT '0',
  `defense` smallint(6) NOT NULL DEFAULT '0',
  `movement` smallint(2) NOT NULL DEFAULT '0',
  `pierce` smallint(4) NOT NULL DEFAULT '0',
  `slash` smallint(4) NOT NULL DEFAULT '0',
  `crush` smallint(4) NOT NULL DEFAULT '0',
  `shock` smallint(4) NOT NULL DEFAULT '0',
  `burn` smallint(4) NOT NULL DEFAULT '0',
  `frost` smallint(4) NOT NULL DEFAULT '0',
  `poison` smallint(4) NOT NULL DEFAULT '0',
  `sonic` smallint(4) NOT NULL DEFAULT '0',
  `mental` smallint(4) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_2` (`id`),
  KEY `ID` (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_stats`
--

INSERT INTO `ab_stats` (`id`, `health`, `regrowth`, `endurance`, `energy`, `meditation`, `initiative`, `offense`, `defense`, `movement`, `pierce`, `slash`, `crush`, `shock`, `burn`, `frost`, `poison`, `sonic`, `mental`) VALUES
(1, 100, 3, 90, 125, 8, 110, 40, 10, 6, 5, 2, 3, 5, 3, 7, 5, 6, 20),
(2, 400, 15, 50, 210, 7, 100, 35, 5, 7, 8, 8, 6, 12, 9, 5, 6, 3, 3),
(3, 340, 20, 50, 140, 7, 85, 35, 15, 6, 6, 7, 8, 3, 4, 6, 20, 5, 3),
(4, 260, 4, 80, 90, 3, 80, 15, 15, 5, 12, 12, 12, 12, 20, 0, 25, 5, 0),
(5, 420, 15, 60, 140, 10, 110, 40, 15, 8, 5, 2, 4, 20, 3, 20, 20, 6, 15),
(6, 800, 5, 80, 100, 5, 160, 20, 20, 6, 4, 4, 4, 2, 1, 40, 20, 4, 15),
(7, 666, 0, 66, 100, 3, 120, 6, 6, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10),
(8, 550, 10, 80, 150, 10, 140, 45, 35, 8, 6, 6, 6, 2, 2, 2, 2, 10, 0),
(9, 430, 3, 50, 60, 5, 40, 20, 20, 4, 5, 4, 3, 2, 1, 10, 5, 5, 15),
(10, 200, 2, 60, 90, 2, 180, 10, 10, 5, 3, 3, 3, 3, 3, 3, 3, 5, 20),
(11, 100, 1, 60, 80, 5, 140, 3, 5, 4, 2, 2, 4, 1, 2, 5, 4, 1, 5),
(12, 90, 6, 20, 100, 6, 60, 9, 5, 3, 3, 3, 3, 3, 1, 6, 0, 0, 0),
(13, 130, 5, 60, 70, 4, 130, 2, 4, 4, 2, 2, 2, 2, 2, 2, 4, 3, 1),
(14, 200, 5, 10, 70, 3, 85, 5, 15, 7, 8, 8, 12, 3, 2, 3, 7, 6, 4),
(15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(19, 222, 1, 33, 90, 3, 80, 30, 5, 4, 6, 6, 6, 1, 1, 1, 5, 6, 7),
(20, 550, 5, 60, 50, 4, 60, 40, 5, 4, 5, 7, 6, 8, 1, 35, 5, 15, 10),
(21, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(24, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(25, 160, 0, 0, 70, 3, 160, 5, 5, 5, 10, 0, 10, 10, 0, 10, 10, 10, 10),
(26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(29, 400, 5, 50, 100, 10, 40, 15, 20, 5, 10, 10, 10, 0, 5, 5, 3, 3, 15),
(30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(31, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(33, 720, 8, 100, 120, 5, 100, 60, 60, 6, 20, 20, 20, 15, 20, 10, 10, 15, 15),
(34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(35, 450, 5, 100, 70, 2, 100, 30, 30, 6, 9, 9, 9, 0, 5, 5, 0, 0, 10),
(36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(37, 160, 8, 90, 70, 5, 40, 10, 10, 4, 4, 4, 4, 3, 1, 1, 1, 1, 1),
(38, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(39, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(42, 800, 5, 100, 80, 10, 80, 80, 80, 5, 15, 15, 15, 10, 10, 5, 5, 5, 10),
(43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(44, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(45, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(0, 100, 1, 60, 100, 10, 50, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 30),
(50, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
