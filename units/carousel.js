$(function() {
	// This will hold the JSON array of all units
	var units;
	// Total items in the carousel (needs to be odd)
	var carouselLength = 7;
	// Essentially, the amount on each side after you remove the middle
	var modValue = (carouselLength - 1) / 2;

	// Get the units data as an array
	$.getJSON("data.json", function(results) {
		// Set the global var
		units = results;
		// Draw the carousel
		drawCarousel();
		// Preload all the images
		preloadImages(units);
		// Add an EL for any carousel divs
		// It's important to note that the element is bound to document on purpose
		// Since the events are on DOM elements not added at runtime, we have to do this
		$(document).on("click", ".carouselAvatar", function(e) {
			selectedUnit = $(e.target).data("id");
			updateCarousel();
			updateCard(selectedUnit);
		});

	});

	function drawCarousel() {
		clearCarousel();
		// Start at -mod
		var i = modValue * -1;
		// Go until positive mod, should result in carouselLength iterations
		while (i <= modValue) {
			// Grabs a spot from the unit array
			var index = Math.abs((units.length + selectedUnit + i) % units.length);
			// Add in the div we'll build on
			var unitDiv = document.createElement("div");
			// Add the class and data id (index)
			$(unitDiv).addClass("carouselAvatar");
			$(unitDiv).data("id", index);
			// Add in the background images
			$(unitDiv).css("background", "url('" + siteUrl + "images/frame.png'), url('../game/deploy/units/avatars/" + units[index].name + ".jpg')");
			// Add it to the carousel
			$("#carousel").append(unitDiv);
			i++;
		}
	}

	function updateCarousel() {
		var i = modValue * -1;
		$(".carouselAvatar").each(function(index) {
			// Grabs a spot from the unit array
			var unitIndex = Math.abs((units.length + selectedUnit + i) % units.length);
			// Add in the data id
			$(this).data("id", unitIndex);
			// Add in the background images
			$(this).css("background", "url('" + siteUrl + "images/frame.png'), url('../game/deploy/units/avatars/" + units[unitIndex].name + ".jpg')");
			i++;
		});
	}

	function clearCarousel() {
		// Remove all the data from the carousel and that's about it
		$("#carousel").html("");
	}

	function preloadImages(unitArr) {
		var images = [];
		var i = 0;
		while (i < unitArr.length) {
			images[i] = new Image();
			images[i].src = "../game/deploy/units/avatars/" + unitArr[i].name + ".jpg";
			i++;
		}
	}

	function updateCard(unitIndex) {
		// Set the unit to the selected unit
		var unit = units[unitIndex];
		// Update side A
		$(".sideA").css("background-image", "url('" + siteUrl + "images/cards/margin.png'), url('" + siteUrl + "game/deploy/units/artwork/" + unit.name + ".jpg')");
		$(".sideA .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin" + unit.type.substring(0, 1));
		$(".sideA .type").text(unit.type);
		$(".sideA .name").text(unit.name);
		$(".sideA .hexs").html(unit.size + "&#11041;");
		// Update side B
		$(".sideB").css("background-image", "url('" + siteUrl + "images/cards/margin.png'), url('" + siteUrl + "images/cards/" + unit.type.substring(0, 1) + ".jpg')");
		for (var property in unit.stats) {
			if (unit.stats.hasOwnProperty(property)) {
				var stat = ".sideB ." + property + " .value";
				$(stat).text(unit.stats[property]);
			}
		}
	}
});
