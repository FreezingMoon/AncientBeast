<?php require_once('global.php'); ?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="google-site-verification" content="uNVUkWjGPKwXaFK-BkOowVezLve8a8rjbM_ew1UHiZg">
<meta name="description" content="Turn Based Strategy Game. Master your beasts!">
<meta name="keywords" content="ancientbeast, ancient, beast, game, online, multiplayer, strategy, bitcoin, bets, combat, arena, chess, cards, creatures, free, open source, foss">
<meta name="author" content="Dread Knight">

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
  	echo "AncientBeast - Turn Based Strategy Game";
  }
?>
</title>
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
<div id="scroll"><a href="#top"><img src="<?php echo $site_root; ?>images/AB.gif" height="32" width="32" alt="top"><br>Top</a></div>
<div id="wrapper">

