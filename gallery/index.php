
<?php $page_title = "Ancient Beast - Gallery";
include("../header.php"); ?>
<script>
	!window.jQuery && document.write('<script src="http://ancientbeast.com/gallery/jquery-1.4.3.min.js"><\/script>');
</script>
<script type="text/javascript" src="http://ancientbeast.com/gallery/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="text/javascript" src="http://ancientbeast.com/gallery/fancybox/jquery.easing-1.3.pack.js"></script>
<script type="text/javascript" src="http://ancientbeast.com/gallery/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="http://ancientbeast.com/gallery/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen" />
	<script type="text/javascript">
		$(document).ready(function() {
			$("a[rel=pop]").fancybox({
				'overlayColor'  : 'black',
				'transitionIn'	: 'elastic',
				'transitionOut'	: 'elastic'
			});
});
</script>
<?php
echo $start_div;
$images = scandir("artwork");
$x = 0;
echo "<table style='margin-left:-18px;'><tr>";
foreach($images as $image) {
	if($image == "." || $image == "..") continue;
	$title = substr($image, 0, -4); 
	echo "<td height=128 width=128 style='text-align:center;'><a rel='pop' href='artwork/$image' title='$title'><img style='max-height:128px; max-width:128px;' src='artwork/$image' title='$title'></a></td>";
	$x++;
	if($x % 7 == 0) echo "</tr><tr>";
} echo "</tr></table>$end_div" . $the_end; ?>

