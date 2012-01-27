<? if(!(isset($_GET["head"]) && ($_GET["head"] == "1"))) { ?>
<!doctype html>
<html>
<head>
<? } ?>
<!--set page title-->
<title><?
if (isset($page_title)) {
	echo $page_title;
}
else {
	echo "Ancient Beast";
}?></title>
<link rel="stylesheet" href="/stylesheet.css">
<?
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
<script type="text/javascript" src="/utils/pixastic.js"></script>
<script type="text/javascript" src="/utils/lighten.js"></script>
<script type="text/javascript">
$(document).ready(function(){
	$('.lighten').each(function(){
		$(this).mouseover(function() {
			var c = Pixastic.process($('img', this).get(0), "lighten", {amount:0.4});
			$(this).mouseout(function(){ Pixastic.revert(c); });
		});
	});
});
</script>
<meta http-equiv="Content-Type" content="text/html;charset=utf-8">
<meta name="description" content="Fantasy TBS RPG">
<meta name="keywords" content="free, foss, games, blender, 3d, animation, online, TBS, RPG, adventure, fun, open source, ubuntu, linux, homm, disciples, cross platform, multiplayer, tactics, arena">
<meta name="author" content="Dread Knight"><? if(!(isset($_GET["head"]) && ($_GET["head"] == "1"))) { ?>
</head>
<body>
<?
include_once("analytics.php");
include_once("connect.php");
$start_div = "<div class='frame_upper'></div><div class='frame_middle'>";
$end_div = "</div><div class='frame_lower'></div>";
$separator = $end_div . $start_div;
$the_end = "</body></html>";
?>
<!--banner-->
<header id="header">
<div style="margin-top: -15px; margin-bottom: 50px;"><a href="http://www.AncientBeast.com"><img src="/images/AncientBeast.png" alt="Ancient Beast"></a>
<!--navigation menu-->
<? include_once("menu/index.php") ?>
</div>
</header>

<!--main area-->
<div id="wrapper">
<? } ?>
