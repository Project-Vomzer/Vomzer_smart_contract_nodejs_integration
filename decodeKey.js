const base64 = "APexj/m4RoqUS/w/W23aOO7dEdl9wvgT1H9+xkeXN+ja";
const buffer = Buffer.from(base64, 'base64');
const hex = buffer.toString('hex');
console.log(hex);
