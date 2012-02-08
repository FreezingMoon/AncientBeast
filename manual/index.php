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
$sections = array("info", "demands", "plot", "gameplay", "factions", "development", "license");
foreach ($sections as &$sectionItem) {
	echo "<td><center><a href='#$sectionItem' class='lighten'><img src='$sectionItem.png' width='120' height='120' style='display:block;'>".ucfirst($sectionItem)."</a></center></td>";
}
?>
</tr></table></nav>
<?php echo $separator; ?>
<article>
<a name="info">I. <b><u>Info</u></b></a>
<p>
<b>Ancient Beast</b>, commonly abreviated <b>AB</b>, is an online multiplayer game, a hybrid combining turn based strategy with role-playing elements, based on an exciting dark fantasy universe infused with mythology, featuring 7 distinctive realms containing a wide variety of creatures to master or defeat, each with it's own unique and exciting set of skills and upgrades, all brought to life by nicely crafted rendered 3d graphics.
</p>
<p>
Ancient Beast is developed using web programming languages such as HTML 5 and javascript/jquery in order to be playable right from any modern browser on pretty much any operating system and hardware, without having to download and install any plugins. It was carefuly designed to be easy to learn and fun.
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
In order to play Ancient Beast, besides meeting the minimum requirements, you'll also needed a <a href="http://www.freezingmoon.org/account" target="_blank"><b>FreezingMoon</b></a> account. After logging in with your account, you'll have to pick a server, choose a faction (sin) and name your hero.
Each game server only hosts a defined number of players that will play an unique game world for a limited period of time, depending on victory conditions.
</p>
<p>
Players will use their hero in order to explore the game world and collect resources or fight foes. Fights take place in a special combat screen, which has some similarities with a chess game: combatants start of on opposite sides and get to control other creatures besides their heroes (in case they have one), also, the combat is based on a square grid and each combatant takes turns to make a move.
A combat arena has about 12x10 square tiles.
</p>
<img src="combat.jpg" style="width:100%;">
<p>
Creatures and heroes that die in battle remain dead and usually leave a corpse or some remains behind, that can be used for their ressurection or for other purposes.
</p>
<p>
Resources can be used for crafting, trading, evolving creatures or building a settlement.
Settlements can act as respawn points for players, also they can help training or evolving creatures, assists with resurrection of creatures or even provide creatures and lots of other things.
</p>
<p>
//talk about heroes, skills, creatures, items, castles, combat, resources
</p>
<?php echo $separator; ?>
<a name="factions">V. <b><u>Factions</u></b></a>
<p>
//talk about how the world has been structured/divided
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
<center><a name="Avarice"><img src="../font/A.png" title="Avarice"><b>varice</b></a></center>
<img src="../realms/avarice.jpg" title="Avarice">
<p>
They like to aquire all sorts of useless things and riches by all means possible.
</p>
<p>
Located in the middle, consists of old city scapes, with wrecked buildings and streets filled with anarchy.
</p>
<center><a name="Envy"><img src="../font/E.png" title="Envy"><b>nvy</b></a></center>
<img src="../realms/envy.jpg" title="Envy">
<p>
The creatures living in this realm always feel rather insecure about themselves and they hate it when others have more or are better in some ways.
</p>
<p>
It's located to the West side and it mainly consists of deserts and cannyons.
</p>
<center><a name="Gluttony"><img src="../font/G.png" title="Gluttony"><b>luttony</b></a></center>
<img src="../realms/gluttony.jpg" title="Gluttony">
<p>
Overcrowded place where all sorts of beasts and plants eat each other as soon as they get a chance.
</p>
<p>
In the east side, where the jungles are really tall and wilde, not even the sun's waves don't go through. Beware of the vegetation as well and don't pet any animals!
</p>
<center><a name="Lust"><img src="../font/L.png" title="Lust"><b>ust</b></a></center>
<img src="../realms/lust.jpg" title="Lust">
<p>
All the creatures around here suffer from pyromancy and have burning desire to incinerate everything within reach and turn to ashes.
</p>
<p>
North side. Volcanoes spread all across this land, which is usually covered by ashes or solid magma, while rivers of hot magma run by, so beware your step and keep in mind that the air rather toxic.
</p>
<center><a name="Pride"><img src="../font/P.png" title="Pride"><b>ride</b></a></center>
<img src="../realms/pride.jpg" title="Pride">
<p>
They're above everyone else. Literally at least.
</p>
<p>
Hundred of years ago, some of the population, mainly the rich, tried separating themselves from the rest, so they built floating fortresses.
</p>
<center><a name="Sloth"><img src="../font/S.png" title="Sloth"><b>loth</b></a></center>
<img src="../realms/sloth.jpg" title="Sloth">
<p>
They don't bother doing much besides survival.
</p>
<p>
South area. This place is all water. Since it's so cold over here, large portions of water are constantly frozen and covered with snow, serving as home for some of the creatures.
</p>
<center><a name="Wrath"><img src="../font/W.png" title="Wrath"><b>rath</b></a></center>
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
//transparent background or unique color; write about resolution for sprites and levels
</p>
<?php echo $separator; ?>
<a name="license">VII. <b><u>License</u><b></a>
<p>
Ancient Beast name is copyrighted by Valentin Anastase.
</p>
<p>
Artwork and audio can redistributed, shared and reused, as long as they're not intended for any commercial purpose, provided you credit the project, foundation and/or author provided (creative commons license: attribution, share alike, non commercial).
</p>
<p>
The codebase or parts of it can be reused or redistributed, provided you credit the project and/or foundation (GPL license).
</p>
<p>
<b>Disclaimer!</b> The Freezing Moon Foundation has a certain amount of financial interest in the project in order to ensure it's proper course and evolution. Despite having it's awesome sides, game development is none the less a very slow, demanding and painfull creative process. Respect!
</p>
</article>
<?php echo $end_div . $the_end; ?>

