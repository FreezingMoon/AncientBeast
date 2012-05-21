<?php $page_title = "Ancient Beast - Donate";
$style = "
.title {
	font-size: 24px;
	font-family: Charlemagnestd;
}";
require_once("../header.php");
start_segment(); ?>
in progress
<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
<input type="hidden" name="cmd" value="_s-xclick">
<input type="hidden" name="hosted_button_id" value="XXXPC6NDXBNTW">
<input type="image" src="<?php echo $site_root; ?>donate/paypal.png"  name="submit" alt="PayPal - The safer, easier way to pay online!">
<img alt=""  src="https://www.paypal.com/en_US/i/scr/pixel.gif" style="width: 1px; height: 1px; display:none;"></form>
<!--
- pp donate button
- montly donation button
- flattr button
- budget (what we need money for)
- widget with donnors; total/montly amount of $ received

-->
<? separate_segment();?>
<p id="bitcoin" class="center">
<iframe width="560" height="315" src="http://www.youtube.com/embed/Um63OQz3bjo" frameborder="0" allowfullscreen></iframe></p>
<p class="center">Feel free to send your <a href="http://www.bitcoin.org" style="font-weight: bold;"><img src="bitcoin.ico"> bitcoin</a> donation over at:</p>
<p class="center" style="font-weight: bold;">1Gpa3NKn8nR9ipXPZbwkjYxqZX3cmz7q97</p>
<p class="center">Any amount we receive helps us reaching our goals. We thank you!</p>
<!-- total/montly amount of bitcoins received -->
<?php
end_segment();
end_page();
?>
