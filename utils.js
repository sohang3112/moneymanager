/** Convert obj to string and escape html special characters - https://stackoverflow.com/a/6234804 .
 * 
 * @param {any} obj
 * @returns {string}
*/
function escapeHtml(obj) {
    return String(obj)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Are 2 dates equal? (considering only date, ignoring time component)
 * 
 * @param {Date} d1 
 * @param {Date} d2 
 * @returns {boolean} Do d1 and d2 have same date?
 */
function equalDates(d1, d2) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
}

/** Sum an array of numbers.
 * 
 * @param {array} numbers 
 * @returns {number}
 */
function sum(numbers) {
    return numbers.reduce((x,acc) => acc + x, 0);
}

function zip(array1, array2) {    // ASSUMPTION: equal-length arrays
    return array1.map((x, index) => [x, array2[index]])
}

/** 
 * 
 * @param {array} array 
 * @param {string} field
*/
function* groupByInSortedArray(array, func) {
    let i = 0;
    while (i < array.length) {
        let property = func(array[i]);
        let group = [ array[i] ];
        for (i++; i < array.length && func(array[i]) == property; i++) group.push(array[i]);
        yield [property, group];
    }
}