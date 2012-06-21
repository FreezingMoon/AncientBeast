<?php $page_title = "Ancient Beast - Gallery";
require_once("../header.php"); ?>
<script type="application/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="application/javascript" src="fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="application/javascript" src="fancybox/jquery.easing-1.3.pack.js"></script>
<script type="application/javascript" src="fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen" />
<script type="application/javascript">
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
separate_segment(); ?>
<center><iframe width="880" height="495" src="http://www.youtube.com/embed/videoseries?list=PLC179DAED0274E304&amp;hl=ro_RO" frameborder="0" allowfullscreen></iframe></center>
<?php separate_segment();
include("../utils/disqus.php");
end_segment();
end_page(); ?>
