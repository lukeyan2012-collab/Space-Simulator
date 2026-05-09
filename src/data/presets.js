import { G } from '@/physics/constants.js';

const AU = 1.496e11;
const M_SUN = 1.989e30;
const orbitalV = (a) => Math.sqrt(G * M_SUN / a);

export const PRESETS = {
  empty: () => [],

  inner_planets: () => [
    { id: 'sun',     position: [0,0,0], velocity: [0,0,0] },
    { id: 'mercury', position: [0.387*AU, 0, 0], velocity: [0, 0, -orbitalV(0.387*AU)] },
    { id: 'venus',   position: [0.723*AU, 0, 0], velocity: [0, 0, -orbitalV(0.723*AU)] },
    { id: 'earth',   position: [1.000*AU, 0, 0], velocity: [0, 0, -orbitalV(1.000*AU)] },
    { id: 'mars',    position: [1.524*AU, 0, 0], velocity: [0, 0, -orbitalV(1.524*AU)] },
  ],

  jupiter_system: () => [
    { id: 'jupiter',  position: [0, 0, 0],       velocity: [0, 0, 0] },
    { id: 'io',       position: [4.22e8, 0, 0],  velocity: [0, 0, -17334] },
    { id: 'europa',   position: [6.71e8, 0, 0],  velocity: [0, 0, -13740] },
    { id: 'ganymede', position: [1.07e9, 0, 0],  velocity: [0, 0, -10880] },
    { id: 'titan',    position: [1.22e9, 0, 0],  velocity: [0, 0, -8500]  },
  ],

  solar_system: () => {
    const order = ['mercury','venus','earth','mars','jupiter','saturn','uranus','neptune'];
    const semiMajorAU = [0.387, 0.723, 1.000, 1.524, 5.203, 9.537, 19.191, 30.069];
    return [
      { id: 'sun', position: [0,0,0], velocity: [0,0,0] },
      ...order.map((id, i) => {
        const a = semiMajorAU[i] * AU;
        return { id, position: [a, 0, 0], velocity: [0, 0, -orbitalV(a)] };
      }),
    ];
  },
};
