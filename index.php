<? $page_title = "Ancient Beast";
include("header.php");
echo $start_div;
$realms = array('avarice', 'envy', 'gluttony', 'lust', 'pride', 'sloth', 'wrath');
$random_realm = array_rand($realms);
echo "<table style=\"background: url('/realms/$realms[$random_realm].jpg') no-repeat center top; height: 400px;\">"; ?>
<tr><td width=25%><center>
		<form action="https://www.paypal.com/cgi-bin/webscr" method="post">
		<input type="hidden" name="cmd" value="_s-xclick">
		<input type="hidden" name="hosted_button_id" value="FU5PCMX33AVJE">
		<input type="image" src="/images/paypal.png"  name="submit" alt="PayPal - The safer, easier way to pay online!">
		<img alt=""  src="https://www.paypal.com/en_US/i/scr/pixel.gif" style="width: 1px; height: 1px; display:none;"></form><br><br><br><br>
	<a class="FlattrButton" style="display:none;" href="http://www.AncientBeast.com"></a><br><br><br><br><br>
	<script type="text/javascript" src="http://apis.google.com/js/plusone.js"></script><g:plusone size="tall"></g:plusone>
</center></td><td width=50%><center>
<iframe width="480" height="360" src="http://www.youtube.com/embed/KBS03PBHtqQ?rel=0" frameborder="0" allowfullscreen></iframe></center>
</td><td width=25%><center>
	<a href='http://www.facebook.com/AncientBeast' target='_blank'><img src='/images/facebook.png' class='lighten'></a><br><br><br><br><br>
	<a href='http://twitter.com/AncientBeast' target='_blank'><img src='/images/twitter.png' class='lighten'></a><br><br><br><br><br>
	<a href='http://feeds.feedburner.com/AncientBeast' target='_blank'><img src='/images/rss.png' class='lighten'></a>
</center></td></tr></table>
<? echo $separator; ?>
<p style="text-align:justify; margin-right:4px;">
<span class="bold">Ancient Beast</span> is a video game that combines turn based strategy and role-playing along with mini-games of other genres. It is based on an exciting dark fantasy universe infused with mythology, featuring 7 distinctive realms containing a wide variety of creatures for you to master or defeat, each with it's own unique and exciting set of skills, upgrades and evolutions, all brought to life by nicely crafted prerendered 3d graphics.
</p>
<? echo $end_div . $the_end; ?>
