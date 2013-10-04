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
<link type="text/css" rel="stylesheet" href="//cdn.jsdelivr.net/hint.css/1.3.0/hint.min.css" />
<link rel="stylesheet" href="<?php echo $site_root; ?>stylesheet.css">
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
<?php
if($_SESSION['id'] != 0) { ?>
 <span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>profile">Account</a></span>
<span style="position: absolute; margin-left: 359px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>index.php?action=logout">Logout</a></span>

<?php } else { ?>
<span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>register.php">Register</a></span>
<span style="position: absolute; margin-left: 366px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>login.php">Login</a></span>

<?php } ?>

<body id="top">
<!--banner-->
<header id="header">
<div style="margin-top: -5px; margin-bottom: 50px;"><a href="<?php echo $site_root; ?>"><img src="<?php echo $site_root; ?>images/AncientBeast.png" height="125" width="555" alt="Ancient Beast"></a>
<!--navigation menu-->
<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
  $menu = array('bestiary', 'shop', 'media', 'game', 'blog', 'chat');
  foreach ($menu as &$menuItem) {
    echo '<td>
      <a href="' . $site_root . $menuItem . '" id="' . $menuItem . '" class="lighten">
      <img alt=" ' . ucfirst($menuItem) . '" src="' . $site_root . 'images/icons/' . $menuItem . '.png" width="90" height="90" style="display:block;">
      ' . ucfirst($menuItem) . '</a></td>';
  } 
?>
</tr></table></nav>
</div>
</header>

<!--main area-->
<div id="scroll"><a href="#top"><img src="<?php echo $site_root; ?>images/AB.gif" height="32" width="32" alt="top"><br>Top</a></div>
<div id="wrapper">

