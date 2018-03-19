// Zfill like in python
export function zfill(num, size) {
    let s = "000000000" + num;
    return s.substr(s.length - size);
}
