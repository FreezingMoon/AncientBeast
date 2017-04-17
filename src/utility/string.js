var str = str || {};

// Zfill like in python
str.zfill = function (num, size) {
    var s = "000000000" + num;
    return s.substr(s.length - size);
}