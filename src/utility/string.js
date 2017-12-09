// Zfill like in python
export function zfill(num, size) {
    var s = "000000000" + num;
    return s.substr(s.length - size);
}