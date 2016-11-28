jQuery(document).ready(function() { 
    musicPlayer.init();
});

var musicPlayer = {
    init: function() {

        var mp = this;

        this.current = 0;
        this.audio = jQuery('#audio')[0];
        this.playlist = jQuery('#playlist');
        this.tracks = this.playlist.find('li a');

        this.repeat = true;
        this.shuffle = true;

        this.audio.volume = .25;
        this.audio.pause();

        jQuery('#mp_shuffle').addClass("active").click(function(e) {
            jQuery(this).toggleClass("active");
            mp.shuffle = !mp.shuffle;
        });

        this.playlist.find('a').click(function(e) {
            e.preventDefault();
            mp.current = jQuery(this).parent().index();
            mp.run( jQuery(this) );
        });

        this.audio.addEventListener('ended',function(e) {
            if(mp.shuffle){
                mp.playRandom();
            } else {
                mp.playNext();
            }
        });
    },

    playRandom: function() {
        do {
            var rand = Math.floor( Math.random() * ( this.tracks.length - 1 ) );
        } while(rand == this.current); // Don't play the same track twice in a row
        this.current = rand;
        var link = this.playlist.find('a')[this.current];
        this.run( jQuery(link) );
    },

    playNext: function() {
        this.current++;
        if(this.current == this.tracks.length && this.repeat) {
            this.current = 0;
        }
        var link = this.playlist.find('a')[this.current];
        this.run( jQuery(link) );
    },

    run: function(link) {
        // Style the active track in the playlist
        par = link.parent();
        par.addClass('active').siblings().removeClass('active');

        this.audio.src = link.attr("href");
        this.audio.load();
        this.audio.play();
    }

};
