<?php $page_title = "Ancient Beast - Gallery";
include("../header.php"); ?>
<script type="text/javascript" src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.1/jquery.min.js"></script>
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
echo $start_div . "<center>";
$images = scandir("artwork");
foreach($images as $image) {
	if($image == "." || $image == "..") continue;
	$title = substr($image, 0, -4); 
	echo "<a style='text-align:center;' rel='pop' href='artwork/$image' title='$title'><img style='height:200px; margin:5px;' src='artwork/$image' title='$title'></a>";
} echo "</center>" . $end_div . $the_end; ?>

