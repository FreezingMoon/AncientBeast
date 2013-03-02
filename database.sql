-- phpMyAdmin SQL Dump
-- version 3.5.4
-- http://www.phpmyadmin.net
--
-- Gazda: 127.0.0.1
-- Timp de generare: 02 Mar 2013 la 17:02
-- Versiune server: 5.1.67-community-log
-- Versiune PHP: 5.2.6

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Baza de date: `C332527_fm`
--

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_abilities`
--

CREATE TABLE IF NOT EXISTS `ab_abilities` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `passive` varchar(20) NOT NULL DEFAULT 'No name',
  `passive desc` varchar(110) NOT NULL DEFAULT 'No description',
  `passive info` varchar(40) NOT NULL DEFAULT 'No info',
  `weak` varchar(20) NOT NULL DEFAULT 'No name',
  `weak desc` varchar(110) NOT NULL DEFAULT 'No description',
  `weak info` varchar(40) NOT NULL DEFAULT 'No info',
  `medium` varchar(20) NOT NULL DEFAULT 'No name',
  `medium desc` varchar(110) NOT NULL DEFAULT 'No description',
  `medium info` varchar(40) NOT NULL DEFAULT 'No info',
  `strong` varchar(20) NOT NULL DEFAULT 'No name',
  `strong desc` varchar(110) NOT NULL DEFAULT 'No description',
  `strong info` varchar(40) NOT NULL DEFAULT 'No info',
  PRIMARY KEY (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_abilities`
--

INSERT INTO `ab_abilities` (`id`, `passive`, `passive desc`, `passive info`, `weak`, `weak desc`, `weak info`, `medium`, `medium desc`, `medium info`, `strong`, `strong desc`, `strong info`) VALUES
(1, 'Post Mortem', 'Drops a powerful fuse bomb on the ground when dying.', '', 'Sword Slash', 'Swift attack on a nearby foe.', 'No info', 'Pistol Shot', 'Medium range shot.', 'No info', 'Rifle Shot', 'Very powerful long range attack.', 'No info'),
(2, 'Backstabber', 'Reduces damage from behind and returns some to melee attackers.', '30% damage reduction and return.', 'Metallic Claws', 'Razor sharp claws help him really shred his foes.', '10 pierce + 10 slash damage.', 'Tail Mace', 'Whips out it''s scepter like tail to bluntly punish a distant foe.', '15 pierce + 15 crush damage.', 'Brain Power', 'Electro-charges it''s brain functions to shock all nearby creatures.', '25 shock damage to adjacent targets.'),
(3, 'Spore Contamination', 'Nearby foes have their regrowth stat constantly reduced with each round.', '-1 regrowth per stack', 'Chomp', 'Takes a huge bite out of his foe, restoring a minor amount of health.', '20 pierce damage, 1/4 as regrowth', 'Blade Kick', 'Slashes nearby foe using feet claws.', '15 pierce + 10 slash + 5 crush damage', 'Frogger', 'Leaps in straight line over obstacles, gaining bonus offense after landing.', '+30 offense for next hit if not moving'),
(4, 'Infernal Temper', 'Bursts into flames when it''s turn comes, damaging nearby creatures.', '5 burn damage', 'Pulverize', 'Smacks a foe with its heavy hand.', '9 crush + 1 burn damage', 'Fissure', 'Smashes his fists into the ground, wreaking fierce havoc ahead.', '10 burn damage ', 'Molten Hurl', 'Turns into a molten boulder, bowling itself into first foe in a straight line.', '15 crush + 5 burn damage'),
(5, 'Armor Penetration', 'Attacks gradually break through enemy defense.', '', 'Jab Attack', 'Horn attack that does bonus pierce damage based on distance traveled.', 'No info', 'Static Charge', 'Shakes hair to create friction and imbue next attack with lightning.', 'No info', 'Envenom', 'Makes use of tongue to smear the horn with highly venomous saliva.', 'No info'),
(6, 'Cryosauna', 'Foes have their movement reduced and initiative constantly decreased.', '', 'Frost Bite', 'Pokes ice teeth into nearby foe.', 'No info', 'Nitrogen Splash', 'Exhales freezing gas that does more damage as it travels.', 'No info', 'Glacial Spikes', 'Several spears of ice erupt in the area nearby, impaling all creatures.', 'No info'),
(7, 'Eye of the Fire', 'Strategically teleports to a new location on the combat field.', '', 'Fiery Claw', 'Scratch and burn a nearby foe.', '10 slash + 10 burn damage', 'Fire Ball', 'Throws a ball of fire that explodes on impact, damaging several creatures.', '20 burn damage', 'Infernal Pyre', 'Increases power of it''s back fire in order to burn all adjacent creatures.', '30 burn damage'),
(8, 'Unstopable', 'Successfully resists first signs of fatigue, being able to carry on.', '', 'Knuckle Head', 'Smashes ringed head into a foe.', 'No info', 'Meat Hook', 'Drags a foe, doing bonus damage if it doesn''t have any movement points.', 'No info', 'Double Swipe', 'Slashes nearby foes with both claws.', 'No info'),
(9, 'Frozen Tower', 'Temporary increases offense and defense by holding the same spot.', '', 'Icy Talons', 'Scratches nearby foe using claws.', 'No info', 'Tail Uppercut', 'Sucker punches a near enemy using tail, ignoring most of it''s defense.', 'No info', 'Icicle Tongue', 'Launches tongue, piercing all foes sitting in front in a straight line.', 'No info'),
(10, 'Inner Vision', 'Lack of sight forces the creature to focus on it''s other senses.', '', 'Tongue Dagger', 'Melee attack on a nearby foe.', 'No info', 'Sonic Scream', 'Shock waves that travel far.', 'No info', 'Psychic Blast', 'Focuses the power of mind in order to attack foes from a small region.', 'No info'),
(11, 'Travel Waypoint', 'Transfer from a shroom to another.', '', 'Head Bash', 'Bumps it''s large cap into nearby foe.', '10 crush damage', 'Tiny Mushroom', 'Drops a shroom that serves as a waypoint or a poisonous trap.', '20 poison damage', 'Noxious Cloud', 'Releases several toxic clouds all around, persisting for several rounds.', '20 adjacent poison damage'),
(12, 'Bunny Hopping', 'Avoids a basic attack by moving to an available adjacent location.', '-1 movement on use', 'Big Nip', 'Dents nearby foe using it''s big teeth.', '4 pierce + 4 slash + 2 crush damage', 'Blowing Wind', 'Pushes an inline creature several hexagons backwards, based on size.', 'range = 6 hexagons - creature size', 'Chilling Spit', 'Spits inline foe with cold saliva. Bonus damage based on distance.', '20 frost + 1 crush / hexagon damage'),
(13, 'Decaying Carcass', 'When dead, it''s corpse rots fast and emanates poisonous gases.', '', 'Sink Teeth', 'Bites a nearby foe.', 'No info', 'Bad Breath', 'Stinks up several nearby enemies.', 'No info', 'Toxic Bubble', 'Creates a mucus bubble from it''s nose and pushes it away.', 'No info'),
(14, 'Self Flatten', 'Squishes itself in order to avoid a melee attack or allow an ally to pass.', '', 'Gummy Mallet', 'Transforms itself into a rubber hammer to strike a nearby foe.', 'No info', 'Royal Seal', 'Sticks chewing gum in place to hinder enemy movement.', 'No info', 'Boom Box', 'Turns belly into a speaker, blasting an inline foe, pushing it back a bit.', 'No info'),
(15, 'Fried Chicken', 'Corpse can be consumed by other creatures, regaining some health.', '', 'Face Smash', 'Bashes nearby foe using it''s head.', 'No info', 'Optic Blast', 'Zaps a foe with it''s laser cannon.', 'No info', 'Magic Act', 'Swaps places of any two creatures in front that have similar sizes overall.', 'No info'),
(16, 'Ground Shaker', 'Stomps the ground when walking, increasing the delay of all it''s foes.', '', 'Lava Splash', 'Hits a near foe with a handful of lava.', 'No info', 'Volcanic Cannon', 'Fires a flaming boulder projectile at a target foe.', 'No info', 'Spitfire', 'Erupts with rage, bombarding the battlefield with burning lava.', 'No info'),
(17, 'Spiked Fence', 'When dead, enemies walking on it''s corpse get their limbs impaled.', '', 'Trident Forehead', 'Pokes nearby enemy with it''s large forehead spikes.', 'No info', 'Trap Jaw', 'Bites nearby foe, crippling it.', 'No info', 'Circular Saw', 'Travels in a straight line and back, cutting through encountered foes.', 'No info'),
(18, 'Pulse of the Maggots', 'Gains one regrowth point for each corpse located on the battlefield.', '', 'Claw Strike', 'Slashes nearby foe using claws.', 'No info', 'Fly Swarm', 'Damages and distracts a foe, lowering it''s offense and defense.', 'No info', 'Shadow Army', 'Allows any dead creature to fight again for it''s life, as a shadow being.', 'No info'),
(19, 'Blood Chalice', 'Nearby damage restores own health.', '10% damage conversion to health.', 'Slice', 'Claw swipe gesture on a nearby foe.', '15 pierce + 15 slash damage', 'Fatal Attraction', 'Causes a target foe to come close to her, while depleting its movement.', 'Does not work on summoners.', 'Tentacle Feet', 'All nearby foes have their movement restrained and take some damage.', '10 crush damage and no movement.'),
(20, 'Cryosauna', 'Foes have their movement reduced and initiative constantly decreased.', '', 'Suction cups', 'Crushes a frontal foe while draining a very small amount of it''s energy.', 'No info', 'Tentacle Grasp', 'Pulls a rather distant inline foe nearby while also crushing it.', 'No info', 'Frostbite Shower', 'Sprinkles the area in front with liquid nitrogen, doing cold damage.', 'No info'),
(21, 'Half Life', 'Can regenerate health up to double.', '', 'Bone Scythe', 'Slashes nearby foe, causing it to bleed and lose health if moving.', 'No info', 'Blood Puke', 'Target''s regrowth becomes nulled if it''s a foe or doubles if it''s an ally.', 'No info', 'Symbiotic Tumor', 'Engulfs body into a meat cocoon for bonus protection and regrowth. ', 'No info'),
(22, 'Lava Pool', 'When dead, melts into puddle of boiling lava that damages foes.', '', 'Poked Eye', 'Swings it''s eye at a nearby foe.', 'No info', 'Iron Shell', 'Solidifies from magma state into iron, greatly increasing resistances.', 'No info', 'Black Pearl', 'Fires a durable sphere up in to the air, falling on target the next round.', 'No info'),
(23, 'Forced Involution', 'When dead, reconfigures itself as a weaker creature, the Magma Spawn.', '', 'Forked Hand', 'Pierces foe using it''s metallic harpoon shaped fingers.', 'No info', 'Fire Dump', 'Ignites the ground, the fire expands and contracts over several rounds.', 'No info', 'Shotgun Blast', 'Blows a handful of shrapnel in a conic area, doing versatile damage.', 'No info'),
(24, 'Healing Factor', 'Able to regenerate even if fatigued.', '', 'Gauntlet Strike', 'Punches a nearby foe with it''s heavy armored hand, leaving quite a mark.', '20 crush damage', 'Bloody Greed', 'Powerful sword penetrating attack, affecting multiple inline hexagons.', '20 pierce + 10 slash damage', 'Supreme Motivation', 'Greed drives it to do an extra effort and act twice in the current round.', 'Ability only usable once per round.'),
(25, 'Self Sewing', 'Partially repairs itself if not taking any damage for a whole round.', '', 'Free Haircut', 'Takes out it''s pair of scissors and cuts a nearby foe, keeping a sample.', 'No info', 'Scarecrow', 'Intimidates target foe, making it run away at the beginning of it''s turn.', 'No info', 'Voodoo Doll', 'Stabs itself, doing mental damage to any of the previously attacked foes.', 'No info'),
(26, 'Immortal Tree', 'Creature is being resurrected each time another one dies right on top.', '', 'Stalagmite Teeth', 'Pierces nearby foe with it''s denture.', 'No info', 'Waterfall Burst', 'Powerful jet of water (Waterfall Cannon?)', 'No info', 'Weed Field', 'Nasty weeds spring allover a region, growing with time.', 'No info'),
(27, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(28, 'Tankish Build', '20% bonus to masteries and defense.', '', 'Stomp''A''Fool', 'Deals damage to nearby foe.', '25 crush damage', 'Stone Grinder', 'Destroys fatigued one or two hexagon creature or corpse.', 'Does 10 crush damage around.', 'Charcoal Blast', 'Bombards an area with burning coal.', '10 crush to target + 10 burn in area'),
(29, 'Bad Touch', 'Every three strikes, a melee attacker is turned to gold for several rounds.', '', 'Red Crystal', 'Pokes nearby foe using staff.', 'No info', 'Winged Orb', 'Heals an ally or damages a foe that''s at the target location next round.', 'No info', 'Burning Light', 'Conjures an energy beam that causes multiple burns in a straight line.', 'No info'),
(30, 'Offspring', 'Spawns a little hungry eggplant that chases nearest foe and attacks it.', '', 'Dinner Time', 'Bites a nearby foe.', 'No info', 'Pony Tail', 'Whips and poisons nearby foes, knocking them back.', 'No info', 'Snake Tongue', 'Throws tongue at a distant target, having it come back with time.', 'No info'),
(31, 'Retaliation', 'Returns favor to frontal attackers, by slashing them with it''s heavy claws.', '', 'Pummel', 'Severly punches a nearby foe.', 'No info', 'Frightening Howl', 'Removes positive buffs and reduces offense and defense of nearby foes.', 'No info', 'Slice and Dice', 'Brutally slashes all frontal foes using it''s extremely sharp claws.', 'No info'),
(32, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(33, 'Percussion Spear', 'Attacks cause rear spear strike, which cannot be dodged.', '', 'Executioner Axe', 'Slashes nearby foe, doing bonus damage based on it''s max health.', 'No info', 'Dragon Flight', 'Travels to a location passing over obstacles with no movement cost.', 'No info', 'Breath of Life', 'Brings back to life a dead ally, with health equal to the endurance stat.', 'No info'),
(34, 'Intimidating', 'Nearby foes have their offense and defense reduced for a round.', '-25% offense and defense debuff', 'Wrist Blade', 'Slashes nearby foe using blade.', '15 slash damage', 'Knock Back', 'Attack that pushes back target.', '10 slash + 5 crush damage', 'Overpower', 'Increases offense and defense until attacking or getting hit once.', '+50% offense and defense bonus'),
(35, 'Shield Block', 'Uses shield to defend against frontal attacks, greatly reducing damage.', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(36, 'Perstilence', 'Foes have regrowth and meditation constantly reduced every few rounds.', '', 'Gnarled Staff', 'Pokes nearby foe using wooden staff.', 'No info', 'Rock Shard', 'Summons obstacle at inline location, doing some damage when erupting.', 'No info', 'Furious Twister', 'Summons tornado that travels inline every round, bashing all creatures.', 'No info'),
(37, 'Spa Mud', 'Gains temporary bonus regrowth and defense when entering a mud bath.', '+5 regrowth, +5 defence', 'Power Bat', 'Pokes baseball bat into nearby foe.', '15 crush damage', 'Ground Ball', 'Strikes a mud boulder towards a foe.', '15 crush + 5 burn damage', 'Mud Bath', 'Orders a pile of mud at a location, slowing foes passing through.', '-1 movement / hex'),
(38, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(39, 'Maggot Infestation', 'Strikes any rear foe at beginning of turn, infesting it with a parasite.', '', 'Round Mouth', 'Bites nearby foe with its sharp teeth.', 'No info', 'Scapel Limbs', 'Strikes nearby foe doing bonus damage on unused movement points.', 'No info', 'Worm Strike', 'Grasps a distant foe, pulling itself to it, doing damage based on distance.', 'No info'),
(40, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(41, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(42, 'Like Butter', 'Ignores half of targets defense.', '', 'Slicer', 'Slashes nearby foe using claws.', 'No info', 'Mesmerize', 'Does sonic damage to an inline foe, also causing it to skip next turn.', 'No info', 'Eclipsing Strike', 'Catapults itself at a foe, reaching it and striking it the next round.', 'No info'),
(43, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(44, 'Feathered', 'Can fly to available locations within movement range, avoiding obstacles.', '', 'Slicing Talon', 'Slashes nearby foe using claws.', '12 slash damage', 'Special Delivery', 'Drops a boulder at the selected location, damaging a creature.', '15 crush damage', 'Escort Service', 'Carries any small or medium creature to a new location. Also damages foes.', '6 pierce + 10 crush damage'),
(45, 'Duality', 'Allows the use of an attack twice.', '', 'Tooth Fairy', 'Syncs teeth into nearby foe.', '20 crush damage', 'Power Note', 'Sings a very powerful note to a foe.', '20 sonic damage', 'Chain Lightning', 'Releases a lightning bolt that will arch, shocking multiple creatures.', '20 shock damage'),
(46, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(47, 'Plate Mail', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(48, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(49, 'No name', 'No description', '', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info', 'No name', 'No description', 'No info'),
(0, 'Artificial Satellite', 'Protects from all harm and also facilitates distant materialization.', '-2 plasma per use', 'Electroshock', 'Does shock damage to a nearby foe. Effective versus larger creatures.', '12 shock damage * creature size', 'Disintegration', 'Does pure damage to a nearby foe. Bonus based on it''s missing health.', '>25 damage; plasma = creature size', 'Materialization', 'Summons a creature on the combat field that will serve and obey orders.', 'plasma = creature size + level (+2)'),
(50, 'Immaterial', 'Passes through obstacles and takes half the damage.', '', 'Hand Jaw', 'Bites nearby foe using it''s ... hand.', 'No info', 'Opression', 'Causes nearby foe to fall into depression and not act for a turn.', 'No info', 'Life and Death', 'Ressurects itself by stealing the life of a fatigued foe, if corpse available.', 'No info');

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_creatures`
--

CREATE TABLE IF NOT EXISTS `ab_creatures` (
  `id` smallint(6) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(15) NOT NULL,
  `sin` varchar(1) NOT NULL,
  `lvl` varchar(1) NOT NULL DEFAULT '1',
  `hex` tinyint(1) NOT NULL DEFAULT '1',
  `embed` tinytext COMMENT 'Sketchfab.com',
  PRIMARY KEY (`id`),
  UNIQUE KEY `Name` (`name`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=51 ;

--
-- Salvarea datelor din tabel `ab_creatures`
--

INSERT INTO `ab_creatures` (`id`, `name`, `sin`, `lvl`, `hex`, `embed`) VALUES
(1, 'Bounty Hunter', 'A', '2', 1, NULL),
(2, 'Marauder', 'G', '6', 3, NULL),
(3, 'Uncle Fungus', 'G', '3', 2, NULL),
(4, 'Magma Spawn', 'L', '2', 3, NULL),
(5, 'Impaler', 'S', '5', 3, NULL),
(6, 'Ice Demon', 'S', '7', 3, NULL),
(7, 'Abolished', 'P', '7', 3, NULL),
(8, 'Horn Head', 'W', '5', 2, 'qiZwkauNCsMRVielvbpliN0K5up'),
(9, 'Nightmare', 'S', '4', 2, NULL),
(10, 'Troglodyte', 'P', '3', 3, NULL),
(11, 'Toxic Shroom', 'G', '1', 1, NULL),
(12, 'Snow Bunny', 'S', '1', 1, NULL),
(13, 'Swampler', 'G', '2', 1, NULL),
(14, 'Gumble', 'P', '1', 1, NULL),
(15, 'Cycloper', 'E', '1', 1, NULL),
(16, 'Vulcan', 'L', '5', 2, NULL),
(17, 'Razorback', 'E', '6', 2, NULL),
(18, 'Sarcophag', 'W', '7', 3, NULL),
(19, 'Miss Creeper', 'G', '4', 1, NULL),
(20, 'Adaptation', 'S', '6', 3, NULL),
(21, 'Flayed', 'W', '4', 2, NULL),
(22, 'Lava Mollusk', 'L', '1', 1, NULL),
(23, 'Metal Face', 'L', '4', 3, NULL),
(24, 'Living Armor', 'A', '6', 2, NULL),
(25, 'Mr. Stitches', 'E', '3', 1, NULL),
(26, 'Moss Hound', 'G', '7', 3, NULL),
(27, 'Sand Shrimp', 'P', '2', 3, NULL),
(28, 'Stomper', 'P', '4', 2, NULL),
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
(40, 'Nutcase', 'W', '1', 2, NULL),
(41, 'Flesh Cleanser', 'W', '2', 2, NULL),
(42, 'Night Stalker', 'E', '7', 2, NULL),
(43, 'Fire Bird', 'L', '7', 3, NULL),
(44, 'Scavenger', 'E', '2', 2, NULL),
(45, 'Chimera', 'P', '6', 3, NULL),
(46, 'Scorpius', 'E', '5', 3, NULL),
(47, 'Royal Guard', 'P', '5', 3, NULL),
(48, 'Satyr', 'W', '6', 3, NULL),
(49, 'Volpyr', 'L', '6', 3, NULL),
(0, 'Dark Priest', '-', '-', 1, NULL),
(50, 'Shadow Leech', 'W', 'S', 1, NULL);

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_donors`
--

CREATE TABLE IF NOT EXISTS `ab_donors` (
  `id` smallint(6) NOT NULL AUTO_INCREMENT,
  `name` varchar(30) NOT NULL,
  `email` varchar(30) NOT NULL,
  `website` char(70) DEFAULT NULL,
  `amount` smallint(6) NOT NULL,
  `type` char(1) NOT NULL DEFAULT '€',
  `anonymous` varchar(1) DEFAULT NULL,
  `date` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM  DEFAULT CHARSET=utf8 AUTO_INCREMENT=18 ;

--
-- Salvarea datelor din tabel `ab_donors`
--

INSERT INTO `ab_donors` (`id`, `name`, `email`, `website`, `amount`, `type`, `anonymous`, `date`) VALUES
(1, 'Hein-Pieter van Braam', 'hp@tmm.cx', 'http://opengameart.org/users/tmm', 40, '$', NULL, '2012-05-16 16:43:24'),
(2, 'Daniel Cohen', 'faemir@faemir.co.uk', 'http://mrfaemir.deviantart.com', 5, '$', NULL, '2010-01-07 23:46:05'),
(3, 'Adam Dalton', 'septimus_Septim@hotmail.com', 'https://www.facebook.com/Thereal.Software', 20, '$', NULL, '2011-10-17 04:00:00'),
(4, 'Markus Eliassen', 'WereMakingGames@hotmail.com', 'http://rising-of-chaos.tripod.com/fanpage/index.html', 3, '$', NULL, '2012-02-18 05:00:00'),
(5, 'gamesandspace', 'zach055@yahoo.com', 'http://www.youtube.com/watch?v=cljNhZKOVXU', 3, '$', NULL, '2012-04-17 04:00:00'),
(6, 'Kevin Brubeck Unhammer', 'pixiemotio.n@gmail.com', 'http://unhammer.wordpress.com', 50, '$', NULL, '2011-01-23 05:00:00'),
(7, 'Vanessa Young', 'silver_nessa@hotmail.com', 'https://www.facebook.com/silvernessa', 46, '$', NULL, '2010-01-07 05:00:00'),
(8, 'Max Mazon', 'feliperules69@gmail.com', 'https://twitter.com/#!/MaxMazon', 1, '$', NULL, '2010-01-06 05:00:00'),
(9, 'Teo Cazghir', 'teo_volkany@yahoo.com', 'http://teogreengage.blogspot.ro', 50, '$', NULL, '2011-10-20 04:00:00'),
(10, 'Leif Larsen', 'linuxdk1978@gmail.com', 'https://twitter.com/#!/obiwandk', 10, '$', NULL, '2010-12-06 05:00:00'),
(11, 'Gheorghe Anastase', 'ganastase@gmail.com', NULL, 250, '€', '', '2012-05-07 04:00:00'),
(12, 'Gheorghe Anastase', 'ganastase@gmail.com', NULL, 225, '€', '', '2012-06-28 04:00:00'),
(13, 'Tudorita Anastase', 'ema6710@yahoo.com', NULL, 500, '€', '', '2011-06-01 04:00:00'),
(14, 'Iwan Gabovitch', 'qubodup@gmail.com', 'http://qubodup.net', 15, '€', NULL, '2012-07-03 22:46:28'),
(15, 'Gheorghe Anastase', 'ganastase@gmail.com', NULL, 215, '€', '', '2012-08-05 04:00:00'),
(16, 'Gheorghe Anastase', 'ganastase@gmail.com', NULL, 67, '€', '', '2012-08-17 13:54:56'),
(17, 'Pandu Aji Wirawan', 'ndundupan@gmail.com', 'http://panduaji.com/', 2, '$', NULL, '2012-11-24 04:06:51');

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_items`
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
(2, 100, 60, 100, 80, 0, 10, 90, 10, 10, 0),
(3, 100, 100, 100, 70, 0, 10, 50, 0, 10, 70),
(4, 100, 100, 100, 100, 100, 100, 100, 20, 10, 90),
(5, 90, 100, 90, 80, 90, 80, 80, 0, 30, 40),
(6, 90, 100, 90, 100, 0, 0, 50, 0, 10, 0),
(7, 80, 70, 100, 80, 0, 0, 50, 0, 10, 0),
(8, 90, 60, 100, 100, 100, 90, 30, 0, 10, 0),
(9, 90, 60, 100, 0, 0, 0, 0, 0, 10, 0),
(10, 80, 100, 100, 100, 100, 100, 100, 10, 10, 0),
(11, 80, 90, 100, 60, 0, 30, 0, 0, 10, 0),
(12, 100, 100, 100, 70, 0, 20, 0, 0, 10, 70),
(13, 80, 100, 100, 100, 100, 100, 100, 30, 10, 0),
(14, 80, 70, 100, 90, 0, 70, 0, 0, 10, 0),
(15, 70, 70, 100, 50, 0, 20, 0, 0, 10, 0),
(16, 80, 70, 100, 60, 0, 10, 50, 0, 10, 0),
(17, 70, 100, 100, 90, 100, 90, 0, 0, 10, 0),
(18, 90, 100, 100, 60, 0, 10, 0, 0, 10, 0),
(19, 100, 100, 100, 100, 100, 100, 100, 0, 10, 0),
(20, 80, 90, 100, 0, 0, 10, 0, 0, 10, 0),
(21, 70, 80, 100, 0, 0, 10, 0, 0, 10, 0),
(22, 80, 70, 100, 40, 0, 10, 0, 0, 10, 0),
(23, 70, 100, 100, 30, 0, 10, 0, 0, 10, 0),
(24, 80, 90, 100, 20, 0, 10, 0, 0, 10, 0),
(25, 80, 50, 100, 80, 100, 80, 0, 0, 10, 0),
(26, 40, 80, 80, 0, 0, 10, 0, 0, 10, 0),
(27, 20, 90, 0, 0, 0, 0, 0, 0, 10, 0),
(28, 80, 90, 100, 0, 0, 10, 0, 0, 10, 0),
(29, 90, 100, 100, 90, 90, 90, 50, 0, 10, 0),
(30, 80, 70, 100, 0, 0, 10, 0, 0, 10, 0),
(31, 40, 80, 100, 60, 0, 0, 0, 0, 10, 0),
(32, 20, 100, 0, 0, 0, 0, 0, 0, 10, 0),
(33, 90, 90, 100, 20, 0, 10, 0, 0, 10, 0),
(34, 100, 90, 100, 80, 80, 10, 0, 0, 10, 0),
(35, 50, 90, 0, 0, 0, 0, 0, 0, 10, 0),
(36, 80, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(37, 80, 100, 100, 70, 0, 20, 0, 0, 10, 0),
(38, 20, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(39, 90, 30, 100, 0, 0, 0, 0, 0, 10, 0),
(40, 10, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(41, 10, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(42, 60, 80, 100, 0, 0, 0, 0, 0, 10, 0),
(43, 10, 50, 0, 0, 0, 0, 0, 0, 10, 0),
(44, 100, 100, 100, 0, 0, 10, 0, 0, 10, 0),
(45, 100, 100, 100, 0, 0, 10, 0, 0, 10, 70),
(46, 10, 30, 0, 0, 0, 0, 0, 0, 10, 0),
(47, 20, 80, 0, 0, 0, 0, 0, 0, 10, 0),
(48, 20, 40, 0, 0, 0, 0, 0, 0, 10, 0),
(49, 20, 60, 0, 0, 0, 0, 0, 0, 10, 0),
(0, 100, 80, 100, 60, 0, 20, 0, 0, 10, 80),
(50, 80, 80, 100, 0, 0, 10, 0, 0, 10, 0);

-- --------------------------------------------------------

--
-- Structura de tabel pentru tabelul `ab_stats`
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
(1, 140, 4, 50, 125, 8, 110, 40, 10, 6, 5, 2, 3, 5, 3, 7, 5, 6, 20),
(2, 280, 10, 60, 150, 7, 100, 35, 5, 7, 8, 8, 6, 12, 9, 5, 6, 3, 3),
(3, 120, 10, 40, 120, 7, 90, 20, 10, 4, 5, 5, 5, 3, 4, 6, 20, 5, 3),
(4, 135, 4, 80, 90, 3, 80, 15, 10, 3, 12, 12, 12, 12, 20, 0, 25, 5, 0),
(5, 200, 10, 50, 140, 10, 110, 40, 15, 7, 5, 2, 4, 20, 3, 20, 20, 6, 15),
(6, 333, 5, 80, 100, 5, 125, 20, 20, 6, 4, 4, 4, 2, 1, 40, 20, 4, 15),
(7, 280, 6, 66, 100, 5, 120, 6, 6, 1, 10, 10, 10, 10, 10, 10, 10, 10, 10),
(8, 240, 7, 60, 80, 10, 100, 45, 35, 8, 6, 6, 6, 2, 2, 2, 2, 10, 0),
(9, 430, 3, 50, 60, 5, 40, 20, 20, 4, 5, 4, 3, 2, 1, 10, 5, 5, 15),
(10, 200, 2, 60, 90, 2, 180, 10, 10, 5, 3, 3, 3, 3, 3, 3, 3, 5, 20),
(11, 80, 7, 60, 70, 7, 140, 3, 5, 4, 2, 2, 4, 1, 2, 5, 4, 1, 5),
(12, 90, 6, 20, 100, 6, 60, 9, 5, 2, 3, 3, 3, 3, 1, 6, 0, 0, 0),
(13, 100, 5, 60, 70, 4, 130, 2, 4, 4, 2, 2, 2, 2, 2, 2, 4, 3, 1),
(14, 80, 10, 40, 70, 3, 85, 5, 15, 7, 8, 8, 12, 3, 2, 3, 7, 6, 4),
(15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(17, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(18, 280, 2, 140, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(19, 190, 2, 33, 80, 3, 80, 30, 5, 4, 6, 6, 6, 1, 1, 1, 5, 6, 7),
(20, 270, 5, 60, 50, 4, 60, 40, 5, 4, 5, 7, 6, 8, 1, 35, 5, 15, 10),
(21, 200, 10, 40, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(23, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(24, 260, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(25, 160, 0, 0, 70, 3, 160, 5, 5, 5, 10, 0, 10, 10, 0, 10, 10, 10, 10),
(26, 320, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(27, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(28, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(29, 180, 5, 50, 100, 10, 40, 15, 20, 5, 10, 10, 10, 0, 5, 5, 3, 3, 15),
(30, 230, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(31, 190, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(32, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(33, 300, 8, 100, 120, 5, 100, 60, 60, 6, 20, 20, 20, 15, 20, 10, 10, 15, 15),
(34, 130, 3, 80, 60, 10, 30, 12, 12, 2, 10, 10, 10, 10, 10, 10, 10, 10, 10),
(35, 200, 5, 100, 70, 2, 100, 30, 30, 6, 9, 9, 9, 0, 5, 5, 0, 0, 10),
(36, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(37, 120, 5, 80, 70, 5, 40, 10, 10, 3, 4, 4, 4, 3, 1, 1, 1, 1, 1),
(38, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(39, 170, 4, 60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(40, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(41, 135, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(42, 320, 5, 100, 80, 10, 80, 80, 80, 5, 15, 15, 15, 10, 10, 5, 5, 5, 10),
(43, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(44, 115, 2, 30, 80, 8, 60, 12, 12, 8, 8, 7, 6, 8, 8, 8, 8, 6, 6),
(45, 260, 5, 40, 80, 8, 50, 20, 20, 4, 8, 8, 8, 15, 10, 9, 8, 15, 12),
(46, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(47, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(48, 260, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(49, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
(0, 100, 1, 60, 100, 10, 50, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 30),
(50, 100, 0, 100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
