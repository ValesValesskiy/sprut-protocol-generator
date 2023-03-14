function Enum(obj) {
    obj.__enumkeys__ = [];

    for(let k in obj) {
        obj[obj[k]] = obj[k];
        obj.__enumkeys__[obj[k]] = k;
    }
}

function Counter(start = 0) {
    const counter = function (value) {
        counter.value = (value != undefined && value > counter.value) ? value : counter.value;

        return counter.value++;
    }

    counter.value = start;

    return counter;
}

module.exports = {
    Enum,
    Counter
}