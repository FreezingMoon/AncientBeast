<?php $page_title = "Ancient Beast - Gallery";
include("../header.php"); ?>
<script type="text/javascript" src="http://ajax.googleapis.com/ajax/libs/jquery/1.4/jquery.min.js"></script>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>gallery/fancybox/jquery.fancybox-1.3.4.pack.js"></script>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>gallery/fancybox/jquery.easing-1.3.pack.js"></script>
<script type="text/javascript" src="<?php echo $WorkingDir; ?>gallery/fancybox/jquery.mousewheel-3.0.4.pack.js"></script>
<link rel="stylesheet" href="<?php echo $WorkingDir; ?>gallery/fancybox/jquery.fancybox-1.3.4.css" type="text/css" media="screen" />
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
	$hover = substr($image, 0, -4); 
	$title = str_replace(' by', '<br>by', $hover);
	echo "<a style='text-align:center;' rel='pop' href='artwork/$image' title='$title'><img style='height:200px; margin:5px;' src='artwork/$image' title='$hover'></a>";
} echo "</center>{$end_div}{$the_end}"; ?>

