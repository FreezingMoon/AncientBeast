<?php
require_once("global.php");
if(!(isset($_GET["head"]) && ($_GET["head"] == "1"))) { ?>
<!doctype html>
<html>
<head>
<?php } ?>
<!--set page title-->
<title><?php
if (isset($page_title)) {
	echo $page_title;
}
else {
	echo "Ancient Beast";
}?></title>
<link rel="stylesheet" href="<?php echo $WorkingDir; ?>stylesheet.css">
<?php
if (isset($style)) {
	echo "<style>$style</style>";
}
if (isset($stylesheet)) {
	echo "<link rel='stylesheet' href='$stylesheet'>";
} ?>
<!--flattr-->
<script type="text/javascript" src="http://api.flattr.com/js/0.6/load.js?mode=auto"></script>
<!--jquery-->
<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.6.2/jquery.min.js"></script>
<!--pixastic-->
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/pixastic.js"></script>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>utils/lighten.js"></script>
<script type="text/javascript">
$(document).ready(function(){
	$('.lighten').each(function(){
		$(this).mouseover(function() {
			var c = Pixastic.process($('img', this).get(0), "lighten", {amount:0.4});
			$(c).mouseout(function(){
                Pixastic.revert(c);
            });
		});
	});
});
</script>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8">
<meta name="description" content="Turn Based Strategy Game Played Online Against Other People. Master your beasts!">
<meta name="keywords" content="game, online, TBS, RPG, strategy, arena, free, foss, open source, 2d, animation">
<meta name="author" content="Dread Knight"><?php if(!(isset($_GET["head"]) && ($_GET["head"] == "1"))) { ?>
</head>
<body>
<?php
include_once("analytics.php");
$start_div = "<div class='frame_upper'></div><div class='frame_middle'>";
$end_div = "</div><div class='frame_lower'></div>";
$separator = $end_div . $start_div;
$the_end = "</body></html>";
?>
<!--banner-->
<header id="header">
<div style="margin-top: -15px; margin-bottom: 50px;"><a href="<?php echo $WorkingDir; ?>"><img src="<?php echo $WorkingDir; ?>images/AncientBeast.png" alt="Ancient Beast"></a>
<!--navigation menu-->
<?php include_once("navigation/index.php") ?>
</div>
</header>

<!--main area-->
<div id="wrapper">
<?php } ?>
