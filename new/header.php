<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2012  Valentin Anastase (a.k.a. Dread Knight)
 *
 * This file is part of Ancient Beast.
 *
 * Ancient Beast is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * Ancient Beast is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * http://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

require_once('global.php'); ?>
<!doctype html>
<html>
<head>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8">
<meta name="google-site-verification" content="uNVUkWjGPKwXaFK-BkOowVezLve8a8rjbM_ew1UHiZg">
<meta name="description" content="Turn Based Strategy Game Played Online Against Other People. Master your beasts!">
<meta name="keywords" content="ancientbeast, ancient, beast, game, online, multiplayer, TBS, PvP, strategy, combat, arena, free, foss, open source, card, chess, creatures, bitcoin, bets">
<meta name="author" content="Dread Knight">

<script type="application/javascript" src="/utils/tinybox.js"></script>
<script type="text/javascript" >
var site_root = "<?php echo 'http://'.$_SERVER['SERVER_NAME'].$site_root; ?>";
</script>

<link rel="alternate" type="application/rss+xml" title="Ancient Beast Blog (RSS 2.0)" href="<?php echo $site_url; ?>blog/feed/" />

<!--set page title-->
<title>
<?php
  if (isset($page_title)) {
	  echo $page_title;
  }
  else {
  	echo "AncientBeast - Online PvP TBS Game";
  }
?>
</title>
    
<link rel="stylesheet" href="<?php echo $site_root; ?>new/stylesheet.css">
<link rel="stylesheet" href="<?php echo $site_root; ?>combat/css/grid.css">
<?php
  if (isset($style)) {
  	echo '<style type="text/css">' . $style . '</style>';
  }
  if (isset($stylesheet)) {
	  echo '<link rel="stylesheet" href="' . $stylesheet . '">';
  } 
?>
<!--flattr-->
<script type="application/javascript" src="http://api.flattr.com/js/0.6/load.js?mode=auto"></script>
<!--jquery-->
<script type="application/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
<!--pixastic-->
<script type="application/javascript" src="<?php echo $site_root; ?>utils/pixastic.js"></script>
<script type="application/javascript" src="<?php echo $site_root; ?>utils/lighten.js"></script>
<script type="application/javascript">
$(document).ready(function(){
	$('.lighten').each(function(){
		$(this).mouseenter(function() {
			var c = Pixastic.process($('img', this).get(0), "lighten", {amount:0.4});
			$(this).mouseleave(function() {
				Pixastic.revert(c);
			});
		});
	});
});
</script>
<!--google analytics-->
<script type="text/javascript">
var _gaq = _gaq || [];
_gaq.push(['_setAccount', 'UA-2840181-5']);
_gaq.push(['_trackPageview']);

(function() {
	var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
	ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
	var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
</script>
</head>
<!--logged out
<span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="#register" onclick="TINY.box.show({url:'/profile/register.php',post:'id=16',width:200,height:160,opacity:40,topsplit:5})">Register</a></span>
<span style="position: absolute; margin-left: 366px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="#login" onclick="TINY.box.show({url:'/profile/login.php',post:'id=16',width:200,height:280,opacity:40,topsplit:5})">Login</a></span>
-->
<!--logged in-->
<!-- <span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="/profile">Account</a></span>
<span style="position: absolute; margin-left: 366px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="#login" onclick="TINY.box.show({url:'/profile/logout.php',post:'id=16',width:200,height:240,opacity:40,topsplit:5})">Logout</a></span>-->

<body>
<!--banner-->
<nav id="header"><ul class="center">
<!--navigation menu-->
<?php
  $menu = array('bestiary', 'shop', 'game', 'media', 'blog', 'chat');
  foreach ($menu as &$menuItem) {
    echo '<li><a href="' . $site_root . 'new/' . $menuItem . '" id="' . $menuItem . '">' . strtoupper($menuItem) . '</a></li>';
  } 
?>
</ul></nav>

<!--main area-->
<div id="wrapper">
<a href="<?php echo $site_root; ?>new"><img src="/images/AB.gif" height=64 width=64 alt="Ancient Beast"><img src="/images/AncientBeast.png" height=64></a>
