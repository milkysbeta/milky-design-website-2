/* Recompose the forest around the real page rhythm. World Y anchors come
   from the live sections: hero 0, work -3.4, Love -7.2, Villa -12.2,
   Goldy -17.2, graphic work -22.2, Lab -28.4, Studio -38.2, Contact -46. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'data', 'layout.json');
const previous = JSON.parse(fs.readFileSync(file, 'utf8'));
const source = [...previous.plants].sort((a, b) => a.seed - b.seed);

const clusters = [
  { id: 'deep left rhythm',  x: -24, z: -32, slab: 0, count: 8,  spreadX: 3,  spreadZ: 5 },
  { id: 'deep right rhythm', x:  24, z: -31, slab: 0, count: 8,  spreadX: 3,  spreadZ: 5 },
  { id: 'mid section frames',x:   0, z: -20, slab: 1, count: 14, spreadX: 16, spreadZ: 4 },
  { id: 'near accents',      x:   0, z: -11, slab: 2, count: 10, spreadX: 10, spreadZ: 2.6 },
  { id: 'front punctuation', x:   0, z:  -4, slab: 3, count: 7,  spreadX: 4.5,spreadZ: 1 }
];

const plans = [
  {
    y: [-2.6, -8.6, -14.7, -20.8, -26.9, -33.0, -39.4, -45.5],
    x: [-23.2, -25.0, -22.8, -25.2, -23.5, -25.5, -22.9, -24.8],
    scale: [9.0, 8.3, 9.6, 8.0, 9.2, 8.5, 9.5, 8.2]
  },
  {
    y: [-4.5, -10.7, -16.8, -23.0, -29.1, -35.2, -41.3, -47.0],
    x: [23.6, 25.0, 22.8, 24.8, 23.2, 25.4, 23.0, 24.6],
    scale: [8.6, 9.4, 8.1, 9.2, 8.4, 9.5, 8.2, 9.0]
  },
  {
    y: [-3.6, -6.0, -9.2, -11.8, -14.7, -17.1, -20.2, -23.1, -25.7, -28.7, -32.0, -35.8, -40.1, -44.7],
    x: [-14.2, 14.8, 15.2, -14.6, -15.0, 14.3, 15.1, -14.1, -15.3, 14.7, 15.0, -14.5, -15.2, 14.4],
    scale: [5.6, 4.8, 5.2, 5.9, 4.7, 5.5, 5.1, 6.0, 4.8, 5.7, 5.0, 5.8, 4.9, 5.5]
  },
  {
    y: [-4.4, -8.8, -13.1, -17.7, -22.0, -26.5, -31.0, -35.4, -40.2, -44.8],
    x: [8.1, -8.5, 8.7, -8.0, -8.8, 8.2, 8.8, -8.3, -8.7, 8.1],
    scale: [3.7, 3.2, 4.0, 3.4, 4.2, 3.3, 4.1, 3.5, 3.9, 3.4]
  },
  {
    /* Rare close leaves punctuate gaps, never the centre of a project film. */
    y: [-4.8, -10.0, -18.9, -24.6, -32.7, -43.9, -47.4],
    x: [3.55, -3.75, 3.65, -3.55, 3.82, 3.66, -3.62],
    scale: [2.55, 2.35, 2.7, 2.4, 2.65, 2.35, 2.42]
  }
];

let cursor = 0;
const plants = [];
plans.forEach((plan, cluster) => {
  const bed = clusters[cluster];
  plan.y.forEach((y, index) => {
    const template = { ...source[cursor++ % source.length] };
    const crownX = plan.x[index];
    const unit = ((template.seed % 1009) / 1008) - 0.5;
    template.cluster = cluster;
    template.ox = +(crownX - bed.x).toFixed(2);
    template.oy = +(y + unit * 0.32).toFixed(2);
    template.oz = +(unit * bed.spreadZ * 1.1).toFixed(2);
    template.scale = +(plan.scale[index] * (0.96 + Math.abs(unit) * 0.09)).toFixed(2);
    template.lean = +(Math.sign(crownX) * -(0.34 + Math.abs(unit) * 0.30)).toFixed(3);
    template.n = 3 + ((template.seed >>> 5) % 3);
    plants.push(template);
  });
});

fs.writeFileSync(file, JSON.stringify({ clusters, plants }, null, 2) + '\n');
console.log(`Composed ${plants.length} plants around ${plans.reduce((sum, plan) => sum + plan.y.length, 0)} section anchors.`);
