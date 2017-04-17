var time = time || {};	
    
time.getTimer = function (number) {
    return str.zfill(Math.floor(number / 60), 2) + ":" + str.zfill(number % 60, 2);
}
        