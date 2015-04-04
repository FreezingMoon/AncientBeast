<?php
$page_title = "Design";
$style = "
.sections {
	font-size: 18px;
	font-weight: 700;
	list-style-type: none;
	width: 100%;
	margin: 0 0 0 -10px;
	padding: 0;
}

.sections li { display: inline; }
";
require_once("../header.php"); ?>

<!-- Display list of sections -->
<div class="div center">
<ul class="sections">
<?php
$sections = array(
	'about',
	'vision',
	'plot',
	'tech',
	'input',
	'refs',
	'battle',
	'adventure',
	'campaign'
);

foreach ($sections as &$sectionItem) {
	echo '<li style="display:inline;"><a href="#' . $sectionItem . '" style="padding:1.3em;">' . ucfirst($sectionItem) . '</a></li>';
}
?>
</ul>
</div>

<div class="div">
<div id="about"><a href="#about"><h3 class="center">About</h3></a></div><br>
This article is meant to provide a detailed view on the project by providing information about the game design elements along with thoughts regarding various design decissions and technical information. It can serve both players who want to know more in-depth details about the game's mechanics or possible contributors who wish to understand the whole mindset.
</div>

<div class="div">
<div id="vision"><a href="#vision"><h3 class="center">Vision</h3></a></div><br>
Some might argue that the chess of the future is... chess, but I think it's been around for too long and besides having a lot of design flaws, it doesn't do too well with current trends anymore and things will get even worse. I want Ancient Beast to spread like a virus and be the chess of the future: basically the default way of battling someone virtually by using strategy while not having to deal with any chance based factors or game elements. The perfect esport. The game is very accessible and playable for free, without enforcing any Pay-to-Play or Pay-to-Win elements, as I personally hate such shovelware games that try to milk whales while also making all the common players feel handicaped. The video game industry is in a very dark place at the moment and I want to break the mold. Development takes a huge about of time and requires wearing lots of hats, so I can't do it alone. The code and the assets are open source and even if you can't draw or program, there are lots of other ways you can contribute, like donating money, providing feedback or simply spreading out the word especially considering that marketing is damn expensive and we don't have a real budget.

I'm also not too happy with the free graphical resources you can find online, so we're generating high quality content that can be used in other projects, Ancient Beast basically being the reverse of Super Smash Bros Brawl, having lots of original characters that are constantly showing up in other cool games, some which might hopefully be even yours.
</div>

<div class="div">
<div id="plot"><a href="#plot"><h3 class="center">Plot</h3></a></div><br>
Everything has a duality. I'm not a religious person but I believe in Him and I came to the conclussion that God and the Devil are the same person, two sides of the same coin. And it is said that He created us in His image, meaning we're capable of both good and evil. And the same goes for everything we make as well. Every single invention that benefit the human kind also lead to suffering and massacres. Now we face a new era, the 3rd industrial revolution, thanks to 3d printers, which allow us to make pretty much anything we can image, house hold objects, action figures, chess pieces, weapons, vehicles, buildings, organs and now even living creatures. We are living in a fantasy world where anything is possible. The average person has a lot of power in his hands, but not enough wisdom to put it to good use. Not a very comfortable thought for a good night's sleep, is it?
</div>

<div class="div">
<div id="tech"><a href="#tech"><h3 class="center">Tech</h3></a></div><br>
The goal is to have the game run smoothly on as many devices as possible, regardless of hardware and operating system, by keeping it lightweight. Every single asset is carefully optimized in order to save bandwidth, disk space and memory.
</div>

<div class="div">
<div id="input"><a href="#input"><h3 class="center">Input</h3></a></div><br>
The game was carefully designed to be playable with pretty much any modern or future device / controller.
</div>

<div class="div">
<div id="refs"><a href="#refs"><h3 class="center">Refs</h3></a></div><br>
I've always preferred multiplayer games that have high replayability rather then playing a lot of games that only revolve around the single player modes. I don't really bother playing the latest and "greatest" AAA titles out there, but I constantly research game design and study a lot of game titles in various ways, like watching Let's Plays, watching buddies play them or reading / watching reviews. I've played quite a bit of turn based strategy games, mobas, beat'em'ups, shooters and real time strategies over the years. Even if my favorite platform was essentially the NES, these types of games except beat'em'ups and tbs' don't really cut it on it (or being played with game pads), but I kinda felt that some of them lacked a bit of soul since they were less about bringing people physically together, to play face-to-face, except for Chess, which on the other hand, feels rather dull and outdated when being played on a device, even a missuse of modern hardware if you ask me, which applies to a lot of Collectible / Trading Card Games (CCG/TCG), usually played by old people in parks, while online you tend to not even see your opponent's face, chances being you're actually not playing against a real person, but a bot pretending to be one.
HoMM3, Disciples 2, Dota, Age of Wonders 2, League of Legends, Heroes of Newerth, Chess
</div>

<div class="div">
<div id="battle"><a href="#battle"><h3 class="center">Battle</h3></a></div><br>

<p>This game mode focuses on combat only, being as fair as possible and avoids any randomness. It allows for a few variations.</p>

<p>
<b>Normal</b><br>
Meant to be played 1vs1 or 2vs2, in combat mode only, having matches ranging from 30 minutes to about 2 hours. The overall emphasis is being equal to your opponents in order to have a fair fight.
The combat field is hexagon tile based, having 9 rows, the odd ones being composed of 15 hexagons, while the even ones being 16.
All players start with a Dark Priest, which allows materializing units. Unlike Chess, the first turn advantage flaw is basically inexistent, as you're not enforced to using the same units as your opponent(s), but in fact you can actually counter the units they summoned if you wish or know how, while trying to copycat them would have you at a dissadvantage, as duplicate units always act slower.
Dark Priests posses an unique resource called plasma, which can be used for both defense, by powering your plasma shield and avoiding harm and for offense, materializing units in order to defeat your foe(s); you can of course make units and use them defensively, as meat shields, since most ranged attacks only hit the first encountered unit.
</p>

<p>
<b>Trivia</b><br>
This mode requires the player to answer a question with 4 possible answers at the start of each unit turn. If he gets the wrong answer, the unit will be skipped. The difficulty and domain of the questions depend on the unit realm and level.
</p>

<p>
<b>Common</b><br>
All the players (2 or 4) have a shared unit inventory they can choose from, so first come, first served, each unit being able to get materialized just once on the combat field, being unique, so no copy-cat tactics and it can be trickier to obtain your wanted unit combos or to counter your foe(s), but you can always anticipate and grab certain units before other players do, kinda like in a game of Tic-Tac-Toe.
</p>

<p>
<b>Sinner</b><br>
In this game mode each player chooses a realm and all the units from that realm are instantly materialized, prioritized from low to high level, so unit count restriction can still apply.
</p>

<p>
<b>Ladder</b><br>
This mode requires a monthly subscription, which will provide you with a plasma pool that regenerates and some units. The plasma is a finite resource and all units as well as the player can actually die. You can resurrect fallen units at the end of the combat using plasma or purchase unit packs to replenish your army. If your Dark Priest gets killed during battle, you won't be able to play another match in this mode until he revives, but you can spend plasma points to instantly revive him. When entering a match, you'll be required to have a minimum number of non-duplicated units and at least a certain number of plasma points. Each match can bring you score, which adds up in the ladder. The ones with the highest score each month will be immortalized in the hall of fame and also receive awesome prizes. You can play this mode only online, optionally by teaming up with another buddy, who also requires an account or subscription. Your buddy can even play from the same device as you provided authorization is granted or he uses a mobile device as a controller.
</p>

<p>
<b>Units</b><br>
There are 7 realms based on the 7 Deadly Sins, each having 7 level of units that come in 3 sizes, small (1 hexagon), medium (2 hexagons) and large (3 hexagons), usually the lower level ones being cuter and smaller, while gradually becoming larger and creepier to the higher end of the spectre. Each player is represented on the adventure map and combat field by a special unit called a hero, which is either a summoner or a champion, the main difference being the way they invoke units on the field, the summoner (Dark Priest) tends to travel light while taking more time to materialize units during combat, but has a wide variety that he picks as he pleases, while the champion (Dread Knight) tends to move slower and only have a limited amount of units that are constantly available in combat. Each materialized unit has a plasma cost, which is equal to this formula: unit level + unit size = plasma cost. There are no unit stacks and each unit is unique, only being materialized once by every player during a battle. The number under an unit represets its remaining health if within a rectangle or the remaining shield if within an capsule, representing a number of hits the specific unit can take before actually being vulnerable.
Killed units drop specific items that occupy their first hexagon, restoring health and or energy to other units that pick them; you can see the efficiency of a drop by hovering it and looking at the current unit's life and energy bar. Each unit has 4 abilities: a passive which can't be triggered manually, but might be in effect permanently or when certain conditions are met, a basic attack which is usually melee and affects a single adjacent hexagon, sometimes even having a special effect, a basic ability and an ultimate ability which is usually very powerful and can change the outcome of the battle. Active abilities usually require energy and sometimes even health. Each can be used once per round, with exceptions. Materialized units suffer from sickness, meaning they don't act the 1st turn and can't recover health or energy. There is no magic so there aren't any spell books, but thanks to their abilities, units can be used as spell pages, thought everything they're capable of doing can be explained by science, their bodies or the gear they may use.
</p>

<p>
<b>Stats</b><br>
Each unit has 9 statistics, being some of the main traits that define it's role on the combat field, for reference they're each explained when hovered the unit cards, but I'll explain them over here as well in way more detail.<br>
Health - the amount of hitpoints an unit currently has, it's displayed under each unit in a rectangle; if an unit drops under 1, it dies, dropping an item. Corpses don't usually remain on the combat field.<br>
Regrowth - after taking damage, units are able to heal themselves more or less each round provided they're not fatigued. Some units don't last very long in the line of fire, requiring constant breaks in order to refill.<br>
Endurance - each round an unit can take a limited amount of damage and still be able to regenerate health and energy. The remaining amount is displayed in the interface, under the avatars of the queued units.<br>
Energy - pretty much all abilities require some energy in order to be performed, the specific amount can be seen when hovering an ability or simply by selecting one provided it's usable from the current location and all its other requirements are met, the amount the ability will drain being indicated in the energy bar.<br>
Meditation - an unit can recover some energy points as well each round, provided it's not fatigued. Even though most abilities can be used only once per turn, it's not very likely that all abilities can be used every turn, especially if the unit constantly gets fatigued. Make sure to shield your marksman units with tankier ones.<br>
Initiative - this defines the position of the unit in the queue, higher level units being able to act faster during a round. Units that didn't act can choose to delay turn, being able to act at the end of the around along with the other units that delayed. The slowest unit can't delay if no other unit delayed before. When it comes to units with identical initiative stats, the older units gets to act first. Heroes tend to act based on player number at first, unless delaying, skipping or being influced by buffs or debuffs when their turn to act comes.<br>
Offense - influences the output damage. If an ability performs area of effect damage and it hits multiple hexagons of a medium or large unit, then the damage will be higher, but not doubled or trippled.<br>
Defense - is responsible for damage reduction. Larger units can take amplified damage from abilities that have an area of effect, by basically having a percentage of their defense being ignored, so be aware of this.<br>
Movement - each unit can move a certain amount of hexagons every turn. It can do so in multiple actions performed and even before, in between and after using abilities. There are also abilities that can affect the mobility of the unit without requiring movement points, so make sure you use them to position strategically.
</p>

<p>
<b>Masteries</b><br>
There are 9 common types of damages that can be either reduced or amplified, provided the specific unit has one or more abilities involving that mastery: pierce, slash, crush, shock, burn, frost, poison, sonic and mental. The defense and offense stats are generic when it comes to reduction or amplifications, like the following formula shows: ability damage + attack damage * (offense stat of the attacker - defense stat of the attacked unit / number of hexagons hit + source stat of attacker - source stat of defender) / 100. Minimum damage is 1. There is also a rare type of Pure damage that can't be reduced. Both stats and masteries can be affected by abilities, hovering on each one in the unit cards ingame will display a list of the buffs and debuffs affecting it.
</p>
</div>

<div class="div">
<div id="adventure"><a href="#adventure"><h3 class="center">Adventure</h3></a></div><br>
Similar to a campaign scenario, but with more options and can also be played along / against other players or bots.
<!-- TODO: talk about heroes, city building, adventure mode, dwellings, gathering resources, relics and plasma -->
</div>

<div class="div">
<div id="campaign"><a href="#campaign"><h3 class="center">Campaign</h3></a></div><br>
<p>You go through several scenarios where you need to accomplish certain goals. You'll be able to travel on an adventure map, aquire resources, build a city and battle lots of foes.</p>

<p>
<b>The Polymorphic Potion</b><br>
You received intelligence from trusty sources that a doctor is attempting to achieve the holy grail of alchemy, allowing the experimenting pacients to partially shape shift limbs for a limited amount of time, this also includes changing the elemental matter as desired, for example transforming a flesh hand into a metallic mace at will. It's only a matter of time until he'll perfect the formula, possibly being able to allow complete transformations indefinitely or being able to change size drastically, God knows whatever else would be possible. This potion be the closest thing to immortality and no doubt many will kill for just a sip in order to achieve such demonic powers. Will you pursure the potion for yourself or destroy it? The temptation is infinite.
</p>

</div>

<?php include("../footer.php"); ?>
