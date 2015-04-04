$(function() {
	// Get the units data as an array
	$.getJSON("data.json", function(units) {
		// Select URL defined unit or a random one to spice things up
		var selected = Math.floor(Math.random()*units.length);
		// Change the avatars, always showing the focused unit in middle
		function carousel() {
            $('#carousel').html('');
			for(var i = -3; i<=3; i++) {
				var number = Math.abs((units.length+selected+i)%units.length);
				var name = units[number].name;
				var style = 'style="background: url(\'../images/frame.png\'), url(\'avatars/'+name+'.jpg\'); height: 128px; width: 128px; display: inline-block;"';
                var $div = $('<div '+style+'></div>').css('cursor', 'pointer');
                $div.click(update.bind(null, number));
				$("#carousel").append($div);
			}
		};
		function update(number) {
			selected = number;
			carousel();
		};
		carousel();
			// Show the cards for the selected unit, progress indicator
			// If new avatar is clicked, repeat the whole process and also update the URL to match
			// Bonus: Page title and disqus commenting system could also match the selected unit
			// Note: It's hard to do PHP's ksort algorithm inside javascript, so use type sorting
	});
});
