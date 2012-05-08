<?php $page_title = "Ancient Beast - Gallery";
require_once("../header.php"); ?>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="text/javascript" src="jquery.fancybox-1.3.4.pack.js"></script>
<script type="text/javascript" src="jquery.easing-1.3.pack.js"></script>
<script type="text/javascript" src="jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="jquery.fancybox-1.3.4.css" type="text/css" media="screen" />
<script type="text/javascript">
$(document).ready(function() {
	var basePage = window.location.href.replace(/#.*/, "");
	$("a[rel=pop]").fancybox({
		'overlayColor'  : 'black',
		'transitionIn'	: 'elastic',
		'transitionOut'	: 'elastic',
		'onComplete'	: function(array, index) {
			history.replaceState("", "", basePage + "#id=" + index);
		},
		'onClosed'		: function() {
			history.replaceState("", "", basePage);
		}
	});
	
	if (/[\#&]id=(\d+)/.test(location.hash))
		$("#img" + RegExp.$1).trigger("click");
});
</script>
<?php
start_segment();
echo "<center>";
$images = scandir("../artwork");
$i = 0;
foreach($images as $image) {
	if($image == "." || $image == "..") continue;
	$title = substr($image, 0, -4); 
	echo "<a id='img{$i}' style='text-align:center;' rel='pop' href='../artwork/$image' title='$title'><img style='height:200px; margin:5px;' src='../artwork/$image' title='$title'></a>";
	$i++;
} echo "</center>";
end_segment();
end_page();
?>
