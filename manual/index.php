<?php
$page_title = "Ancient Beast - Manual";
$style = "
.iconz {
	width: 110px;
	height: 110px;
}
";
include("../header.php");
echo $start_div; ?>
<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$sections = array("info", "demands", "plot", "gameplay", "locations", "development", "license");
foreach ($sections as &$sectionItem) {
	echo "<td><center><a href='#$sectionItem' class='lighten'><img src='$sectionItem.png' width='120' height='120' style='display:block;'>".ucfirst($sectionItem)."</a></center></td>";
}
?>
</tr></table></nav>
<?php echo $separator; ?>
<article>
<a name="info">I. <b><u>Info</u></b></a>
<p>
<b>Ancient Beast</b>, is a 2D turn based strategy game played online against other people, featuring 7 distinctive realms that contain a wide variety of creatures to master or defeat, each with it's own unique and exciting set of skills and abilities, all brought to life by nicely crafted cg graphics.
</p>
<p>
Ancient Beast is free open source and it's developed by <a href="http://www.FreezingMoon.org" target="_blank"><b>Freezing Moon</b></a> (and community) using web coding languages such as HTML, PHP and javascript in order to be playable right from modern browsers on pretty much any operating system and hardware, without having to download and install any plugins.<br>
It was carefuly designed to be easy to learn, fun to play and hard to master. We hope you'll enjoy it!
</p>
<?php echo $separator; ?>
<a name="demands">II. <b><u>Demands</u></b></a>
<ul>
<li>a modern browser with HTML 5 support and Javascript enabled</li>
<li>500mhz Processor</li>
<li>256mb RAM</li>
<li>128mb Video Card with HD capability (recommended)</li>
<li>HD display (recommended)</li>
<li>controller (keyboard and/or mouse, gamepad or multi touch screen)</li>
<li>broadband internet connection (required)</li>
<li>200mb HDD for cache (optional)</li>
<li>stereo speakers (optional)</li>
</ul>
<?php echo $separator; ?>
<a name="plot">III. <b><u>Plot</u></b></a>
<p>
It's the year 2653. In the last centuries, technology advanced exponentially up to the point that pretty much everyone had a fair chance at playing God. With help from the <a href="http://reprap.org/" target="_blank"><b>RepRap</b></a> project, a free desktop 3d printer, anyone could build it's own weapon factory or genetic laboratory right in his own garrage or backyard. Having mechanic parts or genetic modifications turned from a fashion option into a requirement for survival.
</p><p>
Despite their combined efforts, the world's governments couldn't prevent the world from plunging into chaos. The Earth has become a battlefield; split between 7 factions fighting for dominion over the ravaged landscape. The apocalypse is here, and only the strongest will survive.
</p>
<?php echo $separator; ?>
<a name="gameplay">IV. <b><u>Gameplay</u></b></a>
<p>
In order to play Ancient Beast, you'll needed a <a href="http://www.freezingmoon.org/account" target="_blank"><b>FreezingMoon</b></a> account. After logging in, you'll be offered a level 1 creature to get you started and you'll have access to the adventure map, which has 49 locations you can fight at. When you go to a location, you're shown other players already there, which you can challenge or accept challenges from. Fights take place between two sides, up to five players each, the challenger party being showed at the left side of the combat field, which is 18x11 hexes. Based on the difficulty of the fight, you can win gold coins, which can be spent in the shop in order to buy creatures, items, outfits and avatars.
</p>
<img src="combat.jpg" style="width:100%;">
<table width=100%><tr style="text-align:center; vertical-align:top;">
	<td width=30%><b>Creature slots</b><br>Based on your mana points, you can summon and control up to 7 creatures</td>
	<td width=40%><b>Status bar</b><br>Displays combat and chat logs and also shows information about things</td>
	<td width=30%><b>Creature abilities</b><br>Displays the abilities of the active creature, the last one allowing you to skip turn</td>
</tr></table>
<p>
Players are represented on the combat field by skeletons and can be customized by purchasing outfits, which can influence the stats of their summoned creatures.
Players can level up by gaining experience on the combat field, gaining 1 more mana point each level, being able to summon more and/or better creatures. In order to summon a creature you own, it takes a number of mana points equal to the creature's level. Summoning a creature multiple times duplicates it's equiped items and raises it's required mana points by 1 each time for the duration of the combat. When fighting players of lower levels, you will temporarely lose mana points in order to balance the fight.
</p>
<p>
After engaging in combat, players are taken to the battle field where both parties take turns to summon up to seven creatures each. One creature is required, if player can and chooses to summon more later one, by doing so he'll lose the turn of the current creature, but he can have the advantage of summoning more suitable creatures based on the situation of the combat.
</p>
<p>
<b>Health:</b> A raw number representing the amount of damage a creature can take until it dies.<br>
<b>Regrowth:</b> Amount of health which gets restored to the creature every round.<br>
<b>Fatigue:</b> While a creature is bellow this amount of health, it's becomes fatigued and unable to move.<br>
<b>Energy:</b> Doing any action, including moving, drains energy from the creature.<br>
<b>Meditation:</b> Creature gains back this amount of energy points every round.<br>
<b>Delay:</b> Creatures with smaller delay always get to act first.<br>
<b>Offense:</b> Influences the damage output of attacks.<br>
<b>Defense:</b> Protects the creature by reducing incoming damage.<br>
<b>Inventory:</b> Each creature can equip up to 6 items, which have an impact on it's stats and/or masteries.<br>
Each item requires a certain number of available inventory points in order to be equiped, therefore some creatures are more item dependant than others.<br>
<b>Masteries</b> can have an impact on the effectiveness of the creature's abilities and can also help reduce incoming damage and even protect the creature from harmfull effects.
</p>
<?php echo $separator; ?>
<a name="locations">V. <b><u>Locations</u></b></a>
<p>
The world has been divided into equal regions, one for each of the deadly sins which suit it's inhabitants the most.
Every region has 7 locations where combat can take place.
</p>
<div style="text-align:center; width:506px; margin-left:auto; margin-right:auto;">
<img id="sins" src="sins.png" usemap="#sins" border="0" width="506" height="527">
<map id="_sins" name="sins">
<area shape="poly" coords="203,176,301,175,351,260,302,348,199,349,151,261" href="#Avarice" title="Avarice">
<area shape="poly" coords="354,88,453,86,505,175,454,261,355,258,304,173" href="#Envy" title="Envy">
<area shape="poly" coords="51,265,149,262,203,350,149,436,50,436,0,349" href="#Gluttony" title="Gluttony">
<area shape="poly" coords="353,261,454,262,505,350,453,435,352,440,304,349" href="#Lust" title="Lust">
<area shape="poly" coords="201,2,302,2,352,87,302,173,203,171,153,88" href="#Pride" title="Pride">
<area shape="poly" coords="50,89,152,90,202,174,150,258,51,262,0,175" href="#Sloth" title="Sloth">
<area shape="poly" coords="201,350,301,350,355,437,301,524,203,524,152,436" href="#Wrath" title="Wrath">
</map></div>
<br>
<center><a name="Avarice"><b>Avarice</b></a></center>
<img src="../realms/avarice.jpg" title="Avarice">
<p>
They like to aquire all sorts of useless things and riches by all means possible.
</p>
<p>
Located in the middle, consists of old city scapes, with wrecked buildings and streets filled with anarchy.
</p>
<center><b>Envy</b></a></center>
<img src="../realms/envy.jpg" title="Envy">
<p>
The creatures living in this realm always feel rather insecure about themselves and they hate it when others have more or are better in some ways.
</p>
<p>
It's located to the West side and it mainly consists of deserts and cannyons.
</p>
<center><a name="Gluttony"><b>Gluttony</b></a></center>
<img src="../realms/gluttony.jpg" title="Gluttony">
<p>
Overcrowded place where all sorts of beasts and plants eat each other as soon as they get a chance.
</p>
<p>
In the east side, where the jungles are really tall and wilde, not even the sun's waves don't go through. Beware of the vegetation as well and don't pet any animals!
</p>
<center><a name="Lust"><b>Lust</b></a></center>
<img src="../realms/lust.jpg" title="Lust">
<p>
All the creatures around here suffer from pyromancy and have burning desire to incinerate everything within reach and turn to ashes.
</p>
<p>
North side. Volcanoes spread all across this land, which is usually covered by ashes or solid magma, while rivers of hot magma run by, so beware your step and keep in mind that the air rather toxic.
</p>
<center><a name="Pride"><b>Pride</b></a></center>
<img src="../realms/pride.jpg" title="Pride">
<p>
They're above everyone else. Literally at least.
</p>
<p>
Hundred of years ago, some of the population, mainly the rich, tried separating themselves from the rest, so they built floating fortresses.
</p>
<center><a name="Sloth"><b>Sloth</b></a></center>
<img src="../realms/sloth.jpg" title="Sloth">
<p>
They don't bother doing much besides survival.
</p>
<p>
South area. This place is all water. Since it's so cold over here, large portions of water are constantly frozen and covered with snow, serving as home for some of the creatures.
</p>
<center><a name="Wrath"><b>Wrath</b></a></center>
<img src="../realms/wrath.jpg" title="Wrath">
<p>
The beasts from this realm enjoy killing and inflicting suffering on others.
</p>
<p>
Underwold. Back in the day there used to be underground secret facilities that where used for God forbidden experiments regarding genetics and bio weapons.
</p>
<?php echo $separator; ?>
<a name="development">VI. <b><u>Development</u></b></a>
<br>
<br>
<b>Pipeline</b>
<p>
The project is developed with the use of free open source cross platform applications and freeware services.
<a href="http://wuala.com" target="_blank"><b>Wuala</b></a> comes in very handy when working with files collaboratively. You can find our group over <a href="http://wuala.com/AncientBeast" target="_blank"><b>here</b></a> which contains all the project's assets and sources, while <a href="https://github.com/FreezingMoon/AncientBeast" target="_blank"><b>Github</b> handles the code part and stores the final assets.
<a href="http://blender.org" target="_blank"><b>Blender</b></a> is being used for creating most of the assets, such as structures and creatures and their animations, which are prerendered into sprites and sprite-sheets as well as for other tasks.<br>
<a href="http://mypaint.intilinux.com" target="_blank"><b>My Paint</b></a> along with <a href="http://gimp.org" target="_blank"><b>Gimp</b></a> are being used for icons, concept art, texturing and the creation of some of the battle grounds.
<a href="http://al.chemy.org" target="_blank"><b>Alchemy</b></a> can be a very useful tool for finding inspiration when creating creature artwork.
</p>
<table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
$tools = array("github"=>"https://github.com/FreezingMoon/AncientBeast", "wuala"=>"http://www.wuala.com/AncientBeast/", "blender"=>"http://blender.org", "gimp"=>"http://gimp.org", "mypaint"=>"http://mypaint.intilinux.com", "alchemy"=>"http://al.chemy.org");
foreach ($tools as $toolName => $toolLink) {
	echo "<td><a href='$toolLink' target='_blank' class='lighten'><img src='$toolName.png' style='display:block;'>".ucfirst($toolName)."</a></td>";
}
?>
</tr></table>
<br>
<b>Sprite sheets</b>
<br>
<p>
For putting together sprite sheets, you can use <a href="http://www.ImageMagick.org" target="_blank"><b>ImageMagick</b></a>, a CLI tool that allows for various operations. If you're not familiar with command line interfaces, no worries, bellow you can see how easy it is by following an example. There are also several GUI's for ImageMagick, but they won't be covered in this documentation.<br>
On the official website you can find binaries for most popular operating systems, except Ubuntu linux distro. Chances are that if you're using Ubuntu, ImageMagick is already installed, if not, you can easly download and install the tool from the Software Center or from Terminal, using the following command:
</p>
<code>sudo apt-get install imagemagick</code>
<br>
<p>
The operation for putting together sprite sheets using ImageMagick is called "Montage". If we are to render an animation in blender, the PNG format is needed for the output, with the ARGB option enabled. Blender will output a series of images, having the filenames from <i>0001.png</i>, up to the last frame number, which is calculated by: frame range * fps.
</p>
<code>montage * -tile x8 -geometry 256x256+0+0 -background None -quality 100 output.png</code>
<br>
<p>
The game is best played at a HD resolution of 1920x1080, in case your screen uses a lower resolution, the game should accomodate by rescaling. Battlegrounds and other screens that are not made out of tiles will be created at the same HD resolution.
</p>
<p>
Multiplayer will be done with <a href="http://en.wikipedia.org/wiki/WebSocket">WebSocket</a> or using IRC server.
</p>
<?php echo $separator; ?>
<a name="license">VII. <b><u>License</u></b></a><br>
<br>
<table border=1><tr>
<td><a href="http://www.FreezingMoon.org" target="_blank"><img src="FreezingMoon.png"></a></td><td>Ancient Beast name and logo are trademarks of Freezing Moon.<br>Respect the developers and their work!</td>
</tr><tr>
<td><a href="http://creativecommons.org/licenses/by-sa/3.0/" target="_blank"><img src="cc-by-sa.png"></a></td><td>Artwork and audio can be remixed and shared under the same license, provided you credit the project, foundation and/or author provided.</td>
</tr><tr>
<td><a href="http://www.gnu.org/licenses/gpl-3.0.html" target="_blank"><img src="gpl.png"></a></td><td>The codebase or parts of it can be remixed and shared under the same license, provided you credit the project and/or foundation.</td>
</tr></table>
</article>
<?php echo $end_div . $the_end; ?>
