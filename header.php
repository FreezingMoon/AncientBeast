<?php
/* Ancient Beast - Free Open Source Online PvP TBS: card game meets chess, with creatures.
 * Copyright (C) 2007-2014  Valentin Anastase (a.k.a. Dread Knight)
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
 * https://www.AncientBeast.com
 * https://github.com/FreezingMoon/AncientBeast
 * DreadKnight@FreezingMoon.org
 */

require_once('global.php'); ?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=960">
<link rel="stylesheet" href="<?php echo $site_root; ?>stylesheet.css">
<link rel="icon" type="image/png" href="<?php echo $site_root; ?>favicon.png">
<meta name="google-site-verification" content="uNVUkWjGPKwXaFK-BkOowVezLve8a8rjbM_ew1UHiZg">
<meta name="description" content="3d print your squad of creatures with unique abilities in order to defeat your enemies.">
<meta name="keywords" content="ancientbeast, ancient, beast, game, online, multiplayer, strategy, bitcoin, bets, combat, arena, chess, cards, creatures, free, open source, foss">
<meta name="author" content="Dread Knight">

<?php
if (isset($style)) echo '<style type="text/css">' . $style . '</style>';
if (isset($stylesheet)) echo '<link rel="stylesheet" href="' . $stylesheet . '">';
?>

<!--set page title-->
<title>
<?php
$title = "Ancient Beast - ";
if (isset($page_title)) echo $title . $page_title;
else echo $title . "Turn Based Strategy Game";
?>
</title>
<!--google analytics-->
<script>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');
ga('create', 'UA-2840181-5', 'ancientbeast.com');
ga('require', 'displayfeatures');
ga('send', 'pageview');
</script>
</head>

<body>
<?php
if(isset($_SESSION['id'])) { ?>
<span class="account" style="margin-left: -423px;"><a href="<?php echo $site_root; ?>account" id="Account">Account</a></span>
<span class="account" style="margin-left: 359px;"><a href="<?php echo $site_root; ?>index.php?action=logout">Logout</a></span>

<?php } else { ?>
<span class="account" style="margin-left: -423px;"><a href="<?php echo $site_root; ?>account/register" id="Register" class="alpha">Register</a></span>
<span class="account" style="margin-left: 366px;"><a href="<?php echo $site_root; ?>account/login" id="Login" class="alpha">Login</a></span>
<?php }
if(isset($_GET['action']) == 'logout') {
	session_destroy();
	echo '<meta http-equiv="refresh" content="1; url=' . $site_url . '">';
 }
?>

<!-- Title Banner -->
<header id="header">
<div style="margin-top: -5px; margin-bottom: 50px;">
<a href="<?php echo $site_root; ?>"><img src="<?php echo $site_root; ?>images/AncientBeast.png" height="125" width="555" alt="Ancient Beast" class="lighten"></a>
<!-- Navigation Menu -->
<nav><table style="font-size: 18px; font-weight: bold; margin: 0; padding: 0; margin-left: auto; margin-right: auto; text-align: center;"><tr>
<?php
  $menu = array('units', 'media', 'shop', 'play', 'blog', 'chat');
  foreach ($menu as &$menuItem) {
    echo '<td>
      <a href="' . $site_root . $menuItem . '/" id="' . ucfirst($menuItem) . '" style="display:block;" class="lighten">
      <img alt=" ' . ucfirst($menuItem) . '" src="' . $site_root . 'images/icons/' . $menuItem . '.png" width="90" height="90"><br>
      ' . ucfirst($menuItem) . '</a></td>';
  } 
?>
</tr></table></nav>
</div>
</header>

<!-- Main Area -->
<div id="scroll"><a href="#"><img src="<?php echo $site_root; ?>images/AB.gif" height="32" width="32" alt="top"><br>Top</a></div>
<div id="wrapper">

