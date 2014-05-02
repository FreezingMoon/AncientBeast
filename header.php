<?php require_once('global.php'); ?>
<!doctype html>
<html>
<head>
<link rel="stylesheet" href="<?php echo $site_root; ?>stylesheet.css">
<meta charset="utf-8">
<meta name="google-site-verification" content="uNVUkWjGPKwXaFK-BkOowVezLve8a8rjbM_ew1UHiZg">
<meta name="description" content="Turn Based Strategy Game. Master your beasts!">
<meta name="keywords" content="ancientbeast, ancient, beast, game, online, multiplayer, strategy, bitcoin, bets, combat, arena, chess, cards, creatures, free, open source, foss">
<meta name="author" content="Dread Knight">

<?php
if (isset($style)) echo '<style type="text/css">' . $style . '</style>';
if (isset($stylesheet)) echo '<link rel="stylesheet" href="' . $stylesheet . '">';
?>
<link rel="alternate" type="application/rss+xml" title="Ancient Beast Blog (RSS 2.0)" href="<?php echo $site_url; ?>blog/feed/" />

<!--set page title-->
<title>
<?php
if (isset($page_title)) echo $page_title;
else echo "AncientBeast - Turn Based Strategy Game";
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
if($_SESSION['id'] != 0) { ?>
<span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>profile">Account</a></span>
<span style="position: absolute; margin-left: 359px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>index.php?action=logout">Logout</a></span>

<?php } else { ?>
<span style="position: absolute; margin-left: -423px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>register.php">Register</a></span>
<span style="position: absolute; margin-left: 366px; padding-top: -20px; text-shadow: 0.1em 0.1em 0.1em black, 0 0 0.7em black;"><a href="<?php echo $site_root; ?>login.php">Login</a></span>
<?php } ?>

<!--banner-->
<header id="header">
<div style="margin-top: -5px; margin-bottom: 50px;">
<a href="<?php echo $site_root; ?>"><img src="<?php echo $site_root; ?>images/AncientBeast.png" height="125" width="555" alt="Ancient Beast" class="lighten"></a>
<!--navigation menu-->
<nav><table style="font-size:18px; font-weight:bold; margin:0; padding:0; margin-left:auto; margin-right:auto; text-align:center;"><tr>
<?php
  $menu = array('units', 'media', 'items', 'play', 'blog', 'chat');
  foreach ($menu as &$menuItem) {
    echo '<td>
      <a href="' . $site_root . $menuItem . '" id="' . $menuItem . '" style="display:block;" class="lighten">
      <img alt=" ' . ucfirst($menuItem) . '" src="' . $site_root . 'images/icons/' . $menuItem . '.png" width="90" height="90"><br>
      ' . ucfirst($menuItem) . '</a></td>';
  } 
?>
</tr></table></nav>
</div>
</header>

<!--main area-->
<div id="scroll"><a href="#"><img src="<?php echo $site_root; ?>images/AB.gif" height="32" width="32" alt="top"><br>Top</a></div>
<div id="wrapper">

